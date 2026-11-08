// Run against a local HTTP server: node tests/verify-watch-sections.cjs [base URL]
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const section=(title,watchWorkout)=>({title,watchWorkout,items:[{name:'Dead bugs',seconds:60},{name:'Side planks',seconds:30}]});
 const fixture={date:'2099-01-01',sections:[section('Treadmill walking'),section('Upper body and glutes','strength'),section('Gentle core','core')]};
 await page.route('**/workout.json*',route=>route.fulfill({json:fixture}));
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('dialog',d=>d.dismiss());
 const base=process.argv[2]||'http://127.0.0.1:8765/';
 async function ready(){await page.goto(base);await page.waitForFunction(()=>document.querySelectorAll('.item').length===6);await page.evaluate(()=>{window.launches=[];openWorkoutShortcut=url=>{window.launches.push(url)}})}
 const start=i=>page.locator('.item').nth(i).locator('button').first().click();
 const done=i=>page.locator('.item').nth(i).locator('.next-exercise').click();
 const names=()=>page.evaluate(()=>window.launches.map(url=>new URL(url).searchParams.get('name')));
 await ready();
 await start(0);await start(1);await done(1);
 assert.deepEqual(await names(),['Workout Walk Start','Workout Timer Watch','Workout Walk End']);
 await start(2);assert.equal((await names()).at(-1),'Workout Strength Start');
 assert.equal(await page.evaluate(()=>new URL(window.launches.at(-1)).searchParams.get('text')),'60');
 await done(2);assert.equal((await names()).at(-1),'Workout Timer Stop');
 await start(3);assert.equal((await names()).at(-1),'Workout Timer Watch');
 await done(3);assert.equal((await names()).at(-1),'Workout Walk End');
 assert.equal(await page.evaluate(()=>localStorage.getItem('workout-watch-section')),null);
 await ready();assert.deepEqual(await names(),[],'Reload must not repeat ending');
 await start(4);assert.equal((await names()).at(-1),'Workout Core Start');
 await ready();assert.deepEqual(await names(),[],'Reload must not repeat starting');
 await start(5);assert.equal((await names()).at(-1),'Workout Timer Watch');
 await page.evaluate(()=>{const a=readActiveTimer();a.endsAt=Date.now()-1;localStorage.setItem(activeTimerKey,JSON.stringify(a));finishExpiredTimer()});
 assert.deepEqual(await names(),['Workout Timer Watch','Workout Walk End'],'Last timer ends section once without a second Timer Stop');
 // Reopen a section, block a competing session, and finish using its final card.
 await start(2);const before=(await names()).length;await start(4);
 assert.equal((await names()).length,before,'No overlapping Watch sections');
 await page.reload();await page.waitForFunction(()=>document.querySelectorAll('.item').length===6);
 assert.equal(await page.locator('#end-watch-section').count(),0);
 await page.evaluate(()=>{window.launches=[];openWorkoutShortcut=url=>window.launches.push(url)});
 await done(3);assert.deepEqual(await names(),['Workout Walk End']);
 await page.locator('.settings').evaluate(node=>node.open=true);
 await page.selectOption('#timer-mode','iphone');await start(4);
 assert.equal((await names()).at(-1),'Workout Timer');
 assert.equal(await page.evaluate(()=>localStorage.getItem('workout-watch-section')),null);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Mobile viewport must not overflow');
 // Existing gallery still opens and returns to the workout.
 await page.locator('.item .art a').first().click();await page.locator('#photo-viewer').waitFor({state:'visible'});
 await page.locator('.photo-back').click();assert.equal(await page.locator('#photo-viewer').isVisible(),false);
 assert.deepEqual(errors,[]);
 console.log('PASS: mobile browser, walking boundaries, strength/core starts, exercise-only stops, manual/automatic section ends, reload persistence, overlap guard, iPhone mode, gallery.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
