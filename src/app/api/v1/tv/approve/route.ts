import {NextRequest, NextResponse} from 'next/server';
import {operator} from '@/lib/operator';
import {approveTvPairing, inspectTvPairing} from '@/lib/tv-pairing';
import {readBody} from '@/lib/read-body';
import {store} from '@/lib/store';
export async function GET(req: NextRequest) {
  const s = await operator(req); if (!s || !['root','admin'].includes(s.role)) return NextResponse.json({error: 'forbidden'}, {status: 403});
  const pair = await inspectTvPairing(req.nextUrl.searchParams.get('code') || '');
  const org = pair ? await store.organizationById(s.orgId) : null;
  return NextResponse.json(pair ? {...pair, orgId: s.orgId, orgName: org?.name || s.orgId} : {error: 'Invalid, expired, or used code'}, {status: pair ? 200 : 404, headers: {'Cache-Control': 'no-store'}});
}
export async function POST(req: NextRequest) {
  let origin: URL; try {origin = new URL(req.headers.get('origin') || '');} catch {return NextResponse.json({error: 'Invalid origin'}, {status: 403});}
  // Host is the browser-facing authority; nextUrl can contain the internal container port.
  if (!['http:','https:'].includes(origin.protocol) || origin.host !== req.headers.get('host')) return NextResponse.json({error: 'Invalid origin'}, {status: 403});
  const s = await operator(req); if (!s || !['root','admin'].includes(s.role)) return NextResponse.json({error: 'forbidden'}, {status: 403});
  try {const body = JSON.parse(await readBody(req, 1024)); if (typeof body.code !== 'string' || body.orgId !== s.orgId) throw new Error(); return NextResponse.json(await approveTvPairing(body.code, s.orgId, s.id));}
  catch {return NextResponse.json({error: 'Code expired, used, or unavailable'}, {status: 400});}
}
