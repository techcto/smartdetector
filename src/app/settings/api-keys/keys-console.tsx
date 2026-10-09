'use client';
import { useEffect, useState, type FormEvent } from 'react';
import Drawer, { DrawerBackdrop } from '@/app/drawer';
type Key = { id: string; name: string; scopes: string[]; expiresAt: number };
export default function KeysConsole() {
  const [keys, setKeys] = useState<Key[]>([]), [open, setOpen] = useState(false), [token, setToken] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  async function load() { const response = await fetch('/api/v1/api-keys'); if (!response.ok) throw new Error('Only organization admins can manage API keys.'); setKeys(await response.json()); }
  useEffect(() => { let active = true; fetch('/api/v1/api-keys').then(async r => { if (!r.ok) throw new Error('Only organization admins can manage API keys.'); const data = await r.json(); if (active) setKeys(data); }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, []);
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError('');
    const data = new FormData(e.currentTarget);
    try {
      const response = await fetch('/api/v1/api-keys', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: data.get('name'), scopes: data.getAll('scopes'), expiresInDays: Number(data.get('days')) }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      setToken(result.token); setOpen(false); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to create API key'); } finally { setBusy(false); }
  }
  async function revoke(id: string) {
    if (!confirm('Revoke this key? Existing integrations using it will lose access.')) return;
    try { const response = await fetch('/api/v1/api-keys', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) }); if (!response.ok) throw new Error('Unable to revoke key'); await load(); } catch (e) { setError(e instanceof Error ? e.message : 'Unable to revoke key'); }
  }
  return <section className="g-card"><div className="section-heading"><div><h2>Integration keys</h2><p className="muted">Keys cannot change alarms, billing, users or provider connections.</p></div><button className="button primary" onClick={() => { setToken(''); setOpen(true); }}>Create API key</button></div>
    {error && <p role="alert" className="form-error">{error}</p>}
    {token && <div className="notice" role="status"><strong>Copy this key now. It will not be shown again.</strong><pre>{token}</pre><button className="button" onClick={() => { void navigator.clipboard.writeText(token).catch(() => setError('Clipboard unavailable. Select and copy the key above.')); }}>Copy key</button><button className="button" onClick={() => setToken('')}>Dismiss</button></div>}
    <div className="table-wrap"><table><thead><tr><th>Name</th><th>Scopes</th><th>Expires</th><th/></tr></thead><tbody>{keys.length ? keys.map(k => <tr key={k.id}><td>{k.name}</td><td>{k.scopes.join(', ')}</td><td>{new Date(k.expiresAt).toLocaleDateString()}</td><td><button className="copy-button" onClick={() => void revoke(k.id)}>Revoke</button></td></tr>) : <tr><td colSpan={4} className="empty-state">No API keys yet.</td></tr>}</tbody></table></div>
    <DrawerBackdrop open={open} onClose={() => setOpen(false)}/><Drawer open={open} title="Create API key" onClose={() => setOpen(false)}><form className="drawer-form" onSubmit={create}><label>Name<input name="name" maxLength={80} placeholder="AgentCore integration" required autoFocus/></label><label>Expiry in days<input name="days" type="number" min={1} max={365} defaultValue={90} required/></label><fieldset><legend className="small">Read scopes</legend><label><input type="checkbox" name="scopes" value="events:read" defaultChecked/> Read events</label><label><input type="checkbox" name="scopes" value="devices:read" defaultChecked/> Read devices</label></fieldset><p className="muted">The key is bound to this organization at creation.</p>{error && <p role="alert">{error}</p>}<button className="button primary" disabled={busy}>{busy ? 'Creating…' : 'Create key'}</button></form></Drawer>
  </section>;
}
