import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('Ring claim and release alias DynamoDB attribute names',()=>{
  const source=readFileSync(new URL('../src/lib/ring-link.ts',import.meta.url),'utf8');
  assert.ok(source.includes("ConditionExpression:'#lease<:now AND #ttl>:seconds'"));
  assert.ok(source.includes("ExpressionAttributeNames:{'#lease':'lease','#ttl':'ttl'}"));
  assert.ok(source.includes("ConditionExpression:'#lease=:lease'"));
  assert.ok(!source.includes('AND ttl>'));
});
