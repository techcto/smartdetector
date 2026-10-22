// Same-origin pages that sign-in may return to; anything else lands on /console. Shared by the login form and the
// verification link, which carries the destination through signup, so neither becomes an open redirect.
export function returnPath(next:string|null|undefined){return next==='/settings/account-deletion'||next==='/settings/data-deletion'||next==='/tv/connect'||/^\/tv\/connect\?code=[A-F0-9]{5}-[A-F0-9]{5}$/i.test(next??'')||/^\/devices(\/[a-zA-Z0-9_-]{1,128}){0,3}$/.test(next??'')||next?.startsWith('/ring/link?')?next!:null}
