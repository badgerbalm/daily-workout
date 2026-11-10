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
 function finishedRecord(value){
  const validText=v=>typeof v==='string'&&v.length>0&&v.length<=200;
  const validDate=v=>typeof v==='string'&&Number.isFinite(Date.parse(v));
  if(!value||JSON.stringify(value).length>800000||!validText(value.id)||value.status!=='finished'||value.scope!=='daily'||!Number.isSafeInteger(value.revision)||value.revision<1||![value.startedAt,value.updatedAt,value.finishedAt].every(validDate))throw Error('Invalid finished workout record.');
  const plan=value.plan;if(!plan||typeof plan.title!=='string'||typeof plan.date!=='string'||!Array.isArray(plan.sections)||plan.sections.length>100)throw Error('Invalid saved workout plan.');
  const keys=[];plan.sections.forEach((section,s)=>{if(!Array.isArray(section.items)||section.items.length>500)throw Error('Invalid saved exercises.');section.items.forEach((item,i)=>{if(typeof item.name!=='string')throw Error('Invalid exercise name.');keys.push(item.progressKey||s+'-'+i)})});
  if(!value.exercises||keys.length!==Object.keys(value.exercises).length||new Set(keys).size!==keys.length)throw Error('Invalid saved exercise keys.');
  const exercises=Object.create(null);
  for(const key of keys){const e=value.exercises[key];if(!e||!validText(e.id)||e.key!==key||typeof e.name!=='string'||!['unfinished','completed','inferred','skipped'].includes(e.status)||!e.actual)throw Error('Invalid saved exercise result.');
   exercises[key]={id:e.id,key,name:e.name,prescribed:clone(e.prescribed),status:e.status,completionSource:e.completionSource||null,actual:actualResult(e.actual)};
  }
  return {id:value.id,scope:'daily',plan:clone(plan),status:'finished',startedAt:value.startedAt,updatedAt:value.updatedAt,revision:value.revision,exercises,review:reviewResult(value.review||{}),finishedAt:value.finishedAt};
 }
 function sharedRecord(value){
  if(!value||JSON.stringify(value).length>800000||typeof value.id!=='string'||value.scope!=='daily'||!['in-progress','unfinished','finished'].includes(value.status)||!Number.isSafeInteger(value.revision)||value.revision<0||![value.startedAt,value.updatedAt].every(v=>typeof v==='string'&&Number.isFinite(Date.parse(v))))throw Error('Invalid shared workout save.');
  if(value.status==='finished')return finishedRecord(value);
  const plan=value.plan;if(!plan||typeof plan.title!=='string'||typeof plan.date!=='string'||!Array.isArray(plan.sections)||plan.sections.length>100)throw Error('Invalid shared workout plan.');
  const keys=[];plan.sections.forEach((section,s)=>{if(!Array.isArray(section.items)||section.items.length>500)throw Error('Invalid saved exercises.');section.items.forEach((item,i)=>{if(typeof item.name!=='string')throw Error('Invalid exercise name.');keys.push(item.progressKey||s+'-'+i)})});
  if(!value.exercises||keys.length!==Object.keys(value.exercises).length||new Set(keys).size!==keys.length)throw Error('Invalid shared workout exercises.');
  const exercises=Object.create(null);for(const key of keys){const e=value.exercises[key];if(!e||typeof e.id!=='string'||e.key!==key||typeof e.name!=='string'||!['unfinished','completed','inferred','skipped'].includes(e.status)||!e.actual)throw Error('Invalid shared exercise result.');exercises[key]={...clone(e),actual:actualResult(e.actual),...(e.draft===undefined?{}:{draft:clone(e.draft)})}}
  return {...clone(value),exercises};
 }
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
  function leaveUnfinished(id){return transaction(['sessions','meta'],'readwrite',(tx,done)=>{
   const sessions=tx.objectStore('sessions'),request=sessions.get(id);
   request.onsuccess=()=>{const saved=request.result;if(!saved||saved.status!=='in-progress')return;
    saved.status='unfinished';saved.updatedAt=now();sessions.put(saved);
    const meta=tx.objectStore('meta'),activeRequest=meta.get('active:'+saved.scope);
    activeRequest.onsuccess=()=>{if(activeRequest.result?.value===id)meta.delete('active:'+saved.scope)};
   };done();
  })}
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
  // Imported finished records never replace local records or become active workouts.
  function importFinished(records){const validated=records.map(finishedRecord);return transaction(['sessions'],'readwrite',(tx,done,fail)=>{
   for(const record of validated){const r=tx.objectStore('sessions').get(record.id);r.onsuccess=()=>{if(r.result?.status==='in-progress'){fail(Error('A restored record conflicts with an active workout. Local data was preserved.'));return}if(!r.result)tx.objectStore('sessions').add(record)}}done();
  })}
  function mergeShared(input){const remote=sharedRecord(input);return transaction(['sessions','meta'],'readwrite',(tx,done)=>{
   const sessions=tx.objectStore('sessions'),meta=tx.objectStore('meta'),activeRequest=meta.get('active:daily');activeRequest.onsuccess=()=>{
    const localId=activeRequest.result?.value,localRequest=localId?sessions.get(localId):null;const apply=local=>{
     const remoteWins=!local||Date.parse(remote.updatedAt)>Date.parse(local.updatedAt)||(remote.updatedAt===local.updatedAt&&remote.id===local.id&&remote.revision>local.revision);
     if(!remoteWins){done(local);return}
     const restored=remote.status==='unfinished'?{...remote,status:'in-progress'}:remote;sessions.put(restored);if(restored.status==='in-progress')meta.put({key:'active:daily',value:restored.id});else meta.delete('active:daily');done(restored);
    };
    if(localRequest)localRequest.onsuccess=()=>apply(localRequest.result);else apply(null);
   };
  })}
  return {active,ensure,save,finish,leaveUnfinished,importFinished,mergeShared,getSession:id=>get('sessions',id),listSessions:()=>list('sessions'),pending:()=>list('outbox'),close:async()=>{(await open()).close()}};
 }
 if(typeof module!=='undefined')module.exports={createStore,actualResult,reviewResult,finishedRecord,sharedRecord};
 else root.WorkoutHistoryStore={createStore,actualResult,reviewResult,finishedRecord,sharedRecord};
})(typeof window==='undefined'?globalThis:window);
