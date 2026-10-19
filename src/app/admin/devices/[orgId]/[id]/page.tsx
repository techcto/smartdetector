import Link from 'next/link';
import {notFound} from 'next/navigation';
import {adminDate,deviceSummary,rootSession,saasMode} from '@/lib/admin';
import {store} from '@/lib/store';
import Avatar from '../../../avatar';
export default async function AdminDevice({params}:{params:Promise<{orgId:string;id:string}>}){
 await rootSession();if(!saasMode())notFound();
 const {orgId,id}=await params,[org,node]=await Promise.all([store.organizationById(orgId),store.node(orgId,decodeURIComponent(id))]);if(!org||!node)notFound();
 const d=deviceSummary(node),members=await store.membersOfOrg(orgId);
 return <><section className="hero"><div className="admin-entity"><Avatar name={d.name} large/><div><p className="eyebrow mb-1"><Link href="/admin/devices">Devices</Link> ›</p><h1 className="m-0">{d.name}</h1></div></div></section>
 <p className="admin-privacy">Privacy: only device inventory is shown. Events, recordings, snapshots, and people detected by this device stay private to its organization.</p>
 <section className="card g-card"><h2 className="h5">Overview</h2><dl className="admin-facts"><div><dt>Organization</dt><dd><Link href={`/admin/organizations/${org.id}`}>{org.name}</Link></dd></div><div><dt>Provider</dt><dd>{d.provider}</dd></div><div><dt>Status</dt><dd><span className={`status${d.status==='healthy'?'':' neutral'}`}>{d.status}</span></dd></div><div><dt>Connected</dt><dd>{adminDate(d.connectedAt)}</dd></div><div><dt>Last seen</dt><dd>{adminDate(d.lastSeen)}</dd></div></dl></section>
 <section className="card g-card"><h2 className="h5">People with access</h2><div className="table-wrap"><table className="table align-middle mb-0"><thead><tr><th>User</th><th>Role</th><th>Status</th></tr></thead><tbody>{members.length?members.map(({user,membership})=><tr key={user.id}><td><Link className="admin-entity" href={`/admin/users/${user.id}`}><Avatar name={user.displayName}/><span><strong>{user.displayName}</strong><small>{user.username}</small></span></Link></td><td>{membership.role}</td><td><span className={`status${membership.status==='active'?'':' neutral'}`}>{membership.status}</span></td></tr>):<tr><td colSpan={3} className="empty-state"><strong>No members.</strong></td></tr>}</tbody></table></div></section></>;
}
