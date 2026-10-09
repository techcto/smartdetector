import Link from'next/link';import Enrollment from'./enrollment';import Vision from'./autovision';export default function Settings(){return<main><section className="hero"><h1>Settings</h1></section><Enrollment/><Vision/><Link href="/settings/api-keys">Manage API keys</Link><br/><Link href="/settings/billing">Manage payment plan</Link></main>}

