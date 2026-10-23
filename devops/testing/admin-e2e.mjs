import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {chromium} from '@playwright/test';
// Synthetic data only: run against a local SaaS-mode app with a non-AWS notification mode, so forgot-password returns the
// reset link instead of emailing it. Everything the run creates is deleted again, also when it fails partway.
const base=process.env.SMARTDETECTOR_TEST_URL||'http://localhost:8082';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw new Error('This synthetic admin test is local-only');
const shots=process.env.SMARTDETECTOR_TEST_SCREENSHOTS;
const run=randomUUID().slice(0,8),orgName='Synthetic admin E2E '+run,userName='synthetic-admin-viewer-'+run+'@example.com',userPassword='synthetic-viewer-'+randomUUID();
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH});
async function login(page,username,password){await page.goto(base+'/login');await page.getByLabel('Email (or root username)',{exact:true}).fill(username);await page.getByLabel('Password',{exact:true}).fill(password);await page.locator('form').getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL('**/console')}
const shot=async(page,name)=>{if(shots)await page.screenshot({path:`${shots}/${name}.png`,fullPage:true})};
const cleanup=[];let api;
try{
 const context=await browser.newContext(),page=await context.newPage();api=context.request;
 await login(page,process.env.SMARTDETECTOR_TEST_USER||'root',process.env.SMARTDETECTOR_TEST_PASSWORD||'smartdetector-local-change-me');
 await page.goto(base+'/admin');await page.waitForURL('**/admin/organizations');
 const nav=page.getByRole('navigation',{name:'Admin navigation'});
 for(const item of ['Organizations','Users','Devices','Settings'])await nav.getByRole('link',{name:item,exact:true}).waitFor();
 assert.equal(await nav.getByRole('link',{name:'Organizations',exact:true}).getAttribute('aria-current'),'page');
 // Locations are added on the existing Organizations page; admin only views and deletes them.
 assert.equal(await page.getByRole('button',{name:/Add (organization|location)/}).count(),0);
 await page.goto(base+'/organizations');await page.getByRole('button',{name:'Add location',exact:true}).click();
 await page.getByLabel('Location name').fill(orgName);await page.getByRole('button',{name:'Create',exact:true}).click();
 const enrollmentToken=(await page.locator('.smartdetector-drawer pre code').textContent()).trim();assert.ok(enrollmentToken);
 await page.goto(base+'/admin/organizations');
 await page.getByRole('link',{name:new RegExp(orgName)}).click();await page.waitForURL('**/admin/organizations/*');
 const orgId=page.url().split('/').pop();cleanup.push(`/api/orgs/${orgId}`);
 await page.getByRole('heading',{name:orgName,level:1}).waitFor();
 // Seed a member and a device through the product's own APIs.

 assert.equal((await api.post(base+'/api/orgs/active',{data:{orgId}})).status(),200);
 const seed=await browser.newContext();
 const seeded=await seed.request.post(base+'/api/auth/signup',{data:{email:userName,displayName:'Synthetic Admin Viewer',password:userPassword}});assert.equal(seeded.status(),201,await seeded.text());const seededBody=await seeded.json();cleanup.unshift(`/api/v1/users/${seededBody.id}`);
 assert.equal((await seed.request.post(base+'/api/auth/verify-email',{data:{token:new URL(seededBody.verifyLink).searchParams.get('token')}})).status(),200);await seed.close();
 const member=await api.post(base+'/api/v1/users',{headers:{Origin:base},data:{email:userName,role:'viewer'}});assert.equal(member.status(),201,await member.text());const userId=(await member.json()).id;
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
 // Purge saved data (DELETE HISTORY): saved events go, the device stays connected.
 const events=async()=>(await (await api.get(base+'/api/v1/incidents')).json()).length;
 assert.equal((await api.post(base+'/api/v1/signals',{headers:{Authorization:`Bearer ${orgId}.admin-e2e.${enrollmentToken}`},data:{device_id:'admin-e2e-camera',type:'smoke',value:60,event_id:'admin-e2e-'+run}})).status(),202);
 assert.ok(await events()>0,'the smoke alarm saved an event');
 await page.goto(base+'/settings/data-deletion');await page.getByRole('button',{name:'Purge saved data'}).click();
 const purge=page.locator('.offcanvas.show');await purge.getByLabel('Type DELETE HISTORY to confirm').fill('DELETE HISTORY');await purge.getByRole('button',{name:'Permanently purge saved data'}).click();
 await page.getByText('Saved history cleared for '+orgName).waitFor();
 assert.equal(await events(),0,'saved events are purged');assert.equal((await api.get(base+'/api/v1/devices/admin-e2e-camera')).status(),200,'purge keeps devices');
 // Delete a person (DELETE PERSON) and a device (DELETE DEVICE) through their own pages.
 const created=await api.post(base+'/api/v1/people',{headers:{Origin:base},data:{name:'Synthetic Person '+run,family:false,saveActivity:true}});assert.equal(created.status(),200,await created.text());const personId=(await created.json()).person.id;
 await page.goto(base+'/people/'+personId);page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Delete person'}).click();await page.waitForURL('**/events');
 assert.equal((await api.get(base+'/api/v1/people/'+personId)).status(),404,'person is deleted');
 await page.goto(base+'/devices/admin-e2e-camera');await page.getByRole('button',{name:'Remove device'}).click();await page.getByLabel('Type DELETE DEVICE to confirm').fill('DELETE DEVICE');await page.getByRole('button',{name:'Delete device and history'}).click();await page.waitForURL(u=>new URL(u).pathname==='/devices');
 assert.equal((await api.get(base+'/api/v1/devices/admin-e2e-camera')).status(),404,'device is deleted');
 // A second device for the location deletion below (the removed device ID stays tombstoned).
 assert.equal((await api.post(base+'/api/v1/signals',{headers:{Authorization:`Bearer ${orgId}.admin-e2e.${enrollmentToken}`},data:{device_id:'admin-e2e-camera-2',type:'motion',value:7}})).status(),202);
 // Every internal link on the admin and settings pages resolves.
 const seen=new Set();
 for(const path of ['/admin/organizations',`/admin/organizations/${orgId}`,'/admin/users',`/admin/users/${userId}`,'/admin/devices','/admin/settings','/settings','/settings/data-deletion','/settings/account-deletion']){
  await page.goto(base+path);
  for(const href of await page.locator('a[href^="/"]').evaluateAll(as=>as.map(a=>a.getAttribute('href')))){if(seen.has(href))continue;seen.add(href);const r=await api.get(base+href,{maxRedirects:0});assert.ok(r.status()<400,`${path} links to ${href}: ${r.status()}`)}
 }
 // Forgot password: login link -> request -> reset link -> new password works; a page without a token offers a new link.
 const selfName='synthetic-self-'+run+'@example.com',selfPassword='synthetic-self-'+randomUUID(),newPassword='synthetic-reset-'+randomUUID();
 const self=await browser.newContext(),selfPage=await self.newPage();
 const signup=await self.request.post(base+'/api/auth/signup',{data:{displayName:'Synthetic Self Delete '+run,email:selfName,username:selfName,password:selfPassword}});assert.equal(signup.status(),201,await signup.text());const signupBody=await signup.json();cleanup.unshift(`/api/v1/users/${signupBody.id}`);
 assert.equal((await self.request.post(base+'/api/auth/verify-email',{data:{token:new URL(signupBody.verifyLink).searchParams.get('token')}})).status(),200,'verify the new account before signing in');
 await self.clearCookies();
 await selfPage.goto(base+'/login');await selfPage.getByRole('link',{name:'Forgot password?'}).click();await selfPage.waitForURL('**/login/forgot-password');await selfPage.waitForLoadState('networkidle');
 await selfPage.getByLabel('Email',{exact:true}).fill(selfName);await selfPage.getByRole('button',{name:'Send reset link'}).click();
 await selfPage.getByText('Check your email').waitFor();await selfPage.locator('.notice a').click();await selfPage.waitForURL('**/login/reset-password?token=*');await selfPage.waitForLoadState('networkidle');
 await selfPage.getByLabel('New password').fill(newPassword);await selfPage.getByRole('button',{name:'Set new password'}).click();await selfPage.waitForURL(u=>new URL(u).pathname==='/login');
 await login(selfPage,selfName,newPassword);
 await selfPage.goto(base+'/login/reset-password');await selfPage.getByRole('link',{name:'Request a new one.'}).click();await selfPage.waitForURL('**/login/forgot-password');
 // Self-service account deletion from Settings: the unshared personal location goes with the account.
 await selfPage.goto(base+'/settings');await selfPage.getByRole('button',{name:'Delete',exact:true}).click();
 const selfDrawer=selfPage.locator('.offcanvas.show');await selfDrawer.getByText(`Synthetic Self Delete ${run} (Personal)`).waitFor();
 const selfConfirm=selfDrawer.getByRole('button',{name:'Delete',exact:true});assert.ok(await selfConfirm.isDisabled(),'confirmation is required');
 await selfDrawer.getByLabel('Type DELETE to confirm').fill('DELETE');await shot(selfPage,'account-delete');await selfConfirm.click();await selfPage.waitForURL('**/login');
 assert.equal((await self.request.post(base+'/api/auth/login',{data:{username:selfName,password:newPassword}})).status(),401,'deleted account cannot sign in');
 await self.close();
 await page.goto(base+'/admin/organizations');assert.equal(await page.getByRole('link',{name:new RegExp(`Synthetic Self Delete ${run}`)}).count(),0,'unshared personal location is deleted with the account');
 // The operator workspace offers no Delete.
 await page.locator('a.admin-entity').filter({has:page.locator('strong',{hasText:/^SmartDetector$/})}).click();await page.waitForURL('**/admin/organizations/*');await page.getByRole('button',{name:'Open organization console'}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Delete',exact:true}).count(),0,'the operator workspace offers no Delete');
 // Admin user deletion from the detail page: membership removed, sign-in refused.
 await page.goto(base+`/admin/users/${userId}`);await page.getByRole('button',{name:'Delete',exact:true}).click();
 const userDrawer=page.locator('.offcanvas.show');await userDrawer.getByText('Memberships removed').waitFor();await userDrawer.getByText(orgName).waitFor();
 await userDrawer.getByLabel('Type DELETE to confirm').fill('DELETE');await shot(page,'user-delete');await userDrawer.getByRole('button',{name:'Delete',exact:true}).click();await page.waitForURL(u=>new URL(u).pathname==='/admin/users');
 assert.equal((await api.get(base+`/admin/users/${userId}`)).status(),404);
 assert.equal((await api.post(base+'/api/auth/login',{data:{username:userName,password:userPassword}})).status(),401,'deleted user cannot sign in');
 // Admin location deletion: devices go with it and the enrollment token stops working.
 assert.equal((await api.delete(base+`/api/orgs/${orgId}`,{headers:{Origin:base},data:{}})).status(),400,'API requires the typed confirmation');
 // A member whose only organization is this one: the account is deleted with it.
 const lastMember=await api.post(base+'/api/v1/users',{data:{email:'synthetic-last-member-'+run+'@example.com',displayName:'Synthetic Last Member',password:'synthetic-last-'+randomUUID(),role:'viewer'}});assert.equal(lastMember.status(),201,await lastMember.text());const lastMemberId=(await lastMember.json()).id;cleanup.unshift(`/api/v1/users/${lastMemberId}`);
 await page.goto(base+`/admin/organizations/${orgId}`);await page.getByRole('button',{name:'Delete',exact:true}).click();
 const orgDrawer=page.locator('.offcanvas.show');await orgDrawer.getByText('admin-e2e-camera-2').waitFor();
 await orgDrawer.getByText('Accounts deleted').waitFor();await orgDrawer.getByText('Synthetic Last Member').waitFor();
 await orgDrawer.getByLabel('Type DELETE to confirm').fill('delete');assert.ok(await orgDrawer.getByRole('button',{name:'Delete',exact:true}).isDisabled(),'confirmation is case-sensitive');
 await orgDrawer.getByLabel('Type DELETE to confirm').fill('DELETE');await shot(page,'organization-delete');await orgDrawer.getByRole('button',{name:'Delete',exact:true}).click();await page.waitForURL(u=>new URL(u).pathname==='/admin/organizations');
 assert.equal(await page.getByRole('link',{name:new RegExp(orgName)}).count(),0);
 assert.equal((await api.get(base+`/admin/organizations/${orgId}`)).status(),404);
 assert.equal((await api.get(base+`/admin/users/${lastMemberId}`)).status(),404,'the member with no other organization is deleted');
 assert.equal((await api.post(base+'/api/v1/signals',{headers:{Authorization:`Bearer ${orgId}.admin-e2e.${enrollmentToken}`},data:{device_id:'admin-e2e-camera-3',type:'motion',value:7}})).status(),401,'the deleted location enrollment token stops working');
 console.log('PASS: admin sidenav, organization/user/device list and detail pages, privacy limits, root-only access, purge/person/device deletion, links, forgot password, account/user/location deletion.');
}finally{
 if(api)for(const path of cleanup){const r=await api.delete(base+path,{headers:{Origin:base},data:{confirmation:'DELETE'}});if(![200,404].includes(r.status()))console.error(`cleanup ${path}: ${r.status()} ${await r.text()}`)}
 await browser.close();
}
