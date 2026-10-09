import { NextRequest, NextResponse } from 'next/server';
import { operator } from '@/lib/operator';
import { createApiKey, listApiKeys, revokeApiKey } from '@/lib/api-keys';
import { readBody } from '@/lib/read-body';
import { requestOrigin } from '@/lib/session';
async function admin(req: NextRequest, mutation = false) {
  if (mutation && req.headers.get('origin') !== requestOrigin(req)) return null;
  const session = await operator(req);
  return session && ['root', 'admin'].includes(session.role) ? session : null;
}
export async function GET(req: NextRequest) {
  const session = await admin(req);
  return session ? NextResponse.json(await listApiKeys(session.orgId)) : NextResponse.json({ error: 'forbidden' }, { status: 403 });
}
export async function POST(req: NextRequest) {
  const session = await admin(req, true);
  if (!session) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  try { return NextResponse.json(await createApiKey(session.orgId, session.id, JSON.parse(await readBody(req, 4096))), { status: 201, headers: { 'cache-control': 'no-store' } }); }
  catch { return NextResponse.json({ error: 'Provide a name, read scopes and expiry of 1–365 days' }, { status: 400 }); }
}
export async function DELETE(req: NextRequest) {
  const session = await admin(req, true);
  if (!session) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  try { const { id } = JSON.parse(await readBody(req, 1024)); await revokeApiKey(session.orgId, id); return NextResponse.json({ deleted: true }); }
  catch { return NextResponse.json({ error: 'Invalid key ID' }, { status: 400 }); }
}
