import Link from 'next/link';
import {notFound} from 'next/navigation';
import {adminDate,deviceSummary,rootSession,saasMode} from '@/lib/admin';
import {store} from '@/lib/store';
import Avatar from '../../avatar';
import DevicesTable from '../../devices-table';
import OpenOrganization from '../open-organization';
export default async function AdminOrganization({params}:{params:Promise<{id:string}>}){
 await rootSession();if(!saasMode())notFound();
 const {id}=await params,org=await store.organizationById(id);if(!org)notFound();
 const [members,nodes,subscription,products]=await Promise.all([store.membersOfOrg(id),store.nodes(id),store.activeSubscriptionForOrg(id),store.products()]);
 const plan=products.find(p=>p.id===subscription?.productId)?.name??'Dev';
 return <><section className="hero compact-hero"><div className="admin-entity"><Avatar name={org.name} large/><div><p className="eyebrow mb-1"><Link href="/admin/organizations">Organizations</Link> ›</p><h1 className="m-0">{org.name}</h1></div></div><OpenOrganization orgId={org.id}/></section>
 <p className="admin-privacy">Privacy: event history, media, people, and integration credentials stay inside the organization and are not shown here.</p>
 <section className="card g-card"><h2 className="h5">Overview</h2><dl className="admin-facts"><div><dt>Type</dt><dd>{org.orgType}</dd></div><div><dt>Plan</dt><dd>{plan}{subscription?` · ${subscription.status}`:''}</dd></div><div><dt>Contact email</dt><dd>{org.contactEmail??'—'}</dd></div><div><dt>Contact phone</dt><dd>{org.contactPhone??'—'}</dd></div><div><dt>Slug</dt><dd>{org.slug}</dd></div><div><dt>Created</dt><dd>{adminDate(org.createdAt)}</dd></div></dl></section>
 <section className="card g-card"><h2 className="h5">Members</h2><div className="table-wrap"><table className="table align-middle mb-0"><thead><tr><th>User</th><th>Role</th><th>Status</th></tr></thead><tbody>{members.length?members.map(({user,membership})=><tr key={user.id}><td><Link className="admin-entity" href={`/admin/users/${user.id}`}><Avatar name={user.displayName}/><span><strong>{user.displayName}</strong><small>{user.username}</small></span></Link></td><td>{membership.role}</td><td><span className={`status${membership.status==='active'?'':' neutral'}`}>{membership.status}</span></td></tr>):<tr><td colSpan={3} className="empty-state"><strong>No members.</strong></td></tr>}</tbody></table></div></section>
 <section className="card g-card"><h2 className="h5">Connected devices</h2><DevicesTable devices={nodes.map(deviceSummary)}/></section></>;
}
