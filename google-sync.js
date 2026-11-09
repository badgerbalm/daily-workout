/* Google tokens live only in memory. No client secret belongs in this public app. */
(function(root){
 'use strict';
 const CLIENT_ID='790497358549-7lg9e6q8jbv08g1l3p4d1grm92o071js.apps.googleusercontent.com';
 const SCOPE='https://www.googleapis.com/auth/drive.file';
 const ACCOUNT='onlinesny@gmail.com';
 const FORMAT='daily-workout-finished-v1',TITLE='Daily Workout · Private History';
 const HEADER=['Format','Session ID','SHA-256','Plan date','Workout','Finished at','Effort','Energy','Discomfort','Notes',...Array.from({length:20},(_,i)=>'Record '+(i+1))];
 const stable=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
 async function digest(text){return [...new Uint8Array(await root.crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(b=>b.toString(16).padStart(2,'0')).join('')}
 function createSync({store,fetch:request=root.fetch.bind(root),history=root.WorkoutHistoryStore,onStatus=()=>{},connection=null}){
  let token=null,expires=0,epoch=0,running=null,selected=null;
  const connected=()=>connection?connection.connected():Boolean(token&&Date.now()<expires);
  async function setToken(response){
   if(!response.access_token||!Number.isFinite(Number(response.expires_in))||Number(response.expires_in)<=30)throw Error('Google did not return a valid authorization.');
   disconnect();const generation=epoch;
   const result=await request('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:'Bearer '+response.access_token},credentials:'omit',referrerPolicy:'no-referrer'});
   if(generation!==epoch)throw Error('Connection changed. Try again.');
   if(!result.ok)throw Error('Google account could not be verified. Connect again.');
   const identity=await result.json();if(generation!==epoch)throw Error('Connection changed. Try again.');if(identity.email!==ACCOUNT||identity.email_verified!==true)throw Error('Choose '+ACCOUNT+' to connect this personal workout log.');
   token=response.access_token;expires=Date.now()+Number(response.expires_in)*1000-30000;selected=null;
  }
  function disconnect(){epoch++;token=null;expires=0;selected=null;onStatus('Disconnected. Workouts remain on this device and in your private Sheet.')}
  async function api(url,options={},generation=epoch){
   if(generation!==epoch||!connected())throw Error('Connect Google again to sync. Your local results are safe.');
   const response=connection?await connection.google(url,options):await request(url,{...options,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...options.headers},credentials:'omit',referrerPolicy:'no-referrer'});
   if(generation!==epoch)throw Error('Connection changed. Sync stopped.');
   if(!response.ok){if(response.status===401){disconnect();throw Error('Google authorization expired. Connect Google again.');}if(response.status===403)throw Error('Google access is unavailable. Enable Google Drive API and Google Sheets API in project daily-workout-514201, and check the test account and consent permissions.');throw Error('Google request failed ('+response.status+'). Retry Sync now; local results are safe.');}
   return response.status===204?{}:response.json();
  }
  async function discover(generation){
   const found=[];let pageToken='';do{const query=new URLSearchParams({q:"trashed = false and mimeType = 'application/vnd.google-apps.spreadsheet' and appProperties has { key='dailyWorkoutFormat' and value='"+FORMAT+"' }",fields:'nextPageToken,files(id,name)',pageSize:'100',...(pageToken?{pageToken}:{})});const data=await api('https://www.googleapis.com/drive/v3/files?'+query,{},generation);found.push(...(data.files||[]));pageToken=data.nextPageToken||'';}while(pageToken);
   return found;
  }
  async function makeSheet(){
   const generation=epoch;
   // Drive creates the marked file atomically, so interrupted setup can rediscover it.
   const found=await discover(generation);if(found.length)throw Error('A history Sheet already exists. Use Sync now.');
   const file=await api('https://www.googleapis.com/drive/v3/files?fields=id,name',{method:'POST',body:JSON.stringify({name:TITLE,mimeType:'application/vnd.google-apps.spreadsheet',appProperties:{dailyWorkoutFormat:FORMAT}})},generation);
   selected=file.id;return file;
  }
  async function encode(record){const text=stable(history.finishedRecord(record));if(text.length>799980)throw Error('Workout is too large to sync. Export a local backup.');const normalized=JSON.parse(text),chunks=[];let offset=0;
   for(let i=0;i<20;i++){let end=Math.min(offset+40000,text.length);if(end<text.length&&/[\uD800-\uDBFF]/.test(text[end-1]))end--;chunks.push(text.slice(offset,end));offset=end;}
   return [FORMAT,normalized.id,await digest(text),normalized.plan.date,normalized.plan.title,normalized.finishedAt,normalized.review.effort??'',normalized.review.energy??'',normalized.review.discomfort??'',normalized.review.notes,...chunks]}
  async function read(id,generation){
   const base='https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(id);
   const info=await api(base+'?fields=sheets(properties(sheetId,title,gridProperties(columnCount)))',{},generation);
   const properties=info.sheets?.[0]?.properties,title=properties?.title;if(!title)throw Error('The history Sheet has no worksheet. Restore its first tab before syncing.');
   if(properties.gridProperties?.columnCount<HEADER.length)await api(base+':batchUpdate',{method:'POST',body:JSON.stringify({requests:[{updateSheetProperties:{properties:{sheetId:properties.sheetId,gridProperties:{columnCount:HEADER.length}},fields:'gridProperties.columnCount'}}]})},generation);
   const range="'"+title.replace(/'/g,"''")+"'!A:AD";
   const url='https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(id)+'/values/'+encodeURIComponent(range);
   const data=await api(url,{},generation),rows=data.values||[];
   if(!rows.length){await api(url+'?valueInputOption=RAW',{method:'PUT',body:JSON.stringify({values:[HEADER]})},generation);return {url,records:new Map()}}
   if(rows[0].length!==HEADER.length||rows[0].some((v,i)=>v!==HEADER[i]))throw Error('The history Sheet headers changed. Sync stopped without overwriting it.');
   const records=new Map();
   for(const row of rows.slice(1)){
    if(!row.length)continue;if(row[0]!==FORMAT||!row[1]||!row[2])throw Error('A history Sheet row is invalid. Sync stopped.');
    const text=row.slice(10).join('');if(text.length>800000||await digest(text)!==row[2])throw Error('A saved workout row was changed or is incomplete. Sync stopped.');
    const record=history.finishedRecord(JSON.parse(text));if(record.id!==row[1]||stable(record)!==text)throw Error('Invalid workout snapshot in Sheet.');
    const prior=records.get(record.id);if(prior&&prior.hash!==row[2])throw Error('Conflicting copies of a workout were found. Export a local backup before resolving the Sheet.');
    records.set(record.id,{record,hash:row[2]});
   }
   return {url,records};
  }
  async function run(){
   const generation=epoch;onStatus('Checking your private workout Sheet…');
   const files=await discover(generation);
   if(!files.length)return {needsSheet:true};
   if(files.length>1)throw Error('More than one Daily Workout history Sheet exists. Sync stopped to avoid splitting your history.');
   selected=files[0].id;const remote=await read(selected,generation);
   const local=(await store.listSessions()).filter(s=>s.status==='finished'&&s.scope==='daily');
   const missing=[];
   for(const session of local){const row=await encode(session),prior=remote.records.get(session.id);if(prior&&prior.hash!==row[2])throw Error('Local and Google copies differ for a finished workout. Neither copy was overwritten.');if(!prior)missing.push(row)}
   // Append only missing immutable IDs. If a response is lost, the next run reads
   // back the IDs before retrying. Concurrent identical appends are deduped on read.
   for(let i=0;i<missing.length;i+=5)await api(remote.url+':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS',{method:'POST',body:JSON.stringify({values:missing.slice(i,i+5)})},generation);
   const verified=await read(selected,generation);
   for(const session of local){const row=await encode(session);if(verified.records.get(session.id)?.hash!==row[2])throw Error('Google save could not be verified. Retry Sync now.');}
   if(generation!==epoch)throw Error('Connection changed. Sync stopped.');
   await store.importFinished([...verified.records.values()].map(v=>v.record));
   return {count:verified.records.size,sheetId:selected};
  }
  function sync(){if(running)return running;running=run().finally(()=>{running=null});return running}
  function createSheet(){if(running)return Promise.reject(Error('Wait for the current sync to finish.'));running=makeSheet().finally(()=>{running=null});return running}
  return {setToken,disconnect,connected,sync,createSheet,encode};
 }
 if(typeof module!=='undefined')module.exports={createSync,HEADER,FORMAT,stable,SCOPE,CLIENT_ID,ACCOUNT};
 else root.WorkoutGoogleSync={createSync,HEADER,FORMAT,SCOPE,CLIENT_ID,ACCOUNT};
})(typeof window==='undefined'?globalThis:window);
