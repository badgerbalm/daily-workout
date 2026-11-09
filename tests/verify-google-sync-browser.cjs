const assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const plan={date:'2099-01-01',title:'Synthetic sync test',sections:[{title:'Mobility',watchWorkout:'none',items:[{name:'Synthetic exercise',seconds:30}]}]};
  let googleLoads=0,apiCalls=0,rows=[],files=[];
  await page.route('**/workout.json*',r=>r.fulfill({json:plan}));
  await page.route('https://daily-workout-auth.onlinesny.workers.dev/**',async route=>{
   const req=route.request(),path=new URL(req.url()).pathname,data=req.postDataJSON();
   if(path==='/auth/start')return route.fulfill({json:{url:process.argv[2]+'?mock-oauth=1#workout_auth=synthetic&workout_state='+data.state}});
   if(path==='/auth/complete')return route.fulfill({json:{session:'synthetic-app-session',expires:Math.floor(Date.now()/1000)+3600}});
   assert.equal(req.headers().authorization,'Bearer synthetic-app-session');
   if(path==='/session')return route.fulfill({json:{connected:true}});
   if(path==='/disconnect')return route.fulfill({json:{disconnected:true}});
   assert.equal(path,'/google');apiCalls++;const url=data.url,method=data.method;
   if(url.includes('/drive/v3/files?')){if(method==='POST'){files=[{id:'synthetic-sheet'}];return route.fulfill({json:files[0]})}return route.fulfill({json:{files}})}
   if(!url.includes('/values/'))return route.fulfill({json:{sheets:[{properties:{sheetId:0,title:'Sheet1',gridProperties:{columnCount:30}}}]}});
   if(method==='PUT')rows=data.body.values;
   if(method==='POST')rows.push(...data.body.values);
   return route.fulfill({json:method==='GET'?{values:rows}:{}});
  });
  await page.goto(process.argv[2]);await page.waitForFunction(()=>initialPageLoadComplete);
  assert.equal(googleLoads,0);assert.equal(apiCalls,0);
  await page.locator('#open-workout-menu').click();await page.locator('#google-sync summary').click();
  for(const width of [320,390,430]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No sync panel overflow at '+width)}
  await page.locator('#google-connect').click();await page.waitForFunction(()=>document.querySelector('#google-sync-status').textContent.includes('Connected as'));
  assert.equal(apiCalls,0,'Connecting does not sync private history');
  await page.reload();await page.waitForFunction(()=>document.querySelector('#google-sync-status').textContent.includes('Connected as'));
  await page.locator('#open-workout-menu').click();await page.locator('#google-sync summary').click();
  await page.evaluate(async()=>{const s=await WorkoutLog.store.ensure({date:'2099-01-01',title:'Synthetic completed workout',sections:[{title:'Synthetic',items:[{name:'Synthetic exercise'}]}]},'daily');await WorkoutLog.store.finish(s.id,{effort:5,energy:3,discomfort:0,notes:'Synthetic note'})});
  await page.locator('#google-sync-now').click();await page.locator('#google-create-sheet').waitFor({state:'visible'});
  assert.equal(files.length,0);await page.locator('#google-create-sheet').click();await page.locator('#google-sheet-link').waitFor({state:'visible'});
  assert.equal(rows.length,2);assert.equal(rows[1][9],'Synthetic note');
  await page.locator('#google-sync-now').click();await page.waitForFunction(()=>!document.querySelector('#google-sync-now').disabled);assert.equal(rows.length,2);
  assert.match(await page.locator('#local-history-list').textContent(),/Synthetic note/);
  await page.screenshot({path:require('node:path').join(require('node:os').tmpdir(),'daily-workout-google-sync.png'),fullPage:true});
  await page.locator('#google-disconnect').click();await page.waitForFunction(()=>document.querySelector('#google-sync-status').textContent.includes('Disconnected'));assert(await page.locator('#google-sync-now').isDisabled());assert.deepEqual(errors,[]);
  console.log('PASS: real Edge mobile layout, remembered connection across reload, mocked backend/Sheet flow, save/restore UI, idempotent retry and disconnect. Real Google consent remains an owner test.');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
