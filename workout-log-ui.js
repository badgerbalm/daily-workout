/* Logging is always local first. Google sync is optional and explicitly requested. */
(function(){
 'use strict';
 const store=WorkoutHistoryStore.createStore();
 let plan,scope='',storageSuffix='',session=null,sharedState=null,available=true,pending={},serial=Promise.resolve(),entries=new Map(),invalid=new Map(),outcomes=new Map();
 let recovery={};
 const recoveryKey=()=> 'workout-result-recovery:'+scope;
 function checkpoint({allowFinished=false}={}){
  if(!available||!plan)return;
  if(session?.status==='finished'){if(allowFinished)return;throw Error('Start another workout log before starting a new timer.');}
  localStorage.setItem(recoveryKey(),JSON.stringify({plan,sessionId:session?.id||null,changes:recovery}));
 }
 const panel=document.querySelector('#workout-log');
 const status=document.querySelector('#workout-log-status');
 const feedback=text=>{if(status)status.textContent=text;const message=document.querySelector('.review-message');if(message)message.textContent=/Not saved|correction|could not|unavailable/i.test(text)?text:''};
 const reviewKey=()=> 'workout-review-open:'+scope;
 function openReview(){const dialog=document.querySelector('.finish-review');if(!dialog||!available)return;localStorage.setItem(reviewKey(),'1');if(dialog.open)return;if(dialog.showModal)dialog.showModal();else dialog.setAttribute('open','');}
 function closeReview(){const dialog=document.querySelector('.finish-review');localStorage.removeItem(reviewKey());if(dialog?.close)dialog.close();else dialog?.removeAttribute('open');}
 const error=reason=>feedback('Not saved: '+reason.message);
 async function prepare(incoming,selectedScope){
  storageSuffix=selectedScope||'';scope=selectedScope||'daily';
  try{try{await window.WorkoutSharedStateReady}catch{}session=await store.active(scope);
   if(scope==='daily'&&sharedState?.connected()){try{const remote=await sharedState.getWorkout();if(remote){const merged=await store.mergeShared(remote);session=merged.status==='finished'?null:merged}if(session)session=await store.mergeShared(await sharedState.saveWorkout(session));}catch{}}
   const saved=JSON.parse(localStorage.getItem(recoveryKey())||'null');
   if(saved?.sessionId){const prior=await store.getSession(saved.sessionId);if(prior?.status==='finished'){localStorage.removeItem(recoveryKey());}else if(session&&session.id!==saved.sessionId)throw Error('Another workout is active; saved recovery data was retained.');}
   const restored=JSON.parse(localStorage.getItem(recoveryKey())||'null');
   plan=session?.plan||restored?.plan||incoming;recovery=restored?.changes||{};pending={...recovery};available=true;
   if(Object.keys(pending).length)await flush();
   // A prior day's unfinished log must not pin an old Safari tab to yesterday.
   // Preserve it locally, and only roll forward to an actually published plan
   // for today's local calendar date. Same-day prescription snapshots stay fixed.
   const date=new Date(),today=date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');
   if(scope==='daily'&&incoming.date===today&&plan.date<incoming.date){
    if(session)await store.leaveUnfinished(session.id);
    else if(restored?.plan){await flush();await store.leaveUnfinished(session.id);}
    session=null;plan=incoming;recovery={};pending={};
    localStorage.removeItem(recoveryKey());localStorage.removeItem(reviewKey());
   }
   if(panel)panel.hidden=false;
   feedback(session?(JSON.stringify(session.plan)!==JSON.stringify(incoming)?'Resuming your unfinished workout snapshot; latest plan is held until you finish.':'Resuming your saved workout.'):'Results save as you go.');
   return plan;
  }catch(reason){available=false;plan=incoming;if(panel)panel.hidden=false;feedback('Workout history unavailable: '+reason.message+' Timers still work, but results cannot be saved.');return incoming}
 }
 function queue(key,change){
  if(!available||session?.status==='finished')return;
  pending[key]={...(pending[key]||{}),...change};recovery[key]={...(recovery[key]||{}),...change};
  try{checkpoint()}catch(reason){error(reason)}flush().catch(error);
 }
 function flush({allowFinished=false}={}){
  serial=serial.catch(()=>{}).then(async()=>{
   if(!available||!plan)return;
   if(session?.status==='finished'){if(allowFinished)return;throw Error('Start another workout log before starting a new timer.');}
   session=await store.ensure(plan,scope);
   if(JSON.stringify(session.plan)!==JSON.stringify(plan))throw Error('Another tab started a different workout. Refresh to resume that saved workout.');
   const changes=pending;pending={};const recorded=JSON.stringify(recovery);
   try{if(Object.keys(changes).length)session=await store.save(session.id,changes)}catch(reason){for(const [key,value] of Object.entries(changes))pending[key]={...value,...pending[key]};throw reason}
   if(recorded===JSON.stringify(recovery)){recovery={};localStorage.removeItem(recoveryKey());}
   let cloudSaved=false;if(scope==='daily'&&sharedState?.connected()){try{const latest=await sharedState.saveWorkout(session);cloudSaved=Boolean(latest);if(latest&&latest.id===session.id&&Date.parse(latest.updatedAt)>Date.parse(session.updatedAt))session=await store.mergeShared(latest)}catch{}}
   feedback(invalid.size?'Draft saved · correct incomplete fields before finishing.':cloudSaved?'Saved on this device and synced across your connected browsers.':'Saved on this device.');
  });return serial;
 }
 function queueStatus(key,state,source='user'){
  const actualState=state==='completed'&&source!=='user'?'inferred':state;
  if(actualState==='inferred'&&['completed','skipped'].includes(outcomes.get(key)))return;
  outcomes.set(key,actualState);
  queue(key,{status:actualState,source});
  const badge=entries.get(key)?.badge;if(badge)badge.textContent=labels[actualState];
 }
 const labels={unfinished:'Unfinished',completed:'Confirmed complete',skipped:'Skipped',inferred:'Needs confirmation · navigation/timer only'};
 function element(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node}
 function field(parent,label,type,value,attributes={}){
  const wrapper=element('label','result-field'),input=element(type==='select'?'select':'input');wrapper.append(element('span','',label));
  if(type==='select'){for(const [v,text] of attributes.options||[]){const option=element('option','',text);option.value=v;input.append(option)}}
  else{input.type=type;input.inputMode=type==='number'?'decimal':'text';if(type==='number'){input.min='0';input.step='any'}}
  for(const [key,val] of Object.entries(attributes))if(key!=='options')input.setAttribute(key,val);
  input.value=value??'';wrapper.append(input);parent.append(wrapper);return input;
 }
 const units=[['lb','lb'],['kg','kg']];
 async function mount(rowMap){
  await serial.catch(()=>{});entries=new Map();invalid=new Map();outcomes=new Map();if(!available)return;
  const previousSessions=(await store.listSessions()).filter(saved=>saved.id!==session?.id).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
  for(const [key,entry] of rowMap){
   const saved=session?.exercises[key];
   const savedActual=saved?.draft||saved?.actual;
   if(saved?.draft){try{WorkoutHistoryStore.actualResult(saved.draft)}catch(reason){invalid.set(key,reason.message)}}
   if(saved){outcomes.set(key,saved.status);entry.check.checked=['completed','inferred'].includes(saved.status);}
   const details=element('details','actual-results'),summary=element('summary','','Record results');details.append(summary);
   const badge=element('p','result-outcome',labels[saved?.status||'unfinished']);details.append(badge);entries.set(key,{badge,entry});
   const walking=/treadmill|walking/i.test(entry.section.title);
   const priorExercise=previousSessions.flatMap(saved=>Object.values(saved.exercises||{})).find(exercise=>exercise.name.toLowerCase()===entry.item.name.toLowerCase());
   details.append(element('p','result-help',walking?'Suggested settings are ready. Adjust if needed. Finish Workout confirms settings for walks marked done.':'Actual performance only. Blank fields mean not recorded. Saving values does not confirm completion.'));
   const form=element('div','results-form');details.append(form);
   let setControls=[],treadmillControls;
   const update=()=>{
    let actual;
    if(walking){actual={sets:[],treadmill:Object.fromEntries(Object.entries(treadmillControls).map(([name,input])=>[name,input.value]))}}
    else actual={sets:setControls.map(set=>({id:set.id,...Object.fromEntries(Object.entries(set.controls).map(([name,input])=>[name,input.value]))}))};
    const draft=actual;
    try{actual=WorkoutHistoryStore.actualResult(actual);invalid.delete(key);queue(key,walking?{draft}:{actual,draft:null});feedback('Saving on this device…');return true}catch(reason){invalid.set(key,reason.message);queue(key,{draft});feedback('Draft saved locally; '+reason.message);return false}
   };
   if(walking){
    const detail=String(entry.item.detail||'');
    function upper(unit){const match=detail.match(new RegExp('(\\d+(?:\\.\\d+)?)(?:\\s*[–—-]\\s*(\\d+(?:\\.\\d+)?))?\\s*'+unit,'i'));return match?Number(match[2]||match[1]):''}
    const t={durationSeconds:entry.item.seconds||'',speed:upper('(?:mph|km/h)'),speedUnit:/km\/h/i.test(detail)?'km/h':'mph',inclinePct:upper('%'),distance:'',distanceUnit:'mi',...(priorExercise?.actual?.treadmill||{}),...(savedActual?.treadmill||{})};
    treadmillControls={};
    function choices(min,max,step,value,format){const values=new Set(['',...Array.from({length:Math.round((max-min)/step)+1},(_,i)=>String(Number((min+i*step).toFixed(2))))]);if(value!==undefined&&value!==null)values.add(String(value));return [...values].sort((a,b)=>a===''?-1:b===''?1:Number(a)-Number(b)).map(v=>[v,v===''?'Not recorded':format(Number(v))])}
    treadmillControls.durationSeconds=field(form,'Duration','select',t.durationSeconds,{options:choices(30,5400,30,t.durationSeconds,n=>n/60+' min')});
    treadmillControls.speed=field(form,'Speed','select',t.speed,{options:choices(0.5,15,0.1,t.speed,n=>String(n))});
    treadmillControls.inclinePct=field(form,'Incline %','select',t.inclinePct,{options:choices(-5,20,0.5,t.inclinePct,n=>n+'%')});
    const more=element('details','walk-more');more.append(element('summary','','Distance & units · optional'));const extra=element('div','results-form');more.append(extra);form.append(more);
    treadmillControls.speedUnit=field(extra,'Speed unit','select',t.speedUnit||'mph',{options:[['mph','mph'],['km/h','km/h']]});
    const labelSpeed=()=>{for(const option of treadmillControls.speed.options)if(option.value)option.textContent=option.value+' '+treadmillControls.speedUnit.value};labelSpeed();treadmillControls.speedUnit.addEventListener('input',labelSpeed);treadmillControls.speedUnit.addEventListener('change',labelSpeed);
    treadmillControls.distance=field(extra,'Distance','number',t.distance);
    treadmillControls.distanceUnit=field(extra,'Distance unit','select',t.distanceUnit||'mi',{options:[['mi','mi'],['km','km']]});

   }else{
    const weighted=/dumbbell|row|press|raise|carr/i.test(entry.item.name);
    const timed=/plank|carr|stretch|pose/i.test(entry.item.name);
    function addSet(data={}){
     const set=element('fieldset','actual-set'),legend=element('legend','','Set '+(setControls.length+1));set.append(legend);
     const controls={};
     const priorSet=priorExercise?.actual?.sets?.[setControls.length]||priorExercise?.actual?.sets?.at(-1)||{};
     const detail=String(entry.item.detail||'');
     const repRange=detail.match(/(\d+)\s*(?:-|–|to)\s*(\d+)\s*reps?/i);
     const recommendedReps=repRange?Number(repRange[2]):Number(detail.match(/[×x]\s*(\d+)/i)?.[1]||detail.match(/(\d+)\s*reps?/i)?.[1])||10;
     const recommendedSeconds=Number(detail.match(/[×x]\s*(\d+)\s*(?:seconds?|secs?)/i)?.[1]||detail.match(/(\d+)\s*(?:seconds?|secs?)/i)?.[1]||entry.item.seconds)||'';
     const recommendedSide=weighted||/per\s+(?:side|arm)|each\s+side/i.test(detail)?'both':'';
     const repsLabel=/per\s+side|each\s+side/i.test(detail)?'Actual reps per side':/per\s+arm/i.test(detail)?'Actual reps per arm':'Actual reps';
     if(!timed)controls.reps=weighted?field(set,repsLabel,'select',data.reps??priorSet.reps??recommendedReps,{options:Array.from({length:30},(_,i)=>[String(i+1),String(i+1)])}):field(set,repsLabel,'number',data.reps??priorSet.reps??recommendedReps,{step:'1'});
     if(weighted){controls.weight=field(set,'Actual weight','select',data.weight??priorSet.weight??5,{options:Array.from({length:40},(_,i)=>[String((i+1)*5),String((i+1)*5)+' lb'])});controls.weightUnit=field(set,'Unit','select',data.weightUnit||priorSet.weightUnit||'lb',{options:units});controls.weightBasis=field(set,'Weight basis','select',data.weightBasis||priorSet.weightBasis||'per-dumbbell',{options:[['per-dumbbell','Per dumbbell'],['single-hand','One hand'],['total','Total load']]})}
     controls.side=field(set,'Side','select',data.side||priorSet.side||recommendedSide,{options:[['','Not specified'],['left','Left'],['right','Right'],['both','Both']]});
     if(timed)controls.durationSeconds=field(set,'Actual hold/carry seconds','number',data.durationSeconds??priorSet.durationSeconds??recommendedSeconds);
     setControls.push({id:data.id||crypto.randomUUID(),controls});form.append(set);
    }
    const savedSets=savedActual?.sets||[];
    if(savedSets.length)savedSets.forEach(addSet);
    else{const match=String(entry.item.detail||'').match(/(\d+)\s*[×x]/);for(let i=0;i<Math.min(Number(match?.[1])||1,10);i++)addSet()}
    const add=element('button','secondary','+ Add set');add.type='button';add.onclick=()=>addSet();details.append(add);
   }
   if(walking)entries.get(key).readWalking=()=>WorkoutHistoryStore.actualResult({sets:[],treadmill:Object.fromEntries(Object.entries(treadmillControls).map(([name,input])=>[name,input.value]))});
   form.addEventListener('input',update);form.addEventListener('change',update);
   const actions=element('div','result-actions');
   const confirm=element('button','','Confirm complete');confirm.type='button';confirm.onclick=()=>{if(!update())return;if(walking){const actual=WorkoutHistoryStore.actualResult({sets:[],treadmill:Object.fromEntries(Object.entries(treadmillControls).map(([name,input])=>[name,input.value]))});queue(key,{actual,draft:null});}entry.check.checked=true;entry.check.onchange()};
   const skip=element('button','secondary','Skip exercise');skip.type='button';skip.onclick=()=>{if(!allowStartingExercise(key))return;entry.done.onclick();entry.check.checked=false;saveExerciseCheck(plan.date,key,false,'skipped')};
   actions.append(confirm,skip);details.append(actions);entry.row.querySelector('.exercise-info').append(details);
  }
  renderFinish();await renderHistory();
 }
 function renderFinish(){
  const host=document.querySelector('#workout-finish');if(!host)return;host.replaceChildren();
  const launch=element('button','secondary','Finish workout');launch.type='button';launch.onclick=openReview;host.append(launch);
  const details=element('dialog','finish-review');details.setAttribute('aria-labelledby','finish-review-title');const title=element('h2','','How was your workout?');title.id='finish-review-title';details.append(title);details.addEventListener('cancel',()=>localStorage.removeItem(reviewKey()));
  const form=element('div','results-form');details.append(form);
  const draft=session?.reviewDraft||{};
  function rating(label,min,max,value){const group=element('fieldset','review-rating');if(max-min===10)group.classList.add('rating-eleven');group.append(element('legend','',label));const choices=element('div','rating-choices');group.append(choices);const result={value:value??''};for(let number=min;number<=max;number++){const button=element('button','rating-choice',String(number));button.type='button';button.setAttribute('aria-pressed',String(String(value)===String(number)));button.onclick=()=>{result.value=String(result.value)===String(number)?'':String(number);for(const choice of choices.children)choice.setAttribute('aria-pressed',String(choice.textContent===result.value));form.dispatchEvent(new Event('input',{bubbles:true}));};choices.append(button)}form.append(group);return result;}
  const effort=rating('Effort · 1 easy to 10 hardest',1,10,draft.effort);
  const energy=rating('Energy · 1 low to 5 high',1,5,draft.energy);
  const discomfort=rating('Discomfort · 0 none to 10 severe',0,10,draft.discomfort);
  const label=element('label','result-field');label.append(element('span','','Notes · optional'));const notes=element('textarea');notes.maxLength=4000;notes.value=draft.notes||'';notes.rows=2;notes.placeholder='Anything to adjust next time?';label.append(notes);form.append(label);
  details.append(element('p','result-help','Optional ratings · Save confirms settings for walks marked done.'));
  form.addEventListener('input',()=>{try{const review=WorkoutHistoryStore.reviewResult({effort:effort.value,energy:energy.value,discomfort:discomfort.value,notes:notes.value});invalid.delete('__reviewDraft');queue('__reviewDraft',{review})}catch(reason){invalid.set('__reviewDraft',reason.message);feedback('Review needs correction: '+reason.message)}});
  const message=element('p','review-message');message.setAttribute('role','status');details.append(message);
  const finish=element('button','','Save workout');finish.type='button';finish.onclick=async()=>{
   finish.disabled=true;
   try{if(invalid.size)throw Error('Correct incomplete result fields before finishing.');const review=WorkoutHistoryStore.reviewResult({effort:effort.value,energy:energy.value,discomfort:discomfort.value,notes:notes.value});const walks=[];for(const [key,value] of entries){if(value.readWalking&&value.entry.check.checked&&outcomes.get(key)!=='skipped')walks.push([key,value.readWalking()]);}
    for(const [key,actual] of walks){queue(key,{actual,draft:null});queueStatus(key,'completed','user');}
    await flush();session=await store.finish(session.id,review);if(scope==='daily'&&sharedState?.connected())try{session=await sharedState.saveWorkout(session)}catch{}recovery={};localStorage.removeItem(recoveryKey());feedback('Workout finished and saved.');for(const {entry} of entries.values())for(const input of entry.row.querySelectorAll('input,select,button'))input.disabled=true;
    await renderHistory();window.dispatchEvent(new Event('workout-finished'));closeReview();launch.hidden=true;
    const another=element('button','secondary','Start another workout log');another.type='button';another.onclick=async()=>{const oldDate=session.plan.date;session=null;pending={};invalid.clear();localStorage.removeItem('workout-checks-'+oldDate);localStorage.removeItem('workout-navigation-position'+storageSuffix);localStorage.removeItem('workout-card-view'+storageSuffix);await window.refreshWorkout('top')};host.append(another);
    window.finishRequestedDeviceTracking?.();}
   catch(reason){error(reason);finish.disabled=false}
  };const actions=element('div','review-actions');const back=element('button','secondary','Back');back.type='button';back.onclick=closeReview;actions.append(back,finish);details.append(actions);host.append(details);if(localStorage.getItem(reviewKey())==='1')openReview();
 }
 async function renderHistory(){
  const host=document.querySelector('#local-history-list');if(!host)return;
  const sessions=(await store.listSessions()).sort((a,b)=>b.startedAt.localeCompare(a.startedAt)).slice(0,10);host.replaceChildren();
  for(const saved of sessions){const details=element('details','saved-session');details.append(element('summary','',new Date(saved.startedAt).toLocaleDateString()+' · '+saved.plan.title+' · '+saved.status));
   for(const exercise of Object.values(saved.exercises)){const p=element('p','',exercise.name+' — '+labels[exercise.status]);details.append(p);if(exercise.actual.sets.length||exercise.actual.treadmill){const values=element('ul','saved-actuals');exercise.actual.sets.forEach((set,index)=>{const parts=[set.side,set.reps===null?null:set.reps+' reps',set.weight===null?null:set.weight+' '+set.weightUnit+' '+set.weightBasis,set.durationSeconds===null?null:set.durationSeconds+' sec'].filter(Boolean);if(parts.length)values.append(element('li','','Set '+(index+1)+': '+parts.join(' · ')))});const t=exercise.actual.treadmill;if(t){const parts=[t.durationSeconds===null?null:t.durationSeconds+' sec',t.speed===null?null:t.speed+' '+t.speedUnit,t.inclinePct===null?null:t.inclinePct+'% incline',t.distance===null?null:t.distance+' '+t.distanceUnit].filter(Boolean);if(parts.length)values.append(element('li','',parts.join(' · ')))}details.append(values)}}
   host.append(details);
   if(saved.review){const values=[saved.review.effort===null?null:'Effort '+saved.review.effort+'/10',saved.review.energy===null?null:'Energy '+saved.review.energy+'/5',saved.review.discomfort===null?null:'Discomfort '+saved.review.discomfort+'/10'].filter(Boolean);if(values.length)details.append(element('p','',values.join(' · ')));if(saved.review.notes)details.append(element('p','saved-review-notes',saved.review.notes));}
  }
 }
 const exportButton=document.querySelector('#export-local-history');
 if(exportButton)exportButton.onclick=async()=>{try{await serial.catch(()=>{});const data={format:'daily-workout-local-backup',version:1,exportedAt:new Date().toISOString(),sessions:await store.listSessions(),pending:await store.pending()};const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='daily-workout-private-backup-'+new Date().toISOString().slice(0,10)+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),30000)}catch(reason){error(reason)}};
 window.WorkoutLog={prepare,mount,flush,checkpoint,queueStatus,openReview,store,renderHistory,setSharedState:value=>{sharedState=value}};
 window.addEventListener('pagehide',()=>{if(Object.keys(pending).length)flush().catch(error)});
})();
