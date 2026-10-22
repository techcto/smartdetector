import { chromium } from 'playwright';
import { readFile, mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = new URL('../../../', import.meta.url);
const out = new URL('docs/demo-assets/gallery/', root);
const base = process.env.GALLERY_URL || 'http://localhost:3000';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw Error('Local capture only');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
let userId;
const captures = [];
async function capture(page, name, title, caption) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    for (const v of document.querySelectorAll('video')) { v.pause(); v.currentTime = 1; }
    await Promise.all([...document.images].map(i => i.decode().catch(() => {})));
  });
  await page.waitForTimeout(600);
  const buffer = await page.screenshot();
  captures.push({ name, title, caption, buffer });
}
try {
  const page = await context.newPage();
  await page.goto(base, { waitUntil: 'networkidle' });
  await capture(page, '01-website', 'One home for connected moments', 'Website · Public recorded demonstration content');
  const signup = await context.request.post(base + '/api/auth/signup', { data: {
    username: 'gallery-' + randomUUID().slice(0, 8), displayName: 'Demo Reviewer', password: randomUUID() + randomUUID(),
  } });
  if (signup.status() !== 201) throw Error('Local isolated account creation failed: ' + signup.status());
  userId = (await signup.json()).id;
  const providerResponse = await context.request.get(base + '/api/v1/providers');
  const providerData = await providerResponse.json();
  const at = '2026-10-22T12:00:00Z';
  const samples = await Promise.all(['intruder', 'backyardintruder', 'package'].map(async sample => JSON.parse(await readFile(new URL(`public/demo/${sample}-analysis.json`, root), 'utf8'))));
  const devices = ['Front door · Demo', 'Back yard · Demo', 'Porch · Demo'].map((displayName, i) => ({ serverId: 'gallery-camera-' + i, displayName, providerKey: 'ring-test', status: 'healthy', lastHeartbeat: at }));
  const incidents = samples.map((sample, i) => ({ incidentId: 'gallery-event-' + i, serverId: devices[i].serverId, state: 'review', startedAt: at, payload: {
    kind: 'vision-review', source: 'recorded-demo', assessment: 'Recorded sample for interface demonstration',
    thumbnail: 'data:image/jpeg;base64,' + sample.frames[0].preview,
    evidenceFrames: sample.frames.map(f => ({ ...f, preview: 'data:image/jpeg;base64,' + f.preview })),
    observations: sample.observations,
  } }));
  await page.route('**/api/v1/**', route => {
    const p = new URL(route.request().url()).pathname;
    const data = p === '/api/v1/devices' ? devices : p === '/api/v1/incidents' ? incidents : p === '/api/v1/providers' ? { ...providerData, connections: [] } : p === '/api/v1/tv/approve' ? { name: 'SmartDetector Vega Console', orgId: 'gallery', orgName: 'Demo location' } : null;
    return data === null ? route.fulfill({ status: 404, json: { error: 'Not enabled in gallery fixture' } }) : route.fulfill({ json: data });
  });
  await page.goto(base + '/console', { waitUntil: 'networkidle' });
  await page.getByText('Front door · Demo', { exact: true }).first().waitFor();
  await capture(page, '02-dashboard', 'Your device dashboard', 'Web console · Isolated recorded camera/event fixtures');
  await page.goto(base + '/devices', { waitUntil: 'networkidle' });
  await capture(page, '03-devices', 'Connect cameras and displays', 'Web console · Device integration catalog');
  await page.goto(base + '/devices/integrations/ring', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Connect provider', exact: true }).first().click();
  await capture(page, '04-connect-ring', 'Authorize your Ring cameras', 'SmartDetector consent instructions · No Ring credentials or approval simulated');
  await page.goto(base + '/tv/connect', { waitUntil: 'networkidle' });
  const input = page.getByRole('textbox').first();
  await input.fill('ABCDE12345');
  await capture(page, '05-pair-tv-web', 'Approve the display from your browser', 'Web pairing screen · Nonfunctional example code');
  const tv = [
    ['pairing', '06-tv-qr', 'Scan. Sign in. Approve.', 'Shared TV UI in browser · Nonfunctional pairing fixture'],
    ['home', '07-tv-devices', 'Camera collections on your TV', 'Shared TV UI in browser · Blank camera/event test fixtures'],
    ['device', '08-tv-camera', 'Open a camera, explore its history', 'Shared TV UI in browser · Test fixtures'],
    ['event', '09-tv-event', 'Review a moment, frame by frame', 'Shared TV UI in browser · Blank evidence fixtures'],
    ['results', '10-tv-search', 'Find saved activity', 'Shared TV UI in browser · Search test fixtures'],
    ['settings', '11-tv-settings', 'A paired, read-only display', 'Shared TV UI in browser · Console settings'],
  ];
  for (const [source, name, title, caption] of tv) captures.push({ name, title, caption, buffer: await readFile(new URL(`docs/images/vega-playwright/1280-${source}.png`, root)) });
  const canvas = await context.newPage();
  await canvas.setViewportSize({ width: 1200, height: 800 });
  for (const c of captures) {
    await canvas.setContent('<html><body style="margin:0;background:#edf4f8;font-family:Arial,sans-serif;color:#142b49"><main style="padding:28px 32px"><div id="title" style="font-weight:700;font-size:28px"></div><div id="caption" style="margin-top:9px;font-size:14px;color:#526781"></div><img style="display:block;width:1136px;height:652px;object-fit:contain;margin-top:15px;background:white;border-radius:10px" src="data:image/png;base64,' + c.buffer.toString('base64') + '"></main></body></html>');
    await canvas.locator('#title').evaluate((e, v) => e.textContent = v, c.title);
    await canvas.locator('#caption').evaluate((e, v) => e.textContent = v, c.caption);
    await canvas.locator('img').evaluate(img => img.decode());
    await canvas.screenshot({ path: fileURLToPath(new URL(c.name + '.png', out)) });
  }
  console.log('Exported ' + captures.length + ' gallery PNGs at 1200×800. Browser UI, not native-device evidence.');
} finally {
  if (userId) {
    const r = await context.request.delete(base + '/api/v1/users/' + userId, { headers: { Origin: base }, data: { confirmation: 'DELETE' } });
    if (!r.ok()) console.error('Temporary gallery account cleanup failed: HTTP ' + r.status());
    else console.log('Temporary gallery account deleted. No provider connections or events were persisted.');
  }
  await browser.close();
}
