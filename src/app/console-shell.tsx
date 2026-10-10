'use client';
import {usePathname} from 'next/navigation';
import type {ReactNode} from 'react';
export default function ConsoleShell({children,navigation,menu}:{children:ReactNode;navigation:ReactNode;menu:ReactNode}){const path=usePathname();if(['/','/api-reference','/docs/mcp','/signup','/ring/link','/tv'].includes(path)||path.startsWith('/login'))return <>{children}</>;return <div className="console-shell"><header className="console-topbar">{navigation}<div className="console-utilities">{menu}</div></header><main className="content-area">{children}</main></div>}
