import Link from 'next/link';
import {notFound} from 'next/navigation';
import {adminDate,directoryUsers,rootSession,saasMode} from '@/lib/admin';
import Avatar from '../avatar';
export default async function AdminUsers(){
 await rootSession();if(!saasMode())notFound();
 const rows=await directoryUsers();
 return <><section className="hero"><p className="eyebrow">Directory</p><h1>Users</h1><p className="muted page-intro">Everyone with access to an organization. The launch-time root operator is managed through deployment secrets and is not listed.</p></section>
 <section className="card g-card"><div className="table-wrap"><table className="table align-middle mb-0"><thead><tr><th>User</th><th>Organizations</th><th>Status</th><th>Joined</th></tr></thead><tbody>{rows.length?rows.map(({user,organizations})=><tr key={user.id}><td><Link className="admin-entity" href={`/admin/users/${user.id}`}><Avatar name={user.displayName}/><span><strong>{user.displayName}</strong><small>{user.username}</small></span></Link></td><td>{organizations}</td><td><span className={`status${user.status==='active'?'':' neutral'}`}>{user.status}</span></td><td className="muted">{adminDate(user.createdAt)}</td></tr>):<tr><td colSpan={4} className="empty-state"><strong>No users yet.</strong><span>Users appear here once they belong to an organization.</span></td></tr>}</tbody></table></div></section></>;
}
