import {test} from 'node:test';
import assert from 'node:assert/strict';
import {devFixturesEnabled,seedDevFixtures} from '../src/lib/dev-fixtures';
import {store} from '../src/lib/store';
const keys=['NODE_ENV','SMARTDETECTOR_TABLE','SMARTDETECTOR_DYNAMODB_ENDPOINT','SMARTDETECTOR_DEPLOYMENT_MODE'];
function withEnv(values:Record<string,string|undefined>,fn:()=>unknown){const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));const apply=(v:Record<string,string|undefined>)=>{for(const k of keys)if(v[k]===undefined)delete process.env[k];else Object.assign(process.env,{[k]:v[k]})};apply(values);try{return fn()}finally{apply(saved)}}
test('dev fixtures are enabled only for npm run dev or the local docker DynamoDB, never AWS',()=>{
 const on=(v:Record<string,string|undefined>)=>withEnv({SMARTDETECTOR_DEPLOYMENT_MODE:'saas',...v},devFixturesEnabled);
 assert.equal(on({NODE_ENV:'development'}),true,'npm run dev with the in-memory store');
 assert.equal(on({NODE_ENV:'production',SMARTDETECTOR_TABLE:'smartdetector-local',SMARTDETECTOR_DYNAMODB_ENDPOINT:'http://smartdetector-dynamodb:8000'}),true,'local docker stack');
 assert.equal(on({NODE_ENV:'production'}),false,'production build without a table');
 assert.equal(on({NODE_ENV:'development',SMARTDETECTOR_TABLE:'smartdetector-prod'}),false,'AWS tables have no endpoint override');
 assert.equal(on({NODE_ENV:'production',SMARTDETECTOR_TABLE:'smartdetector-prod',SMARTDETECTOR_DYNAMODB_ENDPOINT:'https://dynamodb.us-east-1.amazonaws.com'}),false,'remote endpoints are never seeded');
 assert.equal(withEnv({NODE_ENV:'development'},devFixturesEnabled),false,'private mode is never seeded');
 assert.equal(withEnv({SMARTDETECTOR_DEPLOYMENT_MODE:'on-premise',NODE_ENV:'production',SMARTDETECTOR_TABLE:'smartdetector-local',SMARTDETECTOR_DYNAMODB_ENDPOINT:'http://smartdetector-dynamodb:8000'},devFixturesEnabled),false,'private local docker stack is never seeded');
});
test('dev fixtures seed once into the in-memory SaaS store',async()=>{
 const env={NODE_ENV:process.env.NODE_ENV,SMARTDETECTOR_TABLE:process.env.SMARTDETECTOR_TABLE,SMARTDETECTOR_DEPLOYMENT_MODE:process.env.SMARTDETECTOR_DEPLOYMENT_MODE};
 try{
  Object.assign(process.env,{NODE_ENV:'production',SMARTDETECTOR_DEPLOYMENT_MODE:'saas'});delete process.env.SMARTDETECTOR_TABLE;
  assert.equal(await seedDevFixtures(),false,'production builds must not seed');
  Object.assign(process.env,{NODE_ENV:'development'});
  assert.equal(await seedDevFixtures(),true);
  assert.equal(await seedDevFixtures(),false,'seeding is idempotent per server');
  const harbor=(await store.organizations()).find(o=>o.name==='Harbor Cafe');assert.ok(harbor);
  assert.equal((await store.nodes(harbor.id)).length,3);
  const ava=await store.userByName('ava.patel');assert.ok(ava);assert.equal((await store.orgsForUser(ava.id)).length,2);
 }finally{for(const [k,v] of Object.entries(env))if(v===undefined)delete process.env[k];else Object.assign(process.env,{[k]:v})}
});
