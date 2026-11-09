// No credentials, authorization codes, headers, or Google error payloads are logged.
const CLIENT='790497358549-7lg9e6q8jbv08g1l3p4d1grm92o071js.apps.googleusercontent.com';
const EMAIL='onlinesny@gmail.com',SCOPE='https://www.googleapis.com/auth/drive.file';
const APP='https://badgerbalm.github.io/daily-workout/';
const ORIGIN=new URL(APP).origin;
const enc=new TextEncoder(),dec=new TextDecoder();
const b64=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const unb64=value=>Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
const random=()=>b64(crypto.getRandomValues(new Uint8Array(32)));
export const hash=async value=>b64(await crypto.subtle.digest('SHA-256',enc.encode(value)));
const now=()=>Math.floor(Date.now()/1000);
const valid=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{43}$/.test(value);
class Failure extends Error{constructor(status,message){super(message);this.status=status}}
async function cipherKey(env){return crypto.subtle.importKey('raw',unb64(env.TOKEN_ENCRYPTION_KEY),'AES-GCM',false,['encrypt','decrypt'])}
async function seal(value,env){const iv=crypto.getRandomValues(new Uint8Array(12));return b64(iv)+'.'+b64(await crypto.subtle.encrypt({name:'AES-GCM',iv},await cipherKey(env),enc.encode(value)))}
async function unseal(value,env){const [iv,data]=value.split('.');return dec.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(iv)},await cipherKey(env),unb64(data)))}
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
async function body(request,max=2000000){if(!request.headers.get('Content-Type')?.startsWith('application/json'))throw new Failure(415,'JSON required.');const text=await request.text();if(text.length>max)throw new Failure(413,'Request too large.');try{return JSON.parse(text)}catch{throw new Failure(400,'Invalid JSON.')}}
const db=env=>env.AUTH_DB;
async function googleToken(params,env,request){
 const response=await request('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({client_id:CLIENT,client_secret:env.GOOGLE_CLIENT_SECRET,...params}),redirect:'error'});
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
export function allowedGoogle(url,method){
 let target;try{target=new URL(url)}catch{return false}
 if(target.protocol!=='https:'||target.username||target.password||target.hash||target.port)return false;
 if(target.origin==='https://www.googleapis.com'&&target.pathname==='/drive/v3/files')return ['GET','POST'].includes(method);
 if(target.origin!=='https://sheets.googleapis.com')return false;
 return (method==='GET'&&/^\/v4\/spreadsheets\/[A-Za-z0-9_-]+$/.test(target.pathname))||
 (method==='POST'&&/^\/v4\/spreadsheets\/[A-Za-z0-9_-]+:batchUpdate$/.test(target.pathname))||
 (['GET','PUT','POST'].includes(method)&&/^\/v4\/spreadsheets\/[A-Za-z0-9_-]+\/values\/.+$/.test(target.pathname));
}
export function createHandler(requestGoogle=fetch){return async function(request,env){
 const url=new URL(request.url),origin=request.headers.get('Origin');
 const headers={'Cache-Control':'no-store','Pragma':'no-cache','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'; base-uri 'none'",'Vary':'Origin'};
 if(origin===ORIGIN)Object.assign(headers,{'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Headers':'Authorization,Content-Type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'});
 function finish(response){const result=new Response(response.body,response);for(const [key,value] of Object.entries(headers))result.headers.set(key,value);return result}
 try{
  if(url.pathname==='/health'&&request.method==='GET')return finish(json({ok:true,service:'daily-workout-auth'}));
  if(url.pathname!=='/oauth/callback'&&origin!==ORIGIN)throw new Failure(403,'Origin not allowed.');
  if(request.method==='OPTIONS')return finish(new Response(null,{status:204}));
  if(!env.GOOGLE_CLIENT_SECRET||!env.TOKEN_ENCRYPTION_KEY||!env.AUTH_DB)throw new Failure(503,'Google connection setup is not complete.');
  if(url.pathname==='/auth/start'&&request.method==='POST'){
   const data=await body(request,2000);if(!valid(data.challenge)||!valid(data.state))throw new Failure(400,'Invalid connection request.');
   const state=random(),verifier=random();
   await db(env).prepare('INSERT INTO oauth_pending VALUES (?, ?, ?, ?, ?)').bind(await hash(state),data.challenge,data.state,verifier,now()+600).run();
   const params=new URLSearchParams({client_id:CLIENT,redirect_uri:url.origin+'/oauth/callback',response_type:'code',scope:'openid email '+SCOPE,access_type:'offline',prompt:'consent',login_hint:EMAIL,state,code_challenge:await hash(verifier),code_challenge_method:'S256'});
   return finish(json({url:'https://accounts.google.com/o/oauth2/v2/auth?'+params}));
  }
  if(url.pathname==='/oauth/callback'&&request.method==='GET'){
   const state=url.searchParams.get('state');if(!valid(state))throw new Failure(400,'Invalid OAuth state. Return to Daily Workout and reconnect.');
   const pending=await db(env).prepare('DELETE FROM oauth_pending WHERE state_hash = ? AND expires > ? RETURNING *').bind(await hash(state),now()).first();if(!pending)throw new Failure(400,'This connection link expired or was already used.');
   const back=new URL(APP);
   if(url.searchParams.has('error')){back.hash=new URLSearchParams({workout_auth_error:'cancelled',workout_state:pending.client_state});return finish(Response.redirect(back.href,303))}
   const code=url.searchParams.get('code');if(!code||code.length>4096)throw new Failure(400,'Missing Google authorization code.');
   const data=await googleToken({grant_type:'authorization_code',code,redirect_uri:url.origin+'/oauth/callback',code_verifier:pending.google_verifier},env,requestGoogle);
   if(!data.scope?.split(' ').includes(SCOPE)||!data.refresh_token)throw new Failure(401,'Google did not grant renewable Drive access. Return to Daily Workout and connect again.');
   const identityResponse=await requestGoogle('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:'Bearer '+data.access_token},redirect:'error'});
   if(!identityResponse.ok)throw new Failure(401,'Google account could not be verified.');const identity=await identityResponse.json();
   if(identity.email!==EMAIL||identity.email_verified!==true)throw new Failure(403,'Only the configured Daily Workout owner may connect.');
   const ticket=random(),expires=data.refresh_token_expires_in?now()+Number(data.refresh_token_expires_in):null;
   await db(env).prepare('INSERT INTO oauth_tickets VALUES (?, ?, ?, ?, ?)').bind(await hash(ticket),pending.challenge,await seal(data.refresh_token,env),expires,now()+300).run();
   back.hash=new URLSearchParams({workout_auth:ticket,workout_state:pending.client_state});return finish(Response.redirect(back.href,303));
  }
  if(url.pathname==='/auth/complete'&&request.method==='POST'){
   const data=await body(request,2000);if(!valid(data.ticket)||!valid(data.verifier))throw new Failure(400,'Invalid connection completion.');
   const row=await db(env).prepare('DELETE FROM oauth_tickets WHERE ticket_hash = ? AND challenge = ? AND expires > ? RETURNING *').bind(await hash(data.ticket),await hash(data.verifier),now()).first();if(!row)throw new Failure(401,'Connection expired or belongs to another browser. Reconnect here.');
   const token=random(),expires=Math.min(now()+90*86400,row.grant_expires||Infinity);
   await db(env).prepare('INSERT INTO app_sessions (token_hash, refresh_cipher, expires, created) VALUES (?, ?, ?, ?)').bind(await hash(token),row.refresh_cipher,expires,now()).run();
   return finish(json({session:token,expires,email:EMAIL}));
  }
  if(url.pathname==='/session'&&request.method==='GET'){const row=await session(request,env);return finish(json({connected:true,email:EMAIL,expires:row.expires}))}
  if(url.pathname==='/disconnect'&&request.method==='POST'){const row=await session(request,env);await db(env).prepare('DELETE FROM app_sessions WHERE token_hash = ?').bind(row.token_hash).run();return finish(json({disconnected:true}))}
  if(url.pathname==='/google'&&request.method==='POST'){
   const row=await session(request,env),data=await body(request),method=data.method||'GET';
   if(!allowedGoogle(data.url,method))throw new Failure(400,'Google operation not allowed.');
   let token=await access(row,env,requestGoogle);
   const send=()=>requestGoogle(data.url,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(method==='GET'?{}:{body:JSON.stringify(data.body)}),redirect:'error'});
   let response=await send();if(response.status===401){token=await access({...row,access_expires:0},env,requestGoogle);response=await send()}
   if(!response.ok)throw new Failure(response.status===401?401:response.status===403?403:502,response.status===403?'Google denied access. Check the Drive and Sheets APIs and app permissions.':'Google request failed. Retry sync; local results are safe.');
   return finish(json(await response.json()));
  }
  throw new Failure(404,'Not found.');
 }catch(error){return finish(json({error:error instanceof Failure?error.message:'The Google connection service is temporarily unavailable.'},error instanceof Failure?error.status:503))}
}}
export default {fetch:createHandler(),async scheduled(event,env){await env.AUTH_DB.batch([
 env.AUTH_DB.prepare('DELETE FROM oauth_pending WHERE expires <= ?').bind(now()),env.AUTH_DB.prepare('DELETE FROM oauth_tickets WHERE expires <= ?').bind(now()),env.AUTH_DB.prepare('DELETE FROM app_sessions WHERE expires <= ?').bind(now())
])}};
