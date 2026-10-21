import {objectDetections,detectionFrames} from './object-detections';
type ObjectValue = Record<string, unknown>;
const object = (v: unknown): ObjectValue => v && typeof v === 'object' && !Array.isArray(v) ? v as ObjectValue : {};
const text = (v: unknown) => typeof v === 'string' ? v : '';
const inspectionStatuses=['not_requested','not_triggered','tool_complete','complete','needs_review','unavailable','quota_exhausted','budget_exhausted'];
// Compact, idempotent projection of AutoVision enhanced inspection. Tool inputs/outputs (crops, nested results) are never retained.
export function inspectionSummary(value:unknown){
  const v=object(value);if(!inspectionStatuses.includes(text(v.status)))return null;
  const trace=Array.isArray(v.trace)?v.trace.slice(0,8).flatMap((t,i)=>{const s=object(t);return /^[a-z_]{1,40}$/.test(text(s.tool))&&/^[a-z_]{1,40}$/.test(text(s.status))?[{step:Number.isInteger(s.step)?s.step as number:i,tool:text(s.tool),status:text(s.status),duration_ms:typeof s.duration_ms==='number'&&Number.isFinite(s.duration_ms)&&s.duration_ms>=0?Math.round(s.duration_ms):null,...(text(s.reason)?{reason:text(s.reason).slice(0,300)}:{})}]:[]}):[];
  return {status:text(v.status),review_recommended:v.review_recommended===true,reason:text(v.reason).slice(0,500),...(text(v.model)?{model:text(v.model).slice(0,120)}:{}),followup_count:Number.isInteger(v.followup_count)?Math.max(0,Math.min(2,v.followup_count as number)):0,images_sent_to_bedrock:v.images_sent_to_bedrock===true,trace};
}
export function eventView(payload: unknown) {
  let value = object(payload);
  const aiSummary = text(value.aiAssessment);
  // Worker enrichment wraps the original observations; unwrap without losing context.
  for (let i = 0; i < 3 && !value.kind && !value.signal && value.observations && !Array.isArray(value.observations); i++) value = object(value.observations);
  const signal = object(value.signal), classification = object(value.classification);
  const source = text(value.source) || (signal.simulated === true ? 'simulator' : 'sensor');
  const kind = text(signal.type) || (value.kind === 'vision-review' ? 'visual observation' : 'event');
  const thumbnail = text(value.thumbnail);
  // Display only bounded raster data, never arbitrary tracking URLs or active SVG.
  const preview = /^data:image\/(jpeg|png|webp);base64,[a-zA-Z0-9+/]+=*$/.test(thumbnail) && thumbnail.length <= 200000 ? thumbnail : '';
  const observations = Array.isArray(value.observations) ? value.observations.slice(0, 50).map(v => {
    const row = object(v);
    return { type: text(row.type), value: typeof row.value === 'number' && Number.isFinite(row.value) ? row.value : null, detected: row.detected === true, advisory: row.advisory === true };
  }) : [];
  const evidenceFrames=Array.isArray(value.evidenceFrames)?value.evidenceFrames.slice(0,12).flatMap(f=>{const v=object(f),p=text(v.preview);return typeof v.at_ms==='number'&&Number.isFinite(v.at_ms)&&v.at_ms>=0&&v.at_ms<=30000&&p.length<=60100&&/^data:image\/(jpeg|png);base64,[a-zA-Z0-9+/]+=*$/.test(p)?[{at_ms:v.at_ms,preview:p,detections:objectDetections(v.detections)}]:[]}):[];
  return { personNotify:value.kind!=='vision-review'||value.personNotify!==false, source, kind, preview, evidenceFrames, detectionFrames:detectionFrames(value.detectionFrames), synthetic: signal.simulated === true, aiSummary: aiSummary || text(classification.summary), assessment: text(value.assessment), observations, signalValue: typeof signal.value === 'number' ? signal.value : null, autoVisionJobId: text(value.autoVisionJobId), classificationStatus: text(classification.status), inspection: inspectionSummary(value.inspection), sentToBedrock: typeof value.sentToBedrock === 'boolean' ? value.sentToBedrock : null };
}
