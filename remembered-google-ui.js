(function(){
 'use strict';
 const panel=document.querySelector('#google-sync');if(!panel||!window.WorkoutRememberedGoogle)return;
 const connection=WorkoutRememberedGoogle.create();
 const service=WorkoutGoogleSync.createSync({store:WorkoutLog.store,connection,onStatus:message=>status.textContent=message});
 const connect=panel.querySelector('#google-connect'),sync=panel.querySelector('#google-sync-now'),create=panel.querySelector('#google-create-sheet'),disconnect=panel.querySelector('#google-disconnect'),status=panel.querySelector('#google-sync-status'),link=panel.querySelector('#google-sheet-link');
 let busy=true;
 function controls(){const active=connection.connected();connect.disabled=busy;sync.disabled=busy||!active;disconnect.hidden=!active;disconnect.disabled=busy;create.disabled=busy||!active;connect.textContent=active?'Reconnect Google':'Connect Google';}
 async function action(work){busy=true;controls();try{await work()}catch(error){status.textContent=error.message||'Could not sync. Your local results are safe.';}finally{busy=false;controls()}}
 async function syncNow(){
  await WorkoutLog.flush({allowFinished:true});const result=await service.sync();
  if(result.needsSheet){create.hidden=false;status.textContent='No Daily Workout Sheet found. Create a private Sheet below to begin.';return;}
  create.hidden=true;link.href='https://docs.google.com/spreadsheets/d/'+encodeURIComponent(result.sheetId)+'/edit';link.hidden=false;
  status.textContent=result.count+' finished workout'+(result.count===1?'':'s')+' backed up · synced '+new Date().toLocaleTimeString()+'. Google connection remembered in this browser.';
  await WorkoutLog.renderHistory();
 }
 const viewer=document.querySelector('#google-sheet-viewer'),frame=viewer?.querySelector('iframe'),viewerStatus=viewer?.querySelector('#google-sheet-viewer-status'),openInGoogle=viewer?.querySelector('#open-google-sheet');let viewerTimeout;
 function refreshSheetPreview(){if(!link||!frame||!viewerStatus)return;clearTimeout(viewerTimeout);viewerStatus.textContent='Loading Google Spreadsheet…';const url=new URL(link.href);url.pathname=url.pathname.replace(/\/edit\/?$/,'/preview');url.searchParams.set('gid','0');url.searchParams.set('refresh',String(Date.now()));frame.src=url.href;viewerTimeout=setTimeout(()=>{viewerStatus.textContent='If the sheet has not appeared, use Open in Google.'},12000)}
 if(viewer&&link){frame.onload=()=>{clearTimeout(viewerTimeout);viewerStatus.textContent='Use Refresh sheet to check for the latest changes.'};link.onclick=event=>{event.preventDefault();openInGoogle.href=link.href;viewer.showModal();refreshSheetPreview()};viewer.querySelector('#refresh-google-sheet').onclick=refreshSheetPreview;viewer.querySelector('#close-google-sheet-viewer').onclick=()=>viewer.close();viewer.addEventListener('close',()=>{clearTimeout(viewerTimeout);frame.src='about:blank'})}
 connect.onclick=()=>action(async()=>{status.textContent='Opening Google…';await connection.connect()});
 sync.onclick=()=>action(syncNow);
 create.onclick=()=>action(async()=>{await service.createSheet();await syncNow()});
 disconnect.onclick=()=>action(async()=>{await connection.disconnect();link.hidden=true;create.hidden=true;status.textContent='Disconnected in this browser. Saved workouts remain on this device and in Google.'});
 window.addEventListener('pageshow',controls);
 window.addEventListener('workout-finished',()=>{if(connection.connected())status.textContent='Workout saved across connected browsers. Tap Sync now to back up finished history to Google Sheets.'});
 controls();
 if(window.WorkoutLog)WorkoutLog.setSharedState(connection);
 window.WorkoutSharedStateReady=connection.restore().then(active=>{status.textContent=active?'Connected as onlinesny@gmail.com · workout progress saves across connected browsers. Sync now backs up finished history to Google.':'Connect Google once here. Safari and the Home Screen app may each need their own initial connection.';return active;}).catch(error=>{status.textContent=error.message;return false;}).finally(()=>{busy=false;controls()});
})();
