const assert=require('node:assert/strict');
const {IDBFactory}=require('fake-indexeddb');
const history=require('../workout-history.js');
const {createSync,HEADER}=require('../google-sync.js');
const plan={date:'2099-01-01',title:'Synthetic workout',sections:[{title:'Strength',items:[{name:'Synthetic press',detail:'2 × 10',progressKey:'press'}]}]};
const copy=value=>JSON.parse(JSON.stringify(value));
function backend(){
 const state={files:[],rows:[],calls:[],status:0,loseAppend:false,email:'onlinesny@gmail.com',email_verified:true,columns:26};
 const response=(data,status=200)=>({ok:status>=200&&status<300,status,json:async()=>copy(data)});
 state.fetch=async(url,options={})=>{
  state.calls.push({url,options});assert.equal(options.credentials,'omit');assert.equal(options.referrerPolicy,'no-referrer');assert.match(options.headers.Authorization,/^Bearer /);
  if(url.includes('/userinfo'))return response({email:state.email,email_verified:state.email_verified});
  if(state.status)return response({},state.status);
  if(url.includes('/drive/v3/files?')){
   if(options.method==='POST'){state.files.push({id:'synthetic-sheet',name:'Synthetic history'});return response(state.files[0])}
   return response({files:state.files});
  }
  if(url.includes(':batchUpdate')){state.columns=30;return response({})}
  if(!url.includes('/values/'))return response({sheets:[{properties:{sheetId:0,title:'History',gridProperties:{columnCount:state.columns}}}]});
  if(options.method==='PUT'){state.rows=copy(JSON.parse(options.body).values);return response({})}
  if(options.method==='POST'){assert(url.includes('valueInputOption=RAW'),'Never execute user notes as formulas');state.rows.push(...copy(JSON.parse(options.body).values));if(state.loseAppend){state.loseAppend=false;throw Error('Synthetic lost response')}return response({})}
  return response({values:state.rows});
 };
 return state;
}
async function finish(store,scope='daily'){
 const session=await store.ensure(plan,scope);await store.save(session.id,{press:{actual:{sets:[{reps:7,weight:9.5,weightUnit:'kg',weightBasis:'per-dumbbell',side:'left'}]},status:'completed'}});
 return store.finish(session.id,{effort:6,energy:4,discomfort:0,notes:'=Synthetic note — never a formula'});
}
(async()=>{
 const store=history.createStore({indexedDB:new IDBFactory()}),cloud=backend();
 const sync=createSync({store,fetch:cloud.fetch,history});
 await assert.rejects(sync.sync(),/Connect Google/);assert.equal(cloud.calls.length,0,'No API calls without explicit authorization');
 const session=await finish(store);await finish(store,'practice');await store.ensure(plan,'daily');
 await sync.setToken({access_token:'synthetic-token',expires_in:3600});
 assert.equal(cloud.calls.length,1,'Connecting verifies identity but uploads no history');
 assert.deepEqual(await sync.sync(),{needsSheet:true});assert.equal(cloud.files.length,0,'Sheet creation requires a separate explicit action');
 await sync.createSheet();await assert.rejects(sync.createSheet(),/already exists/);
 cloud.loseAppend=true;await assert.rejects(sync.sync(),/lost response/);assert.equal(cloud.rows.length,2,'Save reached Google even though response was lost');
 const result=await sync.sync();assert.equal(result.count,1);assert.equal(cloud.rows.length,2,'Retry reads IDs and does not append again');assert.equal(cloud.columns,30);
 assert.deepEqual(cloud.rows[0],HEADER);assert.equal(cloud.rows[1][9],session.review.notes);assert.equal(cloud.rows[1][1],session.id,'Only finished daily sessions upload');
 const other=history.createStore({indexedDB:new IDBFactory()}),restore=createSync({store:other,fetch:cloud.fetch,history});
 const active=await other.ensure(plan,'daily');
 await restore.setToken({access_token:'synthetic-token',expires_in:3600});await restore.sync();
 assert.equal((await other.listSessions()).length,2);assert.equal((await other.active('daily')).id,active.id,'Restoring history cannot replace the current workout');
 assert.deepEqual(history.finishedRecord(await other.getSession(session.id)),history.finishedRecord(session),'Units, notes, plan and outcomes survive restore');
 cloud.rows.push(copy(cloud.rows[1]));assert.equal((await restore.sync()).count,1,'Concurrent identical rows collapse to one logical workout');
 const valid=copy(cloud.rows);cloud.rows[1][10]+='x';await assert.rejects(sync.sync(),/changed or is incomplete/);assert.equal((await store.getSession(session.id)).review.notes,session.review.notes);cloud.rows=copy(valid);
 const changed=copy(session);changed.review.notes='Different synthetic content';cloud.rows.push(await sync.encode(changed));await assert.rejects(sync.sync(),/Conflicting/);cloud.rows=copy(valid);
 cloud.rows=[HEADER,await sync.encode(changed)];await assert.rejects(sync.sync(),/Neither copy was overwritten/);assert.equal(cloud.rows.length,2);cloud.rows=copy(valid);
 cloud.rows[0][0]='Edited header';await assert.rejects(sync.sync(),/headers changed/);cloud.rows=copy(valid);
 cloud.status=401;await assert.rejects(sync.sync(),/expired/);assert.equal(sync.connected(),false);cloud.status=0;
 cloud.email='wrong-account@example.invalid';await assert.rejects(sync.setToken({access_token:'synthetic-token',expires_in:3600}),/Choose onlinesny/);assert.equal(sync.connected(),false);
 cloud.email='onlinesny@gmail.com';cloud.email_verified=false;await assert.rejects(sync.setToken({access_token:'synthetic-token',expires_in:3600}),/Choose onlinesny/);cloud.email_verified=true;
 await sync.setToken({access_token:'synthetic-token',expires_in:3600});cloud.status=403;await assert.rejects(sync.sync(),/Enable Google Drive API and Google Sheets API/);cloud.status=0;
 cloud.files.push({id:'second-sheet'});await assert.rejects(sync.sync(),/More than one/);cloud.files.pop();
 const calls=cloud.calls.length;sync.disconnect();await assert.rejects(sync.sync(),/Connect Google/);assert.equal(cloud.calls.length,calls);
 assert.throws(()=>other.importFinished([{...session,status:'in-progress'}]),/Invalid finished/);
 const huge=copy(session);huge.plan.note='x'.repeat(800001);await assert.rejects(sync.encode(huge),/Invalid finished/);
 // Chunking preserves astral Unicode across cell boundaries and RAW notes.
 const big=copy(session);big.id='synthetic-big-session';big.plan.note='🏋️'.repeat(20000);const row=await sync.encode(big);assert(row[11].length>0);cloud.rows=[...copy(valid),row];await restore.sync();assert.equal((await other.getSession(big.id)).plan.note,big.plan.note);
 await Promise.all([store.close(),other.close()]);
 console.log('PASS: least-privilege account authorization, explicit creation, finished-only sync, lost-response retry, deduplication, restore without active replacement, units/notes round-trip, header/hash/conflict guards, API and account failures, disconnection and chunked Unicode.');
})().catch(error=>{console.error(error);process.exitCode=1});
