import { chromium } from 'playwright';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../../../', import.meta.url);
const input = process.env.PRIVATE_CAPTURE_DIR;
if (!input) throw Error('PRIVATE_CAPTURE_DIR must point to the private capture directory');
const output = new URL('docs/images/vega-native/', root);
await mkdir(output, { recursive: true });
const homeMasks = [
  ...[.03,.27,.508,.747,.985].map(x => [x,.33,Math.min(.203,1-x),.065]),
  ...[.03,.27,.508,.747,.985].map(x => [x,.749,Math.min(.203,1-x),.065]),
  [.27,.33,.203,.208], // Indoor camera image, not merely its identifier.
];
const shots = [
  { source:'native-frames-take6/frame-0006.png', file:'native-home.png', name:'07-tv-devices', title:'Your cameras. On your TV.', caption:'Native Vega Fire TV · Connected account · Privacy masks applied', masks:homeMasks, size:[1920,1080] },
  { source:'native-frames-take6/frame-0011.png', file:'native-event.png', name:'09-tv-event', title:'Review the moment, frame by frame', caption:'Native Vega Fire TV · Retained camera evidence · Device identifiers masked', masks:[[.225,.334,.26,.10],[.509,.556,.47,.079]], size:[1920,1080] },
  { source:'01-live-dashboard.png', file:'live-web-dashboard.png', name:'02-dashboard', title:'Your connected-device dashboard', caption:'smartdetector.com · Connected account · Private camera and identifiers masked', masks:[[.162,.325,.173,.079],[.349,.319,.303,.305],[.785,.325,.18,.079],[.16,.822,.175,.085],[.477,.822,.175,.085]], size:[1440,900] },
];
const browser = await chromium.launch({headless:true});
try {
  const page = await browser.newPage();
  for (const s of shots) {
    const bytes = await readFile(input+'/'+s.source);
    await page.setViewportSize({width:s.size[0],height:s.size[1]});
    await page.setContent('<html><body style="margin:0;background:white"><div style="position:relative;width:100vw;height:100vh"><img alt="Native capture" style="width:100%;height:100%;display:block" src="data:image/png;base64,'+bytes.toString('base64')+'">'+s.masks.map(([x,y,w,h])=>'<div style="position:absolute;left:'+x*100+'%;top:'+y*100+'%;width:'+w*100+'%;height:'+h*100+'%;background:#142b49;color:white;display:flex;align-items:center;justify-content:center;font:12px Arial;overflow:hidden">Privacy redaction</div>').join('')+'</div></body></html>');
    await page.locator('img').evaluate(i=>i.decode());
    const sanitized = await page.screenshot({path:fileURLToPath(new URL(s.file,output))});
    await page.setViewportSize({width:1200,height:800});
    await page.setContent('<html><body style="margin:0;background:#edf4f8;color:#142b49;font-family:Arial"><main style="padding:28px 32px"><div id="title" style="font-weight:700;font-size:28px"></div><div id="caption" style="margin-top:9px;font-size:14px;color:#526781"></div><img style="display:block;width:1136px;height:652px;object-fit:contain;margin-top:15px;background:white;border-radius:10px" src="data:image/png;base64,'+sanitized.toString('base64')+'"></main></body></html>');
    await page.locator('#title').evaluate((e,t)=>e.textContent=t,s.title);
    await page.locator('#caption').evaluate((e,t)=>e.textContent=t,s.caption);
    await page.locator('img').evaluate(i=>i.decode());
    await page.screenshot({path:fileURLToPath(new URL('docs/demo-assets/gallery/'+s.name+'.png',root))});
  }
} finally { await browser.close(); }
console.log('Exported three redacted real-capture gallery replacements. Raw originals were not copied into the repository.');
