import DeviceBrowser from '../../device-browser';
import {deviceModels} from '@/lib/device-catalog';
import {notFound} from 'next/navigation';
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;if(!deviceModels.some(m=>m.id===id))notFound();return <DeviceBrowser modelId={id}/>}
