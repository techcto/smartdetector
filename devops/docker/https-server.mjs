import {execFileSync} from 'node:child_process';
import {createServer} from 'node:https';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import next from 'next';

// ALB HTTPS targets support self-signed certificates. Each task has its own
// ephemeral key; ingress is restricted to the ALB SG. Fargate 1.4 encrypts
// temporary storage. Remove the private startup directory before listening.
const directory=mkdtempSync(join(tmpdir(),'smartdetector-tls-'));
let key,cert;
try{
  const filename=join(directory,'key.pem');
  cert=execFileSync('openssl',[
    'req','-x509','-newkey','rsa:2048','-nodes','-days','365',
    '-subj','/CN=smartdetector.internal','-keyout',filename,
  ],{stdio:['ignore','pipe','ignore'],maxBuffer:16384});
  key=readFileSync(filename);
}finally{rmSync(directory,{recursive:true,force:true});}
const port=Number(process.env.PORT??3000);
const hostname=process.env.HOSTNAME??'0.0.0.0';
const app=next({dev:false,hostname,port});
await app.prepare();
const handle=app.getRequestHandler();
const server=createServer({key,cert,minVersion:'TLSv1.2'},(req,res)=>{
  res.setHeader('Strict-Transport-Security','max-age=31536000');
  Promise.resolve(handle(req,res)).catch(()=>{
    if(!res.headersSent)res.writeHead(500);
    res.end();
  });
});
server.on('upgrade',app.getUpgradeHandler());
server.listen(port,hostname,()=>console.log(`HTTPS server listening on port ${port}`));
for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>{
  server.close(()=>{void app.close().then(()=>process.exit(0));});
  setTimeout(()=>process.exit(1),25000).unref();
});
