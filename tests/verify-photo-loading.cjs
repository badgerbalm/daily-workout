// Exercise every registered image in the current plan, without date-specific expectations.
const assert=require('node:assert/strict'),{chromium}=require('playwright');
const photoAPI=require('../exercise-photos.js');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const base=process.argv[2]||'http://127.0.0.1:8765/';
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const [planResponse,libraryResponse]=await Promise.all([page.request.get(new URL('workout.json',base).href),page.request.get(new URL('exercise-photos.json',base).href)]);
  assert(planResponse.ok());assert(libraryResponse.ok());
  const plan=await planResponse.json(),library=await libraryResponse.json();
  await page.goto(base);const items=plan.sections.flatMap(s=>s.items);
  await page.waitForFunction(n=>document.querySelectorAll('.item').length===n,items.length);
  let count=0;
  for(const [index,item] of items.entries()){
   const row=page.locator('.item').nth(index),entry=photoAPI.findExercise(library,item.name);
   await row.scrollIntoViewIfNeeded();
   const photos=entry?.photos?.filter(photo=>photoAPI.localPhotoPath(photo.src)).slice(0,2)||[];
   if(!photos.length){assert.equal(await row.locator('.image-missing').textContent(),'Photo unavailable');continue}
   assert.equal(await row.locator('.art img').count(),photos.length,`${item.name}: all photos render`);
   await row.locator('.art img').evaluateAll(imgs=>Promise.all(imgs.map(async img=>{await img.decode();if(!img.naturalWidth)throw Error('Image did not decode: '+img.src)})));
   for(const [photoIndex,photo] of photos.entries()){
    assert((await row.locator('.art img').nth(photoIndex).getAttribute('src')).endsWith(photo.src));
    await row.locator('.art a').nth(photoIndex).click();
    await page.locator('#photo-viewer img').evaluate(img=>img.decode());
    const back=page.locator('.photo-back'),box=await back.boundingBox();assert(box.y>=0&&box.y+box.height<=844,'Gallery Back stays visible');
    await back.click();count++;
   }
   if(entry.status==='partial')assert((await row.locator('.art').textContent()).includes('only'),'Partial coverage is disclosed on the card');
   if(entry.demo)assert.equal(await row.locator('.demo').first().getAttribute('href'),entry.demo);
  }
  assert.deepEqual(errors,[]);
  console.log(`PASS: ${count} local photos in ${items.length} current-plan cards decode, expand and return correctly at iPhone size.`);
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
