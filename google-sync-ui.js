(function(){
 'use strict';
 if(window.WorkoutRememberedGoogle)return;
 const panel=document.querySelector('#google-sync');if(!panel)return;
 const connect=panel.querySelector('#google-connect'),sync=panel.querySelector('#google-sync-now'),create=panel.querySelector('#google-create-sheet'),disconnect=panel.querySelector('#google-disconnect'),status=panel.querySelector('#google-sync-status'),link=panel.querySelector('#google-sheet-link');
 const viewer=document.querySelector('#google-sheet-viewer'),frame=viewer?.querySelector('iframe'),viewerStatus=viewer?.querySelector('#google-sheet-viewer-status'),openInGoogle=viewer?.querySelector('#open-google-sheet');let viewerTimeout;
 function refreshSheetPreview(){if(!link||!frame||!viewerStatus)return;clearTimeout(viewerTimeout);viewerStatus.textContent='Loading Google Spreadsheet…';const url=new URL(link.href);url.pathname=url.pathname.replace(/\/edit\/?$/,'/preview');url.searchParams.set('gid','0');url.searchParams.set('refresh',String(Date.now()));frame.src=url.href;viewerTimeout=setTimeout(()=>{viewerStatus.textContent='If the sheet has not appeared, use Open in Google.'},12000)}
 if(viewer&&link){frame.onload=()=>{clearTimeout(viewerTimeout);viewerStatus.textContent='Use Refresh sheet to check for the latest changes.'};link.onclick=event=>{event.preventDefault();openInGoogle.href=link.href;viewer.showModal();refreshSheetPreview()};viewer.querySelector('#refresh-google-sheet').onclick=refreshSheetPreview;viewer.querySelector('#close-google-sheet-viewer').onclick=()=>viewer.close();viewer.addEventListener('close',()=>{clearTimeout(viewerTimeout);frame.src='about:blank'})}
 const service=WorkoutGoogleSync.createSync({store:WorkoutLog.store,onStatus:message=>status.textContent=message});
 const sheetKey='workout-google-sheet-id';
 try{const known=localStorage.getItem(sheetKey);if(known)link.href='https://docs.google.com/spreadsheets/d/'+encodeURIComponent(known)+'/edit'}catch{}
 let client=null,loading=null,busy=false;
 const message=text=>{status.textContent=text};
 function controls(){const active=service.connected();connect.disabled=busy;sync.disabled=busy||!active;disconnect.hidden=!active;disconnect.disabled=busy;create.disabled=busy||!active;connect.textContent=active?'Reconnect Google':'Connect Google';}
 function fail(error){message(error.message||'Could not sync. Your local results are safe.');controls()}
 function loadGoogle(){return loading??=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;script.onload=resolve;script.onerror=()=>{loading=null;script.remove();reject(Error('Google sign-in could not load. Check your connection and try again.'))};document.head.append(script)})}
 function initialize(){
  client=google.accounts.oauth2.initTokenClient({client_id:WorkoutGoogleSync.CLIENT_ID,scope:'openid email '+WorkoutGoogleSync.SCOPE,hint:WorkoutGoogleSync.ACCOUNT,include_granted_scopes:false,
   callback:async response=>{
    busy=true;controls();
    try{if(response.error)throw Error('Google connection was not authorized. Your local results are safe.');if(!google.accounts.oauth2.hasGrantedAllScopes(response,WorkoutGoogleSync.SCOPE))throw Error('Allow the requested Google account and app-file permissions to sync.');await service.setToken(response);create.hidden=true;message('Connected as '+WorkoutGoogleSync.ACCOUNT+'. Tap Sync now to back up finished workouts and restore history.');}
    catch(error){service.disconnect();fail(error)}finally{busy=false;controls()}
   },error_callback:()=>{busy=false;message('Google sign-in was closed or blocked. Tap Connect Google to try again.');controls()}});
 }
 connect.onclick=async()=>{
  if(!client){busy=true;controls();try{await loadGoogle();initialize();message('Google sign-in is ready. Tap Connect Google again to choose your account.');}catch(error){fail(error)}finally{busy=false;controls()}return;}
  // Popup request stays in the user's click event (important in Safari).
  try{service.disconnect();create.hidden=true;busy=true;controls();client.requestAccessToken({prompt:'select_account'});}catch(error){busy=false;fail(error)}
 };
 async function performSync(){
  const result=await service.sync();
  if(result.needsSheet){create.hidden=false;message('No Daily Workout Sheet found for this account. Create a private Sheet below, then sync.');return;}
  create.hidden=true;link.href='https://docs.google.com/spreadsheets/d/'+encodeURIComponent(result.sheetId)+'/edit';try{localStorage.setItem(sheetKey,result.sheetId)}catch{}
  message(result.count+' finished workout'+(result.count===1?'':'s')+' backed up · synced '+new Date().toLocaleTimeString()+'. Unfinished workouts stay on this device.');
  await WorkoutLog.renderHistory();
 }
 sync.onclick=async()=>{busy=true;controls();try{await WorkoutLog.flush({allowFinished:true});await performSync()}catch(error){fail(error)}finally{busy=false;controls()}};
 create.onclick=async()=>{busy=true;controls();try{await service.createSheet();await performSync()}catch(error){fail(error)}finally{busy=false;controls()}};
 disconnect.onclick=()=>{service.disconnect();create.hidden=true;controls()};
 window.addEventListener('workout-finished',async()=>{
  if(!service.connected()){message('Workout saved on this device. Connect Google to back it up to your Sheet.');return;}
  busy=true;controls();message('Workout saved. Syncing to Google…');
  try{await WorkoutLog.flush({allowFinished:true});await performSync()}
  catch(error){fail(error)}
  finally{busy=false;controls()}
 });
 window.addEventListener('pageshow',controls);
 controls();
})();
