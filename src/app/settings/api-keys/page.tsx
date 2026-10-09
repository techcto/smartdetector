import KeysConsole from './keys-console';
export default function ApiKeysPage() {
  return <><section className="hero"><p className="eyebrow">Developer access</p><h1>API keys</h1><p className="muted">Read-only REST and MCP access for the active organization. Your browser session never needs an API key.</p></section><KeysConsole/></>;
}
