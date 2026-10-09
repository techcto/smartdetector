import assert from 'node:assert/strict';
const base = process.env.SMARTDETECTOR_TEST_URL || 'http://localhost:8082';
if (!['localhost','127.0.0.1'].includes(new URL(base).hostname)) throw new Error('This synthetic smoke test is local-only');
const call = (path, body, cookie) => fetch(base+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Origin:base,...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});
const pair = await (await call('/api/v1/tv/pair',{name:'Synthetic HTTP pairing test'})).json(); assert.ok(pair.deviceCode);
assert.equal((await (await call('/api/v1/tv/pair',{deviceCode:pair.deviceCode})).json()).error,'authorization_pending');
const login = await call('/api/auth/login',{username:process.env.SMARTDETECTOR_TEST_USER || 'root',password:process.env.SMARTDETECTOR_TEST_PASSWORD || 'smartdetector-local-change-me'}); assert.equal(login.status,200);
const cookie = login.headers.get('set-cookie').split(';')[0];
const identity = await login.json();
assert.equal((await call('/api/v1/tv/approve',{code:pair.userCode,orgId:'synthetic-wrong-workspace'},cookie)).status,400);
const approved = await call('/api/v1/tv/approve',{code:pair.userCode,orgId:identity.orgId},cookie); assert.equal(approved.status,200,await approved.text());
const token = (await (await call('/api/v1/tv/pair',{deviceCode:pair.deviceCode})).json()).token; assert.ok(token);
const feed = () => fetch(base+'/api/v1/tv/feed',{headers:{Authorization:'Bearer '+token}});
try {
  assert.equal((await feed()).status,200);
  assert.equal((await call('/api/v1/tv/approve',{code:pair.userCode},cookie)).status,400);
  assert.equal((await fetch(base+'/api/v1/devices',{headers:{Authorization:'Bearer '+token}})).status,401);
  const forbidden = await fetch(base+'/api/v1/tv/approve',{method:'POST',headers:{Cookie:cookie,Origin:'https://untrusted.invalid','Content-Type':'application/json'},body:JSON.stringify({code:pair.userCode})}); assert.equal(forbidden.status,403);
} finally {
  const connections = (await (await call('/api/v1/providers',null,cookie)).json()).connections;
  for (const c of connections.filter(c=>c.providerKey==='firetv'&&c.name==='Synthetic HTTP pairing test')) {
    assert.equal((await fetch(base+'/api/v1/providers',{method:'DELETE',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({id:c.id})})).status,200);
  }
}
assert.equal((await feed()).status,401);
console.log('PASS: HTTP pairing, pending state, approval, scoped feed, replay rejection, cross-origin rejection and revocation.');
