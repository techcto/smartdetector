import{NextRequest,NextResponse}from'next/server';import{createSession,isSecureRequest,sessionCookie,verifySession,verifyVerifyEmailToken}from'@/lib/session';import{store}from'@/lib/store';import{returnPath}from'@/lib/return-path';import{defaultActiveOrgForUser}from'@/lib/org-resolve';
// Like Osirus: the emailed link opens a page that posts the token here, so mail scanners that prefetch links cannot use
// it. Verifying signs the user in and returns them to the page they started from. Sign-in happens only on the
// unverified -> verified transition, so an old link is not a reusable login, and another user's open session is kept.
export async function POST(req:NextRequest){
  const secret=process.env.SMARTDETECTOR_SESSION_SECRET??'';
  const {token,next}=await req.json().catch(()=>({})) as {token?:string;next?:string};
  const claim=await verifyVerifyEmailToken(token,secret);
  const user=claim&&await store.userById(claim.userId);
  if(!user||user.status!=='active'||user.email!==claim.email)return NextResponse.json({error:'This verification link has expired or was already replaced. Sign in to request a new one.'},{status:400});
  const destination=returnPath(next)??'/console';
  if(user.emailVerified!==false){const done=new URLSearchParams({verify:'done'});if(returnPath(next))done.set('next',destination);return NextResponse.json({redirect:`/login?${done}`})}
  await store.putUser({...user,emailVerified:true,updatedAt:new Date().toISOString()});
  const current=await verifySession(req.cookies.get(sessionCookie)?.value,secret);
  if(current&&current.id!==user.id)return NextResponse.json({redirect:'/console'});
  const active=await defaultActiveOrgForUser(user.id);
  if(!active)return NextResponse.json({redirect:'/login?verify=done'});
  const session=await createSession({id:user.id,username:user.username,role:active.role,orgId:active.orgId,expiresAt:Date.now()+28800000},secret),res=NextResponse.json({redirect:destination});
  res.cookies.set(sessionCookie,session,{httpOnly:true,sameSite:'lax',secure:isSecureRequest(req),path:'/',maxAge:28800});
  return res;
}
