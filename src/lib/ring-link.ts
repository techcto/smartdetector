import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {DynamoDBDocumentClient,QueryCommand,PutCommand,UpdateCommand,DeleteCommand} from '@aws-sdk/lib-dynamodb';
import {connectionCredentials,encryptSecret,decryptSecret,saveSetting,setting} from './providers';

type Pending={pk:string;sk:string;accountId:string;encrypted:string;ttl:number;lease:number};
type Tokens={access_token:string;refresh_token?:string;expires_in:number;expiresAt?:number};
const db=DynamoDBDocumentClient.from(new DynamoDBClient({endpoint:process.env.SMARTDETECTOR_DYNAMODB_ENDPOINT}));
const memory=new Map<string,Pending>();
const partition=(orgId:string,connectionId:string)=>`RINGLINK#${orgId}#${connectionId}`;
const scope=(orgId:string,connectionId:string,accountId:string)=>`${partition(orgId,connectionId)}:${accountId}`;
export function validRingNonce(nonce:string,time:string,accountId:string,hmacKey:string,now=Date.now()){
 if(!/^\d{13}$/.test(time)||!Number.isSafeInteger(Number(time))||Number(time)>now||now-Number(time)>600000||!/^[A-Za-z0-9_-]{43}$/.test(nonce))return false;
 const expected=createHmac('sha256',hmacKey).update(`${time}:${accountId}`).digest();
 const actual=Buffer.from(nonce,'base64url');return actual.length===expected.length&&timingSafeEqual(actual,expected);
}
async function pending(orgId:string,connectionId:string){
 const pk=partition(orgId,connectionId),table=process.env.SMARTDETECTOR_TABLE;
 const rows=table?(await db.send(new QueryCommand({TableName:table,KeyConditionExpression:'pk=:pk',ExpressionAttributeValues:{':pk':pk},ConsistentRead:true}))).Items as Pending[]|undefined:[...memory.values()].filter(r=>r.pk===pk);
 const active:Pending[]=[];
 for(const r of rows??[]){if(r.ttl*1000>Date.now())active.push(r);else await erase(r);}
 return active;
}
async function erase(row:Pending){if(process.env.SMARTDETECTOR_TABLE)await db.send(new DeleteCommand({TableName:process.env.SMARTDETECTOR_TABLE,Key:{pk:row.pk,sk:row.sk}}));else memory.delete(row.pk+row.sk);}
async function tokenRequest(fields:Record<string,string>,fetcher:typeof fetch):Promise<Tokens>{
 const r=await fetcher('https://oauth.ring.com/oauth/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(fields),redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw new Error('Ring token exchange failed. Check app credentials and use a fresh authorization code.');
 const v=await r.json();
 if(typeof v.access_token!=='string'||!v.access_token||v.access_token.length>4096||!Number.isFinite(v.expires_in)||v.expires_in<=0||v.expires_in>86400||(v.refresh_token!==undefined&&(typeof v.refresh_token!=='string'||v.refresh_token.length>4096)))throw new Error('Invalid Ring token response');
 return v;
}
export async function receiveRingCode(orgId:string,connectionId:string,code:string,fetcher:typeof fetch=fetch){
 if(typeof code!=='string'||!code.trim()||code.length>4096)throw new Error('Authorization code required');
 const config=await connectionCredentials(orgId,connectionId,'ring');
 if(!config?.clientId||!config.clientSecret||!config.hmacKey)throw new Error('Ring app credentials are not configured');
 if((await pending(orgId,connectionId)).length>=20)throw new Error('Too many pending account links. Retry after ten minutes.');
 const tokens=await tokenRequest({grant_type:'authorization_code',code,client_id:config.clientId,client_secret:config.clientSecret},fetcher);
 if(!tokens.refresh_token)throw new Error('Ring did not supply a refresh token');
 tokens.expiresAt=Date.now()+tokens.expires_in*1000;
 const r=await fetcher('https://api.amazonvision.com/v1/users/me',{headers:{Authorization:'Bearer '+tokens.access_token},redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw new Error('Unable to verify Ring account');
 const accountId=(await r.json()).data?.id;
 if(typeof accountId!=='string'||!accountId||accountId.length>200)throw new Error('Invalid Ring account response');
 const row:Pending={pk:partition(orgId,connectionId),sk:createHash('sha256').update(accountId).digest('hex'),accountId,encrypted:encryptSecret(JSON.stringify(tokens),scope(orgId,connectionId,accountId)),ttl:Math.floor(Date.now()/1000)+600,lease:0};
 if(process.env.SMARTDETECTOR_TABLE)await db.send(new PutCommand({TableName:process.env.SMARTDETECTOR_TABLE,Item:row}));else memory.set(row.pk+row.sk,row);
 // Never return OAuth credentials to the caller/browser.
 return {accepted:true};
}
export async function completeRingLink(orgId:string,connectionId:string,userId:string,nonce:string,time:string,fetcher:typeof fetch=fetch){
 const connection=await setting(orgId,connectionId),config=await connectionCredentials(orgId,connectionId,'ring');
 if(!connection||!config?.hmacKey)throw new Error('Ring connection not found');
 const row=(await pending(orgId,connectionId)).find(r=>validRingNonce(nonce,time,r.accountId,config.hmacKey));
 if(!row)throw new Error('Link expired or could not be verified. Start again from Ring.');
 const lease=Date.now()+60000;
 if(process.env.SMARTDETECTOR_TABLE)await db.send(new UpdateCommand({TableName:process.env.SMARTDETECTOR_TABLE,Key:{pk:row.pk,sk:row.sk},UpdateExpression:'SET #lease=:lease',ConditionExpression:'#lease<:now AND #ttl>:seconds',ExpressionAttributeNames:{'#lease':'lease','#ttl':'ttl'},ExpressionAttributeValues:{':lease':lease,':now':Date.now(),':seconds':Math.floor(Date.now()/1000)}}));
 else{if(row.lease>Date.now())throw new Error('Account linking is already in progress');row.lease=lease;}
 try{
  const tokens=JSON.parse(decryptSecret(row.encrypted,scope(orgId,connectionId,row.accountId))) as Tokens;
  const headers={Authorization:'Bearer '+tokens.access_token,'Content-Type':'application/json'};
  const post=await fetcher('https://api.amazonvision.com/v1/accounts/me/app-integrations',{method:'POST',headers,body:JSON.stringify({nonce,account_identifier:'SmartDetector user '+createHash('sha256').update(userId).digest('hex').slice(0,12)}),redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!post.ok)throw new Error('Ring did not accept the account link');
  const patch=await fetcher('https://api.amazonvision.com/v1/accounts/me/app-integrations',{method:'PATCH',headers,body:JSON.stringify({status:'completed'}),redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!patch.ok)throw new Error('Ring did not finalize the account link');
  await saveSetting(orgId,userId,{id:connectionId,providerKey:'ring',name:connection.name,enabled:connection.enabled,isDefault:connection.isDefault,settings:{accountId:row.accountId,accessToken:tokens.access_token,refreshToken:tokens.refresh_token??'',expiresAt:String(tokens.expiresAt??Date.now()+tokens.expires_in*1000)}});
  await erase(row);return {linked:true};
 }catch(e){
  if(process.env.SMARTDETECTOR_TABLE)await db.send(new UpdateCommand({TableName:process.env.SMARTDETECTOR_TABLE,Key:{pk:row.pk,sk:row.sk},UpdateExpression:'SET #lease=:zero',ConditionExpression:'#lease=:lease',ExpressionAttributeNames:{'#lease':'lease'},ExpressionAttributeValues:{':zero':0,':lease':lease}}));else row.lease=0;
  throw e;
 }
}
export async function ringAccess(orgId:string,connectionId:string,fetcher:typeof fetch=fetch){
 const config=await connectionCredentials(orgId,connectionId,'ring');if(!config?.accessToken)throw new Error('Link your Ring account first');
 if(!config.expiresAt||Number(config.expiresAt)>Date.now()+60000)return config;
 if(!config.refreshToken||!config.clientId||!config.clientSecret)throw new Error('Ring authorization expired. Link your account again.');
 const tokens=await tokenRequest({grant_type:'refresh_token',refresh_token:config.refreshToken,client_id:config.clientId,client_secret:config.clientSecret},fetcher);
 const existing=await setting(orgId,connectionId);if(!existing)throw new Error('Connection removed');
 await saveSetting(orgId,existing.userId,{id:connectionId,providerKey:'ring',name:existing.name,enabled:existing.enabled,isDefault:existing.isDefault,settings:{accessToken:tokens.access_token,refreshToken:tokens.refresh_token??config.refreshToken,expiresAt:String(Date.now()+tokens.expires_in*1000)}});
 return {...config,accessToken:tokens.access_token};
}
