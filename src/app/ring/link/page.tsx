import RingLink from './ring-link';
import {cookies} from 'next/headers';
import {sessionCookie,verifySession} from '@/lib/session';
import {store} from '@/lib/store';
export const dynamic='force-dynamic';
export default async function Page(){const session=await verifySession((await cookies()).get(sessionCookie)?.value,process.env.SMARTDETECTOR_SESSION_SECRET??'');const org=session?await store.organizationById(session.orgId):null;return <main className="container py-5" style={{maxWidth:720}}>{org&&<div className="alert alert-info">Destination location: <strong>{org.name}</strong>. <a href="/console">Change location in the console</a>, then return to this Ring link before confirming.</div>}<RingLink/></main>}
