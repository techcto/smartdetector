import Link from 'next/link';
import {cookies} from 'next/headers';
import {sessionCookie,verifySession} from '@/lib/session';
import {userDeletion} from '@/lib/admin';
import DeleteDrawer from '@/app/delete-drawer';
export const metadata={title:'Delete account | SmartDetector'};
export default async function AccountDeletion(){
 const session=await verifySession((await cookies()).get(sessionCookie)?.value,process.env.SMARTDETECTOR_SESSION_SECRET??''),saas=process.env.SMARTDETECTOR_DEPLOYMENT_MODE==='saas';
 const deletion=saas&&session&&session.role!=='root'?await userDeletion(session.id):null;
 return <section className="card g-card"><Link href="/settings">← Back to Settings</Link><h1>Delete your SmartDetector account</h1>
 {session&&deletion?<><p>Permanently delete your account and sign out. Locations you own that nobody else uses are deleted with it, including their devices, saved events and images, people, integrations and API keys. Shared locations you own pass to another active member.</p><p className="small text-muted">Not deleted: original Ring recordings, separate AutoVision analysis jobs, notifications already delivered, and deployment backups.</p><div><DeleteDrawer impact={deletion} url={`/api/v1/users/${session.id}`} redirect="/login"/></div></>
 :session?.role==='root'?<p>The deployment&apos;s root operator is managed through deployment secrets and cannot be deleted here.</p>
 :<p>Accounts on private installations are managed by the deployment administrator. Ask them to remove your account.</p>}
 <p className="mt-3">To keep your account and delete only saved data, use <Link href="/settings/data-deletion">data deletion</Link>. <Link href="/privacy">Privacy policy</Link>.</p></section>;
}
