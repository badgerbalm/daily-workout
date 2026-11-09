const assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const plan={date:'2099-01-01',title:'Synthetic sync test',sections:[{title:'Mobility',watchWorkout:'none',items:[{name:'Synthetic exercise',seconds:30}]}]};
  let googleLoads=0,apiCalls=0,rows=[],files=[];
  await page.route('**/workout.json*',r=>r.fulfill({json:plan}));
  await page.route('https://accounts.google.com/gsi/client',r=>{googleLoads++;return r.fulfill({contentType:'text/javascript',body:"window.google={accounts:{oauth2:{hasGrantedAllScopes:()=>true,initTokenClient:options=>({requestAccessToken:()=>options.callback({access_token:'synthetic-token',expires_in:3600})})}}};"})});
  await page.route(/^https:\/\/(openidconnect|www|sheets)\.googleapis\.com\//,async route=>{
   apiCalls++;const req=route.request(),url=req.url();assert.equal(req.headers().authorization,'Bearer synthetic-token');
   if(url.includes('/userinfo'))return route.fulfill({json:{email:'onlinesny@gmail.com',email_verified:true}});
   if(url.includes('/drive/v3/files?')){if(req.method()==='POST'){files=[{id:'synthetic-sheet'}];return route.fulfill({json:files[0]})}return route.fulfill({json:{files}})}
   if(!url.includes('/values/'))return route.fulfill({json:{sheets:[{properties:{sheetId:0,title:'Sheet1',gridProperties:{columnCount:30}}}]}});
   if(req.method()==='PUT')rows=req.postDataJSON().values;
   if(req.method()==='POST')rows.push(...req.postDataJSON().values);
   return route.fulfill({json:req.method()==='GET'?{values:rows}:{}});
  });
  await page.goto(process.argv[2]);await page.waitForFunction(()=>initialPageLoadComplete);
  assert.equal(googleLoads,0);assert.equal(apiCalls,0);
  await page.locator('#open-workout-menu').click();await page.locator('#google-sync summary').click();
  for(const width of [320,390,430]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No sync panel overflow at '+width)}
  await page.locator('#google-connect').click();await page.waitForFunction(()=>document.querySelector('#google-sync-status').textContent.includes('ready'));
  await page.locator('#google-connect').click();await page.waitForFunction(()=>document.querySelector('#google-sync-status').textContent.includes('Connected as'));
  assert.equal(apiCalls,1,'Authorization only checks identity');
  await page.evaluate(async()=>{const s=await WorkoutLog.store.ensure({date:'2099-01-01',title:'Synthetic completed workout',sections:[{title:'Synthetic',items:[{name:'Synthetic exercise'}]}]},'daily');await WorkoutLog.store.finish(s.id,{effort:5,energy:3,discomfort:0,notes:'Synthetic note'})});
  await page.locator('#google-sync-now').click();await page.locator('#google-create-sheet').waitFor({state:'visible'});
  assert.equal(files.length,0);await page.locator('#google-create-sheet').click();await page.locator('#google-sheet-link').waitFor({state:'visible'});
  assert.equal(rows.length,2);assert.equal(rows[1][9],'Synthetic note');
  await page.locator('#google-sync-now').click();await page.waitForFunction(()=>!document.querySelector('#google-sync-now').disabled);assert.equal(rows.length,2);
  assert.match(await page.locator('#local-history-list').textContent(),/Synthetic note/);
  await page.screenshot({path:require('node:path').join(require('node:os').tmpdir(),'daily-workout-google-sync.png'),fullPage:true});
  await page.locator('#google-disconnect').click();assert(await page.locator('#google-sync-now').isDisabled());assert.deepEqual(errors,[]);
  console.log('PASS: real Edge mobile layout, opt-in Google loading, mocked account/Sheet flow, save/restore UI, idempotent retry and disconnect. Real Google consent remains an owner test.');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
