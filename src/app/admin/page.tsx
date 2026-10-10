import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {sessionCookie,verifySession} from '@/lib/session';
import Vision from '../settings/autovision';
import Integrations from './integrations';
export default async function Admin(){
 const session=await verifySession((await cookies()).get(sessionCookie)?.value,process.env.SMARTDETECTOR_SESSION_SECRET??'');
 if(!session)redirect('/login');
 if(session.role!=='root')redirect('/settings');
 return <><section className="hero"><p className="eyebrow">Root administration</p><h1>Admin</h1><p>Installation-wide developer apps and services. Customer accounts, cameras, displays, and events remain scoped to their location under Devices.</p></section><Vision/><Integrations/></>;
}
