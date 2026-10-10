import recording from '../../assets/demo/results.json';
export class DemoError extends Error{constructor(message:string,public status:number){super(message)}}
export function validateScenario(value:unknown){
 if(!Number.isInteger(value)||Number(value)<0||Number(value)>=recording.samples.length)throw new DemoError('Choose a supported sample clip',400);
 return Number(value);
}
// Public playback is deliberately offline: never invoke AutoVision or Bedrock here.
export function demoRecording(value:unknown){return {analysis:recording.samples[validateScenario(value)],prerecorded:true,recorded_at:recording.recorded_at,notification_mode:'preview_only'}}
export async function analyzeDemo(value:unknown){return demoRecording(value)}
