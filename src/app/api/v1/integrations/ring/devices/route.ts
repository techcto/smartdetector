import {NextRequest, NextResponse} from "next/server";
import {operator} from "@/lib/operator";
import {ringAccess} from "@/lib/ring-link";
import {RingClient} from "@/lib/ring";
export async function GET(req: NextRequest) {
  const s = await operator(req); if (!s || !["root", "admin", "operator"].includes(s.role)) return NextResponse.json({error: "forbidden"}, {status: 403});
  try {const config = await ringAccess(s.orgId, req.nextUrl.searchParams.get("connectionId") || "");return NextResponse.json(await new RingClient(config.accessToken).devices());} catch {return NextResponse.json({error: "Ring discovery unavailable; check token and account access"}, {status: 503});}
}
