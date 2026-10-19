import {rootSession} from '@/lib/admin';
import Vision from '../../settings/autovision';
import Integrations from '../integrations';
export default async function AdminSettings(){
 await rootSession();
 return <><section className="hero"><p className="eyebrow">System</p><h1>Settings</h1><p>Installation-wide developer apps and services. Customer accounts, cameras, displays, and events remain scoped to their location under Devices.</p></section><Vision/><Integrations/></>;
}
