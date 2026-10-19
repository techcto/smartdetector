import {randomUUID} from 'node:crypto';
import {store} from './store';
import {hashPassword} from './password';
import type {MembershipRole,Node,OrgType} from './model';
// Synthetic data for `npm run dev` (in-memory store) and the local docker stack (DynamoDB local).
// AWS deployments never set SMARTDETECTOR_DYNAMODB_ENDPOINT, so they are never seeded.
export const devFixturePassword='smartdetector-dev-fixture';
type Fixture={name:string;orgType:OrgType;contactEmail?:string;members:[string,string,MembershipRole][];devices:[string,string|undefined,Node['status'],number][]};
const fixtures:Fixture[]=[
 {name:'Maple Street Home',orgType:'personal',contactEmail:'home@example.com',members:[['ava.patel','Ava Patel','admin'],['leo.patel','Leo Patel','viewer']],devices:[['Front door','ring','healthy',0.1],['Backyard','ring','stale',6],['Living room TV','firetv','healthy',0.5]]},
 {name:'Harbor Cafe',orgType:'business',contactEmail:'ops@example.com',members:[['maria.gomez','Maria Gomez','admin'],['sam.lee','Sam Lee','operator']],devices:[['Entrance camera','ring','healthy',0.2],['Kitchen smoke sensor',undefined,'healthy',1],['Storage room','ring','offline',72]]},
 {name:'Northside Warehouse',orgType:'business',contactEmail:'facilities@example.com',members:[['jordan.kim','Jordan Kim','admin'],['ava.patel','Ava Patel','viewer']],devices:[['Loading dock','ring','pending',0]]},
];
function localDynamo(){try{return ['localhost','127.0.0.1','smartdetector-dynamodb'].includes(new URL(process.env.SMARTDETECTOR_DYNAMODB_ENDPOINT??'').hostname)}catch{return false}}
export const devFixturesEnabled=()=>process.env.SMARTDETECTOR_DEPLOYMENT_MODE==='saas'&&(process.env.SMARTDETECTOR_TABLE?localDynamo():process.env.NODE_ENV==='development');
export async function seedDevFixtures(){
 const g=globalThis as typeof globalThis&{smartdetectorDevFixtures?:boolean};
 if(!devFixturesEnabled()||g.smartdetectorDevFixtures)return false;
 g.smartdetectorDevFixtures=true;
 const now=Date.now(),iso=(hoursAgo:number)=>new Date(now-hoursAgo*3600000).toISOString();
 // DynamoDB local persists across restarts, so only add fixture organizations that are missing.
 const existing=new Set((await store.organizations()).map(o=>o.name)),missing=fixtures.filter(f=>!existing.has(f.name));
 for(const f of missing){
  const org=await store.createOrganization({name:f.name,ownerId:'root',orgType:f.orgType,contactEmail:f.contactEmail});
  for(const [username,displayName,role] of f.members){
   let user=await store.userByName(username);
   if(!user){user={id:randomUUID(),username,displayName,status:'active',createdAt:iso(24*30),updatedAt:iso(24*30)};await store.putUser(user,hashPassword(devFixturePassword))}
   await store.putMembership({id:randomUUID(),orgId:org.id,userId:user.id,role,status:'active',createdAt:iso(24*30),updatedAt:iso(24*30)});
  }
  for(const [name,providerKey,status,hoursAgo] of f.devices)await store.upsertNode({tenantId:org.id,serverId:'fixture-'+name.toLowerCase().replace(/[^a-z0-9]+/g,'-'),agentId:'dev-fixture',displayName:name,providerKey,platform:providerKey?undefined:'signal-api',tags:['dev-fixture'],status,createdAt:iso(24*14),lastHeartbeat:iso(hoursAgo)});
 }
 if(missing.length)console.log(`SmartDetector dev fixtures loaded: ${missing.length} organizations. Fixture users sign in with password "${devFixturePassword}".`);
 return missing.length>0;
}
