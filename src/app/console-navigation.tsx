'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import Brand from './brand';
export default function ConsoleNavigation({saas}:{saas:boolean}){
 const path=usePathname();
 const items=[['Dashboard','/console'],['History','/events'],['Devices','/devices'],['Settings','/settings'],...(saas?[['Plans','/settings/billing']]:[])];
 return <><Link className="brand console-brand" href="/console"><Brand/></Link><nav className="console-primary-nav" aria-label="Console navigation">{items.map(([label,href])=>{const active=href==='/settings'?path.startsWith('/settings')&&path!=='/settings/billing':path===href||path.startsWith(href+'/');return <Link key={href} href={href} aria-current={active?'page':undefined}>{label}</Link>})}</nav></>;
}
