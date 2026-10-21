import {setTimeout as delay} from 'node:timers/promises';
import {pathToFileURL} from 'node:url';
export function replayOptions(args,env=process.env){
 const options={base:env.SMARTDETECTOR_REPLAY_URL??'http://localhost:8082',sample:'intruder',count:1,interval:10,mode:'recorded',camera:undefined};
 for(let i=0;i<args.length;i++){
  if(args[i]==='--live'){options.mode='live';continue}
  const key={'--url':'base','--sample':'sample','--count':'count','--interval':'interval','--camera':'camera'}[args[i]];
  if(!key||!args[i+1])throw Error('Usage: replay-camera.mjs [--sample intruder|backyardintruder|package|dognight] [--count 1..20] [--interval 3..300] [--live] [--url LOOPBACK_URL]');
  options[key]=['count','interval'].includes(key)?Number(args[++i]):args[++i];
 }
 const u=new URL(options.base);
 if(!['http:','https:'].includes(u.protocol)||!['localhost','127.0.0.1','[::1]'].includes(u.hostname)||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw Error('Replay target must be a loopback origin without credentials or paths');
 options.base=u.origin;
 if(options.camera!==undefined&&!['front-door','back-yard'].includes(options.camera))throw Error('Choose front-door or back-yard test camera');
 if(!['intruder','backyardintruder','package','dognight'].includes(options.sample)||!Number.isInteger(options.count)||options.count<1||options.count>20||!Number.isInteger(options.interval)||options.interval<3||options.interval>300)throw Error('Invalid sample/count/interval');
 return options;
}
export async function runReplay(options,env=process.env,fetcher=fetch){
 let cookie='';
 async function request(path,body){
  const response=await fetcher(options.base+path,{method:'POST',redirect:'error',signal:AbortSignal.timeout(100000),headers:{origin:options.base,'content-type':'application/json',...(cookie?{cookie}:{})},body:JSON.stringify(body)});
  if(path==='/api/auth/login'&&response.ok)cookie=response.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');
  if(!response.ok)throw Error(path==='/api/auth/login'?'Local login failed. Set SMARTDETECTOR_REPLAY_USER and SMARTDETECTOR_REPLAY_PASSWORD.':`Replay request failed (HTTP ${response.status}). Ensure local Compose is rebuilt; live mode also needs AutoVision.`);
  return response.json();
 }
 await request('/api/auth/login',{username:env.SMARTDETECTOR_REPLAY_USER??'root',password:env.SMARTDETECTOR_REPLAY_PASSWORD??'smartdetector-local-change-me'});
 for(let i=0;i<options.count;i++){
  const result=await request('/api/local/replay',{sample:options.sample,mode:options.mode,...(options.camera?{camera:options.camera}:{})});
  console.log(JSON.stringify({event:i+1,...result,eventUrl:options.base+'/events/'+encodeURIComponent(result.incidentId)}));
  if(i+1<options.count)await delay(options.interval*1000);
 }
}
async function main(){
 try{const options=replayOptions(process.argv.slice(2));console.log(options.mode==='recorded'?'Recorded sample replay: no Ring, AutoVision or Bedrock calls.':'Live sample analysis: uses configured AutoVision quota; classify=false.');await runReplay(options)}catch(error){console.error(error.message);process.exitCode=1}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)void main();
