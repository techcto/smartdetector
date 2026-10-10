import 'bootstrap/dist/css/bootstrap.min.css';
import './globals.css';
import './events.css';
import './public.css';
import './console-nav.css';
import {cookies} from 'next/headers';
import {sessionCookie,verifySession} from '@/lib/session';
import {store} from '@/lib/store';
import UserMenu from './user-menu';
import OrgPicker from './org-picker';
import ConsoleNavigation from './console-navigation';
import ConsoleShell from './console-shell';
export const metadata={metadataBase:new URL('https://smartdetector.com'),title:'SmartDetector — Your smart devices. One personalized dashboard.',description:'Connect supported smart devices, receive and process events with AI, and review detected activity in your personalized dashboard. Ring event intake, Fire TV display, and more integrations coming soon.'};
export default async function Layout({children}:{children:React.ReactNode}){
 const jar=await cookies(),s=await verifySession(jar.get(sessionCookie)?.value,process.env.SMARTDETECTOR_SESSION_SECRET??'');
 if(!s)return <html lang="en"><body>{children}</body></html>;
 const org=s.orgId?await store.organizationById(s.orgId):null;
 const saas=process.env.SMARTDETECTOR_DEPLOYMENT_MODE==='saas';
 return <html lang="en"><body><ConsoleShell navigation={<ConsoleNavigation saas={saas}/>} menu={<>{saas?<OrgPicker activeOrgId={s.orgId} activeOrgName={org?.name??'Select location'} isRoot={s.role==='root'}/>:<span className="console-private-label">Private installation</span>}<UserMenu id={s.id} displayName={s.username} role={s.role}/></>}>{children}</ConsoleShell></body></html>;
}
