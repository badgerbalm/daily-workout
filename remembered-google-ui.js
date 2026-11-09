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
 connect.onclick=()=>action(async()=>{status.textContent='Opening Google…';await connection.connect()});
 sync.onclick=()=>action(syncNow);
 create.onclick=()=>action(async()=>{await service.createSheet();await syncNow()});
 disconnect.onclick=()=>action(async()=>{await connection.disconnect();link.hidden=true;create.hidden=true;status.textContent='Disconnected in this browser. Saved workouts remain on this device and in Google.'});
 window.addEventListener('pageshow',controls);
 window.addEventListener('workout-finished',()=>{if(connection.connected())status.textContent='Workout saved. Tap Sync now to back it up to Google.'});
 controls();
 connection.restore().then(active=>{status.textContent=active?'Connected as onlinesny@gmail.com · remembered in this browser. Tap Sync now to back up or restore finished workouts.':'Connect Google once here. Safari and the Home Screen app may each need their own initial connection.';}).catch(error=>{status.textContent=error.message;}).finally(()=>{busy=false;controls()});
})();
