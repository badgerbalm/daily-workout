/* Opaque, revocable app sessions only. Google credentials never enter this module. */
(function(root){
 'use strict';
 const BASE='https://daily-workout-auth.onlinesny.workers.dev';
 const KEY='daily-workout-google-session-v1',PENDING='daily-workout-google-pending-v1';
 const encode=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
 const random=()=>encode(root.crypto.getRandomValues(new Uint8Array(32)));
 function create({storage=root.localStorage,request=root.fetch.bind(root),navigate=url=>root.location.assign(url)}={}){
  let saved=null;
  try{const value=JSON.parse(storage.getItem(KEY)||'null');if(value?.expires*1000>Date.now())saved=value;else storage.removeItem(KEY)}catch{}
  const connected=()=>Boolean(saved?.expires*1000>Date.now());
  const clear=()=>{saved=null;storage.removeItem(KEY)};
  async function call(path,data,authenticated=true,{keepalive=false}={}){
   if(authenticated&&!connected()){clear();throw Error('Connect Google to continue.');}
   const response=await request(BASE+path,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(authenticated?{Authorization:'Bearer '+saved.session}:{})},...(data===undefined?{}:{body:JSON.stringify(data)}),credentials:'omit',referrerPolicy:'no-referrer',...(keepalive?{keepalive:true}:{})});
   if(response.status===401){clear();throw Error('Your saved Google connection needs renewal. Connect Google again.');}
   const value=await response.json();if(!response.ok)throw Error(value.error||'Google connection service is unavailable.');return value;
  }
  async function connect(){
   const verifier=random(),state=random(),challenge=encode(await root.crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)));
   storage.setItem(PENDING,JSON.stringify({verifier,state,created:Date.now()}));
   const result=await call('/auth/start',{challenge,state},false);navigate(result.url);
  }
  async function restore(){
   const params=new URLSearchParams(root.location.hash.slice(1));
   if(params.has('workout_auth')||params.has('workout_auth_error')){
    let pending;try{pending=JSON.parse(storage.getItem(PENDING)||'null')}catch{}
    // Remove a one-time callback ticket from browser history before any work.
    root.history.replaceState(null,'',root.location.pathname+root.location.search);
    if(!pending||pending.state!==params.get('workout_state')||Date.now()-pending.created>900000)throw Error('Google returned to a different browser context. Open this page where you started and connect again.');
    if(params.has('workout_auth_error')){storage.removeItem(PENDING);throw Error('Google connection was cancelled.');}
    const value=await call('/auth/complete',{ticket:params.get('workout_auth'),verifier:pending.verifier},false);
    storage.setItem(KEY,JSON.stringify(value));saved=value;storage.removeItem(PENDING);
   }
   if(!connected())return false;
   await call('/session');return true;
  }
  async function disconnect(){try{if(connected())await call('/disconnect',{})}finally{clear()}}
  async function getWorkout(){return (await call('/workout')).record}
  async function saveWorkout(record,{keepalive=false}={}){return (await call('/workout',{record},true,{keepalive})).record}
  // Match fetch's shape so the existing verified Sheet sync protocol is retained.
  async function google(url,options={}){
   const value=await call('/google',{url,method:options.method||'GET',...(options.body?{body:JSON.parse(options.body)}:{})});
   return {ok:true,status:200,json:async()=>value};
  }
  return {connected,restore,connect,disconnect,google,getWorkout,saveWorkout};
 }
 if(typeof module!=='undefined')module.exports={create,BASE};else root.WorkoutRememberedGoogle={create,BASE};
})(typeof window==='undefined'?globalThis:window);
