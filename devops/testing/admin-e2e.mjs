import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {chromium} from '@playwright/test';
// Synthetic data only: run against a local SaaS-mode app (in-memory store recommended; there is no organization delete API).
const base=process.env.SMARTDETECTOR_TEST_URL||'http://localhost:8082';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw new Error('This synthetic admin test is local-only');
const shots=process.env.SMARTDETECTOR_TEST_SCREENSHOTS;
const run=randomUUID().slice(0,8),orgName='Synthetic admin E2E '+run,userName='synthetic-admin-viewer-'+run,userPassword='synthetic-viewer-'+randomUUID();
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH});
async function login(page,username,password){await page.goto(base+'/login');await page.getByLabel('Username',{exact:true}).fill(username);await page.getByLabel('Password',{exact:true}).fill(password);await page.locator('form').getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL('**/console')}
const shot=async(page,name)=>{if(shots)await page.screenshot({path:`${shots}/${name}.png`,fullPage:true})};
try{
 const context=await browser.newContext(),page=await context.newPage();
 await login(page,process.env.SMARTDETECTOR_TEST_USER||'root',process.env.SMARTDETECTOR_TEST_PASSWORD||'smartdetector-local-change-me');
 await page.goto(base+'/admin');await page.waitForURL('**/admin/organizations');
 const nav=page.getByRole('navigation',{name:'Admin navigation'});
 for(const item of ['Organizations','Users','Devices','Settings'])await nav.getByRole('link',{name:item,exact:true}).waitFor();
 assert.equal(await nav.getByRole('link',{name:'Organizations',exact:true}).getAttribute('aria-current'),'page');
 // Admin is view-only; organizations are added on the existing Organizations page.
 assert.equal(await page.getByRole('button',{name:/Add (organization|location)/}).count(),0);
 await page.goto(base+'/organizations');await page.getByRole('button',{name:'Add location',exact:true}).click();
 await page.getByLabel('Location name').fill(orgName);await page.getByRole('button',{name:'Create',exact:true}).click();
 const enrollmentToken=(await page.locator('.smartdetector-drawer pre code').textContent()).trim();assert.ok(enrollmentToken);
 await page.goto(base+'/admin/organizations');
 await page.getByRole('link',{name:new RegExp(orgName)}).click();await page.waitForURL('**/admin/organizations/*');
 const orgId=page.url().split('/').pop();
 await page.getByRole('heading',{name:orgName,level:1}).waitFor();
 // Seed a member and a device through the product's own APIs.
 const api=context.request;
 assert.equal((await api.post(base+'/api/orgs/active',{data:{orgId}})).status(),200);
 const member=await api.post(base+'/api/v1/users',{data:{username:userName,displayName:'Synthetic Admin Viewer',password:userPassword,role:'viewer'}});assert.equal(member.status(),201,await member.text());const userId=(await member.json()).id;
 const signal=await api.post(base+'/api/v1/signals',{headers:{Authorization:`Bearer ${orgId}.admin-e2e.${enrollmentToken}`},data:{device_id:'admin-e2e-camera',type:'motion',value:7}});assert.equal(signal.status(),202,await signal.text());
 await page.reload();await page.getByRole('link',{name:/Synthetic Admin Viewer/}).waitFor();await page.getByRole('link',{name:'admin-e2e-camera',exact:true}).waitFor();await shot(page,'organization-detail');
 // Users: list -> detail shows organizations and connected devices only.
 await nav.getByRole('link',{name:'Users',exact:true}).click();await page.waitForURL('**/admin/users');
 await page.getByRole('link',{name:/Synthetic Admin Viewer/}).click();await page.waitForURL('**/admin/users/'+userId);
 await page.getByRole('heading',{name:'Synthetic Admin Viewer',level:1}).waitFor();
 await page.getByRole('link',{name:new RegExp(orgName)}).first().waitFor();await page.getByRole('link',{name:'admin-e2e-camera',exact:true}).waitFor();await shot(page,'user-detail');
 // Devices: list -> detail; inventory only, never event content or credentials.
 await nav.getByRole('link',{name:'Devices',exact:true}).click();await page.waitForURL('**/admin/devices');
 await page.getByRole('link',{name:'admin-e2e-camera',exact:true}).first().click();await page.waitForURL(`**/admin/devices/${orgId}/admin-e2e-camera`);
 await page.getByRole('heading',{name:'admin-e2e-camera',level:1}).waitFor();await page.getByRole('link',{name:/Synthetic Admin Viewer/}).waitFor();await shot(page,'device-detail');
 for(const path of ['/admin/devices',`/admin/devices/${orgId}/admin-e2e-camera`,`/admin/users/${userId}`,`/admin/organizations/${orgId}`]){await page.goto(base+path);const text=await page.locator('main').innerText();assert.ok(!/motion/i.test(text),path+' must not expose event content');assert.ok(!text.includes(enrollmentToken),path+' must not expose the enrollment token')}
 // Settings stays reachable from the sidenav.
 await page.getByRole('navigation',{name:'Admin navigation'}).getByRole('link',{name:'Settings',exact:true}).click();await page.waitForURL('**/admin/settings');await page.getByRole('heading',{name:'Settings',level:1}).waitFor();
 // Non-root members cannot open admin pages.
 const viewer=await browser.newContext(),viewerPage=await viewer.newPage();
 await login(viewerPage,userName,userPassword);
 for(const path of ['/admin/users',`/admin/devices/${orgId}/admin-e2e-camera`]){await viewerPage.goto(base+path);await viewerPage.waitForURL('**/settings')}
 await viewer.close();
 console.log('PASS: admin sidenav, organization/user/device list and detail pages, privacy limits, and root-only access.');
}finally{await browser.close()}
