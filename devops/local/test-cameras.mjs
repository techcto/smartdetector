import {setTimeout as delay} from 'node:timers/promises';
import {pathToFileURL} from 'node:url';
import {replayOptions,runReplay} from './replay-camera.mjs';
export function testCameraOptions(env=process.env){
 const count=Number(env.SMARTDETECTOR_TEST_EVENT_COUNT??240),interval=Number(env.SMARTDETECTOR_TEST_EVENT_INTERVAL??15);
 if(!Number.isInteger(count)||count<2||count>10000||!Number.isInteger(interval)||interval<4||interval>300)throw Error('Choose 2–10000 events and 4–300 seconds between events');
 const options=replayOptions([],env); // Same strict loopback-only target guard as the CLI.
 return {...options,count,interval};
}
export async function runTestCameras(env=process.env,replay=runReplay,sleep=delay){
 const options=testCameraOptions(env);
 console.log('LOCAL TEST CAMERAS: recorded clips, no Ring authorization, AI calls, or external notifications.');
 let failures=0;
 for(let i=0;i<options.count;i++){
  const front=i%2===0;
  try{await replay({...options,count:1,mode:'recorded',camera:front?'front-door':'back-yard',sample:front?(i%4===0?'package':'intruder'):(i%4===1?'dognight':'backyardintruder')},env);failures=0;}
  catch{failures++;console.error('Local test event failed; check service health/root credentials.');if(failures>=3)throw Error('Three consecutive failures; stopping test cameras');}
  if(i+1<options.count)await sleep((i===0?4:options.interval)*1000);
 }
 console.log('Local camera fixture finished. Restart the container for another bounded run.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)void runTestCameras().catch(()=>{console.error('Test camera fixture stopped; check local configuration.');process.exitCode=1;});
