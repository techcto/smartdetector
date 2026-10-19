'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
const icons:Record<string,string>={
 Organizations:'M3 21V7l9-4 9 4v14M8 21v-5h8v5M8 10h.01M12 10h.01M16 10h.01',
 Devices:'M4 7h11a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Zm12 4 5-3v8l-5-3',
 Users:'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8c0-3.3 3.1-6 7-6s7 2.7 7 6',
 Settings:'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.3l2-1.6-2-3.4-2.4 1a7.5 7.5 0 0 0-2.2-1.3L14.4 3h-4l-.4 2.4a7.5 7.5 0 0 0-2.2 1.3l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.6l-2 1.6 2 3.4 2.4-1a7.5 7.5 0 0 0 2.2 1.3l.4 2.4h4l.4-2.4a7.5 7.5 0 0 0 2.2-1.3l2.4 1 2-3.4-2-1.6c.1-.4.1-.9.1-1.3Z',
};
export default function AdminNavigation({saas}:{saas:boolean}){
 const path=usePathname();
 const groups=[...(saas?[{heading:'Directory',items:[['Organizations','/admin/organizations'],['Users','/admin/users'],['Devices','/admin/devices']]}]:[]),{heading:'System',items:[['Settings','/admin/settings']]}];
 return <aside className="admin-sidenav"><Link className="admin-sidenav-back" href="/console">← Main console</Link><nav aria-label="Admin navigation">{groups.map(g=><div key={g.heading}><p className="admin-sidenav-heading">{g.heading}</p>{g.items.map(([label,href])=><Link key={href} href={href} aria-current={path===href||path.startsWith(href+'/')?'page':undefined}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true"><path d={icons[label]}/></svg>{label}</Link>)}</div>)}</nav></aside>;
}
