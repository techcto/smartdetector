import {rootSession,saasMode} from '@/lib/admin';
import AdminNavigation from './admin-navigation';
export default async function AdminLayout({children}:{children:React.ReactNode}){await rootSession();return <div className="admin-shell"><AdminNavigation saas={saasMode()}/><div className="admin-content">{children}</div></div>}
