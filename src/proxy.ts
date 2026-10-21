import {NextRequest,NextResponse} from 'next/server';
import {sessionCookie,verifySession} from '@/lib/session';
export async function proxy(req:NextRequest){
  const p=req.nextUrl.pathname;
  // Private installs: locations, users and billing do not exist (same rule as AutoVision).
  if(process.env.SMARTDETECTOR_DEPLOYMENT_MODE!=='saas'&&(p==='/users'||p.startsWith('/users/')||p==='/organizations'||p.startsWith('/organizations/')||p==='/locations'||p.startsWith('/locations/')||p.startsWith('/admin/organizations')||p.startsWith('/admin/users')||p.startsWith('/admin/devices')||p==='/billing'||p==='/settings/billing'||p==='/api/v1/users'||p.startsWith('/api/v1/users/')||p==='/api/v1/billing/plan'))return new NextResponse('Not available in private mode',{status:404});
  if(/^\/demo\/(intruder|dognight|backyardintruder|package)(\.mp4|-analysis\.json|-poster\.jpg)$/.test(p))return NextResponse.next();
  // These routes authenticate signed Ring callbacks or scoped bearer credentials themselves.
  if(p==='/api/v1/events/search'||p==='/api/v1/integrations/ring/token'||p==='/api/v1/integrations/ring/webhook')return NextResponse.next();
  if(/^\/brand\/smartdetector-(wordmark|square|icon)\.svg$/.test(p))return NextResponse.next();
  if(p==='/ring/link'||p==='/api/v1/integrations/ring/link'||p.startsWith('/api/v1/integrations/ring/token/')||p==='/api/demo/analyze'||/^\/demo\/(dogs-in-yard|door-visitor)\.mp4$/.test(p))return NextResponse.next();
  if(p==='/privacy'||p==='/signup'||p==='/'||/^\/demo\/(package-delivery\.(mp4|jpg)|dogs-in-yard\.jpg|door-visitor\.jpg|delivery-captions\.vtt|credits\.json)$/.test(p)||p==='/api-reference'||p==='/docs/mcp'||/^\/api\/v1\/(incidents|devices)(\/[a-zA-Z0-9_-]{1,128})?$/.test(p)||p==='/tv'||p==='/developers'||p.startsWith('/api/v1/integrations/ring/webhook/')||p==='/api/v1/tv/pair'||p==='/api/v1/tv/feed'||p==='/api/v1/vision/analyze'||p.startsWith('/login')||p.startsWith('/api/auth/')||p==='/api/health'||p==='/api/v1/signals'||p==='/api/v1/detect'||p==='/api/v1/vision'||p==='/api/billing/webhook')return NextResponse.next();
  const s=await verifySession(req.cookies.get(sessionCookie)?.value,process.env.SMARTDETECTOR_SESSION_SECRET??'');
  if(s)return NextResponse.next();
  if(p.startsWith('/api/'))return NextResponse.json({error:'unauthorized'},{status:401});
  const login=new URL('/login',req.url);if(p==='/tv/connect'||p==='/console'||p==='/settings/account-deletion'||p==='/settings/data-deletion')login.searchParams.set('next',p==='/tv/connect'&&/^[A-F0-9]{5}-[A-F0-9]{5}$/i.test(req.nextUrl.searchParams.get('code')??'')?p+'?code='+encodeURIComponent(req.nextUrl.searchParams.get('code')!):p);return NextResponse.redirect(login);
}
export const config={matcher:['/((?!_next/static|_next/image|favicon.ico).*)']};
