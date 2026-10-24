/* Júlia Pescados — guarda o estado do sistema no servidor (Postgres) em vez do localStorage do navegador.
   Carrega as chaves compartilhadas de forma síncrona antes dos demais scripts, então o código existente continua igual.
   Chaves por aparelho (carrinho, último pedido etc.) seguem no localStorage normal. */
(function () {
  var CHAVES = { jp_demo_v1: 1, jp_crm_v1: 1, jp_ex_v1: 1, jp_pv_v1: 1, jp_rs_ia_v1: 1 };
  var mem = {}, versao = {}, sujo = {}, enviando = {}, timer = null, travado = false;

  function aviso(t) {
    var d = document.getElementById('jpAvisoSrv');
    if (!d) {
      d = document.createElement('div'); d.id = 'jpAvisoSrv';
      d.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:99999;background:#7a1f12;color:#fff;padding:10px 16px;font:600 14px system-ui;text-align:center';
      (document.body || document.documentElement).appendChild(d);
    }
    d.innerHTML = t;
  }
  function irParaLogin() { location.href = '/login?next=' + encodeURIComponent(location.pathname + location.search + location.hash); }

  var x = new XMLHttpRequest();
  x.open('GET', '/api/kv', false);
  try { x.send(); } catch (e) { x = { status: 0 }; }
  if (x.status === 401) { irParaLogin(); return; }
  if (x.status === 200) {
    var r = JSON.parse(x.responseText);
    Object.keys(r).forEach(function (k) { mem[k] = r[k].valor; versao[k] = r[k].versao; });
  } else {
    document.addEventListener('DOMContentLoaded', function () { aviso('Não foi possível carregar os dados do servidor. Recarregue a página.'); });
  }

  function envia(k, keep) {
    if (enviando[k] || travado) return;
    var valor = mem[k]; delete sujo[k]; enviando[k] = true;
    fetch('/api/kv/' + encodeURIComponent(k), {
      method: 'PUT', keepalive: !!keep, credentials: 'same-origin',
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-JP': '1', 'If-Match': String(versao[k] || 0) },
      body: valor === undefined ? '' : valor
    }).then(function (res) {
      enviando[k] = false;
      if (res.status === 401) { irParaLogin(); return; }
      if (res.status === 409) { travado = true; aviso('Estes dados foram alterados em outra sessão. <a href="" style="color:#fff;text-decoration:underline">Recarregue a página</a> para continuar (suas últimas mudanças não foram salvas).'); return; }
      if (!res.ok) { sujo[k] = 1; aviso('Falha ao salvar no servidor. Tentando de novo…'); agenda(3000); return; }
      return res.json().then(function (j) { versao[k] = j.versao; if (sujo[k]) envia(k); });
    }).catch(function () { enviando[k] = false; sujo[k] = 1; agenda(3000); });
  }
  function agenda(ms) { clearTimeout(timer); timer = setTimeout(function () { Object.keys(sujo).forEach(function (k) { envia(k); }); }, ms || 300); }
  function descarrega() { Object.keys(sujo).forEach(function (k) { envia(k, true); }); }
  window.addEventListener('pagehide', descarrega);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') descarrega(); });

  /* pedidos e inscrições novos da loja: aviso no painel (entram no sistema ao recarregar) */
  function olhaEntradas() {
    if (travado || document.visibilityState === 'hidden') return;
    fetch('/api/entradas/pendentes', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (!j || !j.n) return;
      var d = document.getElementById('jpAvisoNovos');
      if (!d) {
        d = document.createElement('div'); d.id = 'jpAvisoNovos';
        d.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:99998;background:#9c2417;color:#fff;padding:12px 16px;border-radius:10px;font:600 14px system-ui;box-shadow:0 6px 24px rgba(0,0,0,.25);cursor:pointer';
        d.onclick = function () { descarrega(); setTimeout(function () { location.reload(); }, 700); };
        (document.body || document.documentElement).appendChild(d);
      }
      d.textContent = j.n + (j.n === 1 ? ' novo pedido ou inscrição da loja — clique para atualizar' : ' novos pedidos ou inscrições da loja — clique para atualizar');
    }).catch(function () {});
  }
  if (document.readyState !== 'loading') setInterval(olhaEntradas, 30000); else document.addEventListener('DOMContentLoaded', function () { olhaEntradas(); setInterval(olhaEntradas, 30000); });

  var P = Storage.prototype, get = P.getItem, set = P.setItem, rem = P.removeItem;
  P.getItem = function (k) { if (this === window.localStorage && CHAVES[k]) return mem[k] ? mem[k] : null; return get.apply(this, arguments); };
  P.setItem = function (k, v) { if (this === window.localStorage && CHAVES[k]) { mem[k] = String(v); sujo[k] = 1; agenda(); return; } return set.apply(this, arguments); };
  P.removeItem = function (k) { if (this === window.localStorage && CHAVES[k]) { mem[k] = ''; sujo[k] = 1; agenda(); return; } return rem.apply(this, arguments); };
})();
