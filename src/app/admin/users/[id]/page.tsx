import Link from 'next/link';
import {notFound} from 'next/navigation';
import {adminDate,deviceSummary,rootSession,saasMode} from '@/lib/admin';
import {store} from '@/lib/store';
import Avatar from '../../avatar';
import DevicesTable from '../../devices-table';
export default async function AdminUser({params}:{params:Promise<{id:string}>}){
 await rootSession();if(!saasMode())notFound();
 const {id}=await params,user=await store.userById(id);if(!user)notFound();
 const organizations=await Promise.all((await store.orgsForUser(id)).map(async ({org,membership})=>({org,membership,devices:(await store.nodes(org.id)).map(deviceSummary)})));
 const devices=organizations.flatMap(l=>l.devices.map(d=>({...d,organization:l.org.name})));
 return <><section className="hero"><div className="admin-entity"><Avatar name={user.displayName} large/><div><p className="eyebrow mb-1"><Link href="/admin/users">Users</Link> ›</p><h1 className="m-0">{user.displayName}</h1></div></div></section>
 <p className="admin-privacy">Privacy: only account details and connected device inventory are shown. Events, recordings, people, and personal settings stay private to the user&apos;s organizations.</p>
 <section className="card g-card"><h2 className="h5">Account</h2><dl className="admin-facts"><div><dt>Username</dt><dd>{user.username}</dd></div><div><dt>Status</dt><dd><span className={`status${user.status==='active'?'':' neutral'}`}>{user.status}</span></dd></div><div><dt>Joined</dt><dd>{adminDate(user.createdAt)}</dd></div><div><dt>Connected devices</dt><dd>{devices.length}</dd></div></dl></section>
 <section className="card g-card"><h2 className="h5">Organizations</h2><div className="table-wrap"><table className="table align-middle mb-0"><thead><tr><th>Organization</th><th>Role</th><th>Access</th><th>Devices</th></tr></thead><tbody>{organizations.length?organizations.map(({org,membership,devices})=><tr key={org.id}><td><Link className="admin-entity" href={`/admin/organizations/${org.id}`}><Avatar name={org.name}/><strong>{org.name}</strong></Link></td><td>{membership.role}</td><td><span className={`status${membership.status==='active'?'':' neutral'}`}>{membership.status}</span></td><td>{devices.length}</td></tr>):<tr><td colSpan={4} className="empty-state"><strong>No organizations.</strong></td></tr>}</tbody></table></div></section>
 <section className="card g-card"><h2 className="h5">Connected devices</h2><DevicesTable devices={devices}/></section></>;
}
