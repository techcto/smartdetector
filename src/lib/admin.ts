import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {sessionCookie,verifySession} from './session';
import {store} from './store';
import {listSettings,providers,removeSetting} from './providers';
import {listApiKeys,revokeApiKey} from './api-keys';
import {listPeople,removePerson} from './people';
import {discardRingLinks} from './ring-link';
import type {Node,Organization,SmartDetectorUser} from './model';
export const saasMode=()=>process.env.SMARTDETECTOR_DEPLOYMENT_MODE==='saas';
// Layouts are not re-rendered on every navigation, so each admin page calls this itself.
export async function rootSession(){const s=await verifySession((await cookies()).get(sessionCookie)?.value,process.env.SMARTDETECTOR_SESSION_SECRET??'');if(!s)redirect('/login');if(s.role!=='root')redirect('/settings');return s}
// Admin views expose device inventory only: never events, incidents, media, people, or provider credentials.
export type DeviceSummary={id:string;orgId:string;name:string;provider:string;status:Node['status'];connectedAt:string;lastSeen:string};
export const deviceSummary=(n:Node):DeviceSummary=>({id:n.serverId,orgId:n.tenantId,name:n.displayName,provider:providers.find(p=>p.key===n.providerKey)?.label??n.platform??'Agent',status:n.status,connectedAt:n.createdAt,lastSeen:n.lastHeartbeat});
export async function directoryDevices(){
 const orgs=await store.organizations();
 return (await Promise.all(orgs.map(async org=>(await store.nodes(org.id)).map(n=>({...deviceSummary(n),organization:org.name}))))).flat().sort((a,b)=>a.organization.localeCompare(b.organization)||a.name.localeCompare(b.name));
}
// Users are indexed by username only, so the directory is built from organization memberships.
export async function directoryUsers(){
 const users=new Map<string,{user:SmartDetectorUser;organizations:number}>();
 for(const members of await Promise.all((await store.organizations()).map(o=>store.membersOfOrg(o.id))))for(const {user} of members)users.set(user.id,{user,organizations:(users.get(user.id)?.organizations??0)+1});
 return [...users.values()].sort((a,b)=>a.user.displayName.localeCompare(b.user.displayName));
}
export const adminDate=(v?:string)=>v&&Number.isFinite(Date.parse(v))?new Date(v).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'}):'—';
// Deletion follows Cloud's admin console: show what goes with the record, confirm by typing DELETE, then remove it for real.
// Anything that would silently break billing or the operator's own workspace is refused instead (HTTP 409).
export class DeletionBlocked extends Error{}
export type DeletionImpact={name:string;type:'organization'|'user';blocker:string|null;subtext:string;related:{name:string;items:string[]}[]};
const count=(n:number,noun:string)=>n?[`${n} ${noun}${n===1?'':'s'}`]:[];
async function organizationBlocker(org:Organization){
 if(org.id===await store.singleDeploymentOrgId())return 'The operator workspace cannot be deleted.';
 if((await store.subscriptions(org.id)).some(s=>s.stripeSubscriptionId&&s.status!=='canceled'))return `${org.name} has a Stripe subscription that is not canceled. Cancel it from the location's billing page first so billing stops.`;
 return null;
}
// Members whose only locations are being deleted lose their accounts too: without a location they can neither
// sign in nor be found in the admin directory.
async function lastMembers(orgIds:string[],exceptUserId?:string){
 const gone=new Set(orgIds),users=new Map<string,SmartDetectorUser>();
 for(const id of orgIds)for(const {user} of await store.membersOfOrg(id))if(user.id!==exceptUserId)users.set(user.id,user);
 const last:SmartDetectorUser[]=[];
 for(const user of users.values())if((await store.orgsForUser(user.id)).every(m=>gone.has(m.org.id)))last.push(user);
 return last;
}
// Admin views never show people, credentials or events, so those are counted, not listed.
export async function organizationDeletion(id:string):Promise<DeletionImpact|null>{
 const org=await store.organizationById(id);if(!org)return null;
 const [members,last,nodes,keys,connections,people,blocker]=await Promise.all([store.membersOfOrg(id),lastMembers([id]),store.nodes(id),listApiKeys(id),listSettings(id),listPeople(id),organizationBlocker(org)]);
 return {name:org.name,type:'organization',blocker,subtext:'Members lose access immediately, and members who belong to no other location are deleted with it. Devices, saved events and images, people, integrations, API keys and settings are deleted too. Ring recordings and separate AutoVision jobs are not affected.',related:[{name:'Accounts deleted',items:last.map(u=>u.displayName)},{name:'Members removed (accounts kept)',items:members.filter(m=>!last.some(u=>u.id===m.user.id)).map(m=>m.user.displayName)},{name:'Devices',items:nodes.map(n=>n.displayName)},{name:'Also deleted',items:[...count(connections.length,'integration'),...count(keys.length,'API key'),...count(people.length,'person record')]}]};
}
// Access and outside connections go first (API keys, Ring and Fire TV links), then saved data, then the organization itself.
export async function deleteOrganization(id:string){
 const org=await store.organizationById(id);if(!org)return false;
 const blocker=await organizationBlocker(org);if(blocker)throw new DeletionBlocked(blocker);
 const members=await store.membersOfOrg(id);
 for(const key of await listApiKeys(id))await revokeApiKey(id,key.id);
 for(const connection of await listSettings(id)){await discardRingLinks(id,connection.id);await removeSetting(id,connection.id)}
 for(const person of await listPeople(id))await removePerson(id,person.id);
 for(const node of await store.nodes(id))await store.removeDevice(id,node.serverId);
 await store.purgeHistory(id);
 const deleted=await store.deleteOrganization(id);
 for(const {user} of members)if(!(await store.orgsForUser(user.id)).length)await store.deleteUser(user.id);
 return deleted;
}
// Like Cloud: an owned organization that other active members still use passes to one of them (an admin first, then
// the longest-standing member, who becomes admin); one nobody else uses is deleted with the user.
async function userPlan(id:string){
 const user=await store.userById(id);if(!user)return null;
 const memberships=await store.orgsForUser(id),transfer:{org:Organization;to:SmartDetectorUser}[]=[],remove:Organization[]=[];let blocker:string|null=null;
 for(const {org} of memberships.filter(m=>m.org.ownerId===id)){
  const heir=(await store.membersOfOrg(org.id)).filter(m=>m.user.id!==id&&m.membership.status==='active'&&m.user.status==='active').sort((a,b)=>Number(b.membership.role==='admin')-Number(a.membership.role==='admin')||a.membership.createdAt.localeCompare(b.membership.createdAt))[0];
  if(heir)transfer.push({org,to:heir.user});else{remove.push(org);blocker??=await organizationBlocker(org)}
 }
 return {user,memberships,transfer,remove,blocker};
}
export async function userDeletion(id:string):Promise<DeletionImpact|null>{
 const plan=await userPlan(id);if(!plan)return null;
 const last=await lastMembers(plan.remove.map(o=>o.id),id);
 return {name:plan.user.displayName,type:'user',blocker:plan.blocker,subtext:'Deleting this user also deletes the locations they own that nobody else uses, with their devices, saved events, people, integrations and API keys, and the accounts of members who belong to no other location. Shared locations they own pass to another active member.',related:[{name:'Locations deleted',items:plan.remove.map(o=>o.name)},{name:'Ownership transferred',items:plan.transfer.map(t=>`${t.org.name} → ${t.to.displayName}`)},{name:'Memberships removed',items:plan.memberships.filter(m=>!plan.remove.some(o=>o.id===m.org.id)).map(m=>m.org.name)},{name:'Member accounts deleted',items:last.map(u=>u.displayName)}]};
}
export async function deleteUserAccount(id:string){
 const plan=await userPlan(id);if(!plan)return false;
 if(plan.blocker)throw new DeletionBlocked(plan.blocker);
 const now=new Date().toISOString();
 for(const {org} of plan.memberships)await store.deleteMembership(org.id,id);
 for(const {org,to} of plan.transfer){
  await store.putOrganization({...org,ownerId:to.id});
  const m=await store.membership(org.id,to.id);if(m&&m.role!=='admin')await store.putMembership({...m,role:'admin',updatedAt:now});
 }
 for(const org of plan.remove)await deleteOrganization(org.id);
 return store.deleteUser(id);
}
