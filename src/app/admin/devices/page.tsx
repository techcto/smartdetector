import {notFound} from 'next/navigation';
import {directoryDevices,rootSession,saasMode} from '@/lib/admin';
import DevicesTable from '../devices-table';
export default async function AdminDevices(){
 await rootSession();if(!saasMode())notFound();
 const devices=await directoryDevices();
 return <><section className="hero"><p className="eyebrow">Directory</p><h1>Devices</h1><p className="muted page-intro">Every device connected to an organization. Only inventory is listed; events, recordings, and credentials stay inside each organization.</p></section>
 <section className="card g-card"><DevicesTable devices={devices}/></section></>;
}
