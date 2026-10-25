// Offline support: cache the game (and its fonts once loaded), serve from cache, refresh in the background.
// Bump VERSION whenever a cached file changes so phones pick up the update.
const VERSION="rink-v2";
const FILES=["./","index.html","manifest.webmanifest","icon-192.png","icon-512.png","apple-touch-icon.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(VERSION).then(c=>c.addAll(FILES)));self.skipWaiting()});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith("rink-")&&k!==VERSION).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener("fetch",e=>{
 if(e.request.method!=="GET")return;
 e.respondWith(caches.match(e.request).then(hit=>{
  const net=fetch(e.request).then(r=>{if(r.ok||r.type==="opaque")caches.open(VERSION).then(c=>c.put(e.request,r.clone()));return r}).catch(()=>hit);
  return hit||net;
 }));
});
