// Replace photographic regions only; never ask a generative model to redraw UI.
import sharp from 'sharp';
import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const privateDir = process.env.PRIVATE_CAPTURE_DIR;
if (!privateDir) throw Error('PRIVATE_CAPTURE_DIR is required (original gallery backups).');
const gallery = resolve(root, 'docs/demo-assets/gallery');
const sheet = resolve(root, 'docs/demo-assets/ai-camera-scenes.png');
const { width, height } = await sharp(sheet).metadata();
const scenes = await Promise.all(Array.from({ length: 6 }, (_, i) => sharp(sheet).extract({
  left: Math.floor(i % 3 * width / 3) + 3,
  top: Math.floor(Math.floor(i / 3) * height / 2) + 3,
  width: Math.floor(width / 3) - 6, height: Math.floor(height / 2) - 6,
}).png().toBuffer()));
// Anonymous pool scene from the approved first AI edit.
scenes.push(await readFile(resolve(root, 'docs/demo-assets/ai-pool-scene.png')));

const jobs = [
  ['01-website', [[633,295,422,238,2]]],
  ['02-dashboard', [[113,309,315,197,1],[443,309,316,197,4],[772,309,315,197,5],
    [113,635,315,117,3],[443,635,316,117,0]]],
  ['07-tv-devices', [
    ...[66,339,609,881,1151].map((x,i)=>[x,318,Math.min(230,1168-x),133,[1,4,5,3,0][i]]),
    ...[66,339,609,881,1151].map((x,i)=>[x,586,Math.min(230,1168-x),131,[0,1,2,6,0][i]]),
  ]],
  ['08-tv-camera', [[72,259,519,213,0]]],
  ['09-tv-event', [[85,312,503,284,3]]],
  ['10-tv-search', [59,293,527,761,996].map(x=>[x,233,Math.min(202,1150-x),99,0])],
];
const audits = [];
for (const [name, boxes] of jobs) {
  const original = await readFile(resolve(privateDir, 'gallery-before-ai', name+'.png'));
  const overlays = await Promise.all(boxes.map(async ([left,top,width,height,index]) => ({
    left,top,input:await sharp(scenes[index]).resize(width,height,{fit:'cover'}).png().toBuffer(),
  })));
  // Caption is outside the application screenshot. UI pixels remain untouched.
  overlays.push({left:32,top:66,input:Buffer.from('<svg width="1136" height="24"><rect width="1136" height="24" fill="#edf4f8"/><text x="0" y="16" font-family="Arial,sans-serif" font-size="14" fill="#526781">Original app UI · AI-replaced camera imagery for privacy · Illustrative scenes, not recorded evidence</text></svg>')});
  const result = await sharp(original).composite(overlays).png().toBuffer();
  const before = await sharp(original).ensureAlpha().raw().toBuffer();
  const after = await sharp(result).ensureAlpha().raw().toBuffer();
  const allowed = [...boxes,[32,66,1136,24]];
  for(let y=0;y<800;y++) for(let x=0;x<1200;x++) {
    if(allowed.some(([l,t,w,h])=>x>=l&&x<l+w&&y>=t&&y<t+h)) continue;
    const offset=(y*1200+x)*4;
    for(let c=0;c<4;c++) if(before[offset+c]!==after[offset+c]) throw Error('UI changed outside photo/caption bounds: '+name);
  }
  await writeFile(resolve(gallery,name+'.png'),result);
  await copyFile(resolve(gallery,name+'.png'),resolve(privateDir,'gallery',name+'.png'));
  audits.push({image:name+'.png',photoRegions:boxes.length,uiOutsidePhotoAndCaption:'pixel-identical',bytes:result.length});
}
await writeFile(resolve(gallery,'ai-edit-audit.json'),JSON.stringify(audits,null,2)+'\n');
console.log(JSON.stringify(audits,null,2));
