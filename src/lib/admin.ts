import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {sessionCookie,verifySession} from './session';
import {store} from './store';
import {providers} from './providers';
import type {Node,SmartDetectorUser} from './model';
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
