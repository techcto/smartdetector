import Devices from '../../devices-console';
import {providers} from '@/lib/providers';
import {notFound} from 'next/navigation';
export default async function Page({params}:{params:Promise<{key:string}>}){const {key}=await params;if(!providers.some(p=>p.key===key))notFound();return <Devices integration={key}/>}
