export async function register(){
 if(process.env.NEXT_RUNTIME!=='nodejs')return;
 const fixtures=await import('./lib/dev-fixtures');
 if(fixtures.devFixturesEnabled())await fixtures.seedDevFixtures().catch(e=>console.error('SmartDetector dev fixtures failed',e));
}
