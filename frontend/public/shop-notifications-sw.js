// Notifications and short-lived shared bill handoff. API responses and credentials are never cached.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const path = event.notification.data?.path;
  if (typeof path !== 'string' || !path.startsWith('/retail/')) return;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const target = new URL(path,self.location.origin).href;
    const app = windows.find(client => new URL(client.url).origin === self.location.origin);
    if (app) { await app.navigate(target); await app.focus(); }
    else await self.clients.openWindow(target);
  })());
});

const intakeShareCache='apna-intake-share-v1',sharePrefix='/_intake_share/',shareLifetime=30*60*1000;
async function cleanIntakeShares(){const cache=await caches.open(intakeShareCache);for(const key of await cache.keys()){const response=await cache.match(key),at=Number(response?.headers.get('X-Shared-At')||0);if(Date.now()-at>shareLifetime)await cache.delete(key);}return cache;}
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);if(url.origin!==self.location.origin)return;
 if(url.pathname==='/intake-share'&&event.request.method==='POST')event.respondWith((async()=>{
  try{const form=await event.request.formData(),file=form.get('bill');if(!(file instanceof File)||!file.size||file.size>5*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type))return Response.redirect(new URL('/retail/items/add-faster?source=SHARED_DOCUMENT',self.location.origin),303);
   const cache=await cleanIntakeShares(),keys=await cache.keys();for(const key of keys.slice(0,Math.max(0,keys.length-2)))await cache.delete(key);
   const id=crypto.randomUUID();await cache.put(sharePrefix+id,new Response(file,{headers:{'Content-Type':file.type,'X-Shared-At':String(Date.now()),'Cache-Control':'no-store'}}));
   return Response.redirect(new URL('/retail/items/add-faster?source=SHARED_DOCUMENT&shared='+id,self.location.origin),303);
  }catch{return Response.redirect(new URL('/retail/items/add-faster?source=SHARED_DOCUMENT',self.location.origin),303);}
 })());
 if(url.pathname.startsWith(sharePrefix)&&event.request.method==='GET')event.respondWith((async()=>{if(!/^\/_intake_share\/[0-9a-f-]{36}$/.test(url.pathname))return new Response('',{status:404});const cache=await cleanIntakeShares();return await cache.match(url.pathname)||new Response('Shared file expired',{status:404});})());
});
self.addEventListener('message',event=>{if(event.data?.type==='PURGE_INTAKE_SHARED')event.waitUntil(caches.delete(intakeShareCache));});
