import Devices from './device-detail';
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <Devices deviceId={id}/>}
