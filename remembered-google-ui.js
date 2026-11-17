(function(){
 'use strict';
 const panel=document.querySelector('#google-sync');if(!panel||!window.WorkoutRememberedGoogle)return;
 const connection=WorkoutRememberedGoogle.create();
 const service=WorkoutGoogleSync.createSync({store:WorkoutLog.store,connection,onStatus:message=>status.textContent=message});
 const connect=panel.querySelector('#google-connect'),sync=panel.querySelector('#google-sync-now'),create=panel.querySelector('#google-create-sheet'),disconnect=panel.querySelector('#google-disconnect'),status=panel.querySelector('#google-sync-status'),link=panel.querySelector('#google-sheet-link');
 const enableAlerts=panel.querySelector('#enable-backup-alerts'),disableAlerts=panel.querySelector('#disable-backup-alerts'),alertStatus=panel.querySelector('#backup-alert-status');
 let busy=true,automaticSyncTask=null,retryTimer=null,retryDelay=30000,pushRegistrationPromise=null,pushConfigPromise=null,activePushSubscription=null,activeReporterToken=null;
 function controls(){const active=connection.connected();connect.disabled=busy;sync.disabled=busy||!active;disconnect.hidden=!active;disconnect.disabled=busy;create.disabled=busy||!active;connect.textContent=active?'Reconnect Google':'Connect Google';}
 async function action(work){busy=true;controls();try{await work()}catch(error){status.textContent=error.message||'Could not sync. Your local results are safe.';}finally{busy=false;controls()}}
 async function syncNow(){
  await WorkoutLog.flush({allowFinished:true});const result=await service.sync();
  if(result.needsSheet){create.hidden=false;status.textContent='No app-linked history Sheet was found. Your workouts remain saved on this device. Reconnect the Google account that owns your existing private Sheet; do not create another unless you confirm none exists.';return false;}
  create.hidden=true;link.href='https://docs.google.com/spreadsheets/d/'+encodeURIComponent(result.sheetId)+'/edit';link.hidden=false;
  status.textContent=result.count+' finished workout'+(result.count===1?'':'s')+' backed up · synced '+new Date().toLocaleTimeString()+'. Google connection remembered in this browser.';
  await WorkoutLog.renderHistory();
  return true;
 }
 function iosNeedsHomeScreen(){const ios=/iPhone|iPad|iPod/i.test(navigator.userAgent)||(/Macintosh/i.test(navigator.userAgent)&&navigator.maxTouchPoints>1);return ios&&!navigator.standalone&&!window.matchMedia?.('(display-mode: standalone)').matches}
 function pushRegistration(){return pushRegistrationPromise||=navigator.serviceWorker.register('./service-worker.js').then(()=>navigator.serviceWorker.ready)}
 function applicationServerKey(value){const encoded=value.replace(/-/g,'+').replace(/_/g,'/'),raw=atob(encoded.padEnd(Math.ceil(encoded.length/4)*4,'='));return Uint8Array.from(raw,char=>char.charCodeAt(0))}
 function alertMessage(code){if(code==='google-auth')return {title:'Workout backup needs attention',body:'Reconnect Google in Daily Workout → Menu → Google backup & sync. Your workout is saved on this device.'};if(code==='google-permission')return {title:'Workout backup needs attention',body:'Google rejected the backup. Reconnect Google in Menu → Google backup & sync and allow access to the private Sheet.'};if(code==='sheet-attention')return {title:'Workout Sheet needs attention',body:'Open Menu → Google backup & sync to review the Sheet issue. Your workout is saved on this device.'};return {title:'Workout backup is pending',body:'Your workout is saved on this device. Open Daily Workout while online; automatic backup will retry.'}}
 function classifyBackupError(error){const message=String(error?.message||'').toLowerCase();if(/renew|authorization|connect google|expired|401/.test(message))return 'google-auth';if(/403|denied|permission|access|api/.test(message))return 'google-permission';if(/sheet|header|conflict|changed|multiple|invalid/.test(message))return 'sheet-attention';return 'backup-retry'}
 async function localBackupAlert(code){if(typeof Notification==='undefined'||Notification.permission!=='granted')return;try{const registration=await pushRegistration();const notice=alertMessage(code);await registration.showNotification(notice.title,{body:notice.body,icon:new URL('images/apple-touch-icon.png',location.href).href,tag:'daily-workout-backup-problem',renotify:false,data:{url:new URL('./',location.href).href}})}catch{}}
 async function notifyBackupProblem(error){if(!activePushSubscription)return;const code=classifyBackupError(error);try{const token=activeReporterToken||connection.pushReporterToken(),result=await connection.reportPushProblem(code,token);if(!result.sent)await localBackupAlert(code)}catch{await localBackupAlert(code)}}
 async function refreshAlertControls(){
  if(!enableAlerts)return;
  enableAlerts.hidden=disableAlerts.hidden=true;
  if(typeof Notification==='undefined'||!('serviceWorker'in navigator)||!('PushManager'in window)){alertStatus.textContent=iosNeedsHomeScreen()?'On iPhone, add Daily Workout to your Home Screen to enable push notifications.':'This browser does not support web push notifications.';return}
  if(iosNeedsHomeScreen()){alertStatus.textContent='On iPhone, add Daily Workout to your Home Screen, then open it there to enable push notifications.';enableAlerts.hidden=false;enableAlerts.disabled=true;return}
  try{const registration=await pushRegistration(),subscription=await registration.pushManager.getSubscription();activePushSubscription=subscription;
   if(subscription){enableAlerts.hidden=true;disableAlerts.hidden=false;enableAlerts.disabled=false;alertStatus.textContent='Backup problem alerts are enabled on this device.';if(connection.connected()){activeReporterToken=connection.pushReporterToken();await connection.registerPush(subscription.toJSON(),activeReporterToken)}}
   else{activeReporterToken=null;disableAlerts.hidden=true;enableAlerts.hidden=false;enableAlerts.disabled=!connection.connected()||Notification.permission==='denied';alertStatus.textContent=Notification.permission==='denied'?'Notifications are blocked. Allow them in this device’s settings, then return here.':connection.connected()?'Turn on alerts to get a notification if a workout backup needs attention.':'Connect Google first to securely register backup alerts.'}
  }catch(error){enableAlerts.hidden=false;enableAlerts.disabled=true;alertStatus.textContent=error.message||'Could not prepare backup alerts on this device.'}
 }
 enableAlerts.onclick=async()=>{enableAlerts.disabled=true;try{if(!connection.connected())throw Error('Connect Google first to enable private backup alerts.');const permissionRequest=Notification.requestPermission();const permission=await permissionRequest;if(permission!=='granted')throw Error('Notifications were not allowed. You can change this in the device settings.');const registration=await pushRegistration(),config=await (pushConfigPromise||=connection.pushConfig());if(!config.publicKey)throw Error('Push notifications are not configured on the backup service yet.');let subscription=await registration.pushManager.getSubscription();if(!subscription)subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:applicationServerKey(config.publicKey)});activeReporterToken=connection.pushReporterToken();await connection.registerPush(subscription.toJSON(),activeReporterToken);activePushSubscription=subscription;alertStatus.textContent='Backup problem alerts are enabled on this device.';enableAlerts.hidden=true;disableAlerts.hidden=false}catch(error){alertStatus.textContent=error.message||'Could not enable backup alerts.';enableAlerts.disabled=false}};
 disableAlerts.onclick=async()=>{disableAlerts.disabled=true;try{const token=activeReporterToken||connection.pushReporterToken();if(activePushSubscription){await connection.removePush(activePushSubscription.endpoint,token);await activePushSubscription.unsubscribe()}activePushSubscription=null;activeReporterToken=null;alertStatus.textContent='Backup problem alerts are off on this device.';disableAlerts.hidden=true;enableAlerts.hidden=false;enableAlerts.disabled=!connection.connected()}catch(error){alertStatus.textContent=error.message||'Could not turn off backup alerts.';disableAlerts.disabled=false}};
 void refreshAlertControls();
 function scheduleAutomaticRetry(){if(retryTimer)clearTimeout(retryTimer);retryTimer=setTimeout(()=>{retryTimer=null;void automaticSync()},retryDelay);retryDelay=Math.min(retryDelay*2,300000)}
 async function automaticSync(){
  if(document.hidden)return false;
  if(!connection.connected()){if(activePushSubscription)void notifyBackupProblem(Error('Reconnect Google to continue.'));return false}
  if(automaticSyncTask)return automaticSyncTask;
  automaticSyncTask=(async()=>{busy=true;controls();try{const synced=await syncNow();if(synced){retryDelay=30000;if(retryTimer){clearTimeout(retryTimer);retryTimer=null}if(activeReporterToken)void connection.clearPushProblems(activeReporterToken).catch(()=>{})}else if(create.hidden===false)void notifyBackupProblem(Error('No app-linked Google history Sheet was found.'));return synced}catch(error){status.textContent='Automatic backup pending. '+(error.message||'Google sync could not finish.')+(connection.connected()?' Your workout is saved on this device; backup will retry automatically.':' Reconnect Google to resume automatic backups.');void notifyBackupProblem(error);if(connection.connected())scheduleAutomaticRetry();return false}finally{busy=false;controls();automaticSyncTask=null}})();
  return automaticSyncTask;
 }
 const viewer=document.querySelector('#google-sheet-viewer'),viewerStatus=viewer?.querySelector('#google-sheet-viewer-status'),viewerData=viewer?.querySelector('#google-sheet-data'),openInGoogle=viewer?.querySelector('#open-google-sheet');
 const cell=(tag,text)=>{const node=document.createElement(tag);node.textContent=text;return node};
 function actualText(exercise){const actual=exercise.actual||{},parts=[];for(const [index,set] of (actual.sets||[]).entries()){const values=['Set '+(index+1),set.side,set.reps===null||set.reps===undefined?null:set.reps+' reps',set.weight===null||set.weight===undefined?null:set.weight+' '+(set.weightUnit||'lb')+(set.weightBasis==='per-dumbbell'?' per dumbbell':set.weightBasis==='single-hand'?' in one hand':set.weightBasis==='total'?' total':''),set.durationSeconds===null||set.durationSeconds===undefined?null:set.durationSeconds+' sec'].filter(Boolean);if(values.length>1)parts.push(values.join(' · '))}const t=actual.treadmill;if(t){const values=[t.durationSeconds==null?null:Math.round(t.durationSeconds/60)+' min',t.speed==null?null:t.speed+' '+(t.speedUnit||'mph'),t.inclinePct==null?null:t.inclinePct+'% incline',t.distance==null?null:t.distance+' '+(t.distanceUnit||'mi')].filter(Boolean);if(values.length)parts.push(values.join(' · '))}return parts.join('\n')||'—'}
 function renderHistory(records){
  viewerData.replaceChildren();
  if(!records.length){viewerData.append(cell('p','No finished workouts are saved in the Google Sheet yet.'));return}
  const table=document.createElement('table');table.className='google-sheet-history-table';
  const head=document.createElement('thead'),header=document.createElement('tr');
  for(const label of ['Date','Workout','Exercise','Status','Recorded results','Symptoms'])header.append(cell('th',label));
  head.append(header);table.append(head);
  const body=document.createElement('tbody');
  for(const record of records){
   for(const exercise of Object.values(record.exercises||{})){
    const row=document.createElement('tr');
    row.append(
     cell('td',record.plan?.date||'—'),
     cell('td',record.plan?.title||'Workout'),
     cell('td',exercise.name||'Exercise'),
     cell('td',(exercise.status||'unfinished').replace(/\b\w/g,c=>c.toUpperCase())),
     cell('td',actualText(exercise)),
     cell('td',exercise.symptoms||'')
    );
    body.append(row);
   }
   const review=record.review||{};
   const reviewParts=[review.effort==null?null:'Effort '+review.effort+'/10',review.energy==null?null:'Energy '+review.energy+'/5',review.discomfort==null?null:'Discomfort '+review.discomfort+'/10'].filter(Boolean);
   if(reviewParts.length||review.notes){
    const details=document.createElement('details');details.className='sheet-review';
    details.append(cell('summary','Workout review'));
    if(reviewParts.length)details.append(cell('p',reviewParts.join(' · ')));
    if(review.notes)details.append(cell('p',review.notes));
    const reviewCell=document.createElement('td');reviewCell.colSpan=6;reviewCell.append(details);
    const reviewRow=document.createElement('tr');reviewRow.className='sheet-review-row';reviewRow.append(reviewCell);body.append(reviewRow);
   }
  }
  table.append(body);viewerData.append(table);
 }
 async function refreshSheetPreview(){if(!viewerStatus||!viewerData)return;viewerStatus.textContent='Loading workout history…';viewerData.replaceChildren();try{const result=await service.preview();if(result.needsSheet){viewerStatus.textContent='No Daily Workout Sheet was found for this Google account.';return}renderHistory(result.records);viewerStatus.textContent=result.records.length+' finished workout'+(result.records.length===1?'':'s')+' · refreshed '+new Date().toLocaleTimeString()+'.'}catch(error){viewerStatus.textContent=error.message||'Could not load workout history. Your data in Google is unchanged.'}}
 if(viewer&&link){link.onclick=event=>{event.preventDefault();openInGoogle.href=link.href;viewer.showModal();refreshSheetPreview()};viewer.querySelector('#refresh-google-sheet').onclick=refreshSheetPreview;viewer.querySelector('#close-google-sheet-viewer').onclick=()=>viewer.close()}
 connect.onclick=()=>action(async()=>{status.textContent='Opening Google…';await connection.connect()});
 sync.onclick=()=>action(async()=>{try{await syncNow()}catch(error){void notifyBackupProblem(error);throw error}});
 create.onclick=()=>action(async()=>{await service.createSheet();await syncNow()});
 disconnect.onclick=()=>action(async()=>{await connection.disconnect();link.hidden=true;create.hidden=true;status.textContent='Disconnected in this browser. Saved workouts remain on this device and in Google.'});
 window.addEventListener('pageshow',()=>{controls();void automaticSync()});
 window.addEventListener('online',()=>void automaticSync());
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void automaticSync()});
 window.addEventListener('workout-app-ready',()=>{void refreshAlertControls();void automaticSync()});
 window.addEventListener('workout-finished',event=>{if(event.detail?.scope&&event.detail.scope!=='daily')return;if(!connection.connected()){status.textContent='Workout saved on this device. Connect Google once in this browser to enable automatic backups.';void notifyBackupProblem(Error('Reconnect Google to continue.'));return}status.textContent='Workout saved. Backing up finished results to your private Google Sheet…';void automaticSync().then(synced=>{if(synced&&event.detail?.sharedSaved===false)status.textContent+=' The cross-browser save did not complete; the Google history backup succeeded.'})});
 controls();
 if(window.WorkoutLog)WorkoutLog.setSharedState(connection);
 window.WorkoutSharedStateReady=connection.restore().then(active=>{status.textContent=active?'Connected as onlinesny@gmail.com · finished workouts back up automatically.':'Connect Google once here. Safari and the Home Screen app may each need their own initial connection.';return active;}).catch(error=>{status.textContent=error.message;return false;}).finally(()=>{busy=false;controls()});
})();
