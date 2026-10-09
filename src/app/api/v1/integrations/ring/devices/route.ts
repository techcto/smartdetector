import {NextRequest, NextResponse} from "next/server";
import {operator} from "@/lib/operator";
import {connectionCredentials} from "@/lib/providers";
import {RingClient} from "@/lib/ring";
export async function GET(req: NextRequest) {
  const s = await operator(req); if (!s || !["root", "admin", "operator"].includes(s.role)) return NextResponse.json({error: "forbidden"}, {status: 403});
  const config = await connectionCredentials(s.orgId, req.nextUrl.searchParams.get("connectionId") || "", "ring");
  if (!config?.accessToken) return NextResponse.json({error: "Configure a Ring access token"}, {status: 409});
  try {return NextResponse.json(await new RingClient(config.accessToken).devices());} catch {return NextResponse.json({error: "Ring discovery unavailable; check token and account access"}, {status: 503});}
}
