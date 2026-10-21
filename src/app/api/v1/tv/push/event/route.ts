import { NextRequest, NextResponse } from "next/server";
import { tvPushEvent } from "@/lib/tv-push";
export async function GET(req: NextRequest) {
  const result = await tvPushEvent(
    req.headers.get("authorization")?.replace(/^Bearer /, "") || ""
  );
  return NextResponse.json(
    result ?? { error: "Notification expired or unavailable" },
    { status: result ? 200 : 401, headers: { "Cache-Control": "no-store" } }
  );
}
