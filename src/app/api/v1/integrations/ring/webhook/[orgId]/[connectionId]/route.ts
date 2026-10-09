import {NextRequest, NextResponse} from "next/server";
import {connectionCredentials} from "@/lib/providers";
import {parseRingEvent, verifyRingSignature} from "@/lib/ring";
import {queueRingEvent} from "@/lib/ring-jobs";
import {readBody} from "@/lib/read-body";
export async function POST(req: NextRequest, context: {params: Promise<{orgId: string; connectionId: string}>}) {
  const {orgId, connectionId} = await context.params;
  const config = await connectionCredentials(orgId, connectionId, "ring");
  if (!config?.hmacKey) return NextResponse.json({error: "unauthorized"}, {status: 401});
  let raw: string; try {raw = await readBody(req, 65536);} catch {return NextResponse.json({error: "Invalid webhook body"}, {status: 413});}
  if (!verifyRingSignature(raw, req.headers.get("x-signature") || "", config.hmacKey)) return NextResponse.json({error: "unauthorized"}, {status: 401});
  let event; try {event = parseRingEvent(raw);} catch {return NextResponse.json({error: "Invalid or unsupported Ring event"}, {status: 400});}
  if (event.accountId !== config.accountId) return NextResponse.json({error: "account mismatch"}, {status: 403});
  try {const jobId = await queueRingEvent(orgId, connectionId, event); return NextResponse.json({accepted: true, jobId});} catch {return NextResponse.json({error: "Queue unavailable; retry delivery"}, {status: 503});}
}
