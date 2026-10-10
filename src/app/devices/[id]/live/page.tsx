'use client';
import {use} from 'react';
import Link from 'next/link';
import LiveCamera from '@/app/live-camera';
export default function Live({params}:{params:Promise<{id:string}>}){
 const {id}=use(params);
 return <><section className="hero"><Link href={'/devices/'+encodeURIComponent(id)}>← Back to device</Link><h1>Camera live view</h1></section><LiveCamera id={id}/></>;
}
