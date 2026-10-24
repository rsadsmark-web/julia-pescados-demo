/* Júlia Pescados — regras do rastreio de entrega, sem tela e sem rede: distância, tempo estimado, filtro de pontos do GPS,
   fila offline do entregador, texto de cada estado e o que o cliente pode ver. Roda no navegador (window.JPR) e no Node. */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(); else raiz.JPR = fabrica();
})(this, function () {
  var RAIO_TERRA = 6371000;
  var LIMITES = {
    precisaoMaxM: 150,        // ponto com precisão pior que isso não entra (sinal fraco pula de quarteirão)
    velocidadeMaxMs: 45,      // 162 km/h: acima disso o salto é erro do GPS, não moto
    intervaloMinMs: 4000,     // o aparelho manda no máximo um ponto a cada 4 s
    intervaloParadoMs: 15000, // parado (menos de 15 m) manda um a cada 15 s: poupa bateria
    parouM: 15,
    trilhaMax: 40,            // pontos guardados no servidor para desenhar o rastro; apagados ao concluir
    filaMax: 200,             // pontos na fila offline do entregador
    pontoVelhoMs: 10 * 60000, // ponto com mais de 10 min não vale como posição atual
    velocidadeMediaMs: 6.1    // ~22 km/h no trânsito de Fortaleza, usada só quando a roteirização não responde
  };

  var rad = function (g) { return g * Math.PI / 180; };
  function distanciaM(a, b) { // haversine, em metros
    var dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * RAIO_TERRA * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  function coordValida(lat, lng) {
    return typeof lat === 'number' && typeof lng === 'number' && isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
  }
  // As entregas são só na região de Fortaleza e Caucaia; coordenada fora dessa caixa é erro de geocodificação ou GPS.
  var CAIXA = { latMin: -4.2, latMax: -3.4, lngMin: -39.1, lngMax: -38.2 };
  function naRegiao(p) { return coordValida(p.lat, p.lng) && p.lat >= CAIXA.latMin && p.lat <= CAIXA.latMax && p.lng >= CAIXA.lngMin && p.lng <= CAIXA.lngMax; }

  // Tempo estimado sem roteirização: linha reta × 1,3 (rua) ÷ velocidade média.
  function etaLinhaReta(de, para) {
    var m = distanciaM(de, para) * 1.3;
    return { distM: Math.round(m), segundos: Math.round(m / LIMITES.velocidadeMediaMs), origem: 'estimado' };
  }

  // Lê um ponto vindo do aparelho e devolve {ok, ponto} limpo ou {ok:false, erro}.
  function lePonto(b, agora) {
    b = b || {}; agora = agora || Date.now();
    var lat = +b.lat, lng = +b.lng, t = +b.t, prec = b.prec == null ? null : +b.prec;
    if (!naRegiao({ lat: lat, lng: lng })) return { ok: false, erro: 'posição fora da região de entrega' };
    if (!isFinite(t) || t > agora + 60000) t = agora; // relógio do aparelho adiantado: vale a hora do servidor
    if (agora - t > LIMITES.pontoVelhoMs) return { ok: false, erro: 'ponto antigo' };
    if (prec != null && (!isFinite(prec) || prec < 0)) prec = null;
    if (prec != null && prec > LIMITES.precisaoMaxM) return { ok: false, erro: 'precisão ruim' };
    return { ok: true, ponto: { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6, t: Math.round(t), prec: prec == null ? null : Math.round(prec) } };
  }

  // Aceita o ponto novo? Barra salto impossível (erro de GPS) e ponto fora de ordem.
  function aceitaPonto(ultimo, novo) {
    if (!ultimo) return true;
    if (novo.t <= ultimo.t) return false;
    var dt = (novo.t - ultimo.t) / 1000, d = distanciaM(ultimo, novo);
    return d / dt <= LIMITES.velocidadeMaxMs || d < 80;
  }

  // O aparelho deve enviar este ponto agora? (economia de bateria: parado, manda menos)
  function deveEnviar(ultimoEnviado, novo) {
    if (!ultimoEnviado) return true;
    var dt = novo.t - ultimoEnviado.t; if (dt < LIMITES.intervaloMinMs) return false;
    return distanciaM(ultimoEnviado, novo) >= LIMITES.parouM || dt >= LIMITES.intervaloParadoMs;
  }

  // Fila offline: guarda até filaMax pontos, descartando os mais antigos; junta pontos quase iguais.
  function empilha(fila, ponto) {
    fila = fila.slice();
    var u = fila[fila.length - 1];
    if (u && ponto.t - u.t < LIMITES.intervaloMinMs) return fila;
    fila.push(ponto);
    while (fila.length > LIMITES.filaMax) fila.shift();
    return fila;
  }

  // Trilha para o rastro no mapa: mantém só os últimos pontos.
  function adicionaTrilha(trilha, ponto) {
    var t = (trilha || []).slice(); t.push([ponto.lat, ponto.lng, ponto.t]);
    return t.length > LIMITES.trilhaMax ? t.slice(t.length - LIMITES.trilhaMax) : t;
  }

  /* ---------- estados da entrega ---------- */
  // aguardando: link criado, entregador ainda não começou · em_rota · entregue · falhou · cancelado
  var ESTADOS = ['aguardando', 'em_rota', 'entregue', 'falhou', 'cancelado'];
  var TEXTO_CLIENTE = {
    aguardando: 'Seu pedido está sendo preparado. Assim que o entregador sair, você acompanha aqui.',
    em_rota: 'Seu pedido saiu para entrega.',
    entregue: 'Pedido entregue. Obrigada pela preferência!',
    falhou: 'Não conseguimos entregar. A Júlia Pescados vai entrar em contato com você.',
    cancelado: 'Este pedido foi cancelado.'
  };
  function proximoEstado(de, acao) {
    var t = {
      aguardando: { iniciar: 'em_rota', cancelar: 'cancelado' },
      em_rota: { concluir: 'entregue', falhar: 'falhou', cancelar: 'cancelado' },
      falhou: { iniciar: 'em_rota', cancelar: 'cancelado' },
      entregue: {}, cancelado: {}
    };
    return (t[de] || {})[acao] || null;
  }

  // Frase do tempo estimado para o cliente. Sem posição ainda, não inventa tempo.
  function textoEta(segundos) {
    if (segundos == null || !isFinite(segundos)) return '';
    var min = Math.max(1, Math.round(segundos / 60));
    if (min <= 2) return 'chegando';
    if (min < 60) return 'cerca de ' + min + ' min';
    var h = Math.floor(min / 60), r = min % 60;
    return 'cerca de ' + h + ' h' + (r ? ' ' + r + ' min' : '');
  }
  function textoDistancia(m) {
    if (m == null || !isFinite(m)) return '';
    return m < 950 ? Math.round(m / 10) * 10 + ' m' : (m / 1000).toFixed(1).replace('.', ',') + ' km';
  }

  /* ---------- o que cada lado pode ver ---------- */
  // Cliente: primeiro nome, estado, posição do entregador (só em rota), destino aproximado e tempo. Nunca telefone, endereço completo nem token.
  function visaoCliente(r, agora) {
    agora = agora || Date.now();
    var emRota = r.estado === 'em_rota';
    var pos = emRota && r.ult_lat != null ? { lat: r.ult_lat, lng: r.ult_lng, t: +r.ult_em } : null;
    if (pos && agora - pos.t > LIMITES.pontoVelhoMs) pos = null;
    return {
      estado: r.estado, texto: TEXTO_CLIENTE[r.estado] || '', pedido: r.pedido_id, nome: r.cliente_nome || '', bairro: r.bairro || '',
      entregador: emRota || r.estado === 'aguardando' ? (r.entregador_nome || '') : '',
      destino: r.estado === 'entregue' || r.estado === 'cancelado' ? null : { lat: r.dest_lat, lng: r.dest_lng, exato: r.dest_precisao === 'endereco' },
      posicao: pos, semSinal: emRota && !pos, atualizadoHa: pos ? Math.max(0, Math.round((agora - pos.t) / 1000)) : null,
      etaSeg: emRota && pos ? r.eta_seg : null, etaTexto: emRota && pos ? textoEta(r.eta_seg) : '', distM: emRota && pos ? r.dist_m : null,
      distTexto: emRota && pos ? textoDistancia(r.dist_m) : '', trilha: emRota ? (r.trilha || []).map(function (x) { return [x[0], x[1]]; }) : [],
      rota: emRota ? (r.rota || null) : null, motivo: r.estado === 'falhou' ? '' : undefined
    };
  }

  return { LIMITES: LIMITES, CAIXA: CAIXA, ESTADOS: ESTADOS, TEXTO_CLIENTE: TEXTO_CLIENTE, distanciaM: distanciaM, coordValida: coordValida, naRegiao: naRegiao,
    etaLinhaReta: etaLinhaReta, lePonto: lePonto, aceitaPonto: aceitaPonto, deveEnviar: deveEnviar, empilha: empilha, adicionaTrilha: adicionaTrilha,
    proximoEstado: proximoEstado, textoEta: textoEta, textoDistancia: textoDistancia, visaoCliente: visaoCliente };
});
