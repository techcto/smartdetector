export function nativeMessaging<T>(operation:()=>Promise<T>, timeoutMs?:number):Promise<T>;
export function refreshSummary(devices:number,events:number,now?:Date):string;
