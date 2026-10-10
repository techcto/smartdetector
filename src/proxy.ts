import {NextRequest,NextResponse} from 'next/server';
import {sessionCookie,verifySession} from '@/lib/session';
export async function proxy(req:NextRequest){
  const p=req.nextUrl.pathname;
  if(/^\/brand\/smartdetector-(wordmark|square|icon)\.svg$/.test(p))return NextResponse.next();
  if(p==='/ring/link'||p==='/api/v1/integrations/ring/link'||p.startsWith('/api/v1/integrations/ring/token/')||p==='/api/demo/analyze'||/^\/demo\/(dogs-in-yard|door-visitor)\.mp4$/.test(p))return NextResponse.next();
  if(p==='/signup'||p==='/'||/^\/demo\/(package-delivery\.(mp4|jpg)|dogs-in-yard\.jpg|door-visitor\.jpg|delivery-captions\.vtt|credits\.json)$/.test(p)||p==='/api-reference'||p==='/docs/mcp'||/^\/api\/v1\/(incidents|devices)(\/[a-zA-Z0-9_-]{1,128})?$/.test(p)||p==='/tv'||p==='/developers'||p.startsWith('/api/v1/integrations/ring/webhook/')||p==='/api/v1/tv/pair'||p==='/api/v1/tv/feed'||p==='/api/v1/vision/analyze'||p.startsWith('/login')||p.startsWith('/api/auth/')||p==='/api/health'||p==='/api/v1/signals'||p==='/api/v1/detect'||p==='/api/v1/vision'||p==='/api/billing/webhook')return NextResponse.next();
  const s=await verifySession(req.cookies.get(sessionCookie)?.value,process.env.SMARTDETECTOR_SESSION_SECRET??'');
  if(s)return NextResponse.next();
  if(p.startsWith('/api/'))return NextResponse.json({error:'unauthorized'},{status:401});
  const login=new URL('/login',req.url);if(p==='/tv/connect'||p==='/console')login.searchParams.set('next',p);return NextResponse.redirect(login);
}
export const config={matcher:['/((?!_next/static|_next/image|favicon.ico).*)']};
