/* Júlia Pescados — mapa do rastreio (Leaflet + OpenStreetMap), igual para o entregador, o cliente e o painel.
   O endereço dos mapas vem de /api/mapa (dá para trocar o provedor de tiles no servidor, sem mexer nas telas). */
(function () {
  var BASE = { lat: -3.7392, lng: -38.5058 };
  var cfg = { tiles: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', atribuicao: '© OpenStreetMap', zoomMax: 19 };
  var pronto = fetch('/api/mapa', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { if (j && j.tiles) cfg = j; }).catch(function () {});

  function cria(el, opc) {
    return pronto.then(function () {
      if (!window.L) throw new Error('mapa indisponível');
      var m = L.map(el, { scrollWheelZoom: false, zoomControl: true, attributionControl: true }).setView([BASE.lat, BASE.lng], 12);
      // referrerPolicy "origin": o servidor de mapas vê só o site, nunca o endereço com o token do link
      L.tileLayer(cfg.tiles, { maxZoom: cfg.zoomMax, attribution: cfg.atribuicao, referrerPolicy: 'origin', crossOrigin: false }).addTo(m);
      setTimeout(function () { m.invalidateSize(); }, 200);
      return m;
    });
  }
  function pino(cls, html, tam) { return L.divIcon({ className: '', html: '<div class="' + cls + '">' + (html || '') + '</div>', iconSize: [0, 0], iconAnchor: tam || [17, 17] }); }
  var ICONES = {
    moto: function (cor) { return L.divIcon({ className: '', html: '<div class="motoboy-pin" style="' + (cor ? 'background:' + cor : '') + '"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.5" cy="17" r="3"/><circle cx="18.5" cy="17" r="3"/><path d="M5.5 17h5l3-7h3.5l1.5 7M13.5 10 12 7H9"/></svg></div>', iconSize: [0, 0], iconAnchor: [17, 17] }); },
    casa: function () { return L.divIcon({ className: '', html: '<div class="destino-pin"></div>', iconSize: [0, 0], iconAnchor: [11, 22] }); },
    base: function () { return pino('base-pin', 'Base', [20, 12]); }
  };
  // Move o pino com suavidade (a posição chega a cada poucos segundos).
  function anima(marcador, para, ms) {
    var de = marcador.getLatLng(), t0 = performance.now(); ms = ms || 1500;
    if (marcador._anim) cancelAnimationFrame(marcador._anim);
    (function passo(t) {
      var f = Math.min(1, (t - t0) / ms); f = f * (2 - f);
      marcador.setLatLng([de.lat + (para[0] - de.lat) * f, de.lng + (para[1] - de.lng) * f]);
      if (f < 1) marcador._anim = requestAnimationFrame(passo);
    })(t0);
  }
  window.JPM = { BASE: BASE, cria: cria, icones: ICONES, anima: anima };
})();
