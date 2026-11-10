const assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require('jsdom');
const until=async fn=>{for(let i=0;i<100;i++){if(fn())return;await new Promise(r=>setTimeout(r,5))}throw Error('UI timed out')};
(async()=>{
 const html=fs.readFileSync('index.html','utf8').match(/<details id="google-sync"[\s\S]*?<\/details>/)[0];
 const dom=new JSDOM(html,{url:'https://workout.invalid',runScripts:'outside-only'}),w=dom.window;
 let active=false,requests=0,uploads=0,created=0,rendered=0,flushed=0,options;
 const service={connected:()=>active,setToken:async()=>{active=true},disconnect:()=>{active=false},sync:async()=>{uploads++;return created?{count:1,sheetId:'synthetic-sheet'}:{needsSheet:true}},createSheet:async()=>{created++}};
 w.WorkoutLog={store:{},flush:async()=>{flushed++},renderHistory:async()=>{rendered++},setSharedState:()=>{}};
 w.WorkoutGoogleSync={createSync:()=>service,CLIENT_ID:'synthetic-client',ACCOUNT:'onlinesny@gmail.com',SCOPE:'drive.file'};
 w.google={accounts:{oauth2:{initTokenClient:config=>{options=config;return {requestAccessToken:()=>requests++}},hasGrantedAllScopes:()=>true}}};
 w.WorkoutRememberedGoogle={create:()=>({connected:()=>active,restore:async()=>false,connect:async()=>{active=true;requests++},disconnect:async()=>{active=false}})};
 w.eval(fs.readFileSync('remembered-google-ui.js','utf8'));
 await until(()=>!w.document.getElementById('google-connect').disabled);
 const get=id=>w.document.getElementById(id),connect=get('google-connect'),sync=get('google-sync-now'),create=get('google-create-sheet');
 assert(sync.disabled);assert.equal(uploads,0);assert.equal(w.document.querySelectorAll('script').length,0,'No Google script before opting in');
 connect.click();await until(()=>!connect.disabled);assert.equal(requests,1);assert(!sync.disabled);assert.equal(uploads,0,'Connect does not upload private results');
 sync.click();await until(()=>!sync.disabled);assert.equal(flushed,1);assert(!create.hidden);assert.equal(created,0);
 create.click();await until(()=>!sync.disabled);assert.equal(created,1);assert.equal(rendered,1);assert(!get('google-sheet-link').hidden);assert.equal(get('google-sheet-link').href,'https://docs.google.com/spreadsheets/d/synthetic-sheet/edit');
 w.dispatchEvent(new w.Event('workout-finished'));assert.match(get('google-sync-status').textContent,/Workout saved/);
 assert.equal(w.localStorage.length,0,'No credentials or health records in sync preferences');
 get('google-disconnect').click();await until(()=>!connect.disabled);assert(sync.disabled);assert(get('google-sheet-link').hidden);

 dom.window.close();console.log('PASS: remembered connection UI, deliberate redirect, no upload on connect, deliberate creation/sync, local-save barrier, readable status and no Google credentials in UI.');
})().catch(error=>{console.error(error);process.exitCode=1});
