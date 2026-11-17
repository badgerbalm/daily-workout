(function(){
 'use strict';
 if(document.documentElement.dataset.preview==='safari'||!window.WorkoutRememberedGoogle)return;
 const googlePanel=document.querySelector('#google-sync'),menu=document.querySelector('#workout-menu');if(!googlePanel||!menu)return;
 const connection=WorkoutRememberedGoogle.create(),details=document.createElement('details');details.id='oura-sync';details.className='local-history';
 const summary=document.createElement('summary');summary.textContent='Oura sleep & readiness';details.append(summary);
 const intro=document.createElement('p');intro.textContent='Connect Oura to copy daily Sleep and Readiness scores, their dates and available contributors into a new tab in the existing private workout Sheet. The 9 AM workout task can read that tab through its connected Google Sheets app. Scores update after Oura sends an update; open the Oura app and sync your ring first.';details.append(intro);
 const actions=document.createElement('div');actions.className='result-actions';
 const connect=document.createElement('button');connect.type='button';connect.textContent='Connect Oura';
 const sync=document.createElement('button');sync.type='button';sync.className='secondary';sync.textContent='Refresh Oura scores';sync.hidden=true;
 const disconnect=document.createElement('button');disconnect.type='button';disconnect.className='secondary';disconnect.textContent='Disconnect & clear stored Oura data';disconnect.hidden=true;
 actions.append(connect,sync,disconnect);details.append(actions);
 const status=document.createElement('p');status.id='oura-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.textContent='Connect Google first, then connect Oura.';details.append(status);
 const note=document.createElement('p');note.className='muted';note.textContent='Scores and contributors are stored encrypted in the connection database and copied to the existing private Sheet. Disconnect clears the stored Oura connection and database copy; rows already copied to Google remain until you remove them there.';details.append(note);
 googlePanel.insertAdjacentElement('afterend',details);
 function connectedMessage(value){if(!value.connected){status.textContent=connection.connected()?'Connect Oura to start sharing daily scores.':'Connect Google first, then connect Oura.';connect.hidden=false;sync.hidden=true;disconnect.hidden=true;return}
  connect.hidden=true;sync.hidden=false;disconnect.hidden=false;
  const parts=['Oura is connected.'];if(value.latestScoreDate)parts.push('Latest score date: '+value.latestScoreDate+'.');else parts.push('No daily scores have arrived yet. Sync your ring in the Oura app, then use Refresh Oura scores.');if(value.pendingSheetRows)parts.push(value.pendingSheetRows+' day(s) are waiting to sync to the existing private Sheet.');status.textContent=parts.join(' ');
 }
 async function refresh(){try{if(!connection.connected()){connectedMessage({connected:false});return}connectedMessage(await connection.ouraStatus())}catch(error){status.textContent=error.message||'Could not check Oura connection.'}}
 connect.onclick=async()=>{connect.disabled=true;status.textContent='Opening Oura authorization…';try{if(!connection.connected())throw Error('Connect Google in this browser first.');const result=await connection.startOura();if(!result.authorizationUrl)throw Error('Oura authorization did not start.');location.assign(result.authorizationUrl)}catch(error){status.textContent=error.message||'Could not connect Oura.';connect.disabled=false}};
 sync.onclick=async()=>{sync.disabled=true;status.textContent='Refreshing recent Oura scores…';try{const result=await connection.syncOura();await refresh();status.textContent+=' Checked '+result.synced+' date(s). If today is missing, sync your ring in the Oura app and try again.'}catch(error){status.textContent=error.message||'Could not refresh Oura scores.'}finally{sync.disabled=false}};
 disconnect.onclick=async()=>{disconnect.disabled=true;status.textContent='Removing the stored Oura connection…';try{await connection.disconnectOura();connectedMessage({connected:false});status.textContent='Oura disconnected. Data already copied to the private Sheet was retained.'}catch(error){status.textContent=error.message||'Could not disconnect Oura.'}finally{disconnect.disabled=false}};
 const params=new URLSearchParams(location.search),result=params.get('oura');if(result){history.replaceState(null,'',location.pathname+location.hash);status.textContent=result==='connected'?'Oura connected. Loading recent daily scores…':'Oura connection was cancelled.'}
 void Promise.resolve(window.WorkoutSharedStateReady).then(refresh).catch(refresh);
 window.addEventListener('workout-app-ready',refresh);
})();
