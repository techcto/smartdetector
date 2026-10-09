import { NextRequest, NextResponse } from 'next/server';
import { readIdentity } from '@/lib/api-keys';
import { store } from '@/lib/store';
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const identity = await readIdentity(req, 'events:read');
  if (!identity) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await context.params;
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) return NextResponse.json({ error: 'Invalid event ID' }, { status: 400 });
  const v = await store.incident(identity.orgId, id);
  return v ? NextResponse.json({ incidentId: v.incidentId, serverId: v.serverId, state: v.state, startedAt: v.startedAt, updatedAt: v.updatedAt, payload: v.payload }, { headers: { 'cache-control': 'no-store' } }) : NextResponse.json({ error: 'not found' }, { status: 404 });
}
