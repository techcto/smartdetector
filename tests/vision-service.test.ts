import {test} from 'node:test';
import assert from 'node:assert/strict';
import {connection} from '../src/lib/vision-connection';
import {providers} from '../src/lib/providers';
import {readFileSync} from 'node:fs';
test('AutoVision falls back to the installation environment, not workspace providers',async()=>{
  const previous=process.env.SMARTDETECTOR_AUTOVISION_API_KEY;
  try{
    delete process.env.SMARTDETECTOR_AUTOVISION_API_KEY;
    assert.equal(await connection('synthetic-a'),'');
    process.env.SMARTDETECTOR_AUTOVISION_API_KEY='synthetic-service-key';
    assert.equal(await connection('synthetic-a'),'synthetic-service-key');
    assert.equal(await connection('synthetic-b'),'synthetic-service-key');
    assert.ok(!providers.some(p=>p.key==='autovision'));
  }finally{if(previous===undefined)delete process.env.SMARTDETECTOR_AUTOVISION_API_KEY;else process.env.SMARTDETECTOR_AUTOVISION_API_KEY=previous;}
});
test('both CloudFormation launch modes inject the service secret and URL into all application tasks',()=>{
  for(const file of ['smartdetector.yaml','smartdetector-existing.yaml']){
    const template=JSON.parse(readFileSync('devops/cloudformation/'+file,'utf8'));
    assert.ok(template.Parameters.AutoVisionApiKeySecretArn);
    const tasks=Object.values(template.Resources).filter((r:any)=>r.Type==='AWS::ECS::TaskDefinition') as any[];
    assert.equal(tasks.length,3);
    for(const task of tasks)for(const c of task.Properties.ContainerDefinitions){
      assert.ok(c.Environment.some((e:any)=>e.Name==='SMARTDETECTOR_AUTOVISION_URL'));
      assert.ok(c.Secrets.some((s:any)=>s['Fn::If']?.[1]?.Name==='SMARTDETECTOR_AUTOVISION_API_KEY'));
    }
  }
});
