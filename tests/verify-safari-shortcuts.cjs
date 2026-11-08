// Deterministic preview routing tests. Device/tab behavior requires iPhone testing.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
class Element{
 constructor(tag){this.tagName=tag;this.children=[];this.checked=false;this.className='';this.textContent='';this.value=''}
 append(...nodes){for(const node of nodes){node.parentElement=this;this.children.push(node)}}
 replaceChildren(...nodes){this.children=[];this.append(...nodes)}
 setAttribute(){}addEventListener(name,fn){this['on'+name]=fn}
 querySelectorAll(s){return this.children.flatMap(n=>[(s.startsWith('.')?n.className===s.slice(1):n.tagName===s)?n:null,...(n.querySelectorAll?.(s)||[])]).filter(Boolean)}
 querySelector(s){return this.querySelectorAll(s)[0]}
 get nextElementSibling(){return this.parentElement?.children[this.parentElement.children.indexOf(this)+1]}
 get previousElementSibling(){return this.parentElement?.children[this.parentElement.children.indexOf(this)-1]}
 scrollIntoView(){}
}
function harness(preview,storage={}){
 const ids=['timer-mode','workout','notice','status','refresh-workout','refresh-feedback','safari-preview','shortcut-profile','shortcut-profile-status','watch-recovery','clear-watch-tracking','watch-recovery-result'];
 const elements=Object.fromEntries(ids.map(id=>['#'+id,new Element('div')]));
 elements['.settings']=new Element('details');
 const document={querySelector:id=>elements[id],createElement:tag=>new Element(tag),addEventListener(){},documentElement:{getAttribute:()=>preview?'safari':null}};
 const section=(title,watchWorkout)=>({title,watchWorkout,items:[{name:'Dead bugs',seconds:60},{name:'Side planks',seconds:30}]});
 const fixture={date:'2099-01-01',sections:[section('Mobility','none'),section('Treadmill walking'),section('Strength','strength'),section('Core','core')]};
 const ctx=vm.createContext({console,URL,document,history:{},window:{scrollY:0,scrollTo(){},addEventListener(){}},localStorage:{getItem:k=>storage[k]||null,setItem:(k,v)=>storage[k]=v,removeItem:k=>delete storage[k]},location:{},setTimeout:()=>1,clearTimeout(){},requestAnimationFrame:fn=>setImmediate(fn),fetch:async url=>({ok:true,json:async()=>url.includes('workout.json')?fixture:{exercises:{}}}),renderExercisePhotos(){},exerciseDemo(){},alert:m=>{throw Error(m)}});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../index.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1],ctx);
 const rows=()=>elements['#workout'].querySelectorAll('.item');
 return {ctx,storage,elements,fixture,rows,start:i=>rows()[i].querySelector('button').onclick(),done:i=>rows()[i].querySelector('.next-exercise').onclick(),name:()=>new URL(ctx.location.href).searchParams.get('name'),reload:()=>vm.runInContext('refreshWorkout()',ctx)};
}
(async()=>{
 const production=harness(false,{'workout-shortcut-profile':'safari-test'});await production.reload();production.start(0);assert.equal(production.name(),'Workout Timer Watch');assert(production.elements['#safari-preview'].hidden,'No test mode exposed on production');
 const switching=harness(true,{'workout-shortcut-profile':'safari-test'});await switching.reload();switching.start(0);switching.start(1);assert.equal(switching.name(),'Workout Timer Watch Safari Test');assert.equal(new URL(switching.ctx.location.href).searchParams.get('text'),'30','Starting the next card passes its duration, not the previous 60 seconds');assert(switching.rows()[0].querySelector('.check').checked);assert.equal(vm.runInContext('readActiveTimer().key',switching.ctx),'0-1');
 const test=harness(true);await test.reload();test.elements['#shortcut-profile'].value='safari-test';test.elements['#shortcut-profile'].onchange();
 test.start(0);assert.equal(test.name(),'Workout Timer Watch Safari Test');assert.equal(new URL(test.ctx.location.href).searchParams.get('text'),'60');assert(test.storage['workout-navigation-position'],'Position is saved before launch');assert.equal(JSON.parse(test.storage['workout-navigation-position']).anchor,'timer','Return targets the timer button');
 test.elements['#shortcut-profile'].value='normal';test.elements['#shortcut-profile'].onchange();assert.equal(test.elements['#shortcut-profile'].value,'safari-test','Cannot change profile mid-timer');
 test.done(0);assert.equal(test.name(),'Workout Timer Stop Safari Test');assert(!test.storage['workout-shortcut-profile-lock']);
 test.start(2);assert.equal(test.name(),'Workout Walk Start Safari Test');
 test.elements['#shortcut-profile'].value='normal';test.elements['#shortcut-profile'].onchange();assert.equal(test.elements['#shortcut-profile'].value,'safari-test','Walking recording pins the profile between intervals');
 test.start(3);assert.equal(test.name(),'Workout Timer Watch Safari Test');test.done(3);assert.equal(test.name(),'Workout Walk End Safari Test');
 test.start(4);assert.equal(test.name(),'Workout Strength Start Safari Test');test.done(4);assert.equal(test.name(),'Workout Timer Stop Safari Test');assert(test.storage['workout-shortcut-profile-lock'],'Timer Stop retains strength routing lock');
 const reopened=harness(true,test.storage);await reopened.reload();reopened.start(5);assert.equal(reopened.name(),'Workout Timer Watch Safari Test');reopened.done(5);assert.equal(reopened.name(),'Workout Walk End Safari Test');assert(!test.storage['workout-shortcut-profile-lock']);
 reopened.start(6);assert.equal(reopened.name(),'Workout Core Start Safari Test');reopened.done(7);assert.equal(reopened.name(),'Workout Walk End Safari Test');
 reopened.elements['#timer-mode'].value='iphone';reopened.start(6);assert.equal(reopened.name(),'Workout Timer Safari Test');
 vm.runInContext('const active=readActiveTimer();active.endsAt=0;localStorage.setItem(activeTimerKey,JSON.stringify(active));finishExpiredTimer()',reopened.ctx);
 assert(!reopened.elements['#shortcut-profile'].disabled,'iPhone expiry releases profile selection without MultiTimer reset');
 reopened.elements['#shortcut-profile'].value='normal';reopened.elements['#shortcut-profile'].onchange();reopened.elements['#timer-mode'].value='watch';reopened.start(1);assert.equal(reopened.name(),'Workout Timer Watch');reopened.done(1);assert.equal(reopened.name(),'Workout Timer Stop');
 const stale=harness(true,{'workout-shortcut-profile':'safari-test'});await stale.reload();stale.start(4);const checksBefore=stale.storage['workout-checks-2099-01-01'];stale.ctx.location.href='https://example.com/';stale.start(6);assert.equal(stale.ctx.location.href,'https://example.com/','Conflict never launches an overlapping Watch workout');assert.equal(stale.elements['.settings'].open,true);assert.equal(stale.elements['#watch-recovery'].hidden,false);stale.elements['#clear-watch-tracking'].onclick();assert.equal(stale.elements['#watch-recovery'].hidden,true);assert(!stale.storage['workout-watch-section']);assert(!stale.storage['workout-shortcut-profile-lock']);assert(!stale.storage['workout-active-exercise-timer']);assert.equal(stale.storage['workout-checks-2099-01-01'],checksBefore,'Recovery preserves all completed exercises');assert.equal(stale.ctx.location.href,'https://example.com/','Clearing stale tracking launches no Shortcut');stale.start(6);assert.equal(stale.name(),'Workout Core Start Safari Test','Next explicit start works after recovery');
 const position=harness(false);await position.reload();const scrolls=[];position.ctx.window.scrollY=50;position.ctx.window.scrollTo=options=>scrolls.push(options);position.rows()[0].getBoundingClientRect=()=>({top:300,bottom:900});position.rows()[0].querySelector('.start-exercise').getBoundingClientRect=()=>({top:700});vm.runInContext("saveWorkoutPosition('0-0');scrollToExercise(timerRows.get('0-0').row);restoreWorkoutPosition()",position.ctx);assert.deepEqual(scrolls.map(x=>x.top),[610,610],'Both navigation and reopening target Start timer rather than the card top');assert(!position.rows()[0].querySelector('.check').checked,'Scrolling does not complete or start an exercise');
 const photos=harness(true,{'workout-shortcut-profile':'safari-test'});await photos.reload();assert(photos.rows()[0].querySelector('.exercise-media').open,'Photos initially expanded');photos.start(0);assert(!photos.rows()[0].querySelector('.exercise-media').open,'Start collapses only the selected card photo');assert(photos.rows()[1].querySelector('.exercise-media').open,'Next card remains available to inspect');assert(!photos.rows()[0].querySelector('.check').checked,'Collapsing never confirms completion');await photos.reload();assert(!photos.rows()[0].querySelector('.exercise-media').open,'Collapse survives Shortcut return');const media=photos.rows()[0].querySelector('.exercise-media');media.open=true;media.ontoggle();assert.equal(media.querySelector('summary').textContent,'Hide photo');await photos.reload();assert(photos.rows()[0].querySelector('.exercise-media').open,'Manual reopening survives refresh');photos.fixture.date='2099-01-02';await photos.reload();assert(photos.rows()[0].querySelector('.exercise-media').open,'A different plan starts with expanded photos');
 console.log('PASS: preview-only Safari duplicate names, duration input, saved navigation, walking/strength/core lifecycle, pinned routing after reload, iPhone fallback, and original-name isolation.');
})().catch(error=>{console.error(error);process.exitCode=1});
