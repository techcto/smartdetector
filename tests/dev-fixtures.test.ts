import {test} from 'node:test';
import assert from 'node:assert/strict';
import {devFixturesEnabled,seedDevFixtures} from '../src/lib/dev-fixtures';
import {store} from '../src/lib/store';
const keys=['NODE_ENV','SMARTDETECTOR_TABLE','SMARTDETECTOR_DYNAMODB_ENDPOINT','SMARTDETECTOR_DEPLOYMENT_MODE'];
function withEnv(values:Record<string,string|undefined>,fn:()=>unknown){const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));const apply=(v:Record<string,string|undefined>)=>{for(const k of keys)if(v[k]===undefined)delete process.env[k];else Object.assign(process.env,{[k]:v[k]})};apply(values);try{return fn()}finally{apply(saved)}}
test('fixtures require private development and never seed SaaS or production',()=>{
 const on=(v:Record<string,string|undefined>)=>withEnv({SMARTDETECTOR_DEPLOYMENT_MODE:'on-premise',...v},devFixturesEnabled);
 assert.equal(on({NODE_ENV:'development'}),true,'private in-memory development');
 assert.equal(on({NODE_ENV:'development',SMARTDETECTOR_TABLE:'local',SMARTDETECTOR_DYNAMODB_ENDPOINT:'http://smartdetector-dynamodb:8000'}),true,'private development with local DynamoDB');
 for(const mode of ['saas','on-premise'])for(const endpoint of [undefined,'http://smartdetector-dynamodb:8000','https://dynamodb.us-east-1.amazonaws.com']){
  assert.equal(on({NODE_ENV:'production',SMARTDETECTOR_DEPLOYMENT_MODE:mode,SMARTDETECTOR_TABLE:endpoint?'table':undefined,SMARTDETECTOR_DYNAMODB_ENDPOINT:endpoint}),false,'all production configurations are disabled');
  if(mode==='saas')assert.equal(on({NODE_ENV:'development',SMARTDETECTOR_DEPLOYMENT_MODE:mode,SMARTDETECTOR_TABLE:endpoint?'table':undefined,SMARTDETECTOR_DYNAMODB_ENDPOINT:endpoint}),false,'local SaaS is disabled too');
 }
 assert.equal(on({NODE_ENV:'development',SMARTDETECTOR_TABLE:'prod'}),false,'AWS tables are disabled');
 assert.equal(on({NODE_ENV:'development',SMARTDETECTOR_TABLE:'prod',SMARTDETECTOR_DYNAMODB_ENDPOINT:'https://dynamodb.us-east-1.amazonaws.com'}),false,'remote endpoints are disabled');
 assert.equal(withEnv({NODE_ENV:'development'},devFixturesEnabled),false,'private mode must be explicit');
});
test('dev fixtures seed once into the in-memory private store',async()=>{
 const env={NODE_ENV:process.env.NODE_ENV,SMARTDETECTOR_TABLE:process.env.SMARTDETECTOR_TABLE,SMARTDETECTOR_DEPLOYMENT_MODE:process.env.SMARTDETECTOR_DEPLOYMENT_MODE};
 try{
  Object.assign(process.env,{NODE_ENV:'production',SMARTDETECTOR_DEPLOYMENT_MODE:'on-premise'});delete process.env.SMARTDETECTOR_TABLE;
  assert.equal(await seedDevFixtures(),false,'production builds must not seed');
  Object.assign(process.env,{NODE_ENV:'development'});
  Object.assign(process.env,{NODE_ENV:'production'});assert.equal(await seedDevFixtures(),false);
  Object.assign(process.env,{NODE_ENV:'development',SMARTDETECTOR_DEPLOYMENT_MODE:'saas'});assert.equal(await seedDevFixtures(),false);
  Object.assign(process.env,{SMARTDETECTOR_DEPLOYMENT_MODE:'on-premise'});
  assert.equal(await seedDevFixtures(),true);
  assert.equal(await seedDevFixtures(),false,'seeding is idempotent per server');
  const harbor=(await store.organizations()).find(o=>o.name==='Harbor Cafe');assert.ok(harbor);
  assert.equal((await store.nodes(harbor.id)).length,3);
  const ava=await store.userByName('ava.patel');assert.ok(ava);assert.equal((await store.orgsForUser(ava.id)).length,2);
 }finally{for(const [k,v] of Object.entries(env))if(v===undefined)delete process.env[k];else Object.assign(process.env,{[k]:v})}
});
