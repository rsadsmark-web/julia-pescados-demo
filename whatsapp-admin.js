/* Painel do WhatsApp (uazapi): estado da integração, travas de envio e últimas mensagens. Tudo nasce desligado. */
(function () {
  var ctx = null, tela = null;
  var esc = function (t) { return ctx.esc(t); };
  var H = { 'Content-Type': 'application/json', 'x-jp': '1' };
  function admin() { return !window.JP_USUARIO || window.JP_USUARIO.papel === 'admin'; }
  function api(url, opcoes) { return fetch(url, opcoes).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { j._ok = r.ok; return j; }); }); }
  function selo(ok, sim, nao) { return '<span class="chip ' + (ok ? 'ok' : 'alerta') + '">' + (ok ? sim : nao) + '</span>'; }
  function num(id, rot, v, min, max) { return '<div class="campo"><label for="' + id + '">' + rot + '</label><input id="' + id + '" type="number" min="' + min + '" max="' + max + '" value="' + esc(v) + '"' + (admin() ? '' : ' disabled') + '></div>'; }
  var ROT = { fila: 'Na fila', enviada: 'Enviada', entregue: 'Entregue', lida: 'Lida', falhou: 'Falhou', bloqueado: 'Bloqueada' };

  function render(t) {
    tela = t;
    tela.innerHTML = '<div class="cab"><div><h1>WhatsApp</h1><p>Conexão com a uazapi e travas de segurança. Enquanto estiver desligado, nenhuma mensagem sai para clientes.</p></div></div><div id="waCorpo"><p class="vazio">Carregando…</p></div>';
    carrega();
  }
  function carrega() {
    Promise.all([api('/api/whatsapp/estado'), api('/api/whatsapp/saida')]).then(function (r) { desenha(r[0], r[1]); }).catch(function () { var c = document.getElementById('waCorpo'); if (c) c.innerHTML = '<div class="banner alerta">Não foi possível ler o estado do WhatsApp.</div>'; });
  }
  function desenha(e, saida) {
    var c = document.getElementById('waCorpo'); if (!c || !e.cfg) return;
    var cfg = e.cfg;
    c.innerHTML =
      '<div class="banner ' + (e.ligadoEfetivo ? 'info' : 'alerta') + '"><div><b>' + (e.ligadoEfetivo ? (cfg.teste ? 'Ligado em modo teste: só os números de teste recebem.' : 'LIGADO: mensagens saem para clientes.') : 'Desligado: nada é enviado.') + '</b> ' +
      (e.ligadoEfetivo ? '' : 'Para ligar são necessários: liberação no servidor, credencial da uazapi e a chave geral abaixo.') + '</div></div>' +
      '<div class="kpis">' + [['Enviadas (24 h)', e.enviadas24h + ' de ' + e.limiteEfetivo], ['Na fila', e.naFila], ['Bloqueadas (24 h)', e.bloqueadas24h], ['Falhas seguidas', e.falhasSeguidas + (e.falhasSeguidas >= cfg.pausaFalhas ? ' (pausado)' : '')], ['Pediram para sair', e.optouts]]
        .map(function (k) { return '<div class="kpi"><span>' + k[0] + '</span><b>' + k[1] + '</b></div>'; }).join('') + '</div>' +
      '<div class="painel"><h2>Estado da integração</h2><div class="acoes" style="gap:14px;align-items:center">' +
      'Liberação no servidor ' + selo(e.liberadoServidor, 'liberada', 'não liberada') + ' Credencial uazapi ' + selo(e.credenciais, 'configurada', 'pendente') + ' Webhook ' + selo(e.webhookConfigurado, 'configurado', 'pendente') + ' Chave geral ' + selo(cfg.ligado, 'ligada', 'desligada') + '</div>' +
      (admin() ? '<div class="acoes" style="margin-top:12px"><button class="btn ' + (cfg.ligado ? 'claro' : '') + '" type="button" id="waGeral">' + (cfg.ligado ? 'Desligar chave geral' : 'Ligar chave geral') + '</button></div>' : '') + '</div>' +
      '<div class="painel" style="margin-top:18px"><h2>Travas de segurança <small>valem no servidor, não só nesta tela</small></h2>' +
      '<label class="chk"><input type="checkbox" id="waTeste"' + (cfg.teste ? ' checked' : '') + (admin() ? '' : ' disabled') + '> Modo teste: só os números abaixo recebem</label>' +
      '<div class="campo"><label for="waNums">Números de teste (um por linha, no máximo 10)</label><textarea id="waNums" rows="3"' + (admin() ? '' : ' disabled') + '>' + esc((cfg.numerosTeste || []).join('\n')) + '</textarea></div>' +
      '<div class="lja-grade2">' + num('waIni0', 'Campanhas a partir de (HH:MM)', cfg.inicio, 0, 0).replace('type="number" min="0" max="0"', 'type="text" pattern="[0-2][0-9]:[0-5][0-9]"') +
      num('waFim0', 'Campanhas até (HH:MM)', cfg.fim, 0, 0).replace('type="number" min="0" max="0"', 'type="text" pattern="[0-2][0-9]:[0-5][0-9]"') +
      num('waMin', 'Intervalo mínimo entre campanhas (s)', cfg.intervaloMin, 5, 600) + num('waMax', 'Intervalo máximo (s)', cfg.intervaloMax, 5, 1200) +
      num('waLim', 'Limite diário de campanhas', cfg.limiteDia, 1, 250) + num('waDia', 'Dia do aquecimento do número', cfg.diaAquecimento, 1, 365) + '</div>' +
      '<p class="lja-dica">Aquecimento: até o 3º dia 20 mensagens, até o 7º 50, até o 14º 100 e depois o limite diário. Quem responder SAIR não recebe mais campanhas. Depois de ' + cfg.pausaFalhas + ' falhas seguidas o envio pausa sozinho. Respostas 1 a 1 não têm horário, mas respeitam modo teste e chave geral.</p>' +
      (admin() ? '<button class="btn" type="button" id="waSalva">Salvar travas</button>' : '<p class="lja-dica">Só o administrador altera as travas.</p>') + '</div>' +
      '<div class="painel" style="margin-top:18px"><h2>Últimas mensagens <small>as 50 mais recentes</small></h2><div class="rolagem"><table><thead><tr><th>Quando</th><th>Número</th><th>Tipo</th><th>Situação</th><th>Mensagem</th></tr></thead><tbody>' +
      (saida.length ? saida.map(function (x) { return '<tr><td>' + esc(new Date(x.criado).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })) + '</td><td>' + esc(x.fone) + '</td><td>' + (x.tipo === 'campanha' ? 'Campanha' : 'Resposta') + '</td><td><span class="chip ' + (x.estado === 'bloqueado' || x.estado === 'falhou' ? 'alerta' : x.estado === 'fila' ? 'cinza' : 'ok') + '">' + ROT[x.estado] + '</span>' + (x.motivo ? '<small>' + esc(x.motivo) + '</small>' : '') + '</td><td>' + esc(x.texto) + '</td></tr>'; }).join('') : '<tr><td colspan="5" style="text-align:center;color:var(--suave);padding:20px">Nenhuma mensagem registrada ainda.</td></tr>') + '</tbody></table></div></div>' +
      '<div class="painel" style="margin-top:18px"><h2>Como ligar (equipe RS Tech)</h2><ol class="lja-dica"><li>Criar a instância na uazapi e ler o QR Code com o número da Júlia.</li><li>No servidor: UAZAPI_URL, UAZAPI_TOKEN e UAZAPI_WEBHOOK_SECRET no .env; apontar o webhook da instância para /api/uazapi/webhook/&lt;segredo&gt;.</li><li>Testar em modo teste com o número de um responsável. Só depois colocar WHATSAPP_LIBERADO=sim e desligar o modo teste.</li></ol></div>';
  }
  function salva(extra) {
    var corpo = extra || {
      teste: document.getElementById('waTeste').checked, numerosTeste: document.getElementById('waNums').value,
      inicio: document.getElementById('waIni0').value, fim: document.getElementById('waFim0').value,
      intervaloMin: +document.getElementById('waMin').value, intervaloMax: +document.getElementById('waMax').value,
      limiteDia: +document.getElementById('waLim').value, diaAquecimento: +document.getElementById('waDia').value
    };
    api('/api/whatsapp/config', { method: 'PUT', headers: H, body: JSON.stringify(corpo) }).then(function (j) { ctx.toast(j._ok ? 'Salvo.' : (j.erro || 'Não foi possível salvar.')); carrega(); });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b || !document.getElementById('waCorpo')) return;
    if (b.id === 'waSalva') salva();
    else if (b.id === 'waGeral') {
      var ligar = /Ligar/.test(b.textContent);
      if (ligar && !window.confirm('Ligar a chave geral do WhatsApp? Com o modo teste ligado, só os números de teste recebem.')) return;
      salva({ ligado: ligar });
    }
  });
  window.WAA = { init: function (c) { ctx = c; }, render: render };
})();
