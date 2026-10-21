import type {IncidentRecord,Product,Settings,Subscription} from './model';
export const DAY_MS=86_400_000;
// Events saved before per-event deadlines existed are never deleted before this date, giving paid admins time to choose retention.
export const LEGACY_GRACE_END=Date.parse('2026-12-01T00:00:00Z');
// A subscription alone never opts a workspace into longer storage. A card retry (past_due) keeps the admin's choice; the saved choice returns when payment resumes.
export function imageRetention(settings:Settings,subscriptions:Subscription[],products:Product[],now=Date.now()){
 const paid=subscriptions.some(s=>['active','past_due'].includes(s.status)&&!!s.stripeSubscriptionId&&(!s.currentPeriodEnd||Date.parse(s.currentPeriodEnd)>now)&&products.some(p=>p.id===s.productId&&p.monthlyPrice>0));
 const requested=settings.privacy.imageRetentionDays??1;
 return {paid,days:paid&&Number.isInteger(requested)?Math.max(1,Math.min(365,requested)):1};
}
export function evidenceExpiry(row:Pick<IncidentRecord,'startedAt'|'ttl'>,days:number){
 const at=Date.parse(row.startedAt);
 // Malformed dates fail closed. Persisted deadlines never extend on upgrade.
 if(!Number.isFinite(at))return 0;
 // Legacy rows have no deadline: follow the workspace period, protected until the one-time grace date.
 return Number.isFinite(row.ttl)?Math.min(at+days*DAY_MS,row.ttl!*1000):Math.max(at+days*DAY_MS,LEGACY_GRACE_END);
}
export function evidenceVisible(row:Pick<IncidentRecord,'startedAt'|'ttl'>,days:number,now=Date.now()){return evidenceExpiry(row,days)>now;}
