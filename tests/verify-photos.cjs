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
  assert(p.author&&p.source&&p.license&&p.licenseUrl&&p.alt&&p.changes);
  assert(p.width>0&&p.height>0);
 }
}
for(const section of workout.sections)for(const item of section.items)assert(api.findExercise(lib,item.name),'Unregistered exercise '+item.name);
assert(api.findExercise(lib,"Parting the horse’s mane").photos.length===2);
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
 scrollIntoView(){this.scrolled=true}
}
const doc={createElement:tag=>new Element(tag,doc),createTextNode:text=>({textContent:text}),addEventListener:()=>{}};
const elements=Object.fromEntries(['timer-mode','status','notice','workout'].map(id=>['#'+id,new Element('div',doc)]));doc.querySelector=s=>elements[s];
const art=doc.createElement('div'),body=doc.createElement('div');
api.renderExercisePhotos(art,body,{name:'Lateral raises'},lib);assert.equal(art.children.length,2);
art.children[0].querySelector('img').onerror();assert.equal(art.children.length,1);assert.equal(body.children.length,1);
art.children[0].querySelector('img').onerror();assert.equal(art.children[0].textContent,'Photo unavailable');assert.equal(body.children.length,0);
const missing=doc.createElement('div');api.renderExercisePhotos(missing,body,{name:'Unknown',image:'images/x.svg'},lib);assert.equal(missing.children[0].textContent,'Photo unavailable');
const storage={};const context=vm.createContext({document:doc,console,localStorage:{getItem:k=>storage[k]??null,setItem:(k,v)=>storage[k]=v},location:{},window:{addEventListener:()=>{}},fetch:async url=>({ok:true,json:async()=>url.includes('exercise-photos')?lib:workout}),renderExercisePhotos:api.renderExercisePhotos,alert:msg=>{throw Error(msg)}});
const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
new vm.Script(script).runInContext(context);
(async()=>{
 await vm.runInContext('load()',context);
 const rows=elements['#workout'].querySelectorAll('.item');assert.equal(rows.length,17);
 let index=0;
 for(const section of workout.sections){for(let i=0;i<section.items.length;i++){
  const item=section.items[i],row=rows[index++],timer=row.querySelectorAll('button')[0];
  timer.onclick();const url=new URL(context.location.href);assert.equal(url.searchParams.get('text'),String(item.seconds));
  assert.equal(url.searchParams.get('name'),section.title.includes('Treadmill')&&i===0?'Workout Walk Start':'Workout Timer Watch');
 }}
 elements['#timer-mode'].value='iphone';rows[4].querySelector('button').onclick();assert.equal(new URL(context.location.href).searchParams.get('name'),'Workout Timer');
 elements['#timer-mode'].value='watch';rows[0].querySelector('.next-exercise').onclick();assert(rows[0].querySelector('input').checked);assert(rows[1].scrolled);
 rows[7].querySelector('.next-exercise').onclick();assert.equal(new URL(context.location.href).searchParams.get('name'),'Workout Walk End');
 rows[16].querySelector('.next-exercise').onclick();assert(rows[16].querySelector('.next-exercise').disabled);
 assert(!html.includes('function drawing('));assert(!html.includes('photo.src=item.image'));
 console.log(`PASS: ${ready}/17 mapped exercises, all local assets/hashes/credits, aliases, missing/broken image handling, 17 variable timers, iPhone fallback, walking boundaries, checkboxes, Done/Next scrolling and final completion.`);
})().catch(e=>{console.error(e);process.exitCode=1});
