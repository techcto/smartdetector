import {BatchGetCommand, QueryCommand, type BatchGetCommandOutput, type DynamoDBDocumentClient} from '@aws-sdk/lib-dynamodb';
import type {IncidentRecord} from './model';
import {evidenceVisible} from './image-retention';

export const incidentIndexes = [
  {IndexName:'IncidentsByTime',KeySchema:[{AttributeName:'tenantId',KeyType:'HASH'},{AttributeName:'incidentTime',KeyType:'RANGE'}],Projection:{ProjectionType:'KEYS_ONLY'}},
  {IndexName:'IncidentsByDevice',KeySchema:[{AttributeName:'incidentDevice',KeyType:'HASH'},{AttributeName:'incidentTime',KeyType:'RANGE'}],Projection:{ProjectionType:'KEYS_ONLY'}},
] as const;

export function incidentIndexKeys(row: Pick<IncidentRecord,'tenantId'|'serverId'|'incidentId'|'startedAt'>) {
  const time=Date.parse(row.startedAt);
  if(!Number.isFinite(time))throw Error('Invalid incident timestamp');
  return {incidentTime:new Date(time).toISOString()+'#'+row.incidentId,incidentDevice:JSON.stringify([row.tenantId,row.serverId])};
}

type Options={deviceId?:string;limit?:number;days:number};
// Sparse, key-only indexes keep image payloads out of the ordered lookup. Fetch
// only bounded batches of canonical rows, where retention and deletion are authoritative.
export async function queryIncidents(db:DynamoDBDocumentClient,table:string,org:string,{deviceId,limit=50,days}:Options) {
  if(!Number.isInteger(limit)||limit<1||limit>1000)throw Error('Invalid incident limit');
  const rows:IncidentRecord[]=[];
  let cursor:Record<string,unknown>|undefined,bytes=0,pages=0;
  do {
    const page=await db.send(new QueryCommand({
      TableName:table,IndexName:deviceId?'IncidentsByDevice':'IncidentsByTime',
      KeyConditionExpression:(deviceId?'incidentDevice':'tenantId')+'=:org',
      ExpressionAttributeValues:{':org':deviceId?JSON.stringify([org,deviceId]):org},
      ScanIndexForward:false,ExclusiveStartKey:cursor,Limit:Math.min(25,limit-rows.length),
    }));
    const keys=(page.Items??[]).map(row=>({pk:row.pk,sk:row.sk}));
    if(keys.length) {
      const found=new Map<string,IncidentRecord>();
      let pending:Record<string,unknown>[]|undefined=keys;
      for(let attempt=0;pending?.length;attempt++) {
        if(attempt===5)throw Error('Incident reads throttled; retry');
        if(attempt)await new Promise(resolve=>setTimeout(resolve,Math.random()*50*2**attempt));
        const batch:BatchGetCommandOutput=await db.send(new BatchGetCommand({RequestItems:{[table]:{Keys:pending,ConsistentRead:true}}}));
        for(const row of batch.Responses?.[table]??[])found.set(row.sk as string,row as IncidentRecord);
        pending=batch.UnprocessedKeys?.[table]?.Keys;
      }
      // BatchGet does not preserve index ordering. Canonical reads prevent an
      // eventually consistent index entry from resurrecting removed evidence.
      for(const key of keys) {
        const row=found.get(key.sk as string);
        if(!row||row.tenantId!==org||deviceId&&row.serverId!==deviceId||!evidenceVisible(row,days))continue;
        rows.push(row);bytes+=Buffer.byteLength(JSON.stringify(row));
      }
    }
    cursor=page.LastEvaluatedKey;pages++;
  }while(cursor&&rows.length<limit&&pages<40&&bytes<10_000_000);
  return {rows,truncated:!!cursor};
}
