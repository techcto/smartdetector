import {NextRequest, NextResponse} from "next/server";
import {operator} from "@/lib/operator";
import {issueTvAccess} from "@/lib/tv";
import {readBody} from "@/lib/read-body";
export async function POST(req: NextRequest) {
  const s = await operator(req); if (!s || !["root", "admin"].includes(s.role)) return NextResponse.json({error: "forbidden"}, {status: 403});
  try {const v = JSON.parse(await readBody(req, 1024)); if (typeof v.name !== "string" || !v.name.trim() || v.name.length > 80) throw new Error("Invalid name"); return NextResponse.json(await issueTvAccess(s.orgId, s.id, v.name), {headers: {"Cache-Control": "no-store"}});} catch {return NextResponse.json({error: "Unable to create display access"}, {status: 400});}
}
