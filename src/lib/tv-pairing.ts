import {createHash, randomBytes, timingSafeEqual} from 'node:crypto';
import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand} from '@aws-sdk/lib-dynamodb';
import {issueTvAccess} from './tv';
import {store} from './store';

type Pair = {pk: string; sk: string; deviceHash: string; name: string; status: 'pending' | 'approving' | 'approved'; ttl: number; token?: string; expiresAt?: number};
const memory = new Map<string, Pair>();
const db = DynamoDBDocumentClient.from(new DynamoDBClient({endpoint: process.env.SMARTDETECTOR_DYNAMODB_ENDPOINT}));
const hash = (v: string) => createHash('sha256').update(v).digest('hex');
function key(code: string) {return {pk: 'TVPAIR#' + hash(code.replace(/-/g, '').toUpperCase()), sk: 'PAIR'};}
export async function beginTvPairing(name: string, now = Date.now()) {
  if (!name.trim() || name.length > 80) throw new Error('Invalid display name');
  if (process.env.SMARTDETECTOR_DYNAMODB_ENDPOINT) await store.organizationById('local-table-initialization');
  for (const [id, row] of memory) if (row.ttl * 1000 <= now) memory.delete(id);
  const code = randomBytes(5).toString('hex').toUpperCase();
  const userCode = code.slice(0,5) + '-' + code.slice(5), deviceCode = code + '.' + randomBytes(32).toString('base64url');
  const row: Pair = {...key(code), deviceHash: hash(deviceCode), name, status: 'pending', ttl: Math.floor(now / 1000) + 600};
  if (process.env.SMARTDETECTOR_TABLE) await db.send(new PutCommand({TableName: process.env.SMARTDETECTOR_TABLE, Item: row, ConditionExpression: 'attribute_not_exists(pk)'}));
  else memory.set(row.pk, row);
  return {userCode, deviceCode, expiresAt: row.ttl * 1000, interval: 5};
}
async function read(code: string, now = Date.now()) {
  if (!/^[A-F0-9]{5}-?[A-F0-9]{5}$/i.test(code)) return null;
  const k = key(code), row = process.env.SMARTDETECTOR_TABLE ? (await db.send(new GetCommand({TableName: process.env.SMARTDETECTOR_TABLE, Key: k, ConsistentRead: true}))).Item as Pair | undefined : memory.get(k.pk);
  return row && row.ttl * 1000 > now ? row : null;
}
export async function inspectTvPairing(code: string) {const row = await read(code); return row?.status === 'pending' ? {name: row.name, expiresAt: row.ttl * 1000} : null;}
export async function approveTvPairing(code: string, orgId: string, userId: string) {
  const row = await read(code); if (!row || row.status !== 'pending') throw new Error('Code expired or already approved');
  if (process.env.SMARTDETECTOR_TABLE) await db.send(new UpdateCommand({TableName: process.env.SMARTDETECTOR_TABLE, Key: key(code), UpdateExpression: 'SET #s = :next', ConditionExpression: '#s = :pending AND #t > :now', ExpressionAttributeNames: {'#s': 'status', '#t': 'ttl'}, ExpressionAttributeValues: {':next': 'approving', ':pending': 'pending', ':now': Math.floor(Date.now()/1000)}}));
  else {row.status = 'approving';}
  try {
    const access = await issueTvAccess(orgId, userId, row.name);
    if (process.env.SMARTDETECTOR_TABLE) await db.send(new UpdateCommand({TableName: process.env.SMARTDETECTOR_TABLE, Key: key(code), UpdateExpression: 'SET #s = :s, #token = :token, expiresAt = :expires', ExpressionAttributeNames: {'#s': 'status', '#token': 'token'}, ExpressionAttributeValues: {':s': 'approved', ':token': access.token, ':expires': access.expiresAt}}));
    else {row.status = 'approved'; row.token = access.token; row.expiresAt = access.expiresAt;}
    return {approved: true};
  } catch (error) {
    if (!process.env.SMARTDETECTOR_TABLE) row.status = 'pending';
    else await db.send(new UpdateCommand({TableName: process.env.SMARTDETECTOR_TABLE, Key: key(code), UpdateExpression: 'SET #s = :s', ExpressionAttributeNames: {'#s': 'status'}, ExpressionAttributeValues: {':s': 'pending'}}));
    throw error;
  }
}
export async function pollTvPairing(deviceCode: string, now = Date.now()) {
  if (!/^[A-F0-9]{10}\.[A-Za-z0-9_-]{43}$/.test(deviceCode)) return {error: 'invalid_device_code'};
  const row = await read(deviceCode.split('.')[0], now);
  if (!row) return {error: 'expired_token'};
  if (!timingSafeEqual(Buffer.from(row.deviceHash, 'hex'), Buffer.from(hash(deviceCode), 'hex'))) return {error: 'invalid_device_code'};
  if (row.status !== 'approved') return {error: 'authorization_pending'};
  return {token: row.token, expiresAt: row.expiresAt};
}
