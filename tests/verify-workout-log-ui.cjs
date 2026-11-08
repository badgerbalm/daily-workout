const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
const {JSDOM,ResourceLoader,VirtualConsole}=require('jsdom');
const {IDBFactory}=require('fake-indexeddb');
const {createStore}=require('../workout-history.js');
const root=path.resolve(__dirname,'..'),indexedDB=new IDBFactory();
const original={date:'2099-03-01',title:'Synthetic workout',sections:[{title:'Strength',watchWorkout:'none',items:[{name:'Dumbbell bench press',seconds:60,detail:'2 × 10',progressKey:'press'}]},{title:'Treadmill walking',watchWorkout:'none',items:[{name:'Easy warm-up',seconds:60,progressKey:'walk'}]}]};
class Resources extends ResourceLoader{fetch(url){const file=path.join(root,path.basename(new URL(url).pathname));return fs.existsSync(file)?Promise.resolve(fs.readFileSync(file)):null}}
async function until(predicate,label){for(let i=0;i<300;i++){if(await predicate())return;await new Promise(resolve=>setTimeout(resolve,10))}throw Error('Timed out: '+label)}
async function page(plan){
 const errors=[],console=new VirtualConsole();console.on('jsdomError',error=>errors.push(error.message));
 const dom=new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8'),{url:'https://workout.invalid/',resources:new Resources(),runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:console,beforeParse(window){
  window.indexedDB=indexedDB;window.crypto.randomUUID=randomUUID;window.scrollTo=()=>{};window.HTMLElement.prototype.scrollIntoView=()=>{};
  window.fetch=async url=>({ok:true,json:async()=>String(url).includes('workout.json')?JSON.parse(JSON.stringify(plan)):JSON.parse(fs.readFileSync(path.join(root,'exercise-photos.json'),'utf8'))});
 }});
 const w=dom.window;await until(()=>w.document.querySelectorAll('.actual-results').length===2&&w.eval('initialPageLoadComplete'),'results mounted');
 w.launches=[];w.openWorkoutShortcut=async url=>{await w.WorkoutLog.flush({allowFinished:/Stop|End/.test(new URL(url).searchParams.get('name'))});w.launches.push(url)};
 const rows=()=>[...w.document.querySelectorAll('.item')];
 function input(container,label,value){const wrapper=[...container.querySelectorAll('label')].find(node=>node.querySelector('span')?.textContent===label);assert(wrapper,'Field '+label);const field=wrapper.querySelector('input,select,textarea');field.value=value;field.dispatchEvent(new w.Event('input',{bubbles:true}));return field}
 return {dom,w,errors,rows,input};
}
(async()=>{
 const store=createStore({indexedDB});
 const first=await page(original),entry=first.rows()[0],actual=entry.querySelector('.actual-results');
 assert.equal(actual.querySelector('input').value,'','Prescribed 10 reps is not entered as actual');
 first.input(actual.querySelector('.actual-set'),'Actual reps','7');
 first.input(actual.querySelector('.actual-set'),'Actual weight','9.5');
 await first.w.WorkoutLog.flush();
 let session=await store.active('daily');assert.equal(session.exercises.press.draft.sets[0].weight,'9.5','Incomplete basis is saved as a draft');assert.equal(session.exercises.press.actual.sets.length,2,'Earlier valid blank weight/reps may already be saved');
 first.input(actual.querySelector('.actual-set'),'Unit','kg');first.input(actual.querySelector('.actual-set'),'Weight basis','per-dumbbell');first.input(actual.querySelector('.actual-set'),'Side','left');
 await first.w.WorkoutLog.flush();session=await store.active('daily');assert.equal(session.exercises.press.actual.sets[0].weight,9.5);assert.equal(session.exercises.press.actual.sets[0].perHand,true);assert.equal(session.exercises.press.draft,null);
 entry.querySelector('.start-exercise').click();await until(()=>first.w.launches.length===1,'first timer after save');assert.equal(new URL(first.w.launches[0]).searchParams.get('text'),'60');
 first.rows()[1].querySelector('.start-exercise').click();await until(()=>first.w.launches.length===2,'next timer');await first.w.WorkoutLog.flush();session=await store.active('daily');assert.equal(session.exercises.press.status,'inferred');assert(actual.querySelector('.result-outcome').textContent.includes('Needs confirmation'));
 entry.querySelector('.check').checked=true;entry.querySelector('.check').dispatchEvent(new first.w.Event('change'));await first.w.WorkoutLog.flush();assert.equal((await store.active('daily')).exercises.press.status,'completed');
 const walk=first.rows()[1].querySelector('.actual-results');first.input(walk,'Actual seconds','240');first.input(walk,'Speed','4.2');first.input(walk,'Speed unit','km/h');first.input(walk,'Incline %','2');first.input(walk,'Distance','0.28');first.input(walk,'Distance unit','km');await first.w.WorkoutLog.flush();
 first.dom.window.close();
 const changed=structuredClone(original);changed.date='2099-03-02';changed.sections[0].items[0].detail='3 × 12';
 const reopened=await page(changed);assert(reopened.w.document.querySelector('#status').textContent.includes('Synthetic workout'));assert(reopened.rows()[0].querySelector('.detail').textContent.includes('2 × 10'),'Unfinished prescription snapshot survives regeneration');
 const restored=reopened.rows()[0].querySelector('.actual-set');assert.equal([...restored.querySelectorAll('input')].find(i=>i.value==='9.5').value,'9.5');assert(reopened.rows()[0].querySelector('.check').checked);assert.equal((await store.listSessions()).length,1,'Reopening creates no duplicate session');
 const skip=[...reopened.rows()[1].querySelectorAll('.actual-results button')].find(button=>button.textContent==='Skip exercise');skip.click();await reopened.w.WorkoutLog.flush();assert.equal((await store.active('daily')).exercises.walk.status,'skipped');
 const review=reopened.w.document.querySelector('.finish-review');reopened.input(review,'Effort · 1 easy to 10 hardest','6');reopened.input(review,'Energy · 1 low to 5 high','4');reopened.input(review,'Discomfort · 0 none to 10 severe','0');const notes=review.querySelector('textarea');notes.value='Synthetic notes';notes.dispatchEvent(new reopened.w.Event('input',{bubbles:true}));await reopened.w.WorkoutLog.flush();
 const finish=[...review.querySelectorAll('button')].find(button=>button.textContent==='Finish and save locally');finish.click();await until(async()=>!(await store.active('daily')),'finished save');
 const saved=(await store.listSessions())[0];assert.equal(saved.status,'finished');assert.equal(saved.review.notes,'Synthetic notes');assert.equal(saved.review.effort,6);assert.equal(saved.exercises.walk.status,'skipped');assert.equal(saved.exercises.walk.actual.treadmill.distanceUnit,'km');
 await until(()=>reopened.w.document.querySelector('#local-history-list').textContent.includes('9.5 kg'),'readable local history');
 assert.deepEqual(first.errors,[]);assert.deepEqual(reopened.errors,[]);reopened.dom.window.close();const later=await page(changed);const laterResults=later.rows()[0].querySelector('.actual-results');assert.equal(laterResults.querySelector('.actual-set input').value,'','New sessions never silently prefill reps');const lastWeight=[...laterResults.querySelectorAll('button')].find(button=>button.textContent.includes('Use last weight: 9.5 kg'));assert(lastWeight,'Last-used weight is offered as an explicit action');assert.equal((await store.listSessions()).length,1,'Browsing does not start a duplicate log');lastWeight.click();await later.w.WorkoutLog.flush();assert.equal((await store.active('daily')).exercises.press.actual.sets[0].weight,9.5);assert.equal((await store.active('daily')).exercises.press.actual.sets[0].reps,null);later.dom.window.close();await store.close();
 console.log('PASS: actual form entry, draft saving, per-dumbbell weights, inferred vs confirmed results, treadmill units, cold reopen/snapshot preservation, no duplicate session, skipping, Finish ratings/notes and readable local history.');
})().catch(error=>{console.error(error);process.exitCode=1});
