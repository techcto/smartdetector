import {NextRequest, NextResponse} from 'next/server';
import {beginTvPairing, pollTvPairing} from '@/lib/tv-pairing';
import {readBody} from '@/lib/read-body';
export async function POST(req: NextRequest) {
  try {
    const body = JSON.parse(await readBody(req, 1024));
    if (typeof body.deviceCode === 'string') return NextResponse.json(await pollTvPairing(body.deviceCode), {headers: {'Cache-Control': 'no-store'}});
    if (typeof body.name !== 'string' || !body.name.trim() || body.name.length > 80) return NextResponse.json({error: 'Invalid display name'}, {status: 400});
    return NextResponse.json({...await beginTvPairing(body.name.trim()), verificationUri: '/tv/connect'}, {headers: {'Cache-Control': 'no-store'}});
  } catch {return NextResponse.json({error: 'Pairing unavailable'}, {status: 503});}
}
