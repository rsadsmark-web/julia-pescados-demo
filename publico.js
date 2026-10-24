/* Júlia Pescados — página pública (loja e receitas): sem login e sem tocar no servidor de aplicação ao navegar.
   O catálogo vem de um arquivo estático (/estado-publico.json), que o Caddy serve do disco e a Cloudflare guarda em cache.
   Só o envio do pedido e da lista de espera chama a API (com limite de requisições). Estado do cliente (carrinho, pedidos
   feitos neste aparelho) fica no localStorage. Carregado antes do shared.js, então o código existente continua igual. */
(function () {
  window.JP_VAZIO = true;
  var JP_PUBLICO = window.JP_PUBLICO = {
    codigo: function () { // 6 caracteres sem 0/O/1/I/L: 32^6 combinações
      var a = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', b = new Uint8Array(6), s = '';
      (window.crypto || window.msCrypto).getRandomValues(b);
      for (var i = 0; i < 6; i++) s += a[b[i] % a.length];
      return s;
    }
  };
  var P = Storage.prototype, get = P.getItem, set = P.setItem, CH = 'jp_demo_v1', EX = 'jp_ex_v1', ENV = 'jp_enviados';

  /* catálogo atual do servidor */
  var srv = null;
  try {
    var x = new XMLHttpRequest(); x.open('GET', '/estado-publico.json', false); x.send();
    if (x.status === 200) srv = JSON.parse(x.responseText);
  } catch (e) {}
  if (srv && srv.corte) window.JP_CORTE = srv.corte;
  if (srv && srv.loja) window.JP_LOJA_CFG = srv.loja;   // horário, frete, mínimo, combos e textos editados no painel
  if (srv && srv.produtos && srv.produtos.length) {
    var st = null; try { st = JSON.parse(get.call(localStorage, CH) || 'null'); } catch (e) {}
    if (!st || typeof st !== 'object' || !st.produtos) st = { produtos: [], clientes: [], motoboys: [], pedidos: [], leads: [], notas: [], baixas: [], seq: 1000 };
    st.produtos = srv.produtos;
    try { set.call(localStorage, CH, JSON.stringify(st)); } catch (e) {}
  }

  /* envio dos pedidos e das inscrições na lista de espera */
  var enviados = {}; try { enviados = JSON.parse(get.call(localStorage, ENV) || '{}'); } catch (e) {}
  function marca(id) { enviados[id] = 1; try { set.call(localStorage, ENV, JSON.stringify(enviados)); } catch (e) {} }
  function manda(url, corpo, id) {
    fetch(url, { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })
      .then(function (r) { if (r.ok || r.status === 409 || r.status === 400) marca(id); }).catch(function () {});
  }
  function varre() {
    try {
      var s = JSON.parse(get.call(localStorage, CH) || '{}');
      (s.pedidos || []).forEach(function (p) { if (p.origemSite && p.id && !enviados[p.id]) manda('/api/pedidos', p, p.id); });
      var e = JSON.parse(get.call(localStorage, EX) || '{}');
      ((e.espera || {}).inscritos || []).forEach(function (i) { if (i.id && !enviados[i.id]) manda('/api/espera', i, i.id); });
    } catch (er) {}
  }
  P.setItem = function (k) {
    var r = set.apply(this, arguments);
    if (this === window.localStorage && (k === CH || k === EX)) setTimeout(varre, 50);
    return r;
  };
  window.addEventListener('load', function () { setTimeout(varre, 1500); });
  setInterval(varre, 60000); // reenvia o que falhou por rede
})();
