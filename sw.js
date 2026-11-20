const CACHE='siparis-defteri-shell-9';
const files=['./','./index.html','./app.js','./reports.js','./lock.js','./backup.js','./style.css','./app.webmanifest','./icon192.png','./icon512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(files.map(path=>new Request(path,{cache:"reload"})))).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
 event.respondWith(caches.open(CACHE).then(async cache=>{
   const cached=await cache.match(event.request);
   if(cached)return cached;
   try{return await fetch(event.request);}catch(error){if(event.request.mode==='navigate')return cache.match('./');throw error;}
 }));
});
