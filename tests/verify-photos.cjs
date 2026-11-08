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
assert.equal(api.exerciseDemo(lib,'Bent knee leg raises'),'https://www.youtube.com/watch?v=T31_qyE7Xqw');
assert.equal(api.findExercise(lib,'Bent-knee leg raise').photos.length,2);
assert.equal(api.findExercise(lib,'Bodyweight glute bridges'),api.findExercise(lib,'Glute bridges'));
assert(api.findExercise(lib,'Bird dogs').photos.length>0);
assert.equal(api.findExercise(lib,'Single lean-back quad stretch'),api.findExercise(lib,'Lying quad stretch'));
assert.equal(api.findExercise(lib,'Single lean-back quad stretch').photos[0].src,'images/lying-quad-stretch.png');
assert.equal(api.findExercise(lib,'Side-lying quad stretch'),undefined,'Do not conflate distinct stretch variations');
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
const credits=body.querySelector('.photo-credits');assert(credits);assert(!credits.open,'Photo credits are collapsed by default');assert.equal(credits.querySelector('summary').textContent,'Photo credits');assert.equal(credits.querySelectorAll('.photo-credit').length,2,'All attribution stays accessible');
const viewer=doc.createElement('dialog');
for(const [tag,cls] of [['button','photo-back'],['div','photo-stage'],['span','photo-position'],['p','photo-caption'],['div','photo-nav'],['button','photo-previous'],['button','photo-next']]){const node=doc.createElement(tag);node.className=cls;viewer.append(node)}
viewer.querySelector('.photo-stage').append(doc.createElement('img'));
viewer.showModal=()=>viewer.open=true;viewer.close=()=>viewer.open=false;elements['#photo-viewer']=viewer;
let prevented=false;art.querySelector('a').onclick({preventDefault:()=>prevented=true});
assert(prevented&&viewer.open,'Photo expands in a dialog without navigating away');
assert.equal(viewer.querySelector('img').src,art.querySelector('img').src);
const stage=viewer.querySelector('.photo-stage'),full=viewer.querySelector('img');
const swipe=(x1,y1,x2,y2)=>{stage.ontouchstart({touches:[{clientX:x1,clientY:y1}]});stage.ontouchend({changedTouches:[{clientX:x2,clientY:y2}]})};
swipe(220,100,50,110);assert.equal(full.src,art.children[1].querySelector('img').src,'Swipe left advances');
swipe(50,100,220,110);assert.equal(full.src,art.children[0].querySelector('img').src,'Swipe right goes back');
swipe(100,220,110,50);assert.equal(full.src,art.children[0].querySelector('img').src,'Vertical gestures do not change photographs');
viewer.querySelector('.photo-next').onclick();assert.equal(full.src,art.children[1].querySelector('img').src);
full.onerror();assert(full.hidden);viewer.querySelector('.photo-previous').onclick();assert(!full.hidden,'Navigate away from a failed image');
viewer.onkeydown({key:'ArrowRight',preventDefault:()=>{}});assert.equal(full.src,art.children[1].querySelector('img').src);
viewer.querySelector('button').onclick();assert(!viewer.open,'Back to workout closes the image');
art.children[1].querySelector('a').onclick({preventDefault:()=>{}});assert.equal(full.src,art.children[1].querySelector('img').src,'Open the photo actually tapped');
const singleArt=doc.createElement('div');api.renderExercisePhotos(singleArt,doc.createElement('div'),{name:'Butterfly stretch'},lib);
singleArt.querySelector('a').onclick({preventDefault:()=>{}});assert(viewer.querySelector('.photo-nav').hidden,'Single image hides navigation');
viewer.querySelector('button').onclick();
art.children[0].querySelector('img').onerror();assert.equal(art.children.length,1);assert.equal(body.children.length,1);
art.children[0].querySelector('img').onerror();assert.equal(art.children[0].textContent,'Photo unavailable');assert.equal(body.children.length,0);
const missing=doc.createElement('div');api.renderExercisePhotos(missing,body,{name:'Unknown',image:'images/x.svg'},lib);assert.equal(missing.children[0].textContent,'Photo unavailable');
console.log(`PASS: ${ready} photographed registry entries, local hashes and attribution, aliases, missing/broken image handling, expanded gallery, swipe navigation and Back to workout. Controls are tested separately.`);
