import Link from 'next/link';
import {notFound} from 'next/navigation';
import {adminDate,rootSession,saasMode} from '@/lib/admin';
import {store} from '@/lib/store';
import Avatar from '../avatar';
export default async function AdminOrganizations(){
 await rootSession();if(!saasMode())notFound();
 const rows=await Promise.all((await store.organizations()).map(async org=>({org,members:(await store.membersOfOrg(org.id)).length,devices:(await store.nodes(org.id)).length})));
 rows.sort((a,b)=>a.org.name.localeCompare(b.org.name));
 return <><section className="hero compact-hero"><div><p className="eyebrow">Directory</p><h1>Organizations</h1><p className="muted page-intro">Every organization is an isolated tenant with its own devices, events, integrations, and access controls.</p></div></section>
 <section className="card g-card"><div className="table-wrap"><table className="table align-middle mb-0"><thead><tr><th>Organization</th><th>Type</th><th>Members</th><th>Devices</th><th>Created</th></tr></thead><tbody>{rows.length?rows.map(({org,members,devices})=><tr key={org.id}><td><Link className="admin-entity" href={`/admin/organizations/${org.id}`}><Avatar name={org.name}/><span><strong>{org.name}</strong><small>{org.contactEmail??org.slug}</small></span></Link></td><td className="muted">{org.orgType}</td><td>{members}</td><td>{devices}</td><td className="muted">{adminDate(org.createdAt)}</td></tr>):<tr><td colSpan={5} className="empty-state"><strong>No organizations yet.</strong><span>Add one to get its enrollment token.</span></td></tr>}</tbody></table></div></section></>;
}
