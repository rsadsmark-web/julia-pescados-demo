/* Júlia Pescados — rastreio de entrega no painel: gera os links, mostra no mapa a posição real dos entregadores,
   aplica no pedido o que o entregador marcou (saiu, entregue, não entregue) e avisa o servidor quando o pedido é cancelado. */
(function () {
  var ctx = null, lista = [], camada = null, ultimoSync = '', timer = null;
  var CORES = ['#9c2417', '#0b4a5c', '#e0861a', '#1d7a43', '#6b3fa0'];

  function esc(t) { return ctx ? ctx.esc(t) : String(t); }
  function api(caminho, opc) {
    opc = opc || {}; var o = { credentials: 'same-origin', method: opc.corpo ? 'POST' : 'GET' };
    if (opc.corpo) { o.headers = { 'Content-Type': 'application/json', 'X-JP': '1' }; o.body = JSON.stringify(opc.corpo); }
    return fetch('/api/rastreios' + caminho, o).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { j.http = r.status; return j; }); });
  }
  function doPedido(id) { return lista.filter(function (r) { return r.pedido === id; })[0]; }
  function pedido(id) { return ctx.estado().pedidos.filter(function (p) { return p.id === id; })[0]; }

  function temReal(id) { var r = doPedido(id); return !!(r && r.estado === 'em_rota' && r.posicao); }

  /* ---------- botão na linha do pedido ---------- */
  function botao(p) {
    if (p.tipo !== 'entrega' || !p.motoboy) return '';
    var st = window.JPD.statusDe(p); if (['confirmado', 'separando', 'pronto', 'saiu', 'falhou'].indexOf(st) < 0) return '';
    var r = doPedido(p.id), rot = r ? { aguardando: 'Rastreio', em_rota: 'Ao vivo', entregue: 'Rastreio', falhou: 'Rastreio', cancelado: 'Rastreio' }[r.estado] : 'Rastreio';
    return '<button class="btn pequeno claro" type="button" data-rast="' + esc(p.id) + '">' + rot + '</button>';
  }

  /* ---------- mapa com as posições reais ---------- */
  function desenha(mapa) {
    if (!mapa || !window.L) return;
    if (!camada || camada._mapa !== mapa) { if (camada) camada.remove(); camada = L.layerGroup().addTo(mapa); camada._mapa = mapa; }
    if (camada._v === versao && camada._n === lista.length) return; // nada novo desde o último desenho
    camada._v = versao; camada._n = lista.length; camada.clearLayers();
    lista.filter(function (r) { return r.estado === 'em_rota'; }).forEach(function (r, i) {
      var cor = CORES[i % CORES.length];
      if (r.rota && r.rota.length > 1) L.polyline(r.rota, { color: cor, weight: 3, opacity: .45, dashArray: '2 8' }).addTo(camada);
      if (r.trilha && r.trilha.length > 1) L.polyline(r.trilha, { color: cor, weight: 4, opacity: .8 }).addTo(camada);
      L.marker([r.destino.lat, r.destino.lng], { icon: JPM.icones.casa() }).addTo(camada).bindTooltip(r.pedido + ' · ' + (r.bairro || '') + (r.destino.exato ? '' : ' (aproximado)'));
      if (r.posicao) {
        var eta = r.etaSeg != null ? ' · ' + JPE.textoEta(r.etaSeg) : '';
        L.marker([r.posicao.lat, r.posicao.lng], { icon: JPM.icones.moto(cor) }).addTo(camada).bindTooltip((r.entregador || '') + ' → ' + r.pedido + eta + (r.semSinal ? ' · sem sinal' : ''));
      }
    });
    var el = document.getElementById('rastAviso');
    var sem = lista.filter(function (r) { return r.semSinal; });
    if (el) el.innerHTML = sem.length ? '<div class="rast-sem-sinal">Sem sinal do entregador: ' + sem.map(function (r) { return esc(r.entregador || '') + ' (' + esc(r.pedido) + ')'; }).join(', ') + '. Confira se a tela do celular dele está aberta.</div>' : '';
    if (!camada._ajustou) { var pts = lista.filter(function (r) { return r.posicao; }).map(function (r) { return [r.posicao.lat, r.posicao.lng]; }); if (pts.length) { try { mapa.fitBounds(L.latLngBounds(pts.concat(lista.filter(function (r) { return r.posicao; }).map(function (r) { return [r.destino.lat, r.destino.lng]; }))), { padding: [30, 30], maxZoom: 15 }); } catch (e) {} camada._ajustou = true; } }
  }

  /* ---------- ciclo: busca, aplica eventos, sincroniza ---------- */
  var aplicando = {}, versao = 0;
  function assinatura(l) { return l.map(function (r) { return r.pedido + ':' + r.estado + ':' + (r.evento || ''); }).join('|'); }
  function aplicaEventos() {
    lista.forEach(function (r) {
      if (!r.evento || aplicando[r.pedido + r.evento]) return;
      var p = pedido(r.pedido); if (!p) return;
      var para = { saiu: 'saiu', entregue: 'entregue', falhou: 'falhou' }[r.evento]; if (!para) return;
      aplicando[r.pedido + r.evento] = true;
      var st = window.JPD.statusDe(p);
      if (st !== para) ctx.mudaStatus(p.id, para, { motivo: r.eventoMotivo || '', por: 'entregador ' + (r.entregador || '') });
      api('/' + encodeURIComponent(r.pedido) + '/aplicado', { corpo: { evento: r.evento } }).then(function () { delete aplicando[r.pedido + r.evento]; });
    });
  }
  function sincroniza() {
    var itens = lista.map(function (r) { var p = pedido(r.pedido); return p ? { id: p.id, status: window.JPD.statusDe(p) } : null; }).filter(Boolean);
    var assin = JSON.stringify(itens); if (assin === ultimoSync || !itens.length) return;
    api('/sincroniza', { corpo: { pedidos: itens } }).then(function (j) { if (j.http === 200) ultimoSync = assin; });
  }
  function ciclo() {
    if (document.visibilityState === 'hidden') return;
    api('').then(function (j) {
      if (j.http !== 200 || !Array.isArray(j) || !window.JPD) return;
      var antes = assinatura(lista); lista = j; versao++;
      ctx.recarrega(); aplicaEventos(); sincroniza();
      if (assinatura(lista) !== antes && ctx.modulo() === 'pedidos') ctx.redesenha(); // a tabela só é refeita quando algum rastreio muda de estado
    }).catch(function () {});
  }

  /* ---------- janela de links ---------- */
  var janela = null;
  function fecha() { if (janela) { janela.remove(); janela = null; } }
  function copia(texto, btn) {
    var ok = function () { var t = btn.textContent; btn.textContent = 'Copiado'; setTimeout(function () { btn.textContent = t; }, 1500); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(texto).then(ok, function () { ctx.toast('Não consegui copiar; selecione o texto e copie.'); });
    else { var i = document.createElement('input'); i.value = texto; document.body.appendChild(i); i.select(); try { document.execCommand('copy'); ok(); } catch (e) {} i.remove(); }
  }
  function abreJanela(id, links) {
    fecha(); var p = pedido(id); if (!p) return; var r = doPedido(id);
    var moto = ctx.estado().motoboys.filter(function (m) { return m.id === p.motoboy; })[0];
    var estados = { aguardando: 'Links criados. Aguardando o entregador iniciar.', em_rota: 'Entrega em andamento, compartilhando a localização.', entregue: 'Entregue.', falhou: 'Entrega não realizada.', cancelado: 'Cancelado.' };
    var h = '<div class="rast-fundo" role="dialog" aria-modal="true" aria-labelledby="rastTit"><div class="rast-caixa"><h2 id="rastTit">Rastreio do pedido ' + esc(p.id) + '</h2>' +
      '<p>' + esc(p.cliente) + ' · ' + esc(p.bairro || '') + ' · entregador: <b>' + esc(moto ? moto.nome : '—') + '</b></p>' +
      (r ? '<p><b>' + esc(estados[r.estado] || r.estado) + '</b></p>' : '<p>Ainda não há rastreio para este pedido.</p>');
    if (links) {
      h += '<p>Link do <b>entregador</b> (mande para ' + esc(moto ? moto.nome : 'o entregador') + '; ele toca em “Iniciar entrega”):</p><div class="rast-link"><input readonly value="' + esc(links.linkEntregador) + '" aria-label="Link do entregador"><button class="btn pequeno" type="button" data-copia="' + esc(links.linkEntregador) + '">Copiar</button></div>' +
        '<p>Link de <b>acompanhamento do cliente</b>:</p><div class="rast-link"><input readonly value="' + esc(links.linkCliente) + '" aria-label="Link do cliente"><button class="btn pequeno" type="button" data-copia="' + esc(links.linkCliente) + '">Copiar</button></div>' +
        '<div class="rast-aviso">O link do cliente só deve ser enviado pelo WhatsApp quando o WhatsApp da loja estiver liberado. Não vale mais depois de 12 horas ou 30 minutos após a entrega.' + (links.aproximado ? ' <b>Atenção:</b> o endereço não foi localizado com precisão; o ponto no mapa é o centro do bairro.' : '') + '</div>';
    } else if (r && r.estado === 'em_rota') {
      h += '<p>A entrega está em andamento, então os links não podem ser trocados. Se o entregador perdeu o link, ele pode reabrir a mensagem enviada.</p>';
    } else if (r && ['aguardando', 'falhou'].indexOf(r.estado) >= 0) {
      h += '<div class="rast-aviso">Por segurança, os links só aparecem na hora em que são gerados. Se perdeu, gere novos (os antigos deixam de valer).</div>';
    }
    h += '<div class="rast-acoes">' + (!r || r.estado !== 'em_rota' ? '<button class="btn" type="button" data-gera="' + esc(p.id) + '">' + (r && r.estado !== 'entregue' && r.estado !== 'cancelado' ? 'Gerar novos links' : 'Gerar links') + '</button>' : '') + '<button class="btn claro" type="button" data-fecha-rast>Fechar</button></div></div></div>';
    var d = document.createElement('div'); d.innerHTML = h; janela = d.firstChild; document.body.appendChild(janela);
    var b = janela.querySelector('button'); if (b) b.focus();
  }
  function gera(id) {
    var p = pedido(id), moto = ctx.estado().motoboys.filter(function (m) { return m.id === p.motoboy; })[0];
    var bairro = window.JP.BAIRROS.filter(function (x) { return x.nome === p.bairro; })[0] || {};
    var corpo = { pedido: p.id, entregadorId: p.motoboy, entregadorNome: moto ? moto.nome : '', cliente: p.cliente, bairro: p.bairro, endereco: p.endereco, obs: p.obs, lat: bairro.lat, lng: bairro.lng, precisao: 'bairro', statusPedido: window.JPD.statusDe(p) };
    ctx.toast('Gerando os links…');
    api('', { corpo: corpo }).then(function (j) {
      if (j.http !== 201) { ctx.toast(j.erro || 'Não foi possível gerar o rastreio.'); return; }
      lista = lista.filter(function (x) { return x.pedido !== id; }); lista.push(j); versao++;
      abreJanela(id, j); ctx.redesenha();
    }).catch(function () { ctx.toast('Sem conexão com o servidor.'); });
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('[data-rast],[data-gera],[data-copia],[data-fecha-rast]') : null; if (!t) { if (janela && e.target.classList && e.target.classList.contains('rast-fundo')) fecha(); return; }
    if (t.dataset.rast) abreJanela(t.dataset.rast); else if (t.dataset.gera) gera(t.dataset.gera); else if (t.dataset.copia) copia(t.dataset.copia, t); else fecha();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') fecha(); });

  function init(c) { ctx = c; ciclo(); clearInterval(timer); timer = setInterval(ciclo, 6000); }
  window.JPEA = { init: init, botao: botao, desenha: desenha, temReal: temReal, lista: function () { return lista; } };
})();
