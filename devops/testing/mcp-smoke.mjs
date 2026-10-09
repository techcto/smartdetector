import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createHttpServer } from '../../submodules/smartdetector-agentcore/src/server.mjs';
import { createApiClient } from '../../submodules/smartdetector-agentcore/src/client.mjs';
import { Client } from '../../submodules/smartdetector-agentcore/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js';
import { StreamableHTTPClientTransport } from '../../submodules/smartdetector-agentcore/node_modules/@modelcontextprotocol/sdk/dist/esm/client/streamableHttp.js';

const base = process.env.SMARTDETECTOR_TEST_URL ?? 'http://localhost:8082';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('This smoke test may only modify a local installation');
const login = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: process.env.SMARTDETECTOR_TEST_USER ?? 'root', password: process.env.SMARTDETECTOR_TEST_PASSWORD ?? 'smartdetector-local-change-me' }) });
assert.equal(login.status, 200, 'Local root login failed');
const cookie = login.headers.get('set-cookie')?.split(';')[0]; assert.ok(cookie);
const headers = { cookie, origin: base, 'content-type': 'application/json' };
const created = await fetch(`${base}/api/v1/api-keys`, { method: 'POST', headers, body: JSON.stringify({ name: 'Synthetic MCP smoke test', scopes: ['events:read', 'devices:read'], expiresInDays: 1 }) });
assert.equal(created.status, 201, 'API key creation failed');
const key = await created.json();
let seededEventId;
if (process.env.SMARTDETECTOR_TEST_SEED === '1') {
  // Optional, explicitly synthetic local fixture retained for reviewing the demo UI.
  const response = await fetch(`${base}/api/v1/simulator`, { method: 'POST', headers, body: JSON.stringify({ device_id: `synthetic-mcp-${randomBytes(4).toString('hex')}`, type: 'smoke', value: 80, event_id: `synthetic-${randomBytes(8).toString('hex')}` }) });
  assert.equal(response.status, 202); seededEventId = (await response.json()).incidentId;
}
const token = randomBytes(32).toString('base64url');
const server = createHttpServer({ authToken: token, read: createApiClient({ baseUrl: base, apiKey: key.token }) });
const client = new Client({ name: 'smartdetector-local-integration', version: '0.1.0' });
try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${server.address().port}/mcp`), { requestInit: { headers: { authorization: `Bearer ${token}` } } }));
  assert.equal((await client.listTools()).tools.length, 5);
  const prompt = await client.getPrompt({ name: 'review_recent_events' }); assert.ok(prompt.messages.length);
  const events = await client.callTool({ name: 'list_events', arguments: { limit: 5 } });
  const devices = await client.callTool({ name: 'list_devices', arguments: { limit: 5 } });
  assert.ok(!events.isError && !devices.isError, 'REST reads failed');
  assert.ok(Array.isArray(events.structuredContent.result) && Array.isArray(devices.structuredContent.result));
  if (seededEventId) {
    assert.ok(!(await client.callTool({ name: 'get_event', arguments: { id: seededEventId } })).isError);
    assert.ok(!(await client.callTool({ name: 'explain_event', arguments: { id: seededEventId } })).isError);
  }
  if (events.structuredContent.result.length) {
    const id = events.structuredContent.result[0].incidentId;
    assert.ok(!(await client.callTool({ name: 'get_event', arguments: { id } })).isError);
    assert.ok(!(await client.callTool({ name: 'explain_event', arguments: { id } })).isError);
  }
  if (devices.structuredContent.result.length) assert.ok(!(await client.callTool({ name: 'get_device', arguments: { id: devices.structuredContent.result[0].serverId } })).isError);
  assert.equal((await fetch(`${base}/api/v1/settings`, { headers: { authorization: `Bearer ${key.token}` } })).status, 401);
  assert.equal((await fetch(`${base}/api/v1/api-keys`, { method: 'POST', headers: { ...headers, origin: 'https://example.invalid' }, body: '{}' })).status, 403);
  assert.equal((await fetch(`${base}/api/v1/agentcore`, { headers: { cookie } })).status, 200);
  const revoked = await fetch(`${base}/api/v1/api-keys`, { method: 'DELETE', headers, body: JSON.stringify({ id: key.id }) }); assert.equal(revoked.status, 200);
  assert.ok((await client.callTool({ name: 'list_events', arguments: {} })).isError, 'Revoked key remained usable');
  console.log('PASS: real local REST + MCP initialize, five tools, review prompt, data reads, privilege boundary, CSRF rejection and immediate revocation. No model or AWS Runtime call was made.');
} finally {
  await client.close();
  await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  const response = await fetch(`${base}/api/v1/api-keys`, { method: 'DELETE', headers, body: JSON.stringify({ id: key.id }) });
  assert.equal(response.status, 200, 'Synthetic key cleanup failed');
}
