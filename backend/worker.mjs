// No credentials, authorization codes, headers, or Google error payloads are logged.
import { buildPushPayload } from '@block65/webcrypto-web-push';
const CLIENT='790497358549-7lg9e6q8jbv08g1l3p4d1grm92o071js.apps.googleusercontent.com';
const EMAIL='onlinesny@gmail.com',SCOPE='https://www.googleapis.com/auth/drive.file';
const APP='https://badgerbalm.github.io/daily-workout/';
const DONATION_APP='https://badgerbalm.github.io/donation-log/';
const ORIGIN=new URL(APP).origin;
const OURA_CALLBACK='https://daily-workout-auth.onlinesny.workers.dev/oura/oauth/callback';
const OURA_WEBHOOK='https://daily-workout-auth.onlinesny.workers.dev/oura/webhook';
const OURA_SCOPE='daily',OURA_AGENT='DailyWorkout/1.0';
const SHEET_FORMAT='daily-workout-finished-v1',OURA_TAB='Oura Daily Scores';
const OURA_HEADER=['Date','Sleep Score','Sleep Contributors','Readiness Score','Readiness Contributors','Oura timestamps','Retrieved at'];
const enc=new TextEncoder(),dec=new TextDecoder();
const b64=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const unb64=value=>Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
const random=()=>b64(crypto.getRandomValues(new Uint8Array(32)));
export const hash=async value=>b64(await crypto.subtle.digest('SHA-256',enc.encode(value)));
const now=()=>Math.floor(Date.now()/1000);
const valid=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{43}$/.test(value);
const pushIssues={
 'google-auth':{title:'Workout backup needs attention',body:'Reconnect Google in Daily Workout → Menu → Google backup & sync. Your workout is saved on this device.'},
 'google-permission':{title:'Workout backup needs attention',body:'Google rejected the backup. Open Daily Workout → Menu → Google backup & sync, reconnect Google, then allow access to the private Sheet.'},
 'sheet-attention':{title:'Workout Sheet needs attention',body:'Open Daily Workout → Menu → Google backup & sync to review the Sheet issue. Your workout remains saved on this device.'},
 'backup-retry':{title:'Workout backup is pending',body:'Your workout is saved on this device. Open Daily Workout while online; automatic backup will retry.'}
};
function validPushSubscription(value){
 if(!value||typeof value!=='object'||typeof value.endpoint!=='string'||value.endpoint.length>4096||JSON.stringify(value).length>8000)return false;
 try{const endpoint=new URL(value.endpoint);const host=endpoint.hostname;const allowed=host==='web.push.apple.com'||host==='fcm.googleapis.com'||host==='fcmregistrations.googleapis.com'||host==='updates.push.services.mozilla.com'||host.endsWith('.push.services.mozilla.com');
  return endpoint.protocol==='https:'&&!endpoint.username&&!endpoint.password&&!endpoint.port&&allowed&&typeof value.keys?.p256dh==='string'&&/^[A-Za-z0-9_-]{80,100}$/.test(value.keys.p256dh)&&typeof value.keys?.auth==='string'&&/^[A-Za-z0-9_-]{20,30}$/.test(value.keys.auth);
 }catch{return false}
}
class Failure extends Error{constructor(status,message){super(message);this.status=status}}
async function cipherKey(env){return crypto.subtle.importKey('raw',unb64(env.TOKEN_ENCRYPTION_KEY),'AES-GCM',false,['encrypt','decrypt'])}
async function seal(value,env){const iv=crypto.getRandomValues(new Uint8Array(12));return b64(iv)+'.'+b64(await crypto.subtle.encrypt({name:'AES-GCM',iv},await cipherKey(env),enc.encode(value)))}
async function unseal(value,env){const [iv,data]=value.split('.');return dec.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(iv)},await cipherKey(env),unb64(data)))}
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
async function body(request,max=2000000){if(!request.headers.get('Content-Type')?.startsWith('application/json'))throw new Failure(415,'JSON required.');const text=await request.text();if(text.length>max)throw new Failure(413,'Request too large.');try{return JSON.parse(text)}catch{throw new Failure(400,'Invalid JSON.')}}
const db=env=>env.AUTH_DB;
async function googleToken(params,env,request){
 const response=await request('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({client_id:CLIENT,client_secret:env.GOOGLE_CLIENT_SECRET,...params}),redirect:'manual'});
 if(!response.ok)throw new Failure(response.status===400?401:502,response.status===400?'Google connection needs renewal. Connect Google again.':'Google is temporarily unavailable.');
 const data=await response.json();if(!data.access_token||data.token_type?.toLowerCase()!=='bearer'||!Number.isFinite(Number(data.expires_in)))throw new Failure(502,'Invalid Google authorization response.');return data;
}
async function session(request,env){
 const token=request.headers.get('Authorization')?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];if(!token)throw new Failure(401,'Connect Google to continue.');
 const key=await hash(token),row=await db(env).prepare('SELECT * FROM app_sessions WHERE token_hash = ? AND expires > ?').bind(key,now()).first();if(!row)throw new Failure(401,'Your saved connection expired. Connect Google again.');return row;
}
async function access(row,env,request){
 if(row.access_cipher&&row.access_expires>now()+60)return unseal(row.access_cipher,env);
 let data;try{data=await googleToken({grant_type:'refresh_token',refresh_token:await unseal(row.refresh_cipher,env)},env,request)}catch(error){if(error.status===401)await db(env).prepare('DELETE FROM app_sessions WHERE token_hash = ?').bind(row.token_hash).run();throw error}
 await db(env).prepare('UPDATE app_sessions SET access_cipher = ?, access_expires = ?, refresh_cipher = ? WHERE token_hash = ?').bind(await seal(data.access_token,env),now()+Number(data.expires_in),data.refresh_token?await seal(data.refresh_token,env):row.refresh_cipher,row.token_hash).run();return data.access_token;
}
const b64url=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const stable=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function todayEastern(){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());return parts.filter(p=>p.type!=='literal').map(p=>p.value).join('-')}
function shiftDate(day,offset){const date=new Date(day+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+offset);return date.toISOString().slice(0,10)}
async function ouraToken(form,env){
 const response=await fetch('https://api.ouraring.com/oauth/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':OURA_AGENT},body:new URLSearchParams(form),redirect:'manual'});
 if(!response.ok)throw new Failure(response.status===401?401:502,'Oura authorization needs attention. Reconnect Oura in Daily Workout.');
 const value=await response.json();if(!value.access_token||!value.refresh_token||value.token_type?.toLowerCase()!=='bearer'||!Number.isFinite(Number(value.expires_in)))throw new Failure(502,'Oura returned an invalid token response.');return value;
}
async function ouraConnection(env){return db(env).prepare('SELECT * FROM oura_connection WHERE owner=?').bind(EMAIL).first()}
async function ouraAccess(env,attempt=0){
 let row=await ouraConnection(env);if(!row)throw new Failure(401,'Connect Oura in Daily Workout first.');if(row.access_expires>now()+120)return unseal(row.access_cipher,env);if(attempt>20)throw new Failure(503,'Oura token renewal is busy. Retry shortly.');
 const locked=await db(env).prepare('UPDATE oura_connection SET refresh_lock_until=? WHERE owner=? AND refresh_lock_until<? RETURNING owner').bind(now()+45,EMAIL,now()).first();
 if(!locked){await sleep(250);return ouraAccess(env,attempt+1)}
 try{
  row=await ouraConnection(env);if(row.access_expires>now()+120)return unseal(row.access_cipher,env);
  const refreshed=await ouraToken({grant_type:'refresh_token',refresh_token:await unseal(row.refresh_cipher,env),client_id:env.OURA_CLIENT_ID,client_secret:env.OURA_CLIENT_SECRET},env);
  const scope=refreshed.scope||row.scopes;if(!scope.split(/\s+/).includes(OURA_SCOPE))throw new Failure(403,'Oura daily access is no longer authorized. Reconnect Oura.');
  await db(env).prepare('UPDATE oura_connection SET access_cipher=?,access_expires=?,refresh_cipher=?,scopes=?,updated_at=?,refresh_lock_until=0 WHERE owner=?').bind(await seal(refreshed.access_token,env),now()+Number(refreshed.expires_in),await seal(refreshed.refresh_token,env),scope,now(),EMAIL).run();return refreshed.access_token;
 }catch(error){await db(env).prepare('UPDATE oura_connection SET refresh_lock_until=0 WHERE owner=?').bind(EMAIL).run();throw error}
}
async function ouraApi(path,env){
 if(!/^\/v2\/usercollection\/(daily_sleep|daily_readiness)(?:\/[A-Za-z0-9_-]+)?(?:\?.*)?$/.test(path))throw new Failure(400,'Oura data request is not allowed.');
 let token=await ouraAccess(env),response=await fetch('https://api.ouraring.com'+path,{headers:{Authorization:'Bearer '+token,'User-Agent':OURA_AGENT},redirect:'manual'});
 if(response.status===401){token=await ouraAccess(env);response=await fetch('https://api.ouraring.com'+path,{headers:{Authorization:'Bearer '+token,'User-Agent':OURA_AGENT},redirect:'manual'})}
 if(!response.ok)throw new Failure(response.status===403?403:502,response.status===403?'Oura daily data is unavailable. Check Oura access and membership.':'Oura could not provide daily scores. Retry after the next Oura app sync.');return response.json();
}
async function googleApiForOura(url,env,requestGoogle,method='GET',payload){
 const row=await db(env).prepare('SELECT * FROM app_sessions WHERE expires>? ORDER BY created DESC LIMIT 1').bind(now()).first();if(!row)throw new Failure(401,'Reconnect Google in Daily Workout to sync Oura scores to the private Sheet.');
 let token=await access(row,env,requestGoogle);
 const send=()=>requestGoogle(url,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(payload===undefined?{}:{body:JSON.stringify(payload)}),redirect:'manual'});
 let response=await send();if(response.status===401){token=await access({...row,access_expires:0},env,requestGoogle);response=await send()}
 if(!response.ok)throw new Failure(response.status===403?403:502,'Could not update the existing private workout Sheet. The Oura data remains saved in the encrypted connection database.');return response.status===204?{}:response.json();
}
async function saveOuraScore(record,env,requestGoogle){
 const timestamp=now(),day=record.day;
 await db(env).prepare('INSERT INTO oura_daily_scores(day,record_cipher,updated_at,sheet_synced_at) VALUES(?,?,?,NULL) ON CONFLICT(day) DO UPDATE SET record_cipher=excluded.record_cipher,updated_at=excluded.updated_at,sheet_synced_at=NULL').bind(day,await seal(JSON.stringify(record),env),timestamp).run();
 try{await writeOuraSheet(record,env,requestGoogle);await db(env).prepare('UPDATE oura_daily_scores SET sheet_synced_at=? WHERE day=?').bind(now(),day).run();return true}catch{return false}
}
async function writeOuraSheet(record,env,requestGoogle){
 const query="trashed=false and mimeType='application/vnd.google-apps.spreadsheet' and appProperties has { key='dailyWorkoutFormat' and value='"+SHEET_FORMAT+"' }";
 const files=await googleApiForOura('https://www.googleapis.com/drive/v3/files?'+new URLSearchParams({q:query,fields:'files(id,name)',pageSize:'100'}),env,requestGoogle);
 if(!files.files?.length)throw new Failure(404,'The existing workout Sheet is not available yet.');if(files.files.length!==1)throw new Failure(409,'Multiple workout Sheets are marked for this app; Oura scores were not written.');const id=files.files[0].id,base='https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(id);
 let info=await googleApiForOura(base+'?fields=sheets(properties(sheetId,title))',env,requestGoogle),tab=info.sheets?.find(s=>s.properties?.title===OURA_TAB)?.properties;
 if(!tab){const added=await googleApiForOura(base+':batchUpdate',env,requestGoogle,'POST',{requests:[{addSheet:{properties:{title:OURA_TAB}}}]});tab=added.replies?.[0]?.addSheet?.properties;if(!tab)throw new Failure(502,'Could not add the Oura scores tab to the existing private Sheet.');}
 const range="'"+OURA_TAB.replace(/'/g,"''")+"'!A:G",valuesUrl=base+'/values/'+encodeURIComponent(range),data=await googleApiForOura(valuesUrl,env,requestGoogle),rows=data.values||[];
 if(!rows.length)await googleApiForOura(valuesUrl+'?valueInputOption=RAW',env,requestGoogle,'PUT',{values:[OURA_HEADER]});
 else if(OURA_HEADER.some((value,index)=>rows[0][index]!==value)||rows[0].length!==OURA_HEADER.length)throw new Failure(409,'The Oura scores tab has unexpected headers; no rows were changed.');
 const output=[record.day,record.sleep?.score??'',record.sleep?.contributors?JSON.stringify(record.sleep.contributors):'',record.readiness?.score??'',record.readiness?.contributors?JSON.stringify(record.readiness.contributors):'',JSON.stringify({sleep:record.sleep?.timestamp||null,readiness:record.readiness?.timestamp||null}),new Date().toISOString()];
 const rowIndex=rows.findIndex((row,index)=>index>0&&row[0]===record.day)+1;
 if(rowIndex>0)await googleApiForOura(base+'/values/'+encodeURIComponent("'"+OURA_TAB.replace(/'/g,"''")+"'!A"+rowIndex+':G'+rowIndex)+'?valueInputOption=RAW',env,requestGoogle,'PUT',{values:[output]});
 else await googleApiForOura(base+'/values/'+encodeURIComponent(range)+':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS',env,requestGoogle,'POST',{values:[output]});
}
async function mergeOuraDay(day,dataType,doc,env,requestGoogle){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||(doc.score!==null&&doc.score!==undefined&&(!Number.isFinite(Number(doc.score))||Number(doc.score)<0||Number(doc.score)>100)))throw new Failure(502,'Oura returned an invalid daily score.');
 const old=await db(env).prepare('SELECT record_cipher FROM oura_daily_scores WHERE day=?').bind(day).first(),record=old?JSON.parse(await unseal(old.record_cipher,env)):{day,sleep:null,readiness:null};
 const metric={score:doc.score===null||doc.score===undefined?null:Number(doc.score),contributors:doc.contributors&&typeof doc.contributors==='object'?doc.contributors:{},timestamp:doc.timestamp||null,sourceId:doc.id||null};
 record[dataType==='daily_sleep'?'sleep':'readiness']=metric;
 if(doc.id)await db(env).prepare('INSERT INTO oura_score_documents(data_type,object_id,day) VALUES(?,?,?) ON CONFLICT(data_type,object_id) DO UPDATE SET day=excluded.day').bind(dataType,doc.id,day).run();
 await db(env).prepare('UPDATE oura_connection SET last_sync_at=? WHERE owner=?').bind(now(),EMAIL).run();await saveOuraScore(record,env,requestGoogle);
}
async function clearDeletedOuraMetric(dataType,objectId,env,requestGoogle){
 const saved=await db(env).prepare('SELECT day FROM oura_score_documents WHERE data_type=? AND object_id=?').bind(dataType,objectId).first();if(!saved)return;
 const row=await db(env).prepare('SELECT record_cipher FROM oura_daily_scores WHERE day=?').bind(saved.day).first();
 if(row){const record=JSON.parse(await unseal(row.record_cipher,env));record[dataType==='daily_sleep'?'sleep':'readiness']=null;await saveOuraScore(record,env,requestGoogle)}
 await db(env).prepare('DELETE FROM oura_score_documents WHERE data_type=? AND object_id=?').bind(dataType,objectId).run();
}
async function syncOuraWindow(env,requestGoogle){
 const end=todayEastern(),start=shiftDate(end,-7),[sleepData,readinessData]=await Promise.all([
  ouraApi('/v2/usercollection/daily_sleep?'+new URLSearchParams({start_date:start,end_date:end}),env),
  ouraApi('/v2/usercollection/daily_readiness?'+new URLSearchParams({start_date:start,end_date:end}),env)
 ]),records=new Map();
 for(const [type,items] of [['daily_sleep',sleepData.data||[]],['daily_readiness',readinessData.data||[]]])for(const item of items){if(!/^\d{4}-\d{2}-\d{2}$/.test(item.day||''))continue;const base=records.get(item.day)||{day:item.day,sleep:null,readiness:null};base[type==='daily_sleep'?'sleep':'readiness']={score:item.score??null,contributors:item.contributors||{},timestamp:item.timestamp||null,sourceId:item.id||null};records.set(item.day,base);if(item.id)await db(env).prepare('INSERT INTO oura_score_documents(data_type,object_id,day) VALUES(?,?,?) ON CONFLICT(data_type,object_id) DO UPDATE SET day=excluded.day').bind(type,item.id,item.day).run()}
 for(const record of records.values()){const old=await db(env).prepare('SELECT record_cipher FROM oura_daily_scores WHERE day=?').bind(record.day).first();if(old){const prior=JSON.parse(await unseal(old.record_cipher,env));if(!record.sleep)record.sleep=prior.sleep;if(!record.readiness)record.readiness=prior.readiness}await saveOuraScore(record,env,requestGoogle)}
 await db(env).prepare('UPDATE oura_connection SET last_sync_at=? WHERE owner=?').bind(now(),EMAIL).run();
 return records.size;
}
async function ouraWebhookApi(method,path,env,payload){
 const response=await fetch('https://api.ouraring.com'+path,{method,headers:{'x-client-id':env.OURA_CLIENT_ID,'x-client-secret':env.OURA_CLIENT_SECRET,'User-Agent':OURA_AGENT,'Content-Type':'application/json'},...(payload===undefined?{}:{body:JSON.stringify(payload)}),redirect:'manual'});
 if(!response.ok&&response.status!==204)throw new Failure(502,'Oura webhook setup needs attention.');return response.status===204?{}:response.json();
}
async function ensureOuraWebhooks(env){
 if(!env.OURA_CLIENT_ID||!env.OURA_CLIENT_SECRET)return;
 let existing=await ouraWebhookApi('GET','/v2/webhook/subscription',env);if(!Array.isArray(existing))existing=[];
 for(const dataType of ['daily_sleep','daily_readiness'])for(const eventType of ['create','update']){
  let current=existing.find(item=>item.callback_url===OURA_WEBHOOK&&item.data_type===dataType&&item.event_type===eventType);
  if(!current){const verification=random(),verificationHash=await hash(verification);await db(env).prepare('INSERT OR REPLACE INTO oura_webhooks(id,event_type,data_type,callback_url,verification_hash,expires_at) VALUES(?,?,?,?,?,0)').bind('pending:'+dataType+':'+eventType,eventType,dataType,OURA_WEBHOOK,verificationHash).run();current=await ouraWebhookApi('POST','/v2/webhook/subscription',env,{callback_url:OURA_WEBHOOK,verification_token:verification,event_type:eventType,data_type:dataType});await db(env).prepare('DELETE FROM oura_webhooks WHERE id=?').bind('pending:'+dataType+':'+eventType).run();await db(env).prepare('INSERT OR REPLACE INTO oura_webhooks(id,event_type,data_type,callback_url,verification_hash,expires_at) VALUES(?,?,?,?,?,?)').bind(current.id,eventType,dataType,OURA_WEBHOOK,verificationHash,Math.floor(Date.parse(current.expiration_time)/1000)||0).run();
  }else{const verificationRow=await db(env).prepare('SELECT verification_hash FROM oura_webhooks WHERE id=?').bind(current.id).first();if(!verificationRow){const verification=random(),verificationHash=await hash(verification);await db(env).prepare('INSERT OR REPLACE INTO oura_webhooks(id,event_type,data_type,callback_url,verification_hash,expires_at) VALUES(?,?,?,?,?,?)').bind(current.id,eventType,dataType,OURA_WEBHOOK,verificationHash,Math.floor(Date.parse(current.expiration_time)/1000)||0).run();const updated=await ouraWebhookApi('PUT','/v2/webhook/subscription/'+encodeURIComponent(current.id),env,{verification_token:verification,callback_url:OURA_WEBHOOK,event_type:eventType,data_type:dataType});await db(env).prepare('UPDATE oura_webhooks SET expires_at=? WHERE id=?').bind(Math.floor(Date.parse(updated.expiration_time)/1000)||0,current.id).run();}}
 }
}
async function processOuraWebhook(payload,env,requestGoogle){
 if(!['daily_sleep','daily_readiness'].includes(payload.data_type)||!['create','update','delete'].includes(payload.event_type)||typeof payload.object_id!=='string'||payload.object_id.length>200)return;
 if(payload.event_type==='delete'){await clearDeletedOuraMetric(payload.data_type,payload.object_id,env,requestGoogle);return}
 const path='/v2/usercollection/'+payload.data_type+'/'+encodeURIComponent(payload.object_id),data=await ouraApi(path,env);if(data?.day)await mergeOuraDay(data.day,payload.data_type,data,env,requestGoogle);
}
async function flushOuraEvents(env,requestGoogle){
 const rows=await db(env).prepare('SELECT event_hash,payload_cipher FROM oura_pending_events ORDER BY created_at LIMIT 20').all();
 for(const row of rows.results||[])try{await processOuraWebhook(JSON.parse(await unseal(row.payload_cipher,env)),env,requestGoogle);await db(env).prepare('DELETE FROM oura_pending_events WHERE event_hash=?').bind(row.event_hash).run()}catch{await db(env).prepare('UPDATE oura_pending_events SET attempts=attempts+1 WHERE event_hash=?').bind(row.event_hash).run()}
}
async function renewOuraWebhooks(env){
 if(!env.OURA_CLIENT_ID||!env.OURA_CLIENT_SECRET)return;
 const rows=await db(env).prepare('SELECT id,expires_at FROM oura_webhooks WHERE id NOT LIKE ?').bind('pending:%').all();
 for(const row of rows.results||[])if(row.expires_at<now()+259200){try{const renewed=await ouraWebhookApi('PUT','/v2/webhook/subscription/renew/'+encodeURIComponent(row.id),env);await db(env).prepare('UPDATE oura_webhooks SET expires_at=? WHERE id=?').bind(Math.floor(Date.parse(renewed.expiration_time)/1000)||now()+604800,row.id).run()}catch{}}
}
async function flushOuraSheet(env,requestGoogle){const rows=await db(env).prepare('SELECT day,record_cipher FROM oura_daily_scores WHERE sheet_synced_at IS NULL ORDER BY day').all();for(const row of rows.results||[])try{await writeOuraSheet(JSON.parse(await unseal(row.record_cipher,env)),env,requestGoogle);await db(env).prepare('UPDATE oura_daily_scores SET sheet_synced_at=? WHERE day=?').bind(now(),row.day).run()}catch{}}
export function allowedGoogle(url,method){
 let target;try{target=new URL(url)}catch{return false}
 if(target.protocol!=='https:'||target.username||target.password||target.hash||target.port)return false;
 if(target.origin==='https://www.googleapis.com'&&target.pathname==='/drive/v3/files')return ['GET','POST'].includes(method);
 if(target.origin!=='https://sheets.googleapis.com')return false;
 return (method==='GET'&&/^\/v4\/spreadsheets\/[A-Za-z0-9_-]+$/.test(target.pathname))||
 (method==='POST'&&/^\/v4\/spreadsheets\/[A-Za-z0-9_-]+:batchUpdate$/.test(target.pathname))||
 (['GET','PUT','POST'].includes(method)&&/^\/v4\/spreadsheets\/[A-Za-z0-9_-]+\/values\/.+$/.test(target.pathname));
}
export function createHandler(requestGoogle=(...args)=>globalThis.fetch(...args)){return async function(request,env,ctx){
 let step='request';
 const url=new URL(request.url),origin=request.headers.get('Origin');
 const headers={'Cache-Control':'no-store','Pragma':'no-cache','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'; base-uri 'none'",'Vary':'Origin'};
 if(origin===ORIGIN)Object.assign(headers,{'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Headers':'Authorization,Content-Type','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Max-Age':'86400'});
 function finish(response){const result=new Response(response.body,response);for(const [key,value] of Object.entries(headers))result.headers.set(key,value);return result}
 try{
  if(url.pathname==='/health'&&request.method==='GET')return finish(json({ok:true,service:'daily-workout-auth'}));
  if(!['/oauth/callback','/oura/oauth/callback','/oura/webhook'].includes(url.pathname)&&origin!==ORIGIN)throw new Failure(403,'Origin not allowed.');
  if(request.method==='OPTIONS')return finish(new Response(null,{status:204}));
  if(!env.GOOGLE_CLIENT_SECRET||!env.TOKEN_ENCRYPTION_KEY||!env.AUTH_DB)throw new Failure(503,'Google connection setup is not complete.');
  if(url.pathname==='/oura/oauth/callback'&&request.method==='GET'){
   const state=url.searchParams.get('state');if(!valid(state))throw new Failure(400,'Invalid Oura authorization state. Return to Daily Workout and reconnect.');
   const pending=await db(env).prepare('DELETE FROM oura_oauth_pending WHERE state_hash=? AND expires>? RETURNING *').bind(await hash(state),now()).first();if(!pending)throw new Failure(400,'This Oura connection expired or was already used. Reconnect from Daily Workout.');
   const back=new URL(APP);if(url.searchParams.has('error')){back.searchParams.set('oura','cancelled');return finish(Response.redirect(back.href,303))}
   const code=url.searchParams.get('code');if(!code||code.length>4096)throw new Failure(400,'Oura did not return an authorization code.');
   step='oura-token-exchange';const value=await ouraToken({grant_type:'authorization_code',code,client_id:env.OURA_CLIENT_ID,client_secret:env.OURA_CLIENT_SECRET,redirect_uri:OURA_CALLBACK,code_verifier:pending.code_verifier},env);
   const scopes=(value.scope||OURA_SCOPE).split(/\s+/).filter(Boolean);if(!scopes.includes(OURA_SCOPE))throw new Failure(403,'Oura did not grant the required daily scope. Reconnect and allow daily data.');
   await db(env).prepare('INSERT INTO oura_connection(owner,access_cipher,access_expires,refresh_cipher,scopes,updated_at,refresh_lock_until,last_sync_at) VALUES(?,?,?,?,?,?,0,NULL) ON CONFLICT(owner) DO UPDATE SET access_cipher=excluded.access_cipher,access_expires=excluded.access_expires,refresh_cipher=excluded.refresh_cipher,scopes=excluded.scopes,updated_at=excluded.updated_at,refresh_lock_until=0').bind(EMAIL,await seal(value.access_token,env),now()+Number(value.expires_in),await seal(value.refresh_token,env),scopes.join(' '),now()).run();
   step='oura-initial-sync';try{await ensureOuraWebhooks(env);await syncOuraWindow(env,requestGoogle)}catch{}
   back.searchParams.set('oura','connected');return finish(Response.redirect(back.href,303));
  }
  if(url.pathname==='/oura/webhook'&&request.method==='GET'){
   const supplied=url.searchParams.get('verification_token'),challenge=url.searchParams.get('challenge');if(!supplied||!challenge||challenge.length>500)throw new Failure(401,'Invalid Oura webhook verification.');
   const row=await db(env).prepare('SELECT id FROM oura_webhooks WHERE verification_hash=?').bind(await hash(supplied)).first();if(!row)throw new Failure(401,'Invalid Oura webhook verification.');return finish(json({challenge}));
  }
  if(url.pathname==='/oura/webhook'&&request.method==='POST'){
   if(!env.OURA_CLIENT_SECRET)throw new Failure(503,'Oura webhook verification is not configured.');const raw=await request.text();if(raw.length>12000)throw new Failure(413,'Webhook request too large.');let payload;try{payload=JSON.parse(raw)}catch{throw new Failure(400,'Invalid webhook JSON.')}
   const signature=request.headers.get('x-oura-signature')||'',stamp=request.headers.get('x-oura-timestamp')||'',rawTimestamp=Number(stamp)||Date.parse(stamp),timestamp=rawTimestamp>1e12?Math.floor(rawTimestamp/1000):rawTimestamp;if(!timestamp||Math.abs(now()-timestamp)>600)throw new Failure(401,'Expired Oura webhook.');
   const key=await crypto.subtle.importKey('raw',enc.encode(env.OURA_CLIENT_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']),expected=[...new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(stamp+JSON.stringify(payload))))].map(b=>b.toString(16).padStart(2,'0')).join('').toUpperCase(),difference=signature.length===expected.length?[...signature].reduce((diff,char,index)=>diff|(char.charCodeAt(0)^expected.charCodeAt(index)),0):1;
   if(difference!==0)throw new Failure(401,'Invalid Oura webhook signature.');
   const eventHash=await hash(JSON.stringify(payload));await db(env).prepare('INSERT OR IGNORE INTO oura_pending_events(event_hash,payload_cipher,created_at,attempts) VALUES(?,?,?,0)').bind(eventHash,await seal(JSON.stringify(payload),env),now()).run();if(ctx?.waitUntil)ctx.waitUntil(flushOuraEvents(env,requestGoogle));else await flushOuraEvents(env,requestGoogle);return finish(new Response('OK',{status:200}));
  }
  if(url.pathname==='/auth/start'&&request.method==='POST'){
   const data=await body(request,2000),app=data.app||'workout';if(!valid(data.challenge)||!valid(data.state)||!['workout','donation'].includes(app))throw new Failure(400,'Invalid connection request.');
   const state=random(),verifier=random();
   await db(env).prepare('INSERT INTO oauth_pending VALUES (?, ?, ?, ?, ?)').bind(await hash(state),data.challenge,app+':'+data.state,verifier,now()+600).run();
   const params=new URLSearchParams({client_id:CLIENT,redirect_uri:url.origin+'/oauth/callback',response_type:'code',scope:'openid email '+SCOPE,access_type:'offline',prompt:'consent',login_hint:EMAIL,state,code_challenge:await hash(verifier),code_challenge_method:'S256'});
   return finish(json({url:'https://accounts.google.com/o/oauth2/v2/auth?'+params}));
  }
  if(url.pathname==='/oauth/callback'&&request.method==='GET'){
   const state=url.searchParams.get('state');if(!valid(state))throw new Failure(400,'Invalid OAuth state. Return to the app and reconnect.');
   step='oauth-state';const pending=await db(env).prepare('DELETE FROM oauth_pending WHERE state_hash = ? AND expires > ? RETURNING *').bind(await hash(state),now()).first();if(!pending)throw new Failure(400,'This connection link expired or was already used.');
   const route=/^(workout|donation):([A-Za-z0-9_-]{43})$/.exec(pending.client_state),app=route?.[1]||'workout',clientState=route?.[2]||pending.client_state;if(!valid(clientState))throw new Failure(400,'Invalid connection destination.');
   const back=new URL(app==='donation'?DONATION_APP:APP);
   if(url.searchParams.has('error')){back.hash=new URLSearchParams({[app+'_auth_error']:'cancelled',[app+'_state']:clientState});return finish(Response.redirect(back.href,303))}
   const code=url.searchParams.get('code');if(!code||code.length>4096)throw new Failure(400,'Missing Google authorization code.');
   step='google-exchange';const data=await googleToken({grant_type:'authorization_code',code,redirect_uri:url.origin+'/oauth/callback',code_verifier:pending.google_verifier},env,requestGoogle);
   if(!data.scope?.split(' ').includes(SCOPE)||!data.refresh_token)throw new Failure(401,'Google did not grant renewable Drive access. Return to Daily Workout and connect again.');
   step='google-identity';const identityResponse=await requestGoogle('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:'Bearer '+data.access_token},redirect:'manual'});
   if(!identityResponse.ok)throw new Failure(401,'Google account could not be verified.');const identity=await identityResponse.json();
   if(identity.email!==EMAIL||identity.email_verified!==true)throw new Failure(403,'Only the configured Daily Workout owner may connect.');
   step='save-connection';const ticket=random(),expires=data.refresh_token_expires_in?now()+Number(data.refresh_token_expires_in):null;
   await db(env).prepare('INSERT INTO oauth_tickets VALUES (?, ?, ?, ?, ?)').bind(await hash(ticket),pending.challenge,await seal(data.refresh_token,env),expires,now()+300).run();
   step='return-to-app';back.hash=new URLSearchParams({[app+'_auth']:ticket,[app+'_state']:clientState});return finish(Response.redirect(back.href,303));
  }
  if(url.pathname==='/auth/complete'&&request.method==='POST'){
   const data=await body(request,2000);if(!valid(data.ticket)||!valid(data.verifier))throw new Failure(400,'Invalid connection completion.');
   const row=await db(env).prepare('DELETE FROM oauth_tickets WHERE ticket_hash = ? AND challenge = ? AND expires > ? RETURNING *').bind(await hash(data.ticket),await hash(data.verifier),now()).first();if(!row)throw new Failure(401,'Connection expired or belongs to another browser. Reconnect here.');
   const token=random(),expires=Math.min(now()+90*86400,row.grant_expires||Infinity);
   await db(env).prepare('INSERT INTO app_sessions (token_hash, refresh_cipher, expires, created) VALUES (?, ?, ?, ?)').bind(await hash(token),row.refresh_cipher,expires,now()).run();
   return finish(json({session:token,expires,email:EMAIL}));
  }
  if(url.pathname==='/oura/start'&&request.method==='POST'){
   await session(request,env);if(!env.OURA_CLIENT_ID||!env.OURA_CLIENT_SECRET)throw new Failure(503,'Oura is not configured yet. Set OURA_CLIENT_ID and OURA_CLIENT_SECRET in Cloudflare.');
   const state=random(),verifier=random(),challenge=b64url(await crypto.subtle.digest('SHA-256',enc.encode(verifier)));await db(env).prepare('INSERT INTO oura_oauth_pending(state_hash,code_verifier,expires) VALUES(?,?,?)').bind(await hash(state),verifier,now()+600).run();
   const params=new URLSearchParams({client_id:env.OURA_CLIENT_ID,redirect_uri:OURA_CALLBACK,response_type:'code',scope:OURA_SCOPE,state,code_challenge:challenge,code_challenge_method:'S256'});return finish(json({authorizationUrl:'https://cloud.ouraring.com/oauth/authorize?'+params}));
  }
  if(url.pathname==='/oura/status'&&request.method==='GET'){
   await session(request,env);const row=await ouraConnection(env),pending=await db(env).prepare('SELECT COUNT(*) AS count FROM oura_daily_scores WHERE sheet_synced_at IS NULL').first(),latest=await db(env).prepare('SELECT day FROM oura_daily_scores ORDER BY day DESC LIMIT 1').first();return finish(json({connected:Boolean(row),lastSyncAt:row?.last_sync_at?new Date(row.last_sync_at*1000).toISOString():null,latestScoreDate:latest?.day||null,pendingSheetRows:Number(pending?.count||0)}));
  }
  if(url.pathname==='/oura/sync'&&request.method==='POST'){
   await session(request,env);if(!await ouraConnection(env))throw new Failure(401,'Connect Oura first.');const count=await syncOuraWindow(env,requestGoogle);await flushOuraSheet(env,requestGoogle);return finish(json({synced:count}));
  }
  if(url.pathname==='/oura/disconnect'&&request.method==='POST'){
   await session(request,env);const hooks=await db(env).prepare('SELECT id FROM oura_webhooks WHERE id NOT LIKE ?').bind('pending:%').all();for(const hook of hooks.results||[])try{await ouraWebhookApi('DELETE','/v2/webhook/subscription/'+encodeURIComponent(hook.id),env)}catch{}
   await db(env).batch([db(env).prepare('DELETE FROM oura_connection WHERE owner=?').bind(EMAIL),db(env).prepare('DELETE FROM oura_daily_scores').bind(),db(env).prepare('DELETE FROM oura_score_documents').bind(),db(env).prepare('DELETE FROM oura_webhooks').bind(),db(env).prepare('DELETE FROM oura_pending_events').bind(),db(env).prepare('DELETE FROM oura_oauth_pending').bind()]);return finish(json({disconnected:true,sheetRowsRetained:true}));
  }
  if(url.pathname==='/push/config'&&request.method==='GET')return finish(json({publicKey:env.VAPID_PUBLIC_KEY||null}));
  if(url.pathname==='/push/subscribe'&&request.method==='POST'){
   await session(request,env);const data=await body(request,12000),subscription=data.subscription,reporterToken=data.reporterToken;
   if(!validPushSubscription(subscription)||!valid(reporterToken)||!env.VAPID_PUBLIC_KEY)throw new Failure(400,'Invalid push subscription.');
   const endpointHash=await hash(subscription.endpoint),reporterHash=await hash(reporterToken),timestamp=now();
   await db(env).prepare('INSERT INTO push_subscriptions (endpoint_hash,owner,subscription_cipher,reporter_hash,created,updated) VALUES (?,?,?,?,?,?) ON CONFLICT(endpoint_hash) DO UPDATE SET owner=excluded.owner,subscription_cipher=excluded.subscription_cipher,reporter_hash=excluded.reporter_hash,updated=excluded.updated').bind(endpointHash,EMAIL,await seal(JSON.stringify(subscription),env),reporterHash,timestamp,timestamp).run();
   return finish(json({subscribed:true}));
  }
  if(url.pathname==='/push/unsubscribe'&&request.method==='POST'){
   const data=await body(request,6000);if(typeof data.endpoint!=='string'||!valid(data.reporterToken))throw new Failure(400,'Invalid push unsubscribe request.');
   const endpointHash=await hash(data.endpoint),reporterHash=await hash(data.reporterToken);
   await db(env).prepare('DELETE FROM push_subscriptions WHERE endpoint_hash=? AND reporter_hash=? AND owner=?').bind(endpointHash,reporterHash,EMAIL).run();
   return finish(json({unsubscribed:true}));
  }
  if(url.pathname==='/push/problem'&&request.method==='POST'){
   const data=await body(request,2000),issue=pushIssues[data.code];if((data.code!=='resolved'&&!issue)||!valid(data.reporterToken))throw new Failure(400,'Invalid backup alert request.');
   const reporterHash=await hash(data.reporterToken),ownerRow=await db(env).prepare('SELECT owner FROM push_subscriptions WHERE reporter_hash=? LIMIT 1').bind(reporterHash).first();
   if(!ownerRow)return finish(json({sent:0,subscribed:false}));
   if(data.code==='resolved'){await db(env).prepare('DELETE FROM push_problem_notices WHERE owner=?').bind(ownerRow.owner).run();return finish(json({sent:0,resolved:true}));}
   const subscriptions=await db(env).prepare('SELECT endpoint_hash,subscription_cipher FROM push_subscriptions WHERE owner=?').bind(ownerRow.owner).all();
   if(!subscriptions.results?.length)return finish(json({sent:0,subscribed:false}));
   const timestamp=now(),claim=await db(env).prepare('INSERT INTO push_problem_notices (owner,code,last_sent) VALUES (?,?,?) ON CONFLICT(owner,code) DO UPDATE SET last_sent=excluded.last_sent WHERE push_problem_notices.last_sent<=? RETURNING code').bind(ownerRow.owner,data.code,timestamp,timestamp-21600).first();
   if(!claim)return finish(json({sent:0,throttled:true}));
   let sent=0;
   for(const saved of subscriptions.results){
    try{const subscription=JSON.parse(await unseal(saved.subscription_cipher,env));if(!validPushSubscription(subscription))throw Error('Invalid saved subscription.');
     const payload=await buildPushPayload({data:{title:issue.title,body:issue.body,url:APP},options:{ttl:3600,urgency:'normal',topic:'backup-problem'}},subscription,{subject:'mailto:onlinesny@gmail.com',publicKey:env.VAPID_PUBLIC_KEY,privateKey:env.VAPID_PRIVATE_KEY});
     const response=await fetch(subscription.endpoint,{...payload,redirect:'manual'});
     if(response.status===404||response.status===410){await db(env).prepare('DELETE FROM push_subscriptions WHERE endpoint_hash=?').bind(saved.endpoint_hash).run();continue;}
     if(response.ok)sent++;
    }catch{}
   }
   if(!sent)await db(env).prepare('DELETE FROM push_problem_notices WHERE owner=? AND code=?').bind(ownerRow.owner,data.code).run();
   return finish(json({sent}));
  }
  if(url.pathname==='/session'&&request.method==='GET'){const row=await session(request,env);return finish(json({connected:true,email:EMAIL,expires:row.expires}))}
  if(url.pathname==='/workout'&&request.method==='GET'){
   await session(request,env);const row=await db(env).prepare('SELECT state_cipher FROM shared_workout_state WHERE owner = ?').bind(EMAIL).first();
   return finish(json({record:row?JSON.parse(await unseal(row.state_cipher,env)):null}));
  }
  if(url.pathname==='/workout'&&request.method==='POST'){
   await session(request,env);const data=await body(request,900000);
   if(data.handoffReady===true&&Object.keys(data).length===1)return finish(json({ready:true}));
   const record=data.record;
   if(!record||record.scope!=='daily'||!['in-progress','unfinished','finished'].includes(record.status)||typeof record.id!=='string'||record.id.length>200||typeof record.updatedAt!=='string'||!Number.isFinite(Date.parse(record.updatedAt))||!Number.isSafeInteger(record.revision)||record.revision<0||JSON.stringify(record).length>800000)throw new Failure(400,'Invalid workout save.');
   await db(env).prepare('INSERT INTO shared_workout_state (owner,state_cipher,updated_at,revision) VALUES (?,?,?,?) ON CONFLICT(owner) DO UPDATE SET state_cipher=excluded.state_cipher, updated_at=excluded.updated_at, revision=excluded.revision WHERE shared_workout_state.updated_at < excluded.updated_at OR (shared_workout_state.updated_at = excluded.updated_at AND shared_workout_state.revision <= excluded.revision)').bind(EMAIL,await seal(JSON.stringify(record),env),record.updatedAt,record.revision).run();
   const row=await db(env).prepare('SELECT state_cipher FROM shared_workout_state WHERE owner = ?').bind(EMAIL).first();
   return finish(json({record:row?JSON.parse(await unseal(row.state_cipher,env)):null}));
  }
  if(url.pathname==='/disconnect'&&request.method==='POST'){const row=await session(request,env);await db(env).prepare('DELETE FROM app_sessions WHERE token_hash = ?').bind(row.token_hash).run();return finish(json({disconnected:true}))}
  if(url.pathname==='/google'&&request.method==='POST'){
   const row=await session(request,env),data=await body(request),method=data.method||'GET';
   if(!allowedGoogle(data.url,method))throw new Failure(400,'Google operation not allowed.');
   let token=await access(row,env,requestGoogle);
   const send=()=>requestGoogle(data.url,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(method==='GET'?{}:{body:JSON.stringify(data.body)}),redirect:'manual'});
   let response=await send();if(response.status===401){token=await access({...row,access_expires:0},env,requestGoogle);response=await send()}
   if(!response.ok)throw new Failure(response.status===401?401:response.status===403?403:502,response.status===403?'Google denied access. Check the Drive and Sheets APIs and app permissions.':'Google request failed. Retry sync; local results are safe.');
   return finish(json(await response.json()));
  }
  throw new Failure(404,'Not found.');
 }catch(error){return finish(json({error:error instanceof Failure?error.message:'The Google connection service is temporarily unavailable. Reference: '+step+(String(error.message).includes('D1')?'-database':'')},error instanceof Failure?error.status:503))}
}}
export default {fetch:createHandler(),async scheduled(event,env){await env.AUTH_DB.batch([
 env.AUTH_DB.prepare('DELETE FROM oauth_pending WHERE expires <= ?').bind(now()),env.AUTH_DB.prepare('DELETE FROM oauth_tickets WHERE expires <= ?').bind(now()),env.AUTH_DB.prepare('DELETE FROM app_sessions WHERE expires <= ?').bind(now()),env.AUTH_DB.prepare('DELETE FROM oura_oauth_pending WHERE expires <= ?').bind(now())
]);if(env.OURA_CLIENT_ID&&env.OURA_CLIENT_SECRET){try{await renewOuraWebhooks(env);await flushOuraEvents(env,globalThis.fetch);await flushOuraSheet(env,globalThis.fetch)}catch{}}}};
