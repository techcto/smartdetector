/** Identity is an opt-in SmartDetector concern, never an AutoVision customer database. */
export type PersonPreferences={recognize:boolean;saveActivity:boolean;notify:boolean;family:boolean};
export type PersonMatch={personId:string;confidence:'confirmed'|'uncertain';preferences:PersonPreferences};
export type PersonAlertEvidence={
  matches:PersonMatch[];
  /** True only when every observed person has a confidently associated face. */
  completeCoverage:boolean;
  otherHazard:boolean;
};
/** Fail open for alerts: missing evidence, unknown people and hazards must not be muted. */
export function shouldNotifyPeople(evidence:PersonAlertEvidence):boolean{
  if(evidence.otherHazard||!evidence.completeCoverage||!evidence.matches.length)return true;
  return evidence.matches.some(m=>m.confidence!=='confirmed'||!m.preferences.recognize||m.preferences.notify);
}
export function maySavePersonActivity(preferences:PersonPreferences){return preferences.recognize&&preferences.saveActivity;}
export function validatePersonPreferences(value:unknown):PersonPreferences{
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid preferences');
  const input=value as Record<string,unknown>;
  if(Object.keys(input).some(k=>!['recognize','saveActivity','notify','family'].includes(k))||['recognize','saveActivity','notify','family'].some(k=>typeof input[k]!=='boolean'))throw Error('Invalid preferences');
  // Recognition cannot be disabled while still promising identity-specific suppression.
  if(!input.recognize&&!input.notify)throw Error('Recognition consent is required to mute personal alerts');
  return input as PersonPreferences;
}
