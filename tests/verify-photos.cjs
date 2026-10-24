'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),lib=JSON.parse(fs.readFileSync(path.join(root,'exercise-photos.json'))),workout=JSON.parse(fs.readFileSync(path.join(root,'workout.json')));
const api=require('../exercise-photos.js');
const aliases=new Set();let ready=0;
for(const entry of Object.values(lib.exercises)){
 for(const name of [entry.name,...entry.aliases]){const n=api.normalize(name);assert(!aliases.has(n),'Duplicate alias '+n);aliases.add(n)}
 assert(entry.photos.length<=2);
 if(entry.photos.length)ready++;
 for(const p of entry.photos){
  assert(api.localPhotoPath(p.src));const bytes=fs.readFileSync(path.join(root,p.src));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),p.sha256);
  assert(p.author&&p.source&&p.license&&(p.licenseUrl||p.permissionBasis)&&p.alt&&p.changes);
  assert(p.width>0&&p.height>0);
 }
}
for(const section of workout.sections)for(const item of section.items)assert(api.findExercise(lib,item.name),'Unregistered exercise '+item.name);
assert(api.findExercise(lib,"Parting the horse’s mane").photos.length===2);
assert.equal(api.exerciseDemo(lib,'Suitcase carry'),'https://www.youtube.com/watch?v=rFIUiO-P1jo');
assert.equal(api.exerciseDemo({exercises:{unsafe:{name:'Unsafe',demo:'javascript:alert(1)'}}},'Unsafe'),undefined);
for(const bad of ['https://x/a.jpg','images/x.svg','images/../x.jpg','//x/a.jpg','images/x.jpg?foo'])assert(!api.localPhotoPath(bad));
// Minimal DOM for deterministic renderer and existing control regression tests.
class Element{
 constructor(tag,doc){this.tagName=tag;this.ownerDocument=doc;this.children=[];this.className='';this.textContent='';this.attributes={};this.checked=false;this.classList={add:()=>{}}}
 append(...nodes){for(const node of nodes){node.parentElement=this;this.children.push(node)}}
 replaceChildren(...nodes){this.children=[];this.append(...nodes)}
 remove(){this.parentElement.children=this.parentElement.children.filter(n=>n!==this)}
 setAttribute(k,v){this.attributes[k]=v}
 get nextElementSibling(){const a=this.parentElement?.children||[];return a[a.indexOf(this)+1]}
 querySelector(selector){return this.querySelectorAll(selector)[0]}
 querySelectorAll(selector){return this.children.flatMap(n=>[(selector[0]==='.'?n.className?.split(' ').includes(selector.slice(1)):n.tagName===selector)?n:null,...(n.querySelectorAll?.(selector)||[])]).filter(Boolean)}
 scrollIntoView(options){this.scrolled=true;this.scrollOptions=options}
}
const events={document:{},window:{}};
const doc={createElement:tag=>new Element(tag,doc),createTextNode:text=>({textContent:text}),addEventListener:(name,handler)=>events.document[name]=handler};
const elements=Object.fromEntries(['timer-mode','status','notice','workout'].map(id=>['#'+id,new Element('div',doc)]));doc.querySelector=s=>elements[s];
const art=doc.createElement('div'),body=doc.createElement('div');
api.renderExercisePhotos(art,body,{name:'Lateral raises'},lib);assert.equal(art.children.length,2);
const viewer=doc.createElement('dialog');viewer.append(doc.createElement('button'),doc.createElement('img'));
viewer.showModal=()=>viewer.open=true;viewer.close=()=>viewer.open=false;elements['#photo-viewer']=viewer;
let prevented=false;art.querySelector('a').onclick({preventDefault:()=>prevented=true});
assert(prevented&&viewer.open,'Photo expands in a dialog without navigating away');
assert.equal(viewer.querySelector('img').src,art.querySelector('img').src);
viewer.querySelector('button').onclick();assert(!viewer.open,'Back to workout closes the image');
art.children[0].querySelector('img').onerror();assert.equal(art.children.length,1);assert.equal(body.children.length,1);
art.children[0].querySelector('img').onerror();assert.equal(art.children[0].textContent,'Photo unavailable');assert.equal(body.children.length,0);
const missing=doc.createElement('div');api.renderExercisePhotos(missing,body,{name:'Unknown',image:'images/x.svg'},lib);assert.equal(missing.children[0].textContent,'Photo unavailable');
let workoutFetches=0;
const storage={};const context=vm.createContext({document:doc,console,history:{scrollRestoration:'auto'},requestAnimationFrame:callback=>setImmediate(callback),localStorage:{getItem:k=>storage[k]??null,setItem:(k,v)=>storage[k]=v},location:{},window:{addEventListener:(name,handler)=>events.window[name]=handler},fetch:async url=>{if(url.includes('workout.json'))workoutFetches++;return {ok:true,json:async()=>url.includes('exercise-photos')?lib:workout}},renderExercisePhotos:api.renderExercisePhotos,exerciseDemo:api.exerciseDemo,alert:msg=>{throw Error(msg)}});
const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
new vm.Script(script).runInContext(context);
(async()=>{
 await vm.runInContext('refreshWorkout()',context);
 const itemCount=workout.sections.reduce((count,section)=>count+section.items.length,0);
 const rows=elements['#workout'].querySelectorAll('.item');assert.equal(rows.length,itemCount);
 const carryRow=rows.find(row=>row.querySelector('.name').textContent==='Suitcase carries');
 if(carryRow){assert.equal(carryRow.querySelector('.demo').href,'https://www.youtube.com/watch?v=rFIUiO-P1jo');assert.equal(carryRow.querySelector('img').src,'./images/suitcase-carry-comparison.png')}
 assert(rows[0].scrolled,'A new workout starts at the first unchecked exercise');
 assert.equal(context.history.scrollRestoration,'manual');
 let index=0;
 for(const section of workout.sections){for(let i=0;i<section.items.length;i++){
  const item=section.items[i],row=rows[index++],timer=row.querySelectorAll('button')[0];
  timer.onclick();const url=new URL(context.location.href);assert.equal(url.searchParams.get('text'),String(item.seconds));
  assert.equal(url.searchParams.get('name'),section.title.includes('Treadmill')&&i===0?'Workout Walk Start':'Workout Timer Watch');
 }}
 elements['#timer-mode'].value='iphone';rows[4].querySelector('button').onclick();assert.equal(new URL(context.location.href).searchParams.get('name'),'Workout Timer');
 elements['#timer-mode'].value='watch';rows[0].querySelector('.next-exercise').onclick();assert(rows[0].querySelector('input').checked);assert(rows[1].scrolled);
 const walkingSectionIndex=workout.sections.findIndex(section=>section.title.includes('Treadmill'));
 const lastWalkingRow=workout.sections.slice(0,walkingSectionIndex+1).reduce((count,section)=>count+section.items.length,0)-1;
 rows[lastWalkingRow].querySelector('.next-exercise').onclick();assert.equal(new URL(context.location.href).searchParams.get('name'),'Workout Walk End');
 rows[itemCount-1].querySelector('.next-exercise').onclick();assert(rows[itemCount-1].querySelector('.next-exercise').disabled);
 // Refreshes must read saved checks, skip completed exercises, and coalesce
 // Safari's overlapping pageshow, visibilitychange and focus notifications.
 const checkStorageKey='workout-checks-'+workout.date;
 storage[checkStorageKey]=JSON.stringify({'0-0':true,'0-1':true,'1-0':true});
 const beforeRefresh=workoutFetches;
 const refreshing=events.window.pageshow();
 assert.equal(events.window.focus(),refreshing);
 doc.hidden=false;events.document.visibilitychange();
 await refreshing;
 assert.equal(workoutFetches,beforeRefresh+1,'One reload per overlapping return event burst');
 let refreshedRows=elements['#workout'].querySelectorAll('.item');
 assert(refreshedRows[2].scrolled,'Return to the earliest unchecked item, even with later checks');
 assert.equal(refreshedRows[2].scrollOptions.behavior,'auto');
 assert(!refreshedRows[0].scrolled,'Do not return to the completed first exercise');
 doc.hidden=true;const beforeHidden=workoutFetches;events.document.visibilitychange();
 assert.equal(workoutFetches,beforeHidden,'Leaving Safari must not refresh');doc.hidden=false;
 const allChecked={};workout.sections.forEach((section,s)=>section.items.forEach((_,i)=>allChecked[s+'-'+i]=true));
 storage[checkStorageKey]=JSON.stringify(allChecked);await events.window.focus();
 refreshedRows=elements['#workout'].querySelectorAll('.item');
 assert(refreshedRows[itemCount-1].scrolled,'A completed workout stays at the final item');
 delete storage[checkStorageKey];await events.window.pageshow();
 refreshedRows=elements['#workout'].querySelectorAll('.item');
 assert(refreshedRows[0].scrolled,'With no saved progress, resume at the first item');
 assert(!refreshedRows[0].querySelector('.check').checked,'Returning does not complete a running timer');
 assert(!html.includes('function drawing('));assert(!html.includes('photo.src=item.image'));
 console.log(`PASS: ${ready} photo-library entries, all local assets/hashes/credits, aliases, missing/broken image handling, ${itemCount} variable timers, iPhone fallback, walking boundaries, checkboxes, Done/Next, return-to-next-unchecked scrolling, overlapping return events and completed-workout scrolling.`);
})().catch(e=>{console.error(e);process.exitCode=1});
