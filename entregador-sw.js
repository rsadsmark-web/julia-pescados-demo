/* Júlia Pescados — guarda a tela do entregador para abrir mesmo com o sinal fraco. Nunca guarda a API nem posições. */
var VERSAO = 'jpe-1', ARQUIVOS = ['/base.css', '/entrega.css', '/entrega-lib.js', '/entrega-mapa.js', '/entregador.js'];
self.addEventListener('install', function (e) { e.waitUntil(caches.open(VERSAO).then(function (c) { return c.addAll(ARQUIVOS.map(function (a) { return new Request(a, { cache: 'reload' }); })); }).then(function () { return self.skipWaiting(); })); });
self.addEventListener('activate', function (e) { e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== VERSAO; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); })); });
self.addEventListener('fetch', function (e) {
  var u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.indexOf('/api/') === 0) return; // API sempre pela rede
  e.respondWith(fetch(e.request).then(function (r) { // rede primeiro; sem rede, usa o que guardou
    if (r.ok && (u.pathname.indexOf('/e/') === 0 || ARQUIVOS.indexOf(u.pathname) >= 0)) { var c = r.clone(); caches.open(VERSAO).then(function (ca) { ca.put(e.request, c); }); }
    return r;
  }).catch(function () { return caches.match(e.request, { ignoreSearch: true }); }));
});
