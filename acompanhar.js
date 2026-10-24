/* Júlia Pescados — acompanhamento do cliente (abre pelo link /r/<token>, sem login).
   Mostra o estado, o entregador no mapa e o tempo estimado; atualiza sozinho e avisa se a internet cair. */
(function () {
  var TOKEN = location.pathname.split('/')[2] || '', API = '/api/r/' + encodeURIComponent(TOKEN);
  var E = window.JPE, $ = function (id) { return document.getElementById(id); };
  var mapa = null, pinMoto = null, pinCasa = null, linhaRota = null, linhaTrilha = null, ajustou = false, mexeuNoMapa = false, falhas = 0, timer = null, ultimo = null, ultimoOk = 0;

  function mostra(id) { ['carregando', 'erro', 'app'].forEach(function (i) { $(i).classList.toggle('ent-oculto', id !== i); }); }
  function faixa(tipo, texto) { var f = $('faixa'); f.className = 'ent-faixa ' + tipo + (texto ? '' : ' ent-oculto'); f.textContent = texto || ''; }
  function fim(titulo, texto) { clearTimeout(timer); mostra('erro'); $('erroTitulo').textContent = titulo; $('erroTexto').textContent = texto; }

  function etapa(s) { return { aguardando: 2, em_rota: 3, entregue: 4, falhou: 3, cancelado: 0 }[s.estado] || 1; }
  function desenha(s) {
    var n = etapa(s);
    [].forEach.call($('etapas').children, function (li) { var i = +li.dataset.e; li.className = s.estado === 'cancelado' ? '' : i < n || n === 4 ? 'feito' : i === n ? 'atual' : ''; });
    var primeiro = (s.nome || '').split(' ')[0];
    $('titulo').textContent = (primeiro ? primeiro + ', ' : '') + ({ aguardando: 'estamos preparando o seu pedido.', em_rota: s.entregador ? s.entregador + ' está a caminho.' : 'seu pedido está a caminho.', entregue: 'seu pedido foi entregue.', falhou: 'não conseguimos entregar.', cancelado: 'este pedido foi cancelado.' }[s.estado] || '');
    if (!primeiro) $('titulo').textContent = $('titulo').textContent.charAt(0).toUpperCase() + $('titulo').textContent.slice(1);
    $('eta').classList.toggle('ent-oculto', !s.etaTexto);
    $('eta').textContent = s.etaTexto ? (s.etaTexto === 'chegando' ? 'Chegando!' : 'Chega em ' + s.etaTexto) : '';
    var det = [];
    if (s.estado === 'em_rota') {
      if (s.distTexto) det.push('A ' + s.distTexto + ' de você.');
      if (s.semSinal) det.push('Aguardando o sinal do entregador.');
      else if (s.atualizadoHa != null && s.atualizadoHa > 90) det.push('Última posição há ' + Math.round(s.atualizadoHa / 60) + ' min.');
    }
    det.push(s.texto);
    $('detalhe').textContent = det.join(' ');
    atualizaMapa(s);
  }

  function atualizaMapa(s) {
    if (!mapa) return;
    var ativo = s.estado === 'em_rota' || s.estado === 'aguardando';
    $('mapa').style.display = s.destino ? '' : 'none';
    if (s.destino && !pinCasa) pinCasa = L.marker([s.destino.lat, s.destino.lng], { icon: JPM.icones.casa() }).addTo(mapa);
    if (s.destino && !ajustou) { mapa.setView([s.destino.lat, s.destino.lng], 15); }
    if (linhaRota) { mapa.removeLayer(linhaRota); linhaRota = null; }
    if (linhaTrilha) { mapa.removeLayer(linhaTrilha); linhaTrilha = null; }
    if (s.posicao && ativo) {
      var ll = [s.posicao.lat, s.posicao.lng];
      if (s.rota && s.rota.length > 1) linhaRota = L.polyline(s.rota, { color: '#0b4a5c', weight: 4, opacity: .55, dashArray: '2 8' }).addTo(mapa);
      if (s.trilha && s.trilha.length > 1) linhaTrilha = L.polyline(s.trilha, { color: '#9c2417', weight: 4, opacity: .8 }).addTo(mapa);
      if (!pinMoto) pinMoto = L.marker(ll, { icon: JPM.icones.moto() }).addTo(mapa); else JPM.anima(pinMoto, ll, 2000);
      if (!mexeuNoMapa && s.destino) { try { mapa.fitBounds(L.latLngBounds([ll, [s.destino.lat, s.destino.lng]]), { padding: [50, 50], maxZoom: 16, animate: ajustou }); } catch (e) {} ajustou = true; }
    } else if (pinMoto) { mapa.removeLayer(pinMoto); pinMoto = null; }
  }

  function busca() {
    clearTimeout(timer);
    fetch(API, { credentials: 'omit', cache: 'no-store' }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { j.http = r.status; return j; }); }).then(function (j) {
      if (j.http === 404) return fim('Link não encontrado', 'Confira se o endereço está completo. Se precisar, peça um novo link à Júlia Pescados.');
      if (j.http === 410) return fim('Este link expirou', 'O acompanhamento deste pedido já terminou. Obrigada pela preferência!');
      if (j.http === 429) { timer = setTimeout(busca, 20000); return; }
      if (j.http !== 200) throw new Error('http ' + j.http);
      falhas = 0; ultimoOk = Date.now(); ultimo = j; mostra('app'); faixa('', ''); desenha(j);
      if (j.estado === 'entregue' || j.estado === 'cancelado') return; // nada mais muda: para de consultar
      timer = setTimeout(busca, document.visibilityState === 'hidden' ? 20000 : j.estado === 'em_rota' ? 5000 : 12000);
    }).catch(function () {
      falhas++;
      if (ultimo) { mostra('app'); faixa('aviso', 'Sem conexão. Mostrando a última posição (' + Math.round((Date.now() - ultimoOk) / 1000) + ' s atrás). Tentando de novo…'); }
      else { mostra('erro'); $('erroTitulo').textContent = 'Sem conexão'; $('erroTexto').textContent = 'Não consegui carregar o acompanhamento. Confira a internet; vou tentar de novo.'; }
      timer = setTimeout(busca, Math.min(30000, 4000 * Math.pow(2, Math.min(falhas, 3))));
    });
  }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') busca(); });
  window.addEventListener('online', busca);

  if (!TOKEN) return fim('Link não encontrado', 'Peça um novo link à Júlia Pescados.');
  JPM.cria($('mapa')).then(function (m) { mapa = m; m.on('dragstart', function () { mexeuNoMapa = true; }); if (ultimo) atualizaMapa(ultimo); }).catch(function () { $('mapa').style.display = 'none'; });
  busca();
})();
