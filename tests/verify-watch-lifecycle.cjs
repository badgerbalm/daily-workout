const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
class Element{
 constructor(tag){this.tagName=tag;this.children=[];this.checked=false;this.className='';this.textContent=''}
 append(...nodes){for(const n of nodes){n.parentElement=this;this.children.push(n)}}
 replaceChildren(...nodes){this.children=[];this.append(...nodes)}
 setAttribute(){} addEventListener(name,fn){this['on'+name]=fn}
 querySelectorAll(s){return this.children.flatMap(n=>[(s.startsWith('.')?n.className===s.slice(1):n.tagName===s)?n:null,...(n.querySelectorAll?.(s)||[])]).filter(Boolean)}
 querySelector(s){return this.querySelectorAll(s)[0]}
 get nextElementSibling(){return this.parentElement?.children[this.parentElement.children.indexOf(this)+1]}
 get previousElementSibling(){return this.parentElement?.children[this.parentElement.children.indexOf(this)-1]}
 scrollIntoView(){this.scrolled=true}
}
const ids=['timer-mode','workout','notice','status','refresh-workout','refresh-feedback'];
const elements=Object.fromEntries(ids.map(id=>['#'+id,new Element('div')]));
const doc={querySelector:id=>elements[id],createElement:tag=>new Element(tag),addEventListener(){}};
const storage={},alerts=[];
const section=(title,watchWorkout)=>({title,watchWorkout,items:[{name:'Dead bugs',seconds:60},{name:'Side planks',seconds:30}]});
const fixture={date:'2099-01-01',sections:[section('Treadmill walking'),section('Upper body and glutes','strength'),section('Gentle core','core')]};
const ctx=vm.createContext({console,document:doc,history:{},window:{scrollY:0,scrollTo(){},addEventListener(){}},localStorage:{getItem:k=>storage[k]||null,setItem:(k,v)=>storage[k]=v,removeItem:k=>delete storage[k]},location:{},setTimeout:()=>1,clearTimeout(){},requestAnimationFrame:fn=>setImmediate(fn),fetch:async url=>({ok:true,json:async()=>url.includes('workout.json')?fixture:{exercises:{}}}),renderExercisePhotos(){},exerciseDemo(){},alert:m=>alerts.push(m)});
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
assert(!html.includes('timer-stop-prompt'),'No timer-stop overlay is rendered');
assert(!html.includes('id="end-watch-section"'),'No End Watch section button is rendered');
vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],ctx);
const rows=()=>elements['#workout'].querySelectorAll('.item');
const start=i=>rows()[i].querySelector('button').onclick();
const done=i=>rows()[i].querySelector('.next-exercise').onclick();
const name=()=>new URL(ctx.location.href).searchParams.get('name');
const reload=()=>vm.runInContext('refreshWorkout()',ctx);
(async()=>{
 await reload();start(0);assert.equal(name(),'Workout Walk Start');start(1);assert.equal(name(),'Workout Timer Watch');done(1);assert.equal(name(),'Workout Walk End');
 start(2);assert.equal(name(),'Workout Strength Start');assert.equal(new URL(ctx.location.href).searchParams.get('text'),'60');
 done(2);assert.equal(name(),'Workout Timer Stop');assert(storage['workout-watch-section']);
 start(3);assert.equal(name(),'Workout Timer Watch');done(3);assert.equal(name(),'Workout Walk End');assert(!storage['workout-watch-section']);
 ctx.location.href='https://example.com/';await reload();assert.equal(ctx.location.href,'https://example.com/');
 start(4);assert.equal(name(),'Workout Core Start');await reload();start(5);assert.equal(name(),'Workout Timer Watch');
 let launches=[];ctx.capture=url=>launches.push(url);vm.runInContext('openWorkoutShortcut=url=>capture(url)',ctx);
 vm.runInContext('const a=readActiveTimer();a.endsAt=0;localStorage.setItem(activeTimerKey,JSON.stringify(a));finishExpiredTimer()',ctx);
 assert.deepEqual(launches.map(url=>new URL(url).searchParams.get('name')),['Workout Walk End'],'Final expiry ends once without extra Timer Stop');
 start(2);assert.equal(new URL(launches.at(-1)).searchParams.get('name'),'Workout Strength Start');const count=launches.length;
 start(4);assert.equal(launches.length,count);assert.equal(alerts.length,1,'Guard overlapping Watch sections');
 await reload();done(3);assert(!storage['workout-watch-section'],'Final Done still ends the tracked section after reload');
 assert.equal(new URL(launches.at(-1)).searchParams.get('name'),'Workout Walk End');
 elements['#timer-mode'].value='iphone';start(4);assert.equal(new URL(launches.at(-1)).searchParams.get('name'),'Workout Timer');assert(!storage['workout-watch-section']);
 assert.equal(vm.runInContext("watchSectionType({title:'Strength and core'})",ctx),'strength');
 assert.equal(vm.runInContext("watchSectionType({title:'Strength',watchWorkout:'none'})",ctx),null);
 assert.equal(elements['#status'].textContent.startsWith('Unable'),false);
 console.log('PASS: full page lifecycle with strength/core starts, timer-only intermediate stops, one final stop, reload persistence, overlap guard, walking boundaries, iPhone fallback and legacy classification.');
})().catch(e=>{console.error(e);process.exitCode=1});
