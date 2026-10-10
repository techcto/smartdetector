import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {DynamoDBDocumentClient,GetCommand,PutCommand} from '@aws-sdk/lib-dynamodb';
import {encryptSecret,decryptSecret} from './providers';
type Config={url:string;encryptedKey:string};
let memory:Config|null=null;
const key={pk:'SYSTEM#SERVICES',sk:'AUTOVISION'},scope='system:autovision:api-key';
const db=DynamoDBDocumentClient.from(new DynamoDBClient({endpoint:process.env.SMARTDETECTOR_DYNAMODB_ENDPOINT}));
async function stored():Promise<Config|null>{const table=process.env.SMARTDETECTOR_TABLE;if(!table)return memory;return(await db.send(new GetCommand({TableName:table,Key:key,ConsistentRead:true}))).Item as Config??null;}
export async function visionConfig(){const v=await stored();return {url:v?.url??process.env.SMARTDETECTOR_AUTOVISION_URL??'https://autovision.dev',apiKey:v?.encryptedKey?decryptSecret(v.encryptedKey,scope):process.env.SMARTDETECTOR_AUTOVISION_API_KEY?.trim()??'',managedBy:v?'admin':'deployment'};}
export async function saveVisionConfig(url:string,apiKey:string){
 const parsed=new URL(url);if(parsed.username||parsed.password||parsed.search||parsed.hash||parsed.pathname!=='/'||!(parsed.protocol==='https:'||parsed.protocol==='http:'&&['localhost','127.0.0.1','autovision-api'].includes(parsed.hostname)))throw Error('Use an HTTPS service origin, or a supported local development origin');
 if(typeof apiKey!=='string'||apiKey.length>4096)throw Error('Invalid API key');
 const old=await stored(),value=apiKey.trim()||(old?.encryptedKey?decryptSecret(old.encryptedKey,scope):process.env.SMARTDETECTOR_AUTOVISION_API_KEY?.trim());if(!value)throw Error('API key required');
 const v={url:parsed.origin,encryptedKey:encryptSecret(value,scope)};
 if(process.env.SMARTDETECTOR_TABLE)await db.send(new PutCommand({TableName:process.env.SMARTDETECTOR_TABLE,Item:{...key,...v}}));else memory=v;
}
