import Link from 'next/link';
import {adminDate,type DeviceSummary} from '@/lib/admin';
export default function DevicesTable({devices}:{devices:(DeviceSummary&{organization?:string})[]}){
 const org=devices.some(d=>d.organization);
 return <div className="table-wrap"><table className="table align-middle mb-0"><thead><tr><th>Device</th>{org&&<th>Organization</th>}<th>Provider</th><th>Status</th><th>Last seen</th></tr></thead><tbody>{devices.length?devices.map(d=><tr key={d.orgId+d.id}><td><Link href={`/admin/devices/${d.orgId}/${encodeURIComponent(d.id)}`}><strong>{d.name}</strong></Link></td>{org&&<td><Link href={`/admin/organizations/${d.orgId}`}>{d.organization}</Link></td>}<td>{d.provider}</td><td><span className={`status${d.status==='healthy'?'':' neutral'}`}>{d.status}</span></td><td className="muted">{adminDate(d.lastSeen)}</td></tr>):<tr><td colSpan={org?5:4} className="empty-state"><strong>No connected devices.</strong></td></tr>}</tbody></table></div>;
}
