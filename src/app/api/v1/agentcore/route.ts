import { NextRequest, NextResponse } from 'next/server';
import { toolCatalog } from '@smartdetector/agentcore';
import { operator } from '@/lib/operator';
export async function GET(req: NextRequest) {
  if (!await operator(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return NextResponse.json({ tools: toolCatalog, transport: 'streamable-http', readOnly: true, documentation: 'https://github.com/techcto/smartdetector-agentcore', localEndpoint: 'http://localhost:8083/mcp' });
}
