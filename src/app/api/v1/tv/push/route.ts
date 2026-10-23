import { NextRequest, NextResponse } from "next/server";
import { readBody } from "@/lib/read-body";
import { registerTvPush } from "@/lib/tv-push";
import { authorizeTv } from "@/lib/tv";
export async function GET(req: NextRequest) {
  const access = await authorizeTv(req.headers.get("authorization")?.replace(/^Bearer /, "") || "");
  if (!access) return NextResponse.json({error:"Display access expired or revoked"},{status:401,headers:{"Cache-Control":"no-store"}});
  return NextResponse.json({configured:process.env.SMARTDETECTOR_ADM_ENABLED === "true"},{headers:{"Cache-Control":"no-store"}});
}
export async function POST(req: NextRequest) {
  try {
    const body = JSON.parse(await readBody(req, 8192));
    if (body.registrationId !== null && process.env.SMARTDETECTOR_ADM_ENABLED !== "true") return NextResponse.json({error:"Background TV alerts are not configured"},{status:503});
    if (body.registrationId !== null && typeof body.registrationId !== "string")
      return NextResponse.json(
        { error: "Invalid registration" },
        { status: 400 }
      );
    const result = await registerTvPush(
      req.headers.get("authorization")?.replace(/^Bearer /, "") || "",
      body.registrationId
    );
    return NextResponse.json(
      result ?? { error: "Display access expired or revoked" },
      { status: result ? 200 : 401, headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { error: "Unable to register TV alerts" },
      { status: 400 }
    );
  }
}
