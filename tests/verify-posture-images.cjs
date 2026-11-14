const assert=require('node:assert/strict'),{chromium}=require('playwright');
const photoAPI=require('../exercise-photos.js');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const fixture={date:'2099-02-01',sections:[{title:'Posture practice',watchWorkout:'none',items:[
   {name:'Band pull-aparts',seconds:90,detail:'2 × 12 controlled reps'},
   {name:'Wall-anchored band chest stretch',seconds:60,detail:'30 sec each side · light tension'}
  ]}]};
  await page.route('**/workout.json*',route=>route.fulfill({json:fixture}));
  await page.goto(process.argv[2]||'http://127.0.0.1:8765/');
  await page.waitForFunction(()=>document.querySelectorAll('.item').length===2&&initialPageLoadComplete);
  for(const [i,name] of ['Band pull-aparts','Wall-anchored band chest stretch'].entries()){
   const row=page.locator('.item').nth(i),img=row.locator('.art img');
   assert((await row.textContent()).includes(name),`${name} card is rendered`);
   assert((await row.textContent()).includes(i===0?'2 × 12 controlled reps':'30 sec each side · light tension'));
   assert((await row.locator('.start-exercise').textContent()).includes(i===0?'1:30':'1:00'));
   assert.equal(await img.count(),1,`${name} has one mapped image`);
   await img.evaluate(async node=>{await node.decode();if(!node.naturalWidth||!node.naturalHeight||Math.abs(node.naturalWidth/node.naturalHeight-1.6)>.01)throw Error(`Unexpected image dimensions: ${node.naturalWidth}x${node.naturalHeight}`)});
   assert((await img.getAttribute('src')).includes(i===0?'band-pull-aparts.svg':'wall-anchored-band-chest-stretch.svg'));
   await row.locator('.art a').click();
   await page.locator('#photo-viewer img').evaluate(node=>node.decode());
   assert(await page.locator('#photo-viewer').isVisible());
   await page.locator('.photo-back').click();
  }
  assert.deepEqual(errors,[]);
  await page.screenshot({path:require('node:path').join(require('node:os').tmpdir(),'daily-workout-posture-images-mobile.png'),fullPage:true});
  console.log('PASS: both posture illustrations decode at iPhone width, map to the intended cards, and open in the image viewer.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
