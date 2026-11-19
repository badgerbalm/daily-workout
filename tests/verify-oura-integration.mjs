import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import {createHandler,hash} from '../backend/worker.mjs';

const sql=new DatabaseSync(':memory:');sql.exec(fs.readFileSync('backend/schema.sql','utf8'));
const database={prepare(query){const statement=sql.prepare(query);let params=[];const prepared={bind(...values){params=values;return prepared},first(){return statement.get(...params)||null},all(){return {results:statement.all(...params)}},run(){return statement.run(...params)}};return prepared}};
const secretKey=Buffer.alloc(32,11).toString('base64url'),env={AUTH_DB:database,GOOGLE_CLIENT_SECRET:'google-test-secret',TOKEN_ENCRYPTION_KEY:secretKey,OURA_CLIENT_ID:'oura-client-test',OURA_CLIENT_SECRET:'oura-client-secret-test'};
const base='https://auth.example.test',origin='https://badgerbalm.github.io',owner='onlinesny@gmail.com';
const enc=new TextEncoder(),base64url=value=>Buffer.from(value).toString('base64url'),now=()=>Math.floor(Date.now()/1000);
async function seal(value){const key=await crypto.subtle.importKey('raw',Buffer.from(secretKey,'base64url'),'AES-GCM',false,['encrypt']);const iv=crypto.getRandomValues(new Uint8Array(12));const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,enc.encode(value));return base64url(iv)+'.'+base64url(encrypted)}
const appToken=base64url(crypto.getRandomValues(new Uint8Array(32)));
sql.prepare('INSERT INTO app_sessions(token_hash,refresh_cipher,access_cipher,access_expires,expires,created) VALUES(?,?,?,?,?,?)').run(await hash(appToken),await seal('google-refresh'),await seal('google-access'),now()+3600,now()+3600,now());
const date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
let ouraRefreshes=0,sheetWrites=0;const rows=[],tabs=[{sheetId:0,title:'Sheet1'}],workoutRows=[['Format','Session ID','Plan date'],['daily-workout-finished-v1','keep-me','2099-01-01']];let readinessScore=77,sleepDuration=25200,sleepDeleted=false;
const google=async(url,options={})=>{
 const parsed=new URL(url),method=options.method||'GET';assert.equal(options.redirect,'manual');
 if(url==='https://oauth2.googleapis.com/token'){return Response.json({access_token:'google-access-renewed',token_type:'Bearer',expires_in:3600})}
 if(parsed.hostname==='www.googleapis.com')return Response.json({files:[{id:'marked-workout-sheet',name:'Daily Workout · Private History'}]});
 if(parsed.hostname==='sheets.googleapis.com'&&parsed.pathname.endsWith(':batchUpdate')){
  const request=JSON.parse(options.body).requests[0];if(request.addSheet){tabs.push(request.addSheet.properties);return Response.json({replies:[{addSheet:{properties:request.addSheet.properties}}]})}return Response.json({replies:[{}]});
 }
 if(parsed.hostname==='sheets.googleapis.com'&&/^\/v4\/spreadsheets\/[^/]+$/.test(parsed.pathname))return Response.json({sheets:tabs.map(properties=>({properties}))});
 if(parsed.hostname==='sheets.googleapis.com'&&parsed.pathname.includes('/values/')){
  const range=decodeURIComponent(parsed.pathname.split('/values/')[1]||'');
  if(method==='GET')return Response.json({values:rows});
  const body=JSON.parse(options.body);
  if(parsed.pathname.includes(':append')){rows.push(...body.values);sheetWrites++;return Response.json({updates:{updatedRows:body.values.length}})}
  if(method==='PUT'){const first=body.values?.[0]||[];if(rows.length===0)rows.push(first);else if(/!A\d+:J\d+/.test(range)){const index=Number(range.match(/!A(\d+)/)?.[1]||1)-1;rows[index]=first;sheetWrites++}else rows[0]=first;return Response.json({updatedRows:first.length})}
 }
 throw new Error('Unexpected Google request: '+method+' '+url);
};
const originalFetch=globalThis.fetch;
globalThis.fetch=async(url,options={})=>{
 const parsed=new URL(url),method=options.method||'GET';
 if(parsed.hostname==='api.ouraring.com'&&parsed.pathname==='/oauth/token'){
  const form=options.body; if(form.get('grant_type')==='authorization_code')return Response.json({access_token:'oura-access-1',refresh_token:'oura-refresh-1',token_type:'Bearer',expires_in:3600,scope:'daily'});
  assert.equal(form.get('refresh_token'),ouraRefreshes===0?'oura-refresh-1':'oura-refresh-2');ouraRefreshes++;return Response.json({access_token:'oura-access-'+(ouraRefreshes+1),refresh_token:'oura-refresh-'+(ouraRefreshes+2),token_type:'Bearer',expires_in:3600,scope:'daily'});
 }
 if(parsed.hostname==='api.ouraring.com'&&parsed.pathname==='/v2/webhook/subscription'&&method==='GET')return Response.json([]);
 if(parsed.hostname==='api.ouraring.com'&&parsed.pathname==='/v2/webhook/subscription'&&method==='POST')return Response.json({id:'hook-'+JSON.parse(options.body).data_type+'-'+JSON.parse(options.body).event_type,expiration_time:new Date(Date.now()+7*86400000).toISOString()});
 if(parsed.hostname==='api.ouraring.com'&&parsed.pathname==='/v2/usercollection/daily_sleep/'+encodeURIComponent('sleep-doc-1'))return Response.json({id:'sleep-doc-1',day:date,score:80,contributors:{total_sleep:90,efficiency:85},timestamp:new Date().toISOString()});
 if(parsed.hostname==='api.ouraring.com'&&parsed.pathname==='/v2/usercollection/daily_readiness/'+encodeURIComponent('readiness-doc-1'))return Response.json({id:'readiness-doc-1',day:date,score:readinessScore,contributors:{previous_night:75,hrv_balance:80},timestamp:new Date().toISOString()});
 if(parsed.hostname==='api.ouraring.com'&&parsed.pathname==='/v2/usercollection/sleep/'+encodeURIComponent('session-main'))return Response.json({id:'session-main',day:date,type:'long_sleep',total_sleep_duration:sleepDuration,awake_time:1200,efficiency:89,restless_periods:4,bedtime_end:date+'T07:20:00-05:00'});
 if(parsed.hostname==='api.ouraring.com'&&parsed.pathname==='/v2/usercollection/daily_sleep')return Response.json({data:[{id:'sleep-doc-1',day:date,score:80,contributors:{total_sleep:90,efficiency:85},timestamp:new Date().toISOString()}]});
 if(parsed.hostname==='api.ouraring.com'&&parsed.pathname==='/v2/usercollection/daily_readiness')return Response.json({data:[{id:'readiness-doc-1',day:date,score:readinessScore,contributors:{previous_night:75,hrv_balance:80},timestamp:new Date().toISOString()}]});
 if(parsed.hostname==='api.ouraring.com'&&parsed.pathname==='/v2/usercollection/sleep')return Response.json({data:[...(!sleepDeleted?[{id:'session-main',day:date,type:'long_sleep',total_sleep_duration:sleepDuration,awake_time:1200,efficiency:89,restless_periods:4,deep_sleep_duration:5400,rem_sleep_duration:6300,light_sleep_duration:13500,bedtime_start:date+'T00:10:00-05:00',bedtime_end:date+'T07:20:00-05:00'}]:[]),{id:'session-nap',day:date,type:'nap',total_sleep_duration:1800,bedtime_end:date+'T15:00:00-05:00'}]});
 throw new Error('Unexpected Oura request: '+method+' '+url);
};
const handle=createHandler(google),call=(path,{method='GET',body,token=appToken,requestOrigin=origin}={})=>handle(new Request(base+path,{method,headers:{Origin:requestOrigin,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})}),env);
try{
 const start=await call('/oura/start',{method:'POST'});assert.equal(start.status,200);const authorization=new URL((await start.json()).authorizationUrl);assert.equal(authorization.searchParams.get('scope'),'daily');assert.equal(authorization.searchParams.get('code_challenge_method'),'S256');
 const state=authorization.searchParams.get('state'),callback=await handle(new Request(base+'/oura/oauth/callback?state='+state+'&code=oauth-code'),env);assert.equal(callback.status,303);assert.match(callback.headers.get('Location'),/oura=connected/);assert.equal(rows.length,2,'one header plus a single Oura date row');assert.equal(rows[0][0],'Date');assert.equal(rows[0][7],'Total Sleep (seconds)');assert.equal(rows[1][0],date);assert.equal(rows[1][1],80);assert.equal(rows[1][3],77);assert.equal(rows[1][7],25200);assert.match(rows[1][8],/bedtimeEnd/);assert.equal(sheetWrites,1);
  let status=await call('/oura/status');if(status.status!==200)console.error('Oura status response:',await status.clone().text());assert.equal(status.status,200);let payload=await status.json();assert.equal(payload.connected,true);assert.equal(payload.latestSleep.score,80);assert.equal(payload.latestSleep.totalSleepSeconds,25200);assert.equal(payload.latestReadiness.score,77);assert.equal(payload.lastSyncAt!==null,true);assert.equal(JSON.stringify(payload).includes('oura-client-secret-test'),false);
  await sql.prepare('UPDATE oura_connection SET access_expires=0 WHERE owner=?').run(owner);assert.deepEqual((await Promise.all([call('/oura/sync',{method:'POST'}),call('/oura/sync',{method:'POST'})])).map(response=>response.status),[200,200]);assert.equal(ouraRefreshes,1,'expired access token uses rotating refresh token automatically under concurrent sync');assert.equal(rows.length,2,'concurrent same-date syncs update the existing date row instead of appending duplicates');assert.equal(tabs.length,2,'Oura tab was added without replacing the workout tab');assert.deepEqual(workoutRows,[['Format','Session ID','Plan date'],['daily-workout-finished-v1','keep-me','2099-01-01']],'existing workout history remains untouched');
 readinessScore=81;const event={event_type:'update',data_type:'daily_readiness',object_id:'readiness-doc-1'},stamp=String(now()),signature=await crypto.subtle.importKey('raw',enc.encode(env.OURA_CLIENT_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']),signed=await crypto.subtle.sign('HMAC',signature,enc.encode(stamp+JSON.stringify(event))),hex=[...new Uint8Array(signed)].map(n=>n.toString(16).padStart(2,'0')).join('').toUpperCase();
 const webhook=await handle(new Request(base+'/oura/webhook',{method:'POST',headers:{'Content-Type':'application/json','x-oura-timestamp':stamp,'x-oura-signature':hex},body:JSON.stringify(event)}),env);assert.equal(webhook.status,200);assert.equal(rows.length,2,'webhook updates the same date row');assert.equal(rows[1][3],81,'webhook updates readiness score');
  const sendWebhook=async payload=>{const timestamp=String(now()),key=await crypto.subtle.importKey('raw',enc.encode(env.OURA_CLIENT_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']),mac=await crypto.subtle.sign('HMAC',key,enc.encode(timestamp+JSON.stringify(payload))),sig=[...new Uint8Array(mac)].map(n=>n.toString(16).padStart(2,'0')).join('').toUpperCase();return handle(new Request(base+'/oura/webhook',{method:'POST',headers:{'Content-Type':'application/json','x-oura-timestamp':timestamp,'x-oura-signature':sig},body:JSON.stringify(payload)}),env)};
  sleepDuration=28800;assert.equal((await sendWebhook({event_type:'update',data_type:'sleep',object_id:'session-main'})).status,200);assert.equal(rows.length,2);assert.equal(rows[1][7],28800,'sleep webhook refreshes duration without adding another day');
  sleepDeleted=true;assert.equal((await sendWebhook({event_type:'delete',data_type:'sleep',object_id:'session-main'})).status,200);assert.equal(rows[1][1],80,'sleep deletion preserves the separate daily sleep score');assert.equal(rows[1][7],'','deleted overnight duration is cleared');
 const invalid=await handle(new Request(base+'/oura/webhook',{method:'POST',headers:{'Content-Type':'application/json','x-oura-timestamp':stamp,'x-oura-signature':'bad'},body:JSON.stringify(event)}),env);assert.equal(invalid.status,401,'invalid webhook signature is rejected');
 payload=await (await call('/oura/status')).json();assert.equal(payload.latestReadiness.score,81);assert.equal(payload.latestSleep.totalSleepSeconds,undefined,'deleted overnight duration is unavailable rather than fabricated');
 const stored=sql.prepare('SELECT access_cipher,refresh_cipher FROM oura_connection WHERE owner=?').get(owner);assert(!JSON.stringify(stored).includes('oura-refresh-'));assert.equal((await call('/oura/status',{requestOrigin:'https://evil.invalid'})).status,403);
 console.log('PASS: Oura PKCE authorization, daily-only scope, webhook registration, encrypted token storage, OAuth callback, sleep/session/readiness mapping, status payload, concurrent rotating token refresh, deduplicated Sheet upserts, preserved workout tab, signed create/update/delete webhooks, and rejection of invalid signatures.');
}finally{globalThis.fetch=originalFetch;sql.close()}
