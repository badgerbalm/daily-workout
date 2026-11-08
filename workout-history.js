/* Private local history. This module makes no network requests. */
(function(root){
 'use strict';
 const clone=value=>JSON.parse(JSON.stringify(value));
 function number(value,label,{integer=false,max=100000,min=0}={}){
  if(value===''||value===null||value===undefined)return null;
  const n=Number(value);if(!Number.isFinite(n)||n<min||n>max||(integer&&!Number.isInteger(n)))throw Error(label+' is outside the allowed range.');return n;
 }
 function actualResult(input){
  const sets=(input.sets||[]).map((set,index)=>{
   const weight=number(set.weight,'Weight',{max:5000});
   if(weight!==null&&!['per-dumbbell','total','single-hand'].includes(set.weightBasis))throw Error('Choose whether the weight is per dumbbell, total, or in one hand.');
   if(!['lb','kg'].includes(set.weightUnit||'lb'))throw Error('Choose lb or kg.');
   if(!['','left','right','both'].includes(set.side||''))throw Error('Invalid side.');
   return {id:String(set.id||'set-'+index),reps:number(set.reps,'Reps',{integer:true,max:10000}),weight,weightUnit:set.weightUnit||'lb',weightBasis:set.weightBasis||null,perHand:weight===null?null:['per-dumbbell','single-hand'].includes(set.weightBasis),side:set.side||null,durationSeconds:number(set.durationSeconds,'Set duration',{max:86400})};
  });
  if(sets.length>100)throw Error('Too many sets.');
  let treadmill=null;
  if(input.treadmill){const t=input.treadmill;
   if(!['mph','km/h'].includes(t.speedUnit||'mph')||!['mi','km'].includes(t.distanceUnit||'mi'))throw Error('Invalid treadmill units.');
   treadmill={durationSeconds:number(t.durationSeconds,'Duration',{max:86400}),speed:number(t.speed,'Speed',{max:50}),speedUnit:t.speedUnit||'mph',inclinePct:number(t.inclinePct,'Incline',{min:-20,max:50}),distance:number(t.distance,'Distance',{max:1000}),distanceUnit:t.distanceUnit||'mi'};
  }
  return {sets,treadmill};
 }
 function reviewResult(input){return {effort:number(input.effort,'Effort',{integer:true,min:1,max:10}),energy:number(input.energy,'Energy',{integer:true,min:1,max:5}),discomfort:number(input.discomfort,'Discomfort',{integer:true,max:10}),notes:String(input.notes||'').trim().slice(0,4000)}};
 function createStore(options={}){
  const idb=options.indexedDB||root.indexedDB,uuid=options.uuid||(()=>root.crypto.randomUUID()),now=options.now||(()=>new Date().toISOString());
  let database;
  function open(){return database??=new Promise((resolve,reject)=>{
   if(!idb){reject(Error('IndexedDB is unavailable in this browser.'));return}
   const request=idb.open(options.name||'daily-workout-private-history',1);
   request.onupgradeneeded=()=>{const db=request.result;for(const store of ['sessions','meta','outbox'])if(!db.objectStoreNames.contains(store))db.createObjectStore(store,{keyPath:store==='meta'?'key':'id'})};
   request.onsuccess=()=>{request.result.onversionchange=()=>request.result.close();resolve(request.result)};
   request.onerror=()=>reject(request.error);request.onblocked=()=>reject(Error('Close another workout tab so local storage can open.'));
  })}
  async function transaction(stores,mode,work){
   const db=await open();return new Promise((resolve,reject)=>{
    const tx=db.transaction(stores,mode);let value,failure;
    tx.oncomplete=()=>resolve(value);tx.onerror=tx.onabort=()=>reject(failure||tx.error||Error('Local save was interrupted.'));
    const done=result=>{value=result};const fail=error=>{failure=error;tx.abort()};
    try{work(tx,done,fail)}catch(error){fail(error)}
   });
  }
  const get=(store,id)=>transaction([store],'readonly',(tx,done)=>{const r=tx.objectStore(store).get(id);r.onsuccess=()=>done(r.result||null)});
  async function active(scope){const meta=await get('meta','active:'+scope);return meta?get('sessions',meta.value):null}
  function ensure(plan,scope){return transaction(['sessions','meta','outbox'],'readwrite',(tx,done,fail)=>{
   const sessions=tx.objectStore('sessions'),meta=tx.objectStore('meta');const r=meta.get('active:'+scope);
   const create=()=>{
    const id=uuid(),timestamp=now(),exercises={};
    plan.sections.forEach((section,s)=>section.items.forEach((item,i)=>{const key=item.progressKey||s+'-'+i;exercises[key]={id:uuid(),key,name:item.name,prescribed:clone(item),status:'unfinished',completionSource:null,actual:{sets:[],treadmill:null}}}));
    const session={id,scope,plan:clone(plan),status:'in-progress',startedAt:timestamp,updatedAt:timestamp,revision:0,exercises,review:null};
    sessions.add(session);meta.put({key:'active:'+scope,value:id});tx.objectStore('outbox').put({id:id+':created',sessionId:id,revision:0,state:'pending',type:'session-created'});done(session);
   };
   r.onsuccess=()=>{if(!r.result){create();return}const existing=sessions.get(r.result.value);existing.onsuccess=()=>{if(existing.result?.status==='in-progress')done(existing.result);else create()}};
  })}
  function save(id,changes){return transaction(['sessions','outbox'],'readwrite',(tx,done,fail)=>{
   const r=tx.objectStore('sessions').get(id);r.onsuccess=()=>{try{
    const session=r.result;if(!session||session.status!=='in-progress')throw Error('This workout has already been finished.');
    for(const [key,change] of Object.entries(changes)){
     if(key==='__reviewDraft'){session.reviewDraft=reviewResult(change.review);session.revision++;tx.objectStore('outbox').put({id:session.id+':review-draft',sessionId:session.id,revision:session.revision,state:'pending',type:'review-draft'});continue}
     const exercise=session.exercises[key];if(!exercise)throw Error('Exercise is not in the saved workout snapshot.');
     if(change.draft!==undefined)exercise.draft=change.draft===null?null:clone(change.draft);
     if(change.actual)exercise.actual=actualResult(change.actual);
     if(change.status){if(!['completed','skipped','unfinished','inferred'].includes(change.status))throw Error('Invalid exercise status.');if(!(change.status==='inferred'&&['completed','skipped'].includes(exercise.status))){exercise.status=change.status;exercise.completionSource=change.source||'user'}}
     session.revision++;tx.objectStore('outbox').put({id:session.id+':'+exercise.id+':result',sessionId:session.id,exerciseId:exercise.id,revision:session.revision,state:'pending',type:'exercise-result'});
    }
    session.updatedAt=now();tx.objectStore('sessions').put(session);done(session);
   }catch(error){fail(error)}};
  })}
  function finish(id,review){const validated=reviewResult(review);return transaction(['sessions','meta','outbox'],'readwrite',(tx,done,fail)=>{
   const r=tx.objectStore('sessions').get(id);r.onsuccess=()=>{const session=r.result;if(!session){fail(Error('Workout not found.'));return}if(session.status==='finished'){done(session);return}
    session.status='finished';session.finishedAt=now();session.updatedAt=session.finishedAt;session.review=validated;session.revision++;
    tx.objectStore('sessions').put(session);tx.objectStore('outbox').put({id:id+':finished',sessionId:id,revision:session.revision,state:'pending',type:'session-finished'});
    const meta=tx.objectStore('meta').get('active:'+session.scope);meta.onsuccess=()=>{if(meta.result?.value===id)tx.objectStore('meta').delete('active:'+session.scope)};done(session);
   };
  })}
  const list=store=>transaction([store],'readonly',(tx,done)=>{const r=tx.objectStore(store).getAll();r.onsuccess=()=>done(r.result)});
  return {active,ensure,save,finish,getSession:id=>get('sessions',id),listSessions:()=>list('sessions'),pending:()=>list('outbox'),close:async()=>{(await open()).close()}};
 }
 if(typeof module!=='undefined')module.exports={createStore,actualResult,reviewResult};
 else root.WorkoutHistoryStore={createStore,actualResult,reviewResult};
})(typeof window==='undefined'?globalThis:window);
