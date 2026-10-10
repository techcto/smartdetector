import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {DynamoDBDocumentClient,GetCommand,PutCommand} from '@aws-sdk/lib-dynamodb';
import {encryptSecret,decryptSecret} from './providers';

export const integrationFields={
 ring:{clientId:false,clientSecret:true,hmacKey:true},
 firetv:{applicationId:false},
 bedrock:{modelId:false,region:false},
 alexa:{skillId:false,clientId:false,clientSecret:true},
} as const;
export type SystemIntegration=keyof typeof integrationFields;
const db=DynamoDBDocumentClient.from(new DynamoDBClient({endpoint:process.env.SMARTDETECTOR_DYNAMODB_ENDPOINT}));
const memory=new Map<string,Record<string,string>>();
const key=(provider:string)=>({pk:'SYSTEM#INTEGRATIONS',sk:provider});
async function stored(provider:SystemIntegration):Promise<Record<string,string>>{
 if(!process.env.SMARTDETECTOR_TABLE)return memory.get(provider)??{};
 return (await db.send(new GetCommand({TableName:process.env.SMARTDETECTOR_TABLE,Key:key(provider),ConsistentRead:true}))).Item?.settings??{};
}
export async function systemIntegration(provider:SystemIntegration){
 const values=await stored(provider);
 return Object.fromEntries(Object.entries(values).map(([field,value])=>[field,(integrationFields[provider] as Record<string,boolean>)[field]?decryptSecret(value,`system:${provider}:${field}`):value]));
}
export async function publicSystemIntegration(provider:SystemIntegration){
 const values=await stored(provider);
 return Object.fromEntries(Object.entries(integrationFields[provider]).map(([field,secret])=>[field,secret?!!values[field]:values[field]??'']));
}
export async function saveSystemIntegration(provider:SystemIntegration,input:Record<string,unknown>){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!Object.hasOwn(integrationFields[provider],k)))throw Error('Invalid configuration fields');
 const values={...await stored(provider)};
 for(const [field,secret] of Object.entries(integrationFields[provider])){
  const value=input[field];if(value===undefined||value==='')continue;
  if(typeof value!=='string'||value.length>4096||!value.trim())throw Error('Invalid configuration value');
  if(field==='region'&&!/^[a-z]{2}(?:-gov)?-[a-z]+-\d$/.test(value.trim()))throw Error('Invalid AWS region');
  values[field]=secret?encryptSecret(value.trim(),`system:${provider}:${field}`):value.trim();
 }
 if(provider==='ring'&&['clientId','clientSecret','hmacKey'].some(f=>!values[f]))throw Error('All three Ring app credentials are required');
 if(process.env.SMARTDETECTOR_TABLE)await db.send(new PutCommand({TableName:process.env.SMARTDETECTOR_TABLE,Item:{...key(provider),settings:values,updatedAt:new Date().toISOString()}}));else memory.set(provider,values);
}
