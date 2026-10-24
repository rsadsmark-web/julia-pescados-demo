/* Júlia Pescados — tela do entregador (abre pelo link /e/<token>, sem app e sem login).
   Compartilha a posição a cada poucos segundos, guarda numa fila quando falta sinal e manda tudo quando volta. */
(function () {
  var TOKEN = location.pathname.split('/')[2] || '', API = '/api/e/' + encodeURIComponent(TOKEN);
  var E = window.JPE, $ = function (id) { return document.getElementById(id); };
  var CHAVE_FILA = 'jpe_fila_' + TOKEN.slice(0, 12);
  var estado = null, mapa = null, pinMoto = null, pinCasa = null, watchId = null, fila = [], ultimoEnviado = null, ultimoAceito = null, ultimoGps = 0;
  var enviando = false, falhasRede = 0, timerEnvio = null, timerSinal = null, wake = null, parado = false;

  function mostra(ids) { ['carregando', 'erro', 'app'].forEach(function (i) { $(i).classList.toggle('ent-oculto', ids !== i); }); }
  function erro(titulo, texto) { pararGps(); mostra('erro'); $('erroTitulo').textContent = titulo; $('erroTexto').textContent = texto; }
  function faixa(tipo, texto) { var f = $('faixa'); f.className = 'ent-faixa ' + tipo + (texto ? '' : ' ent-oculto'); f.textContent = texto || ''; }
  function api(caminho, corpo) {
    var opc = corpo === undefined ? { credentials: 'omit' } : { method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) };
    return fetch(API + caminho, opc).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { j.http = r.status; return j; }); });
  }

  /* ---------- fila offline (sobrevive a fechar e abrir a tela) ---------- */
  function lerFila() { try { fila = JSON.parse(localStorage.getItem(CHAVE_FILA) || '[]'); } catch (e) { fila = []; } }
  function gravaFila() { try { localStorage.setItem(CHAVE_FILA, JSON.stringify(fila)); } catch (e) {} }

  /* ---------- envio ---------- */
  function agendaEnvio(ms) { clearTimeout(timerEnvio); timerEnvio = setTimeout(envia, ms); }
  function envia() {
    if (enviando || !fila.length || parado) return Promise.resolve();
    if (navigator.onLine === false) { avisaSinal(); return Promise.resolve(); }
    enviando = true; var lote = fila.slice(0, 50);
    return api('/posicoes', { pontos: lote }).then(function (j) {
      enviando = false;
      if (j.http === 200) { fila = fila.slice(lote.length); gravaFila(); falhasRede = 0; avisaSinal(); if (fila.length) agendaEnvio(500); return; }
      if (j.http === 409 || j.http === 410 || j.http === 404) { fila = []; gravaFila(); return encerradoPeloServidor(j); }
      if (j.http === 429) { agendaEnvio(15000); return; }
      throw new Error('http ' + j.http);
    }).catch(function () { enviando = false; falhasRede++; avisaSinal(); agendaEnvio(Math.min(60000, 4000 * Math.pow(2, Math.min(falhasRede, 4)))); });
  }
  function encerradoPeloServidor(j) {
    pararGps();
    if (j.http === 410 || j.http === 404) return erro('Link expirado', 'Este link não vale mais. Peça um novo à Júlia Pescados.');
    carrega();
  }

  /* ---------- GPS ---------- */
  function aoPosicao(pos) {
    ultimoGps = Date.now();
    var c = pos.coords, p = { lat: c.latitude, lng: c.longitude, t: pos.timestamp || Date.now(), prec: c.accuracy };
    if (c.accuracy > E.LIMITES.precisaoMaxM) { avisaSinal(); return; }
    if (!E.aceitaPonto(ultimoAceito, p)) return;
    ultimoAceito = p;
    var ll = [p.lat, p.lng];
    if (mapa) { if (!pinMoto) { pinMoto = L.marker(ll, { icon: JPM.icones.moto() }).addTo(mapa); fitTudo(); } else JPM.anima(pinMoto, ll, 1200); }
    if (E.deveEnviar(ultimoEnviado, p)) { ultimoEnviado = p; fila = E.empilha(fila, p); gravaFila(); agendaEnvio(300); }
    avisaSinal();
  }
  function aoErroGps(err) {
    if (err && err.code === 1) { faixa('erro', 'A localização está bloqueada. Toque no cadeado ao lado do endereço do site, permita a localização e recarregue a página.'); $('iniciar').disabled = false; return; }
    if (err && err.code === 3) { avisaSinal(); return; }
    avisaSinal();
  }
  function ligaGps() {
    if (!navigator.geolocation) { faixa('erro', 'Este navegador não consegue compartilhar a localização. Abra o link no Chrome ou no Safari.'); return false; }
    if (watchId != null) return true;
    watchId = navigator.geolocation.watchPosition(aoPosicao, aoErroGps, { enableHighAccuracy: true, maximumAge: 3000, timeout: 25000 });
    pedeTelaLigada(); clearInterval(timerSinal); timerSinal = setInterval(avisaSinal, 5000);
    return true;
  }
  function pararGps() {
    parado = true; clearInterval(timerSinal); clearTimeout(timerEnvio);
    if (watchId != null && navigator.geolocation) navigator.geolocation.clearWatch(watchId);
    watchId = null; if (wake) { try { wake.release(); } catch (e) {} wake = null; }
  }
  function pedeTelaLigada() { // sem isto o celular apaga a tela e o navegador para de mandar a posição
    if (navigator.wakeLock && navigator.wakeLock.request) navigator.wakeLock.request('screen').then(function (w) { wake = w; }).catch(function () {});
  }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && watchId != null) { pedeTelaLigada(); envia(); } });
  window.addEventListener('online', function () { falhasRede = 0; envia(); avisaSinal(); });
  window.addEventListener('offline', avisaSinal);

  function avisaSinal() {
    if (!estado || estado.estado !== 'em_rota') return;
    var idadeGps = (Date.now() - ultimoGps) / 1000, texto, tipo = 'ok';
    if (navigator.onLine === false) { tipo = 'aviso'; texto = 'Sem internet. Guardando ' + fila.length + ' ponto(s); envio assim que o sinal voltar.'; }
    else if (!ultimoGps) { tipo = 'aviso'; texto = 'Procurando o sinal de GPS… vá para um lugar aberto.'; }
    else if (idadeGps > 40) { tipo = 'aviso'; texto = 'GPS sem sinal há ' + Math.round(idadeGps) + ' s.'; }
    else if (falhasRede) { tipo = 'aviso'; texto = 'Internet instável. ' + fila.length + ' ponto(s) na fila.'; }
    else texto = 'Compartilhando a localização com o cliente.';
    faixa(tipo, texto);
    $('sinal').textContent = fila.length ? fila.length + ' ponto(s) esperando envio' : 'Tudo enviado.';
  }

  /* ---------- tela ---------- */
  function fitTudo() { if (!mapa) return; var pts = [[estado.destino.lat, estado.destino.lng]]; if (pinMoto) pts.push(pinMoto.getLatLng()); try { mapa.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 16 }); } catch (e) {} }
  function desenha() {
    var s = estado, em = s.estado === 'em_rota', fim = s.estado === 'entregue' || s.estado === 'cancelado';
    $('pedidoTitulo').textContent = 'Pedido ' + s.pedido + ' — ' + (s.cliente || 'cliente');
    $('endereco').textContent = s.endereco || s.bairro || 'Endereço não informado';
    $('detalhes').textContent = [s.bairro, s.obs].filter(Boolean).join(' · ');
    $('aproximado').classList.toggle('ent-oculto', s.destino.exato);
    $('rotaExterna').href = 'https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=' + s.destino.lat + ',' + s.destino.lng;
    var podeIniciar = s.podeIniciar && !em;
    $('privacidade').classList.toggle('ent-oculto', !podeIniciar);
    $('iniciar').classList.toggle('ent-oculto', !podeIniciar);
    $('emRota').classList.toggle('ent-oculto', !em);
    $('falha').classList.add('ent-oculto');
    $('fim').classList.toggle('ent-oculto', !fim && s.estado !== 'falhou');
    $('fim').textContent = s.estado === 'entregue' ? 'Entrega concluída. A sua localização não está mais sendo compartilhada. Obrigado!' : s.estado === 'cancelado' ? 'Este pedido foi cancelado. Não faça a entrega. A localização está desligada.' : s.estado === 'falhou' ? 'Entrega marcada como não realizada. A localização está desligada. Falta só a Júlia liberar uma nova tentativa.' : '';
    if (s.estado === 'aguardando' && !s.podeIniciar) faixa('aviso', 'O pedido ainda está sendo preparado. Esta tela libera sozinha quando a Júlia marcar como pronto.');
    else if (!em) faixa('', '');
    if (mapa && !pinCasa) pinCasa = L.marker([s.destino.lat, s.destino.lng], { icon: JPM.icones.casa() }).addTo(mapa);
    if (mapa && !em) mapa.setView([s.destino.lat, s.destino.lng], 15);
  }

  function carrega() {
    return api('').then(function (j) {
      if (j.http === 404) return erro('Link não encontrado', 'Confira se copiou o endereço inteiro, ou peça um novo à Júlia Pescados.');
      if (j.http === 410) return erro('Link expirado', 'Este link não vale mais. Peça um novo à Júlia Pescados.');
      if (j.http !== 200) throw new Error('http ' + j.http);
      estado = j; mostra('app'); parado = j.estado !== 'em_rota';
      var pronto = mapa ? Promise.resolve() : JPM.cria($('mapa')).then(function (m) { mapa = m; });
      return pronto.catch(function () { faixa('aviso', 'Não consegui carregar o mapa. Use a rota no aplicativo de mapas; o compartilhamento continua funcionando.'); }).then(function () {
        desenha();
        if (j.estado === 'em_rota') { parado = false; lerFila(); ligaGps(); envia(); }
        else if (j.estado === 'aguardando') setTimeout(carrega, 15000); // espera a Júlia marcar "pronto"
      });
    }).catch(function () { mostra('erro'); $('erroTitulo').textContent = 'Sem conexão'; $('erroTexto').textContent = 'Não consegui falar com o servidor. Confira a internet; vou tentar de novo.'; setTimeout(carrega, 8000); });
  }

  $('iniciar').addEventListener('click', function () {
    var b = this; b.disabled = true; faixa('', '');
    if (!navigator.geolocation) { b.disabled = false; return faixa('erro', 'Este navegador não consegue compartilhar a localização. Abra o link no Chrome ou no Safari.'); }
    if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') { b.disabled = false; return faixa('erro', 'A localização só funciona em endereço seguro (https).'); }
    // pede a permissão primeiro: se o motorista negar, nada é iniciado no servidor
    navigator.geolocation.getCurrentPosition(function () {
      api('/iniciar', { aceite: true }).then(function (j) {
        if (j.http !== 200) { b.disabled = false; return faixa('erro', j.erro || 'Não foi possível iniciar agora.'); }
        parado = false; ultimoEnviado = null; ultimoAceito = null; ultimoGps = 0; fila = []; gravaFila();
        carrega();
      }).catch(function () { b.disabled = false; faixa('erro', 'Sem conexão para iniciar. Tente de novo.'); });
    }, function (err) { b.disabled = false; aoErroGps(err); if (!err || err.code !== 1) faixa('aviso', 'Ainda sem sinal de GPS. Vá para um lugar aberto e toque de novo.'); }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 });
  });

  function terminar(caminho, corpo, botao) {
    botao.disabled = true;
    var antes = fila.length ? envia() : Promise.resolve();
    Promise.resolve(antes).then(function () { return api(caminho, corpo); }).then(function (j) {
      botao.disabled = false;
      if (j.http === 200 || j.http === 409) { pararGps(); fila = []; gravaFila(); return carrega(); }
      faixa('erro', j.erro || 'Não consegui registrar. Tente de novo.');
    }).catch(function () { botao.disabled = false; faixa('erro', 'Sem internet. Tente de novo quando o sinal voltar.'); });
  }
  $('concluir').addEventListener('click', function () { terminar('/concluir', {}, this); });
  $('abreFalha').addEventListener('click', function () { $('falha').classList.toggle('ent-oculto'); });
  $('confirmaFalha').addEventListener('click', function () { terminar('/falhar', { motivo: $('motivo').value }, this); });

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/e-sw.js', { scope: '/e/' }).catch(function () {});
  if (!TOKEN) erro('Link não encontrado', 'Peça um novo à Júlia Pescados.'); else carrega();
})();
