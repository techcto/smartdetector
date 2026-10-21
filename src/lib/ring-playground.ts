import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {DynamoDBDocumentClient,GetCommand,PutCommand,DeleteCommand} from '@aws-sdk/lib-dynamodb';
type RecordValue={id:string;expiresAt:number;encrypted:string;ttl:number};
const memory=new Map<string,RecordValue>();
const db=DynamoDBDocumentClient.from(new DynamoDBClient({endpoint:process.env.SMARTDETECTOR_DYNAMODB_ENDPOINT}));
const key=(org:string)=>({pk:'ORG#'+org,sk:'RING_PLAYGROUND'});
export function playgroundEnabled(env:NodeJS.ProcessEnv=process.env){
 if(env.SMARTDETECTOR_LOCAL_PLAYGROUND!=='true'||env.SMARTDETECTOR_NOTIFICATION_MODE!=='log'||(!env.SMARTDETECTOR_TABLE&&env.NODE_ENV==='production'))return false;
 try{const u=new URL(env.SMARTDETECTOR_DYNAMODB_ENDPOINT??'');return u.protocol==='http:'&&!u.username&&!u.password&&['localhost','127.0.0.1','[::1]','smartdetector-dynamodb'].includes(u.hostname);}catch{return false;}
}
export function playgroundDeadline(token:string,now=Date.now()){
 if(typeof token!=='string'||!token.trim()||token.length>16000||/\s/.test(token))throw Error('Invalid Playground token');
 let expiry=now+1800000;
 // Unverified JWT claims can only SHORTEN the local limit, never grant access.
 try{const payload=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString());if(typeof payload.exp==='number'&&Number.isFinite(payload.exp))expiry=Math.min(expiry,payload.exp*1000);}catch{/* Opaque tokens are validated by Ring, not guessed locally. */}
 if(expiry<=now+1000)throw Error('Playground token expired');return expiry;
}
export async function playgroundRecord(org:string){
 const table=process.env.SMARTDETECTOR_TABLE;
 return table?(await db.send(new GetCommand({TableName:table,Key:key(org),ConsistentRead:true}))).Item as RecordValue|undefined:memory.get(org);
}
export async function removePlaygroundToken(org:string,id:string,expiresAt?:number){
 const table=process.env.SMARTDETECTOR_TABLE;
 if(table){try{await db.send(new DeleteCommand({TableName:table,Key:key(org),ConditionExpression:'#id=:id'+(expiresAt===undefined?'':' AND #expiry=:expiry'),ExpressionAttributeNames:{'#id':'id',...(expiresAt===undefined?{}:{'#expiry':'expiresAt'})},ExpressionAttributeValues:{':id':id,...(expiresAt===undefined?{}:{':expiry':expiresAt})}}));}catch(e){if(!(e instanceof Error&&e.name==='ConditionalCheckFailedException'))throw e;}}
 else if(memory.get(org)?.id===id&&(expiresAt===undefined||memory.get(org)?.expiresAt===expiresAt))memory.delete(org);
}
export async function activePlayground(org:string,id?:string){
 if(!playgroundEnabled())return null;const row=await playgroundRecord(org);
 if(row&&row.expiresAt<=Date.now()){await removePlaygroundToken(org,row.id,row.expiresAt);return null;}
 return row&&(!id||row.id===id)?row:null;
}
export async function savePlaygroundToken(org:string,token:string,fetcher:typeof fetch=fetch){
 if(!playgroundEnabled())throw Error('Playground is disabled');
 const expiresAt=playgroundDeadline(token);
 const {RingClient}=await import('./ring');
 const document=await new RingClient(token,fetcher).devices(); // Real validation; never accept merely decoded JWTs.
 if(!Array.isArray(document.data)||!document.data.length)throw Error('No authorized cameras');
 const id='playground-local',{encryptSecret}=await import('./providers');
 const row:RecordValue={id,expiresAt,ttl:Math.floor(expiresAt/1000),encrypted:encryptSecret(token,org+':'+id)};
 if(process.env.SMARTDETECTOR_TABLE)await db.send(new PutCommand({TableName:process.env.SMARTDETECTOR_TABLE,Item:{...key(org),...row}}));else memory.set(org,row);
 return {id,expiresAt};
}
export async function playgroundAccess(org:string,id:string):Promise<Record<string,string>>{
 const row=await activePlayground(org,id);if(!row)throw Error('Playground connection expired');
 const {decryptSecret}=await import('./providers');
 return {accessToken:decryptSecret(row.encrypted,org+':'+row.id),expiresAt:String(row.expiresAt),playgroundExpiresAt:String(row.expiresAt)};
}
