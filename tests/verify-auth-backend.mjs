import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import {createHandler,hash,allowedGoogle} from '../backend/worker.mjs';
const sql=new DatabaseSync(':memory:');sql.exec(fs.readFileSync('backend/schema.sql','utf8'));
const database={prepare(query){return {bind(...params){return {first:async()=>sql.prepare(query).get(...params)||null,run:async()=>sql.prepare(query).run(...params)}}}}};
const env={AUTH_DB:database,GOOGLE_CLIENT_SECRET:'synthetic-secret',TOKEN_ENCRYPTION_KEY:Buffer.alloc(32,7).toString('base64url')};
const origin='https://badgerbalm.github.io',base='https://auth.example.invalid';
let refreshCalls=0,googleCalls=0,email='onlinesny@gmail.com',invalidGrant=false,oldAccess=false,redirectGoogle=false;
const fakeGoogle=async(url,options={})=>{
 googleCalls++;assert.equal(options.redirect,'manual','Cloudflare-compatible redirect mode; never forward credentials to redirects');if(redirectGoogle)return new Response(null,{status:302,headers:{Location:'https://evil.invalid'}});
 if(url==='https://oauth2.googleapis.com/token'){
  const body=options.body;assert.equal(body.get('client_secret'),'synthetic-secret');
  if(body.get('grant_type')==='refresh_token'){refreshCalls++;assert.equal(body.get('refresh_token'),'synthetic-refresh');if(invalidGrant)return Response.json({error:'invalid_grant'},{status:400});return Response.json({access_token:'synthetic-refreshed',token_type:'Bearer',expires_in:3600})}
  assert(body.get('code_verifier'));return Response.json({access_token:'synthetic-access',refresh_token:'synthetic-refresh',token_type:'Bearer',expires_in:3600,scope:'openid email https://www.googleapis.com/auth/drive.file'});
 }
 if(url.includes('/userinfo'))return Response.json({email,email_verified:true});
 assert.equal(options.redirect,'manual');assert.equal(options.headers.Authorization,'Bearer synthetic-refreshed');if(oldAccess){oldAccess=false;return Response.json({}, {status:401})}return Response.json({files:[{id:'synthetic-sheet'}]});
};
const handle=createHandler(fakeGoogle);
const call=(path,data,token,requestOrigin=origin)=>handle(new Request(base+path,{method:data===undefined?'GET':'POST',headers:{Origin:requestOrigin,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})}),env);
const random=()=>crypto.randomUUID().replaceAll('-','')+'abcdefghijk';
async function begin(){const verifier=random(),state=random();const response=await call('/auth/start',{challenge:await hash(verifier),state});assert.equal(response.status,200);const body=await response.json(),url=new URL(body.url);assert.equal(url.searchParams.get('access_type'),'offline');assert.equal(url.searchParams.get('code_challenge_method'),'S256');return {verifier,state,url}}
async function callback(flow){return handle(new Request(base+'/oauth/callback?state='+flow.url.searchParams.get('state')+'&code=synthetic-code'),env)}
assert.equal((await call('/health')).status,200);
assert.equal((await call('/session')).status,401);
assert.equal((await call('/session',undefined,undefined,'https://evil.invalid')).status,403);
const flow=await begin();const response=await callback(flow);assert.equal(response.status,303);assert.equal(response.headers.get('Cache-Control'),'no-store');const back=new URL(response.headers.get('Location'));assert.equal(back.origin,origin);const fragment=new URLSearchParams(back.hash.slice(1));assert.equal(fragment.get('workout_state'),flow.state);const ticket=fragment.get('workout_auth');
assert.equal((await callback(flow)).status,400,'OAuth state consumed once');
assert.equal((await call('/auth/complete',{ticket,verifier:random()})).status,401,'Wrong browser cannot claim ticket');
const completed=await call('/auth/complete',{ticket,verifier:flow.verifier});assert.equal(completed.status,200);const session=await completed.json();assert(session.session);assert(!JSON.stringify(session).includes('synthetic-refresh'));
assert.equal((await call('/auth/complete',{ticket,verifier:flow.verifier})).status,401);
const row=sql.prepare('SELECT * FROM app_sessions').get();assert(!JSON.stringify(row).includes('synthetic-refresh'));assert.notEqual(row.token_hash,session.session);
assert.equal((await call('/session',undefined,session.session)).status,200);
const sharedWorkout={id:'shared-workout-1',scope:'daily',status:'in-progress',revision:1,startedAt:new Date().toISOString(),updatedAt:new Date().toISOString(),plan:{title:'Synthetic',date:'2026-11-09',sections:[]},exercises:{}};
assert.equal((await call('/workout',undefined,session.session)).status,200,'Shared save starts empty');
assert.equal((await call('/workout',{record:sharedWorkout},session.session)).status,200,'Connected browser can save active progress');
const sharedResult=await (await call('/workout',undefined,session.session)).json();assert.deepEqual(sharedResult.record,sharedWorkout,'Shared save is stored and restored through encrypted D1 state');
assert.equal((await call('/workout',{record:{...sharedWorkout,id:'bad',revision:-1}},session.session)).status,400,'Invalid shared workout data is rejected');
const google={url:'https://www.googleapis.com/drive/v3/files?q=synthetic',method:'GET'};
assert.equal((await call('/google',google,session.session)).status,200);assert.equal(refreshCalls,1);
assert.equal((await call('/google',google,session.session)).status,200);assert.equal(refreshCalls,1,'Cached access token avoids redundant refresh');
oldAccess=true;assert.equal((await call('/google',google,session.session)).status,200);assert.equal(refreshCalls,2,'One renewed access token retry');
for(const url of ['https://evil.invalid/','http://www.googleapis.com/drive/v3/files','https://www.googleapis.com/drive/v3/files/secret','https://oauth2.googleapis.com/token','https://sheets.googleapis.com/v4/spreadsheets/id/permissions'])assert(!allowedGoogle(url,'GET'));
const before=googleCalls;assert.equal((await call('/google',{url:'https://evil.invalid',method:'GET'},session.session)).status,400);assert.equal(googleCalls,before);
assert.equal((await call('/disconnect',{},session.session)).status,200);assert.equal((await call('/session',undefined,session.session)).status,401);
email='other@example.invalid';assert.equal((await callback(await begin())).status,403);email='onlinesny@gmail.com';
const f=await begin();const res=await callback(f),p=new URLSearchParams(new URL(res.headers.get('Location')).hash.slice(1));const s=await (await call('/auth/complete',{ticket:p.get('workout_auth'),verifier:f.verifier})).json();invalidGrant=true;assert.equal((await call('/google',google,s.session)).status,401);assert.equal((await call('/session',undefined,s.session)).status,401);
redirectGoogle=true;assert.equal((await callback(await begin())).status,502,'Google redirects fail closed');redirectGoogle=false;
sql.close();console.log('PASS: OAuth state/PKCE, one-time ticket binding, account restriction, encrypted tokens, hashed sessions, refresh/cache/retry, origin and proxy guards, disconnect and grant revocation.');
