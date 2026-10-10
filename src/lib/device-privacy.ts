import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {DynamoDBDocumentClient,GetCommand,PutCommand,QueryCommand,DeleteCommand} from '@aws-sdk/lib-dynamodb';
const db=DynamoDBDocumentClient.from(new DynamoDBClient({endpoint:process.env.SMARTDETECTOR_DYNAMODB_ENDPOINT}));
const memory=new Map<string,{removed:boolean;cutoff:number}>();
export const devicePrivacyKey=(org:string,id:string)=>({pk:'ORG#'+org,sk:'DEVICE_PRIVACY#'+id});
export async function devicePrivacy(org:string,id:string){const key=devicePrivacyKey(org,id);return process.env.SMARTDETECTOR_TABLE?(await db.send(new GetCommand({TableName:process.env.SMARTDETECTOR_TABLE,Key:key,ConsistentRead:true}))).Item as {removed:boolean;cutoff:number}|undefined:memory.get(key.pk+key.sk)}
export async function markDeviceRemoved(org:string,id:string){const key=devicePrivacyKey(org,id),value={removed:true,cutoff:Date.now()};if(process.env.SMARTDETECTOR_TABLE)await db.send(new PutCommand({TableName:process.env.SMARTDETECTOR_TABLE,Item:{...key,...value}}));else memory.set(key.pk+key.sk,value);}
export async function restoreDevice(org:string,id:string){const key=devicePrivacyKey(org,id),old=await devicePrivacy(org,id);if(!old)return;const value={removed:false,cutoff:old.cutoff};if(process.env.SMARTDETECTOR_TABLE)await db.send(new PutCommand({TableName:process.env.SMARTDETECTOR_TABLE,Item:{...key,...value}}));else memory.set(key.pk+key.sk,value);}
export async function assertDeviceHistory(org:string,id:string,at?:string){const privacy=await devicePrivacy(org,id);if(privacy&&(privacy.removed||at!==undefined&&Date.parse(at)<=privacy.cutoff))throw Error('Device removed or history deleted');}
export async function deleteDeviceHistory(org:string,id:string){
 const table=process.env.SMARTDETECTOR_TABLE;if(!table)throw Error('Persistent history store required');let deleted=0;
 for(const partition of [{pk:'ORG#'+org,prefix:'INCIDENT#'},{pk:'ORG#'+org,prefix:'RINGJOB#'},{pk:'ORG#'+org+'#NODE#'+id,prefix:'EVENT#'}]){
  let cursor:Record<string,unknown>|undefined;do{const page=await db.send(new QueryCommand({TableName:table,KeyConditionExpression:'pk=:pk AND begins_with(sk,:prefix)',ExpressionAttributeValues:{':pk':partition.pk,':prefix':partition.prefix},ExclusiveStartKey:cursor,ConsistentRead:true}));
   for(const row of page.Items??[]){const jobDevice=row.event?.deviceId;if(partition.prefix==='INCIDENT#'&&row.serverId!==id)continue;if(partition.prefix==='RINGJOB#'){const {createHash}=await import('node:crypto');if(typeof jobDevice!=='string'||'ring-'+createHash('sha256').update(jobDevice).digest('hex').slice(0,24)!==id)continue}await db.send(new DeleteCommand({TableName:table,Key:{pk:row.pk,sk:row.sk}}));deleted++}cursor=page.LastEvaluatedKey;
  }while(cursor)
 }return deleted;
}
