import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import type { NextRequest } from 'next/server';
import { store } from './store';
import { operator } from './operator';

export const apiScopes = ['events:read', 'devices:read'] as const;
export type ApiScope = typeof apiScopes[number];
type ApiKey = { id: string; orgId: string; name: string; scopes: ApiScope[]; digest: string; createdAt: string; expiresAt: number; createdBy: string };
const table = process.env.SMARTDETECTOR_TABLE;
const db = DynamoDBDocumentClient.from(new DynamoDBClient({ endpoint: process.env.SMARTDETECTOR_DYNAMODB_ENDPOINT }));
const globalKeys = globalThis as typeof globalThis & { smartdetectorApiKeys?: Map<string, ApiKey> };
const memory = globalKeys.smartdetectorApiKeys ??= new Map();
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export function publicApiKey(key: ApiKey) {
  return { id: key.id, orgId: key.orgId, name: key.name, scopes: key.scopes, createdAt: key.createdAt, expiresAt: key.expiresAt, createdBy: key.createdBy };
}
export async function createApiKey(orgId: string, createdBy: string, input: { name: string; scopes: ApiScope[]; expiresInDays: number }) {
  if (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 80 || !Array.isArray(input.scopes) || !input.scopes.length || input.scopes.some(s => !apiScopes.includes(s)) || !Number.isInteger(input.expiresInDays) || input.expiresInDays < 1 || input.expiresInDays > 365) throw new Error('Invalid API key settings');
  if (!await store.organizationById(orgId)) throw new Error('Organization not found');
  const id = randomUUID(), secret = randomBytes(32).toString('base64url');
  const token = `sd_${orgId}.${id}.${secret}`;
  const key: ApiKey = { id, orgId, createdBy, name: input.name.trim(), scopes: [...new Set(input.scopes)], digest: hash(token), createdAt: new Date().toISOString(), expiresAt: Date.now() + input.expiresInDays * 86400000 };
  if (table) await db.send(new PutCommand({ TableName: table, Item: { pk: `ORG#${orgId}`, sk: `APIKEY#${id}`, ...key }, ConditionExpression: 'attribute_not_exists(pk)' }));
  else memory.set(`${orgId}:${id}`, key);
  return { ...publicApiKey(key), token };
}
export async function listApiKeys(orgId: string) {
  await store.organizationById(orgId);
  if (!table) return [...memory.values()].filter(k => k.orgId === orgId).map(publicApiKey);
  const result = await db.send(new QueryCommand({ TableName: table, KeyConditionExpression: 'pk=:pk AND begins_with(sk,:prefix)', ExpressionAttributeValues: { ':pk': `ORG#${orgId}`, ':prefix': 'APIKEY#' }, ConsistentRead: true }));
  return (result.Items ?? []).map(row => publicApiKey(row as ApiKey));
}
export async function revokeApiKey(orgId: string, id: string) {
  if (!/^[a-zA-Z0-9-]{1,128}$/.test(id)) throw new Error('Invalid key ID');
  if (table) await db.send(new DeleteCommand({ TableName: table, Key: { pk: `ORG#${orgId}`, sk: `APIKEY#${id}` } }));
  else memory.delete(`${orgId}:${id}`);
}
export async function verifyApiKey(token: string, scope: ApiScope) {
  const parts = /^sd_([a-zA-Z0-9-]{1,128})\.([a-zA-Z0-9-]{1,128})\.([a-zA-Z0-9_-]{43})$/.exec(token);
  if (!parts) return null;
  const [, orgId, id] = parts;
  let key: ApiKey | undefined;
  if (table) { const result = await db.send(new GetCommand({ TableName: table, Key: { pk: `ORG#${orgId}`, sk: `APIKEY#${id}` }, ConsistentRead: true })); key = result.Item as ApiKey | undefined; }
  else key = memory.get(`${orgId}:${id}`);
  if (!key || key.orgId !== orgId || key.expiresAt <= Date.now() || !key.scopes.includes(scope)) return null;
  const actual = Buffer.from(hash(token)), expected = Buffer.from(key.digest);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected) || !await store.organizationById(orgId)) return null;
  return { orgId, keyId: id };
}
export async function readIdentity(req: NextRequest, scope: ApiScope) {
  // An explicitly supplied bearer token must never fall back to an operator cookie.
  const auth = req.headers.get('authorization');
  if (auth) return auth.startsWith('Bearer ') ? verifyApiKey(auth.slice(7), scope) : null;
  const session = await operator(req);
  return session ? { orgId: session.orgId } : null;
}
