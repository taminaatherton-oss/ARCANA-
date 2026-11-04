const CACHE='arcana-shell-v5';
const CORE=[
 './','./index.html','./styles.css','./app.js','./manifest.webmanifest',
 './assets/cat-logo.png','./assets/spark.svg','./assets/book.svg','./assets/cards.svg',
 './assets/journal.svg','./assets/calendar.svg','./assets/note.svg','./assets/settings.svg'
];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET'||new URL(req.url).origin!==self.location.origin)return;
 event.respondWith((async()=>{
  const cached=await caches.match(req);
  if(cached)return cached;
  try{
   const response=await fetch(req);
   if(response.ok){const copy=response.clone();caches.open(CACHE).then(c=>c.put(req,copy));}
   return response;
  }catch(error){
   if(req.mode==='navigate')return (await caches.match('./index.html'))||Response.error();
   return Response.error();
  }
 })());
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const data=event.notification.data||{};
 const target=new URL(data.url||'./index.html#journal',self.registration.scope).href;
 event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
  for(const client of list){if('focus'in client){client.navigate(target);return client.focus();}}
  return clients.openWindow(target);
 }));
});
