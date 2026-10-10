import Link from 'next/link';
import {notFound} from 'next/navigation';
import LoginForm from '../login/login-form';
export const dynamic='force-dynamic';
export default function Signup(){
 if(process.env.SMARTDETECTOR_DEPLOYMENT_MODE!=='saas')notFound();
 return <main className="min-vh-100 d-flex align-items-center justify-content-center"><section className="card g-card login-card"><Link href="/">← SmartDetector</Link><div className="eyebrow mt-3">Your connected-device dashboard</div><h1>Create your account.</h1><p className="muted">Start with a personal location, connect your devices, and review detected events in one place.</p><LoginForm allowSignup initialMode="signup"/></section></main>;
}
