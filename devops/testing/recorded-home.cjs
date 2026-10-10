const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 let executablePath;for(const dir of fs.readdirSync('/ms-playwright')){const p='/ms-playwright/'+dir+'/chrome-linux64/chrome';if(fs.existsSync(p))executablePath=p;}
 const browser=await chromium.launch({executablePath,args:['--no-sandbox']});
 try{
  const page=await browser.newPage();page.setDefaultTimeout(120000);const errors=[];let posts=0;
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()==='POST')posts++;});
  await page.goto(process.env.SMARTDETECTOR_TEST_URL||'http://localhost:8092',{waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForFunction(()=>Object.keys(document.querySelector('.sd-recorded-hero-demo button')||{}).some(k=>k.startsWith('__reactProps$')));
  assert.equal(await page.locator('.sd-recorded-grid > section').count(),3);
  assert.equal(await page.locator('video').count(),4);
  for(const [clip,title] of [['intruder','Doorbell camera'],['dognight','Dog at night'],['backyardintruder','Backyard visitor'],['package','Package delivery']]){
   const data=JSON.parse(fs.readFileSync('public/demo/'+clip+'-analysis.json','utf8'));
   const region=page.getByRole('region',{name:title+' video analysis demo',exact:true});
   assert.equal(await region.locator('video').evaluate(v=>v.controls),false);
   await region.getByRole('button',{name:'View analysis →',exact:true}).click();
   for(const f of data.frames){await region.getByRole('button',{name:'Show analyzed sample '+(f.at_ms/1000).toFixed(1)+' seconds',exact:true}).click();assert.equal(await region.locator('.sd-recorded-box').count(),f.detections.length);}
   await region.getByRole('button',{name:'← Previous',exact:true}).click();
   assert.match(await region.getByRole('status').textContent(),new RegExp('Sample '+(data.frames.length-1)+' of'));
   await region.getByRole('button',{name:'Next →',exact:true}).click();
   assert.equal(await region.getByRole('button',{name:'Next →',exact:true}).isDisabled(),true);
  }
  for(const width of [390,768,1440]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
  assert.equal(posts,0);assert.deepEqual(errors,[]);
  console.log(JSON.stringify({status:'passed',videos:4,tiles:3,analysisPosts:posts,responsive:[390,768,1440]}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
