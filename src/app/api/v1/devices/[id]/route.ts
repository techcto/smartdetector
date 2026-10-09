import { NextRequest, NextResponse } from 'next/server';
import { readIdentity } from '@/lib/api-keys';
import { store } from '@/lib/store';
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const identity = await readIdentity(req, 'devices:read');
  if (!identity) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await context.params;
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) return NextResponse.json({ error: 'Invalid device ID' }, { status: 400 });
  const v = await store.node(identity.orgId, id);
  return v ? NextResponse.json({ serverId: v.serverId, displayName: v.displayName, platform: v.platform, tags: v.tags, status: v.status, createdAt: v.createdAt, lastHeartbeat: v.lastHeartbeat }, { headers: { 'cache-control': 'no-store' } }) : NextResponse.json({ error: 'not found' }, { status: 404 });
}
