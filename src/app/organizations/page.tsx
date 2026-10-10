import {cookies} from 'next/headers';
import {sessionCookie, verifySession} from '@/lib/session';
import OrganizationsConsole from './organizations-console';
export default async function Organizations(){
  const jar=await cookies();
  const session=await verifySession(jar.get(sessionCookie)?.value,process.env.SMARTDETECTOR_SESSION_SECRET??'');
  if(process.env.SMARTDETECTOR_DEPLOYMENT_MODE!=='saas'||session?.role!=='root')return <main><section className="hero"><div className="eyebrow">Locations</div><h1>Not available.</h1><p className="muted page-intro">Location management is available to the root operator in SaaS mode.</p></section></main>;
  return <main><section className="hero"><div className="eyebrow">Locations</div><h1>Manage your locations.</h1><p className="muted page-intro">Each location has its own devices, events, integrations, and access controls.</p></section><section className="card g-card"><OrganizationsConsole/></section></main>;
}

