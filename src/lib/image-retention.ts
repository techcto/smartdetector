import type {IncidentRecord,Product,Settings,Subscription} from './model';
export const DAY_MS=86_400_000;
// A subscription alone never opts a workspace into longer storage.
export function imageRetention(settings:Settings,subscriptions:Subscription[],products:Product[],now=Date.now()){
 const paid=subscriptions.some(s=>s.status==='active'&&!!s.stripeSubscriptionId&&(!s.currentPeriodEnd||Date.parse(s.currentPeriodEnd)>now)&&products.some(p=>p.id===s.productId&&p.monthlyPrice>0));
 const requested=settings.privacy.imageRetentionDays??1;
 return {paid,days:paid&&Number.isInteger(requested)?Math.max(1,Math.min(365,requested)):1};
}
export function evidenceExpiry(row:Pick<IncidentRecord,'startedAt'|'ttl'>,days:number){
 const at=Date.parse(row.startedAt);
 // Malformed dates fail closed. Persisted deadlines never extend on upgrade.
 return Math.min(Number.isFinite(at)?at+days*DAY_MS:0,Number.isFinite(row.ttl)?row.ttl!*1000:Number.isFinite(at)?at+DAY_MS:0);
}
export function evidenceVisible(row:Pick<IncidentRecord,'startedAt'|'ttl'>,days:number,now=Date.now()){return evidenceExpiry(row,days)>now;}
