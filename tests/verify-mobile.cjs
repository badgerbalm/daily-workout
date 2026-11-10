const assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await page.addInitScript(()=>localStorage.setItem('workout-shortcut-profile','normal'));
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const fixture={date:'2099-01-01',sections:[{title:'Mobility',watchWorkout:'none',items:[{name:'Side planks',detail:'Left · set 1',seconds:30,progressKey:'left-1',legacyProgressKey:'legacy'},{name:'Side planks',detail:'Right · set 1',seconds:45,progressKey:'right-1'},{name:'Unknown movement',seconds:60}]}]};
 let requests=0;await page.route('**/workout.json*',route=>{requests++;return route.fulfill({json:fixture})});
 await page.goto(process.argv[2]||'http://127.0.0.1:8765/');
 await page.waitForFunction(()=>document.querySelectorAll('.item').length===3&&initialPageLoadComplete);
 assert.equal(await page.locator('.image-missing').textContent(),'Photo unavailable');
 // The two existing side-plank photos retain the complete pose, not cropped thumbnails.
 for(const width of [320,390,430,768]){
  await page.setViewportSize({width,height:844});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`No horizontal overflow at ${width}px`);
  for(const selector of ['.item > button','#open-workout-menu']){
   const boxes=await page.locator(selector).evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().height));assert(boxes.every(h=>h>=44),`Touch targets: ${selector}`);
  }
 }
 await page.setViewportSize({width:390,height:844});
 await page.evaluate(()=>window.scrollTo(0,500));
 assert((await page.locator('.app-header').boundingBox()).y===0,'Summary and Menu remain visible while scrolling');
 assert(await page.locator('.app-header #status').isVisible());
 await page.evaluate(()=>window.scrollTo(0,0));
 await page.screenshot({path:require('node:path').join(require('node:os').tmpdir(),'daily-workout-sticky-header.png')});
 await page.evaluate(()=>{window.launches=[];openWorkoutShortcut=url=>window.launches.push(url)});
 await page.locator('.item').nth(0).locator('.start-exercise').click();
 assert.equal(await page.evaluate(()=>new URL(launches.at(-1)).searchParams.get('text')),'30');
 await page.locator('.item').nth(0).locator('.next-exercise').click();
 assert(await page.locator('.check').nth(0).isChecked());
 await page.locator('#open-workout-menu').click();
 assert((await page.locator('#refresh-workout').boundingBox()).height>=44);
 await Promise.all([page.waitForNavigation(),page.locator('#refresh-workout').click()]);
 await page.waitForFunction(()=>initialPageLoadComplete);
 assert(await page.locator('.check').nth(0).isChecked(),'Combined refresh reloads the page and preserves checks');
 // Real DOM return events coalesce, preserving checks and refreshing once.
 const before=requests;
 await page.evaluate(async()=>{lastForegroundRefreshAt=0;window.dispatchEvent(new Event('pageshow'));window.dispatchEvent(new Event('focus'));document.dispatchEvent(new Event('visibilitychange'));await refreshInProgress});
 assert.equal(requests,before+1);
 await page.locator('.exercise-media').first().evaluate(node=>node.open=true);
 await page.locator('.item .art a').first().click();
 const back=page.locator('.photo-back');await back.waitFor({state:'visible'});
 const backBox=await back.boundingBox();assert(backBox.y>=0&&backBox.y+backBox.height<=844);await page.locator('.photo-next').click();assert.equal(await page.locator('.photo-position').textContent(),'Photo 2 of 2');
 await page.screenshot({path:require('node:path').join(require('node:os').tmpdir(),'daily-workout-gallery.png')});await back.click();
 // Expiry, explicit false overriding a legacy check, and invalidated timers use stable fixtures.
 await page.evaluate(async()=>{localStorage.setItem('workout-checks-2099-01-01',JSON.stringify({legacy:true}));await refreshWorkout()});
 assert(await page.locator('.check').nth(0).isChecked(),'Split holds inherit legacy completion');
 await page.evaluate(async()=>{const saved={'legacy':true,'left-1':false};localStorage.setItem('workout-checks-2099-01-01',JSON.stringify(saved));await refreshWorkout()});
 assert(await page.locator('.check').nth(0).isChecked(),'Saved history takes precedence over edited legacy checkbox storage');
 await page.locator('.check').nth(0).uncheck();
 await page.evaluate(async()=>{await WorkoutLog.flush();await refreshWorkout()});
 assert(!await page.locator('.check').nth(0).isChecked(),'An explicit uncheck updates the saved workout result');
 await page.locator('.item').nth(1).locator('.start-exercise').click();
 const launchesBeforeExpiry=await page.evaluate(()=>launches.length);
 await page.evaluate(()=>{const active=readActiveTimer();active.endsAt=0;localStorage.setItem(activeTimerKey,JSON.stringify(active));finishExpiredTimer()});
 assert(await page.locator('.check').nth(1).isChecked());
 assert.equal(await page.evaluate(()=>readActiveTimer()),null);
 assert.equal(await page.evaluate(()=>launches.length),launchesBeforeExpiry,'Timer expiry must not open another app');
 const launchesBefore=await page.evaluate(()=>launches.length);
 await page.evaluate(async()=>{await refreshWorkout()});
 assert.equal(await page.evaluate(()=>launches.length),launchesBefore,'Refresh must not relaunch a consumed stop');
 await page.locator('.item').nth(2).locator('.start-exercise').click();
 await page.locator('.item').nth(0).locator('.next-exercise').click();
 assert.equal(await page.evaluate(()=>readActiveTimer().key),'0-2','Completing another card retains active timer');
 await page.evaluate(async()=>{const active=readActiveTimer();active.workout='stale plan';active.endsAt=0;localStorage.setItem(activeTimerKey,JSON.stringify(active));await refreshWorkout()});
 assert(!await page.locator('.check').nth(2).isChecked(),'Changed plans invalidate stale timers');
 await page.locator('#open-workout-menu').click();await page.locator('.settings > summary').click();await page.selectOption('#timer-mode','iphone');await page.locator('#close-workout-menu').click();
 await page.locator('.item').nth(2).locator('.start-exercise').click();
 await page.evaluate(()=>{const active=readActiveTimer();active.endsAt=0;localStorage.setItem(activeTimerKey,JSON.stringify(active));finishExpiredTimer()});
 assert.equal(await page.evaluate(()=>new URL(launches.at(-1)).searchParams.get('name')),'Workout Timer','iPhone expiry never resets MultiTimer');

 // Fresh reload retains local progress; it never relaunches an external shortcut.
 await page.reload();await page.waitForFunction(()=>initialPageLoadComplete);assert(await page.locator('.check').nth(1).isChecked());
 // Failed local images become clean placeholders; no broken thumbnail remains.
 await page.route('**/images/side-plank-*.jpg',route=>route.abort());await page.reload();
 await page.waitForFunction(()=>initialPageLoadComplete);
 await page.locator('.exercise-media').evaluateAll(nodes=>nodes.forEach(node=>node.open=true));
 await page.locator('.art img').evaluateAll(nodes=>nodes.forEach(node=>node.loading='eager'));
 await page.waitForFunction(()=>document.querySelectorAll('.item .art').length===3&&[...document.querySelectorAll('.item .art')].every(art=>art.querySelector('.image-missing')));
 assert.equal(await page.locator('.art img').count(),0);
 assert.deepEqual(errors,[]);
 console.log('PASS: responsive iPhone widths, touch targets, variable timers, checks, refresh coalescing, gallery, expiry, reload persistence, and failed images.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
