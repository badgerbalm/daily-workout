const assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const fixture={date:'2099-02-01',sections:[{title:'Mobility',watchWorkout:'none',items:Array.from({length:7},(_,i)=>({name:'Dead bugs',detail:`Step ${i+1}`,seconds:300,progressKey:'step-'+i}))}]};
  await page.route('**/workout.json*',route=>route.fulfill({json:fixture}));
  const base=process.argv[2]||'http://127.0.0.1:8765/';
  const ready=()=>page.waitForFunction(()=>initialPageLoadComplete&&document.querySelectorAll('.item').length===7);
  const row=i=>page.locator('.item').nth(i);
  const rowTop=i=>row(i).evaluate(node=>node.getBoundingClientRect().top);
  const timerTop=i=>row(i).locator('.start-exercise').evaluate(node=>node.getBoundingClientRect().top);
  const stored=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('workout-navigation-position')));
  const intercept=()=>page.evaluate(()=>{window.launches=[];openWorkoutShortcut=url=>{shortcutReturnPending=true;launches.push({name:new URL(url).searchParams.get('name'),position:readWorkoutPosition()})}});
  await page.goto(base);await ready();assert.equal(await page.evaluate(()=>scrollY),0,'Fresh plan starts at top');
  await intercept();
  await row(2).locator('button').first().click();
  assert.equal((await stored()).key,'step-2');assert.equal((await stored()).anchor,'timer');
  assert.equal(await page.evaluate(()=>launches[0].position.key),'step-2','Save selected exercise before launching Shortcut');
  assert(!await row(2).locator('.check').isChecked());
  await page.evaluate(async()=>{window.dispatchEvent(new Event('pageshow'));await refreshInProgress});
  assert(Math.abs(await timerTop(2)-140)<4,'Warm Shortcut return restores the selected exercise');
  assert.equal(await page.evaluate(()=>launches.length),1,'Returning never repeats the start Shortcut');
  await page.reload();await ready();
  assert(Math.abs(await timerTop(2)-140)<4,'Cold reopening returns to the started exercise');
  await page.waitForTimeout(1000);
  assert(Math.abs(await timerTop(2)-140)<4,'No delayed scroll-to-top undoes restoration');
  assert(!await row(2).locator('.check').isChecked(),'Restoring position never completes the running exercise');
  await intercept();await row(2).locator('.next-exercise').click();
  assert.equal(await page.evaluate(()=>launches.at(-1).name),'Workout Timer Stop');
  assert.equal(await page.evaluate(()=>launches.at(-1).position.key),'step-3','Done stores next exercise before resetting timer');
  await page.reload();await ready();assert(Math.abs(await timerTop(3)-140)<4);
  assert(await row(2).locator('.check').isChecked());
  assert(await row(1).locator('.check').isChecked(),'Done retains earlier inferred checks');
  // Manual checkbox changes must merge, not overwrite completions saved by Start.
  await row(4).locator('.check').check();
  await page.reload();await ready();assert(await row(1).locator('.check').isChecked());
  assert(await row(2).locator('.check').isChecked());assert(await row(4).locator('.check').isChecked());
  // Leaving normally captures an offset within a card, even before a scroll debounce fires.
  await row(4).scrollIntoViewIfNeeded();
  await page.evaluate(()=>{window.scrollBy(0,90);window.dispatchEvent(new Event('pagehide'))});
  const before=await stored();assert(before.key);
  await page.reload();await ready();
  const index=Number(before.key.split('-')[1]);assert(Math.abs(await rowTop(index)-before.offset)<4,'Restore manual browsing offset');
  // A requested-duration expiry still advances and restores the next card.
  await intercept();await row(3).locator('button').first().click();
  await page.evaluate(async()=>{const timer=readActiveTimer();timer.endsAt=0;localStorage.setItem(activeTimerKey,JSON.stringify(timer));await refreshWorkout('restore')});
  assert.equal((await stored()).key,'step-4');assert(await row(3).locator('.check').isChecked());
  await page.reload();await ready();assert(Math.abs(await timerTop(4)-140)<4);
  // New plan contents never reuse a positional bookmark from a different plan.
  fixture.sections[0].items[0].detail='Changed prescription';
  await page.reload();await ready();assert.equal(await page.evaluate(()=>scrollY),0);
  await page.evaluate(()=>localStorage.setItem('workout-navigation-position','invalid JSON'));
  await page.reload();await ready();assert.equal(await page.evaluate(()=>scrollY),0);
  assert.deepEqual(errors,[]);
  console.log('PASS: save before Shortcut, cold reopen, Done/expiry destinations, merged checks, browsing offset, changed plans and corrupt bookmarks.');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
