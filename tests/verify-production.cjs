const assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const fixture={date:'2099-01-01',title:'Synthetic production routing',sections:[{title:'Mobility',watchWorkout:'none',items:[{name:'Dead bugs',seconds:30},{name:'Bird dogs',seconds:60}]},{title:'Treadmill walk',items:[{name:'Easy warm-up',seconds:60},{name:'Cool-down',seconds:60}]},{title:'Core',watchWorkout:'core',items:[{name:'Bird dogs',seconds:30},{name:'Dead bugs',seconds:30}]}]};
  await page.route('**/workout.json*',r=>r.fulfill({json:fixture}));
  await page.goto(process.argv[2]);await page.waitForFunction(()=>initialPageLoadComplete);
  assert.equal(await page.locator('#shortcut-profile').inputValue(),'safari','New production sessions default to Safari');
  assert(!await page.locator('#google-sync').isVisible());await page.locator('#open-workout-menu').click();await page.locator('.settings > summary').click();await page.locator('#safari-preview > summary').click();
  assert(await page.locator('#safari-preview').isVisible());assert(!/\btest\b|\bpreview\b/i.test(await page.locator('#safari-preview').innerText()),'Production controls have no test or preview labels');await page.locator('#close-workout-menu').click();
  await page.evaluate(()=>{window.launches=[];openWorkoutShortcut=url=>launches.push(url)});
  const start=i=>page.locator('.item').nth(i).locator('.start-exercise').click(),done=i=>page.locator('.item').nth(i).locator('.next-exercise').click();
  const last=()=>page.evaluate(()=>new URL(launches.at(-1)).searchParams.get('name'));
  await start(0);assert.equal(await last(),'Workout Timer Watch Safari');await done(0);assert.equal(await last(),'Workout Timer Stop Safari');
  await start(2);assert.equal(await last(),'Workout Walk Start Safari');await done(3);assert.equal(await last(),'Workout End Safari');
  await start(4);assert.equal(await last(),'Workout Core Start Safari');await done(4);assert.equal(await last(),'Workout Timer Stop Safari');await start(5);await done(5);
  await page.getByRole('button',{name:'Save workout',exact:true}).click();await page.waitForFunction(()=>new URL(launches.at(-1)).searchParams.get('name')==='Workout End Safari');
  await page.goto(new URL('safari-setup.html',process.argv[2]).href);assert.equal(await page.locator('#return-url').inputValue(),process.argv[2]);assert(!/\btest\b/i.test(await page.locator('body').innerText()));assert.deepEqual(errors,[]);
  console.log('PASS: production Safari defaults and clean names, mobility/walk/core start-stop-end lifecycle, finish save barrier and correct return URL guide.');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
