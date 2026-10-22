import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {DynamoDBDocumentClient,GetCommand,PutCommand,QueryCommand,DeleteCommand,TransactWriteCommand} from '@aws-sdk/lib-dynamodb';
import {devicePrivacyKey} from './device-privacy';
const table=process.env.SMARTDETECTOR_TABLE;
const db=DynamoDBDocumentClient.from(new DynamoDBClient({endpoint:process.env.SMARTDETECTOR_DYNAMODB_ENDPOINT}),{marshallOptions:{removeUndefinedValues:true}});
const cutoffs=new Map<string,number>();
const key=(org:string)=>({pk:'ORG#'+org,sk:'HISTORY_PRIVACY'});
export const memoryHistoryCutoff=(org:string)=>cutoffs.get(org)??0;
export async function historyCutoff(org:string){if(!table)return memoryHistoryCutoff(org);return Number((await db.send(new GetCommand({TableName:table,Key:key(org),ConsistentRead:true}))).Item?.cutoff??0)}
export async function writeHistory(org:string,at:string,item:Record<string,unknown>){
 const time=Date.parse(at);if(!Number.isFinite(time))throw Error('Invalid history timestamp');
 await db.send(new TransactWriteCommand({TransactItems:[{ConditionCheck:{TableName:table!,Key:key(org),ConditionExpression:'attribute_not_exists(#cutoff) OR #cutoff < :time',ExpressionAttributeNames:{'#cutoff':'cutoff'},ExpressionAttributeValues:{':time':time}}},...(typeof item.serverId==='string'?[{ConditionCheck:{TableName:table!,Key:devicePrivacyKey(org,item.serverId),ConditionExpression:'(attribute_not_exists(#removed) OR #removed=:false) AND (attribute_not_exists(#cutoff) OR #cutoff<:time)',ExpressionAttributeNames:{'#removed':'removed','#cutoff':'cutoff'},ExpressionAttributeValues:{':false':false,':time':time}}}]:[]),{Put:{TableName:table!,Item:item}}]}));
}
export async function markHistoryPurge(org:string){const cutoff=Date.now();if(table){try{await db.send(new PutCommand({TableName:table,Item:{...key(org),cutoff},ConditionExpression:'attribute_not_exists(#c) OR #c < :c',ExpressionAttributeNames:{'#c':'cutoff'},ExpressionAttributeValues:{':c':cutoff}}))}catch(e){if(!(e instanceof Error&&e.name==='ConditionalCheckFailedException'))throw e;return historyCutoff(org)}}else cutoffs.set(org,Math.max(cutoff,memoryHistoryCutoff(org)));return cutoff}
export async function deleteStoredHistory(org:string,nodeIds:string[],cutoff:number){
 if(!table)throw Error('Persistent history store required');
 // Detached devices no longer appear in inventory, but their retained events
 // still belong to a later history purge or account deletion.
 const ids=new Set(nodeIds);let privacyCursor:Record<string,unknown>|undefined;
 do{const page=await db.send(new QueryCommand({TableName:table,KeyConditionExpression:'pk=:pk AND begins_with(sk,:prefix)',ExpressionAttributeValues:{':pk':'ORG#'+org,':prefix':'DEVICE_PRIVACY#'},ConsistentRead:true,ExclusiveStartKey:privacyCursor}));for(const row of page.Items??[])ids.add(String(row.sk).slice('DEVICE_PRIVACY#'.length));privacyCursor=page.LastEvaluatedKey;}while(privacyCursor);
 let deleted=0;
 const partitions=[{pk:'ORG#'+org,prefix:'INCIDENT#'},{pk:'ORG#'+org,prefix:'RINGJOB#'},...[...ids].map(id=>({pk:'ORG#'+org+'#NODE#'+id,prefix:'EVENT#'}))];
 for(const {pk,prefix} of partitions){let cursor:Record<string,unknown>|undefined;do{const page=await db.send(new QueryCommand({TableName:table,KeyConditionExpression:'pk=:pk AND begins_with(sk,:prefix)',ExpressionAttributeValues:{':pk':pk,':prefix':prefix},ConsistentRead:true,ExclusiveStartKey:cursor}));
  for(const row of page.Items??[]){const field=prefix==='RINGJOB#'?'event':prefix==='INCIDENT#'?'startedAt':'at',time=prefix==='RINGJOB#'?Number(row.event?.timestamp):Date.parse(row[field]);if(!Number.isFinite(time)||time<=cutoff){try{await db.send(new DeleteCommand({TableName:table,Key:{pk:row.pk,sk:row.sk},ConditionExpression:row[field]===undefined?'attribute_not_exists(#stamp)':'#stamp=:stamp',ExpressionAttributeNames:{'#stamp':field},...(row[field]===undefined?{}:{ExpressionAttributeValues:{':stamp':row[field]}})}));deleted++}catch(e){if(!(e instanceof Error&&e.name==='ConditionalCheckFailedException'))throw e}}}
  cursor=page.LastEvaluatedKey;
 }while(cursor)}return deleted;
}
