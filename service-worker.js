'use strict';

self.addEventListener('push',event=>{
 let notice={title:'Workout backup needs attention',body:'Open Daily Workout → Menu → Google backup & sync for help.',url:self.registration.scope};
 try{const incoming=event.data?.json();if(incoming&&typeof incoming.title==='string'&&typeof incoming.body==='string')notice={...notice,...incoming}}catch{}
 const url=new URL(notice.url||self.registration.scope,self.registration.scope);
 if(url.origin!==self.location.origin)url.href=self.registration.scope;
 event.waitUntil(self.registration.showNotification(notice.title,{body:notice.body,icon:new URL('images/apple-touch-icon.png',self.registration.scope).href,badge:new URL('images/apple-touch-icon.png',self.registration.scope).href,tag:'daily-workout-backup-problem',renotify:false,data:{url:url.href}}));
});

self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const target=event.notification.data?.url||self.registration.scope;
 event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(windows=>{
  for(const client of windows){if(new URL(client.url).origin===self.location.origin)return client.navigate(target).then(()=>client.focus())}
  return self.clients.openWindow(target);
 }));
});
