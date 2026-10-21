import { NextRequest, NextResponse } from "next/server";
import { readBody } from "@/lib/read-body";
import { registerTvPush } from "@/lib/tv-push";
export async function POST(req: NextRequest) {
  if (process.env.SMARTDETECTOR_ADM_ENABLED !== "true")
    return NextResponse.json(
      { error: "Background TV alerts are not configured" },
      { status: 503 }
    );
  try {
    const body = JSON.parse(await readBody(req, 8192));
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
