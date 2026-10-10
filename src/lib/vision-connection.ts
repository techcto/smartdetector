// Installation-level service credential; never return it to clients.
import {visionConfig} from './system-vision';
export async function connection(_orgId?: string) {return (await visionConfig()).apiKey;}

