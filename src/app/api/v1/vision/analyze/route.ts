import {NextRequest, NextResponse} from "next/server";
import {operator} from "@/lib/operator";
import {agent} from "@/lib/http";
import {readBody} from "@/lib/read-body";
import {analyzeFrames} from "@/lib/vision-analysis";
export async function POST(req: NextRequest) {
  const s = await operator(req), a = await agent(req);
  if ((!s || s.role === "viewer") && !a) return NextResponse.json({error: "forbidden"}, {status: 403});
  const orgId = s && s.role !== 'viewer' ? s.orgId : a!.tenantId;
  try {const v = JSON.parse(await readBody(req, 4000000));return NextResponse.json(await analyzeFrames(orgId, v.device_id, v.frames, v.classify ?? true));} catch {return NextResponse.json({error: "Analysis unavailable; validate frames and the AutoVision system service"}, {status: 400});}
}
