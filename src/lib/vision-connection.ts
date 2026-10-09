// Installation-level service credential; never return it to clients.
export async function connection(_orgId?: string) {return process.env.SMARTDETECTOR_AUTOVISION_API_KEY?.trim() || '';}

