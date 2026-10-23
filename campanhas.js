/* Campanhas (disparos em massa por WhatsApp) — demonstração.
   Nada é enviado: o envio é simulado e as travas de segurança reproduzem as regras dos disparos reais
   (chave geral, modo de teste, horário, intervalo aleatório, rodada, limite diário, aquecimento, opt-out, lote). */
(function () {
  var I = null, ACEL = 10, MAXMSG = 1000;
  var RODAPE = 'Para não receber mais mensagens, responda SAIR.';
  var VARS = { nome: 'primeiro nome', bairro: 'bairro do cliente', categoria: 'categoria na carteira' };
  var CATS = [['novo', 'Novos'], ['recorrente', 'Recorrentes'], ['vip', 'VIP'], ['inativo', 'Inativos'], ['prospect', 'Prospects']];
  var STATUS = { rascunho: ['Rascunho', 'cinza'], agendada: ['Agendada', ''], enviando: ['Enviando', 'ok'], pausada: ['Pausada', 'alerta'], concluida: ['Concluída', 'ok'], cancelada: ['Cancelada', 'perigo'] };
  var cp = { sel: null, editId: null, f: { nome: '', cats: [], etqs: [], msg: '', quando: 'ja', data: '' }, erro: '', modal: false, errCfg: '' };

  var esc = function (t) { return I.esc(t); };
  var D = function () { return I.dados(); };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var rand = function (a, b) { return a + Math.random() * (b - a); };
  var moeda = function () { return I.ctx(); };

  /* ---------- regras (as mesmas dos disparos reais) ---------- */
  function minutos(hhmm) { var p = hhmm.split(':'); return (+p[0]) * 60 + (+p[1]); }
  function minutoAgora() {
    var cfg = D().cfg;
    if (cfg.relogio) return minutos(cfg.relogio);
    var s = new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Fortaleza', hour: '2-digit', minute: '2-digit', hour12: false });
    return minutos(s.replace(/^24/, '00'));
  }
  function dentroHorario() { var cfg = D().cfg, m = minutoAgora(); return m >= minutos(cfg.inicio) && m < minutos(cfg.fim); }
  function aquecimento(dia) { return dia <= 3 ? 20 : dia <= 7 ? 50 : dia <= 14 ? 100 : 250; }
  function limiteEfetivo() { var c = D().cfg; return Math.min(c.limiteDia, aquecimento(c.diaNumero)); }
  function usadosHoje() { var corte = Date.now() - 86400000; return D().envios.filter(function (t) { return t > corte; }).length; }
  function validaCfg(a) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(a.inicio) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(a.fim) || a.inicio >= a.fim) return 'Horário inválido: o início precisa ser antes do fim, no mesmo dia.';
    if (![a.minS, a.maxS, a.rodada].every(Number.isInteger) || a.minS < 5 || a.maxS < a.minS || a.maxS > 600) return 'Intervalo inválido: mínimo de 5 segundos e o máximo não pode ser menor que o mínimo (até 600 segundos).';
    if (a.rodada < 1 || a.rodada > 10) return 'Envios por rodada: de 1 a 10.';
    if (!Number.isInteger(a.limiteDia) || a.limiteDia < 1 || a.limiteDia > 250) return 'Limite diário: de 1 a 250 mensagens a cada 24 horas.';
    if (!Number.isInteger(a.diaNumero) || a.diaNumero < 1 || a.diaNumero > 60) return 'Dias de uso do número: de 1 a 60.';
    if (!Number.isInteger(a.lote) || a.lote < 1 || a.lote > 200) return 'Limite por campanha: de 1 a 200 destinatários.';
    var n = I.digitos(a.numTeste);
    if (a.numTeste && (n.length < 10 || n.length > 13)) return 'Número de teste inválido: use DDD + número.';
    return null;
  }
  function variaveisDesconhecidas(t) { var r = []; (t.match(/\{(\w+)\}/g) || []).forEach(function (m) { var n = m.slice(1, -1); if (!VARS[n] && r.indexOf(n) < 0) r.push(n); }); return r; }
  function preenche(t, l) {
    var cat = I.catOf(l).rot;
    return t.replace(/\{nome\}/g, I.primeiro(l.nome)).replace(/\{bairro\}/g, l.bairro || 'sua região').replace(/\{categoria\}/g, cat);
  }
  function textoFinal(msg, l) { return preenche(msg, l).trim() + '\n\n' + RODAPE; }
  function erroMsg(t) {
    t = t.trim();
    if (t.length < 5) return 'A mensagem precisa ter ao menos 5 caracteres.';
    if (t.length > MAXMSG) return 'A mensagem pode ter até ' + MAXMSG + ' caracteres.';
    var d = variaveisDesconhecidas(t); if (d.length) return 'Variável desconhecida {' + d[0] + '}. Use {nome}, {bairro} ou {categoria}.';
    return null;
  }

  /* ---------- público ---------- */
  function publico(pub, cfg) {
    var agora = Date.now(), opt = D().optout, res = { total: 0, enviar: [], pulados: [] };
    D().leads.forEach(function (l) {
      var cat = I.catOf(l).cod;
      var okCat = !pub.cats.length || pub.cats.indexOf(cat) >= 0;
      var okEtq = !pub.etqs.length || l.etq.some(function (e) { return pub.etqs.indexOf(e) >= 0; });
      if (!okCat || !okEtq) return;
      res.total++;
      if (opt.indexOf(I.digitos(l.fone)) >= 0 || l.optout) res.pulados.push({ l: l, motivo: 'Pediu para sair (opt-out)' });
      else if (l.ultimoDisparo && agora - l.ultimoDisparo < 3 * 86400000) res.pulados.push({ l: l, motivo: 'Recebeu disparo há menos de 3 dias' });
      else if (res.enviar.length >= cfg.lote) res.pulados.push({ l: l, motivo: 'Acima do limite por campanha (' + cfg.lote + ')' });
      else res.enviar.push(l);
    });
    return res;
  }
  function destinatarios(res) {
    var dest = res.enviar.map(function (l) { return { id: l.id, nome: l.nome, fone: l.fone, st: 'pendente' }; });
    res.pulados.forEach(function (p) { dest.push({ id: p.l.id, nome: p.l.nome, fone: p.l.fone, st: 'pulado', motivo: p.motivo }); });
    return dest;
  }
  function stats(c) {
    var s = { total: c.dest.length, enviadas: 0, entregues: 0, respondidas: 0, falhas: 0, puladas: 0, pendentes: 0 };
    c.dest.forEach(function (r) {
      if (r.st === 'pendente') s.pendentes++;
      else if (r.st === 'pulado') s.puladas++;
      else if (r.st === 'falha') s.falhas++;
      else { s.enviadas++; if (r.st === 'entregue' || r.st === 'respondida') s.entregues++; if (r.st === 'respondida') s.respondidas++; }
    });
    return s;
  }

  /* ---------- dados de exemplo ---------- */
  function novoLog(c, t, ts) { c.log.unshift({ ts: ts || Date.now(), t: t }); if (c.log.length > 80) c.log.pop(); }
  function semear(Dd) {
    Dd.cfg = { geral: false, teste: true, numTeste: '(85) 99999-0001', inicio: '09:00', fim: '19:00', minS: 25, maxS: 60, rodada: 2, limiteDia: 250, diaNumero: 9, lote: 100, simFalha: false, relogio: '' };
    I = I || window.CRM.i;
    if (window.JP_VAZIO) { Dd.camps = []; return; }
    var h = 3600000, d = 86400000, agora = Date.now();
    function lead(n) { return Dd.leads.filter(function (l) { return l.nome === n; })[0]; }
    function camp(nome, msg, pub, status, ini) {
      var c = { id: 'cp' + Dd.seqCamp++, nome: nome, msg: msg, pub: pub, status: status, criada: ini, agenda: 0, dest: [], log: [], proximo: 0, naRodada: 0, bloqueio: '' };
      return c;
    }
    // 1) concluída há 5 dias — reativação
    var c1 = camp('Reativação — clientes inativos', 'Oi, {nome}! Faz tempo que não falamos. Esta semana o camarão chegou fresquinho, com 10% de desconto para quem voltar. Quer que eu separe um pedido?', { cats: ['inativo'], etqs: [] }, 'concluida', agora - 5 * d);
    var mapa1 = { 'Rafael Costa': 'respondida', 'Silvana Rocha': 'entregue', 'Ivan Gomes': 'entregue', 'André Lima': 'pulado' };
    Object.keys(mapa1).forEach(function (n, i) {
      var l = lead(n); if (!l) return;
      var r = { id: l.id, nome: l.nome, fone: l.fone, st: mapa1[n], ts: agora - 5 * d + i * 70000 };
      if (r.st === 'pulado') r.motivo = 'Pediu para sair (opt-out)'; else l.ultimoDisparo = r.ts;
      c1.dest.push(r);
    });
    novoLog(c1, 'Campanha concluída: 3 enviadas, 1 pulada (opt-out).', agora - 5 * d + 600000);
    // 2) pausada sozinha por 3 falhas seguidas — ontem
    var c2 = camp('Oferta de sexta — camarão e kits', 'Oi, {nome}! Sexta tem Kit Churrasco do Mar por R$ 84,90 e camarão cinza a R$ 49,90/kg. Posso reservar o seu?', { cats: ['vip', 'recorrente'], etqs: [] }, 'pausada', agora - 20 * h);
    var alvos = Dd.leads.filter(function (l) { var k = I.catOf(l).cod; return (k === 'vip' || k === 'recorrente') && !l.optout; });
    alvos.forEach(function (l, i) {
      var r = { id: l.id, nome: l.nome, fone: l.fone, st: 'pendente' };
      if (i < 5) { r.st = i === 1 ? 'respondida' : 'entregue'; r.ts = agora - 20 * h + i * 60000; l.ultimoDisparo = r.ts; Dd.envios.push(r.ts); }
      else if (i < 8) { r.st = 'falha'; r.ts = agora - 20 * h + i * 60000; r.motivo = 'Número do disparo sem conexão (simulado)'; Dd.envios.push(r.ts); }
      c2.dest.push(r);
    });
    c2.pausaAuto = '3 falhas definitivas seguidas: o disparo pausou sozinho para proteger o número.';
    novoLog(c2, 'Pausada automaticamente: 3 falhas seguidas. Confira a conexão do número antes de retomar.', agora - 20 * h + 9 * 60000);
    // 3) agendada para amanhã 09:00
    var amanha = new Date(); amanha.setDate(amanha.getDate() + 1); amanha.setHours(9, 0, 0, 0);
    var c3 = camp('Encomendas de ceia', 'Olá, {nome}! Já estamos aceitando encomendas de camarão e frutos do mar para a ceia. Quer garantir o seu com antecedência?', { cats: ['novo', 'prospect'], etqs: [] }, 'agendada', agora - 2 * h);
    c3.agenda = amanha.getTime();
    // 4) rascunho
    var c4 = camp('Atacado — tabela da semana', 'Oi, {nome}! Saiu a tabela de atacado da semana. Posso te enviar os valores?', { cats: [], etqs: ['Atacado'] }, 'rascunho', agora - 3 * h);
    Dd.camps = [c4, c3, c2, c1];
    // o público do agendamento é congelado ao agendar
    c3.dest = destinatarios(publico(c3.pub, Dd.cfg));
    novoLog(c3, 'Agendada para amanhã às 09:00. Só envia se a chave geral estiver ligada.', agora - 2 * h);
  }

  /* ---------- motor de envio simulado ---------- */
  function promove(c, now) {
    var mudou = false;
    c.dest.forEach(function (r) {
      if (r.st === 'enviada' && now >= r.entAt) { r.st = 'entregue'; mudou = true; }
      if (r.st === 'entregue' && r.respAt && now >= r.respAt) {
        r.st = 'respondida'; mudou = true;
        var l = I.lead(r.id); if (!l) return;
        if (r.sair) { l.msgs.push({ d: 'c', t: 'SAIR', ts: now }); l.nao = (l.nao || 0) + 1; window.CRM.registraOptout(l, 'Cliente respondeu SAIR à campanha “' + c.nome + '”: removido de todas as campanhas futuras.'); novoLog(c, I.primeiro(r.nome) + ' respondeu SAIR e entrou na lista de opt-out.'); }
        else { l.msgs.push({ d: 'c', t: 'Tenho interesse, pode me chamar!', ts: now }); l.nao = (l.nao || 0) + 1; novoLog(c, I.primeiro(r.nome) + ' respondeu à campanha.'); }
      }
    });
    return mudou;
  }
  function finaliza(c) {
    c.status = 'concluida'; c.bloqueio = '';
    novoLog(c, 'Campanha concluída.');
  }
  function envia(c, now) {
    var cfg = D().cfg; c.bloqueio = '';
    if (!cfg.geral) { c.bloqueio = 'Chave geral desligada: nada é enviado.'; return false; }
    if (!dentroHorario()) { c.bloqueio = 'Fora do horário permitido (' + cfg.inicio + ' às ' + cfg.fim + '). Retoma sozinha dentro da janela.'; return false; }
    if (usadosHoje() >= limiteEfetivo()) { c.bloqueio = 'Limite diário atingido (' + usadosHoje() + ' de ' + limiteEfetivo() + ' nas últimas 24 horas). Retoma quando liberar vaga.'; return false; }
    if (cfg.teste) {
      if (I.digitos(cfg.numTeste).length < 10) { c.bloqueio = 'Modo de teste ligado, mas sem número de teste cadastrado.'; return false; }
      var primeiro = c.dest.filter(function (r) { return r.st === 'pendente'; })[0];
      var amostra = primeiro ? I.lead(primeiro.id) : null;
      c.dest.unshift({ id: 'teste', nome: 'Número de teste', fone: cfg.numTeste, st: 'enviada', ts: now, entAt: now + 1500, teste: true });
      D().envios.push(now);
      c.dest.forEach(function (r) { if (r.st === 'pendente') { r.st = 'pulado'; r.motivo = 'Modo de teste ligado: só o número de teste recebe'; } });
      novoLog(c, 'MODO DE TESTE: enviada somente ao número de teste ' + cfg.numTeste + (amostra ? ' (texto de exemplo com os dados de ' + amostra.nome + ')' : '') + '. Os demais destinatários foram preservados sem envio.');
      c.nota = 'Concluída em modo de teste: nenhum cliente recebeu.';
      finaliza(c); return true;
    }
    if (now < c.proximo) return false;
    var r = c.dest.filter(function (x) { return x.st === 'pendente'; })[0];
    if (!r) { finaliza(c); return true; }
    var l = I.lead(r.id);
    if (D().optout.indexOf(I.digitos(r.fone)) >= 0 || (l && l.optout)) {
      r.st = 'pulado'; r.motivo = 'Pediu para sair: conferido de novo na hora do envio';
      novoLog(c, 'Pulado ' + r.nome + ': opt-out conferido na hora do envio.'); return true;
    }
    // reserva o destinatário ANTES de enviar: uma mensagem por pessoa, falha não repete
    r.st = 'enviada'; r.ts = now; D().envios.push(now);
    if (l) l.ultimoDisparo = now;
    var falhou = cfg.simFalha || Math.random() < 0.03;
    if (falhou) {
      r.st = 'falha'; r.motivo = cfg.simFalha ? 'Número do disparo sem conexão (simulado)' : 'Falha definitiva do provedor (simulada)';
      novoLog(c, 'FALHA ao enviar para ' + r.nome + ': ' + r.motivo + ' (não será reenviada).');
      var rec = c.dest.filter(function (x) { return x.ts; }).sort(function (a, b) { return b.ts - a.ts; }).slice(0, 3);
      if (rec.length === 3 && rec.every(function (x) { return x.st === 'falha'; })) {
        c.status = 'pausada'; c.pausaAuto = '3 falhas definitivas seguidas: o disparo pausou sozinho para proteger o número.';
        novoLog(c, 'PAUSADA automaticamente: 3 falhas seguidas.');
        return true;
      }
    } else {
      r.entAt = now + 1500;
      if (Math.random() < 0.32) { r.respAt = now + rand(6000, 22000); r.sair = Math.random() < 0.1; }
      if (l) l.msgs.push({ d: 'j', t: textoFinal(c.msg, l), ts: now, st: 'entregue', camp: c.nome });
    }
    c.naRodada = (c.naRodada || 0) + 1;
    var esperaMs;
    if (c.naRodada >= cfg.rodada) { c.naRodada = 0; esperaMs = 60000 / ACEL; }
    else esperaMs = rand(cfg.minS, cfg.maxS) * 1000 / ACEL;
    c.proximo = now + esperaMs;
    if (!falhou) novoLog(c, 'Enviada para ' + r.nome + ' · próxima em ' + Math.round(esperaMs / 1000) + ' s (na demonstração; no real, ' + Math.round(esperaMs * ACEL / 1000) + ' s).');
    if (!c.dest.some(function (x) { return x.st === 'pendente'; })) finaliza(c);
    return true;
  }
  function tick() {
    if (!D()) return;
    var now = Date.now(), mudou = false;
    D().camps.forEach(function (c) {
      if (promove(c, now)) mudou = true;
      if (c.status === 'agendada' && c.agenda && now >= c.agenda) {
        if (D().cfg.geral) { c.status = 'enviando'; novoLog(c, 'Hora do agendamento: campanha iniciada.'); mudou = true; }
        else c.bloqueio = 'Chegou a hora, mas a chave geral está desligada: nada é enviado.';
      }
      if (c.status === 'enviando' && envia(c, now)) mudou = true;
    });
    if (mudou) I.salvar();
    if (I.ctx().modulo() === 'campanhas') atualiza();
    if (mudou) I.ctx().selos();
  }

  /* ---------- telas ---------- */
  function sw(on, attr, rot) { return '<button type="button" class="sw' + (on ? ' on' : '') + '" role="switch" aria-checked="' + on + '" aria-label="' + rot + '" ' + attr + '><i></i></button>'; }
  function renderBanner() {
    var cfg = D().cfg;
    if (!cfg.geral) return '<div class="cp-banner off"><div><b>Disparos desligados.</b> A chave geral nasce desligada: com ela assim, nenhuma campanha envia nada, nem agendada.</div>' + sw(false, 'data-cpgeral', 'Chave geral dos disparos') + '</div>';
    return '<div class="cp-banner on"><div><b>Disparos ligados' + (cfg.teste ? ' em MODO DE TESTE' : '') + '.</b> ' + (cfg.teste ? 'Só o número de teste ' + esc(cfg.numTeste || '(não cadastrado)') + ' recebe; nenhum cliente é atingido.' : 'Atenção: o modo de teste está desligado, as campanhas atingem os clientes (aqui, de mentira).') + '</div>' + sw(true, 'data-cpgeral', 'Chave geral dos disparos') + '</div>';
  }
  function renderUso() {
    var cfg = D().cfg, u = usadosHoje(), lim = limiteEfetivo(), pct = Math.min(100, Math.round(u / lim * 100));
    var rel = cfg.relogio ? 'Relógio simulado: ' + cfg.relogio : 'Relógio real (Fortaleza)';
    var dentro = dentroHorario();
    return '<div class="barra' + (pct > 85 ? ' critico' : pct > 60 ? ' baixo' : '') + '"><i style="width:' + pct + '%"></i></div><small>' + u + ' de ' + lim + ' mensagens nas últimas 24 horas · limite efetivo = menor entre o limite diário (' + cfg.limiteDia + ') e o aquecimento (' + aquecimento(cfg.diaNumero) + ')</small>' +
      '<small>' + rel + ': <b class="' + (dentro ? 'ok-t' : 'er-t') + '">' + (dentro ? 'dentro do horário permitido' : 'FORA do horário permitido, nada sai') + '</b></small>';
  }
  function renderTravas() {
    var cfg = D().cfg;
    var rampa = [[1, 3, 20], [4, 7, 50], [8, 14, 100], [15, 99, 250]];
    return '<div class="painel cp-travas"><h2>Travas de segurança <small>as mesmas regras dos disparos reais pela UAZAPI</small></h2>' +
      '<div class="tv-grade">' +
      '<div class="tv"><h3>Chave geral dos disparos</h3>' + sw(cfg.geral, 'data-cpgeral', 'Chave geral dos disparos') + '<p>Nasce DESLIGADA. Desligada, nada é enviado, nem campanha agendada.</p></div>' +
      '<div class="tv"><h3>Modo de teste</h3>' + sw(cfg.teste, 'data-cpteste', 'Modo de teste') + '<p>Ligado (padrão): só o número de teste recebe, ninguém mais.</p>' +
      '<label for="tvNum">Número de teste</label><input id="tvNum" value="' + esc(cfg.numTeste) + '" inputmode="tel" placeholder="(85) 9xxxx-xxxx"></div>' +
      '<div class="tv"><h3>Horário permitido</h3><div class="tv-par"><div><label for="tvIni">Início</label><input id="tvIni" type="time" value="' + cfg.inicio + '"></div><div><label for="tvFim">Fim</label><input id="tvFim" type="time" value="' + cfg.fim + '"></div></div><p>Fuso de Fortaleza, sem madrugada. Fora da janela o envio espera sozinho.</p></div>' +
      '<div class="tv"><h3>Intervalo aleatório</h3><div class="tv-par"><div><label for="tvMin">Mínimo (s)</label><input id="tvMin" type="number" min="5" max="600" value="' + cfg.minS + '"></div><div><label for="tvMax">Máximo (s)</label><input id="tvMax" type="number" min="5" max="600" value="' + cfg.maxS + '"></div></div><p>Ritmo de gente, não de robô: espera sorteada entre uma mensagem e outra (mínimo 5 s).</p></div>' +
      '<div class="tv"><h3>Envios por rodada</h3><input id="tvRod" type="number" min="1" max="10" value="' + cfg.rodada + '" aria-label="Envios por rodada"><p>No máximo esse tanto por rodada de 1 minuto (1 a 10).</p></div>' +
      '<div class="tv"><h3>Limite diário</h3><input id="tvLim" type="number" min="1" max="250" value="' + cfg.limiteDia + '" aria-label="Limite diário"><p>Máximo de mensagens a cada 24 horas na conta (até 250).</p><div id="cpUso">' + renderUso() + '</div></div>' +
      '<div class="tv"><h3>Aquecimento do número</h3><label for="tvDia">Dias de uso do número em disparos</label><input id="tvDia" type="number" min="1" max="60" value="' + cfg.diaNumero + '"><p>Número novo começa devagar: ' + rampa.map(function (r) { return (r[1] === 99 ? 'dia ' + r[0] + '+' : 'dias ' + r[0] + '–' + r[1]) + ': ' + r[2] + '/dia'; }).join(' · ') + '. Hoje: <b>' + aquecimento(cfg.diaNumero) + '/dia</b>.</p></div>' +
      '<div class="tv"><h3>Limite por campanha (lote)</h3><input id="tvLote" type="number" min="1" max="200" value="' + cfg.lote + '" aria-label="Limite por campanha"><p>Máximo de destinatários em uma campanha (1 a 200). O excedente fica de fora.</p></div>' +
      '</div>' +
      (cp.errCfg ? '<div class="banner alerta" role="alert">' + esc(cp.errCfg) + '</div>' : '') +
      '<div class="tv-acoes"><button class="btn mar" data-cpsalvar>Salvar regras</button><span class="dica">Chave geral e modo de teste valem na hora; os demais campos, ao salvar.</span></div>' +
      '<h3 class="cv-h3">Travas fixas (não se desligam)</h3><ul class="tv-fixas">' +
      '<li><b>Uma mensagem por pessoa</b> em cada campanha: o destinatário é reservado antes do envio e, se falhar, nunca é reenviado.</li>' +
      '<li><b>Opt-out respeitado</b>: quem respondeu SAIR é conferido de novo na hora do envio e nunca mais recebe.</li>' +
      '<li><b>Rodapé obrigatório</b> em toda mensagem: “' + RODAPE + '”.</li>' +
      '<li><b>Só quem já conversou</b> com a loja entra no público.</li>' +
      '<li><b>3 falhas seguidas pausam sozinhas</b> a campanha, em vez de insistir com o número.</li>' +
      '<li><b>Sem repetir em 3 dias</b>: quem recebeu um disparo há menos de 3 dias é pulado.</li>' +
      '<li><b>Confirmação antes de iniciar</b>: toda campanha passa por uma revisão das travas.</li>' +
      '<li><b>Número exclusivo de disparos</b>, separado do atendimento, para que um bloqueio não derrube as conversas.</li></ul>' +
      '<details class="tv-demo"><summary>Ferramentas da demonstração</summary><div class="tv-demo-c">' +
      '<div>' + sw(!!cfg.relogio, 'data-cprelogio', 'Simular horário comercial') + ' <span>Simular que são ' + '10:00 (para ver o envio andar fora do expediente)</span></div>' +
      '<div>' + sw(!!cfg.simFalha, 'data-cpfalha', 'Simular falhas de envio') + ' <span>Simular número sem conexão (para ver a pausa automática após 3 falhas)</span></div>' +
      '<p class="dica">Velocidade da demonstração: ' + ACEL + '× mais rápida que a real. Nada é enviado de verdade.</p></div></details></div>';
  }
  function chipSt(s) { var x = STATUS[s]; return '<span class="chip ' + x[1] + '">' + x[0] + '</span>'; }
  function barra(c) {
    var s = stats(c), t = Math.max(1, s.total - s.puladas), feitas = s.enviadas + s.falhas;
    return '<div class="barra"><i style="width:' + Math.round(feitas / t * 100) + '%"></i></div><small>' + feitas + ' de ' + (s.total - s.puladas) + '</small>';
  }
  function renderLista() {
    var cs = D().camps;
    return '<div class="painel"><h2>Campanhas <small>' + cs.length + ' no total</small></h2>' + (cs.length ? '<div class="rolagem"><table><thead><tr><th>Campanha</th><th>Situação</th><th>Andamento</th><th></th></tr></thead><tbody>' + cs.map(function (c) {
      return '<tr class="' + (cp.sel === c.id ? 'sel' : '') + '"><td><b>' + esc(c.nome) + '</b><small>' + publicoRot(c.pub) + '</small></td><td>' + chipSt(c.status) + '</td><td>' + barra(c) + '</td><td><button class="btn pequeno claro" data-cpabre="' + c.id + '">Abrir</button></td></tr>';
    }).join('') + '</tbody></table></div>' : '<p class="vazio">Nenhuma campanha ainda.</p>') + '</div>';
  }
  function publicoRot(pub) {
    var p = [];
    if (pub.cats.length) p.push('categoria: ' + pub.cats.map(function (c) { return CATS.filter(function (x) { return x[0] === c; })[0][1].toLowerCase(); }).join(', '));
    if (pub.etqs.length) p.push('etiqueta: ' + pub.etqs.join(', '));
    return esc(p.join(' + ') || 'sem filtro');
  }
  function renderDetalhe() {
    var c = D().camps.filter(function (x) { return x.id === cp.sel; })[0];
    if (!c) return '<div class="painel"><p class="vazio">Abra uma campanha para acompanhar enviadas, entregues, respondidas e falhas.</p></div>';
    var s = stats(c), acoes = '';
    if (c.status === 'enviando') acoes += '<button class="btn pequeno" data-cppausa="' + c.id + '">Pausar</button>';
    if (c.status === 'pausada') acoes += '<button class="btn pequeno verde" data-cpretoma="' + c.id + '">Retomar</button>';
    if (c.status === 'enviando' || c.status === 'pausada' || c.status === 'agendada') acoes += '<button class="btn pequeno linha" data-cppara="' + c.id + '">Cancelar campanha</button>';
    if (c.status === 'rascunho') acoes += '<button class="btn pequeno mar" data-cpedita="' + c.id + '">Editar e iniciar</button>';
    var kp = function (t, v, cl) { return '<div class="kpi ' + (cl || '') + '"><span>' + t + '</span><b>' + v + '</b></div>'; };
    var aviso = '';
    if (c.status === 'pausada' && c.pausaAuto) aviso = '<div class="banner alerta"><b>Pausada automaticamente.</b> ' + esc(c.pausaAuto) + ' Confira a conexão antes de retomar.</div>';
    else if (c.status === 'enviando' && c.bloqueio) aviso = '<div class="banner alerta"><b>Aguardando.</b> ' + esc(c.bloqueio) + '</div>';
    else if (c.status === 'agendada') aviso = '<div class="banner info">Agendada para <b>' + I.ctx().dataHora(c.agenda || Date.now()) + '</b>.' + (c.bloqueio ? ' ' + esc(c.bloqueio) : '') + '</div>';
    else if (c.nota) aviso = '<div class="banner info">' + esc(c.nota) + '</div>';
    var exemplo = D().leads[0];
    return '<div class="painel" id="cpDet"><h2>' + esc(c.nome) + ' ' + chipSt(c.status) + '</h2>' + aviso +
      '<div class="kpis cp-kpis">' + kp('Público', s.total) + kp('Enviadas', s.enviadas) + kp('Entregues', s.entregues) + kp('Respondidas', s.respondidas) + kp('Falhas', s.falhas, s.falhas ? 'alerta' : '') + kp('Puladas', s.puladas) + '</div>' +
      barra(c) + '<div class="acoes" style="margin:12px 0">' + acoes + '</div>' +
      '<h3 class="cv-h3">Mensagem</h3><div class="cp-msg">' + esc(textoFinal(c.msg, exemplo)).replace(/\n/g, '<br>') + '</div>' +
      '<h3 class="cv-h3">Destinatários</h3><div class="rolagem cp-dest"><table><thead><tr><th>Contato</th><th>Situação</th></tr></thead><tbody>' + c.dest.map(function (r) {
        var cor = r.st === 'respondida' ? 'ok' : r.st === 'falha' ? 'perigo' : r.st === 'pulado' ? 'cinza' : r.st === 'pendente' ? '' : 'ok';
        var rot = { pendente: 'Na fila', enviada: 'Enviada', entregue: 'Entregue', respondida: 'Respondida', falha: 'Falhou', pulado: 'Pulado' }[r.st];
        return '<tr><td><b>' + esc(r.nome) + '</b><small>' + esc(r.fone) + '</small></td><td><span class="chip ' + cor + '">' + rot + '</span>' + (r.motivo ? '<small>' + esc(r.motivo) + '</small>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<h3 class="cv-h3">Registro de envio</h3><div class="log cp-log">' + (c.log.length ? c.log.map(function (x) { return esc(new Date(x.ts).toLocaleTimeString('pt-BR')) + '  ' + esc(x.t); }).join('\n') : 'Sem eventos ainda.') + '</div></div>';
  }
  function renderForm() {
    var f = cp.f, cfg = D().cfg;
    var cats = CATS.map(function (c) { return '<label class="cp-ck"><input type="checkbox" data-cpcat="' + c[0] + '"' + (f.cats.indexOf(c[0]) >= 0 ? ' checked' : '') + '> ' + c[1] + '</label>'; }).join('');
    var etqs = D().etiquetas.map(function (e) { return '<label class="cp-ck"><input type="checkbox" data-cpetq="' + esc(e) + '"' + (f.etqs.indexOf(e) >= 0 ? ' checked' : '') + '> ' + esc(e) + '</label>'; }).join('');
    return '<div class="painel"><h2>' + (cp.editId ? 'Editar campanha' : 'Nova campanha') + '</h2>' +
      '<div class="campo largo"><label for="cpNome">Nome da campanha</label><input id="cpNome" maxlength="60" value="' + esc(f.nome) + '" placeholder="Ex.: Oferta de camarão — fim de semana"></div>' +
      '<fieldset class="cp-fs"><legend>Público por categoria da carteira</legend><div class="cp-cks">' + cats + '</div></fieldset>' +
      '<fieldset class="cp-fs"><legend>Público por etiqueta</legend><div class="cp-cks">' + etqs + '</div></fieldset>' +
      '<div id="cpResumo"></div>' +
      '<div class="campo largo"><label for="cpMsg">Mensagem</label><textarea id="cpMsg" rows="5" maxlength="' + MAXMSG + '" placeholder="Oi, {nome}! ...">' + esc(f.msg) + '</textarea>' +
      '<div class="cp-vars">Variáveis: ' + Object.keys(VARS).map(function (v) { return '<button type="button" class="btn pequeno claro" data-cpvar="' + v + '" title="' + VARS[v] + '">{' + v + '}</button>'; }).join(' ') + '<span id="cpCont" class="dica"></span></div>' +
      '<div class="cp-prev" id="cpPrev"></div></div>' +
      '<fieldset class="cp-fs"><legend>Agendamento</legend>' +
      '<label class="cp-ck"><input type="radio" name="cpQuando" value="ja" ' + (f.quando === 'ja' ? 'checked' : '') + '> Assim que possível (respeitando horário, intervalo e limites)</label>' +
      '<label class="cp-ck"><input type="radio" name="cpQuando" value="agendar" ' + (f.quando === 'agendar' ? 'checked' : '') + '> Agendar para <input type="datetime-local" id="cpData" value="' + esc(f.data) + '" aria-label="Data e hora do agendamento"></label></fieldset>' +
      (cp.erro ? '<div class="banner alerta" role="alert">' + esc(cp.erro) + '</div>' : '') +
      '<div class="acoes"><button class="btn mar" data-cprevisar>Revisar e iniciar</button><button class="btn claro" data-cprasc>Salvar rascunho</button>' + (cp.editId ? '<button class="btn linha" data-cpcancelaedit>Cancelar edição</button>' : '') + '</div>' +
      '<p class="dica" style="margin-top:10px">Ao revisar, a confirmação mostra cada trava (chave geral, modo de teste, horário, ritmo e limites) antes de a campanha começar.</p></div>';
  }
  function atualizaResumo() {
    var el = $('#cpResumo'); if (!el) return;
    var f = cp.f, cfg = D().cfg;
    if (!f.cats.length && !f.etqs.length) { el.innerHTML = '<div class="cp-res">Escolha ao menos uma categoria ou etiqueta para definir o público. Campanha sem filtro não é permitida.</div>'; }
    else {
      var r = publico(f, cfg), motivos = {};
      r.pulados.forEach(function (p) { motivos[p.motivo] = (motivos[p.motivo] || 0) + 1; });
      el.innerHTML = '<div class="cp-res"><b>' + r.enviar.length + ' vão receber</b> de ' + r.total + ' no público.' + Object.keys(motivos).map(function (m) { return '<br><span class="er-t">' + motivos[m] + ' fora:</span> ' + esc(m.toLowerCase()); }).join('') + '</div>';
    }
    var ta = $('#cpMsg');
    var cont = $('#cpCont'); if (cont) cont.textContent = ' ' + f.msg.length + '/' + MAXMSG;
    var pv = $('#cpPrev');
    if (pv) {
      var ex = D().leads.filter(function (l) { return !l.optout; })[0];
      var er = f.msg.trim() ? erroMsg(f.msg) : null;
      pv.innerHTML = f.msg.trim() ? (er ? '<span class="er-t">' + esc(er) + '</span>' : '<small>Prévia para ' + esc(ex.nome) + ' (com o rodapé obrigatório):</small><div class="cp-msg">' + esc(textoFinal(f.msg, ex)).replace(/\n/g, '<br>') + '</div>') : '';
    }
  }
  function atualiza() {
    var b = $('#cpBanner'); if (b) b.innerHTML = renderBanner();
    var u = $('#cpUso'); if (u) u.innerHTML = renderUso();
    var l = $('#cpLista'); if (l) l.innerHTML = renderLista();
    var d = $('#cpDetalhe'); if (d) { var rol = $('.cp-dest', d), top = rol ? rol.scrollTop : 0; d.innerHTML = renderDetalhe(); rol = $('.cp-dest', d); if (rol) rol.scrollTop = top; }
    document.querySelectorAll('[data-cpgeral],[data-cpteste]').forEach(function (s) { /* estado visual vem do banner e das travas */ });
  }
  function render(tela) {
    tela.innerHTML = '<div class="cab"><div><h1>Campanhas</h1><p>Disparos em massa por WhatsApp, com as mesmas travas de segurança dos disparos reais. Tudo simulado: nenhuma mensagem é enviada de verdade.</p></div></div>' +
      '<div id="cpBanner">' + renderBanner() + '</div><div id="cpTravas">' + renderTravas() + '</div>' +
      '<div class="cp-duas"><div id="cpForm">' + renderForm() + '</div><div><div id="cpLista">' + renderLista() + '</div><div id="cpDetalhe" style="margin-top:18px">' + renderDetalhe() + '</div></div></div>' +
      '<div id="cpModal"></div>';
    atualizaResumo();
  }

  /* ---------- ações ---------- */
  function numero(id) { var e = $('#' + id); return e ? Number(e.value) : NaN; }
  function salvarRegras() {
    var cfg = D().cfg;
    var novo = { inicio: $('#tvIni').value, fim: $('#tvFim').value, minS: numero('tvMin'), maxS: numero('tvMax'), rodada: numero('tvRod'), limiteDia: numero('tvLim'), diaNumero: numero('tvDia'), lote: numero('tvLote'), numTeste: $('#tvNum').value.trim() };
    var e = validaCfg(novo);
    cp.errCfg = e || '';
    if (e) { $('#cpTravas').innerHTML = renderTravas(); I.toast('Regras não salvas: ' + e); return; }
    ['inicio', 'fim', 'minS', 'maxS', 'rodada', 'limiteDia', 'diaNumero', 'lote', 'numTeste'].forEach(function (k) { cfg[k] = novo[k]; });
    I.salvar(); $('#cpTravas').innerHTML = renderTravas(); atualizaResumo(); I.toast('Regras de envio salvas.');
  }
  function lerForm() {
    var f = cp.f;
    f.nome = ($('#cpNome') || { value: f.nome }).value; f.msg = ($('#cpMsg') || { value: f.msg }).value;
    var q = document.querySelector('input[name=cpQuando]:checked'); if (q) f.quando = q.value;
    var dt = $('#cpData'); if (dt) f.data = dt.value;
  }
  function validaForm() {
    lerForm(); var f = cp.f, cfg = D().cfg;
    if (!f.nome.trim()) return 'Dê um nome à campanha.';
    if (!f.cats.length && !f.etqs.length) return 'Escolha ao menos uma categoria ou etiqueta para o público.';
    var em = erroMsg(f.msg); if (em) return em;
    if (publico(f, cfg).enviar.length === 0) return 'Ninguém elegível neste público (opt-out, disparo recente ou filtro sem contatos).';
    if (f.quando === 'agendar') {
      if (!f.data) return 'Escolha a data e a hora do agendamento.';
      if (new Date(f.data).getTime() <= Date.now()) return 'O agendamento precisa ser no futuro.';
    }
    return null;
  }
  function limpaForm() { cp.f = { nome: '', cats: [], etqs: [], msg: '', quando: 'ja', data: '' }; cp.editId = null; cp.erro = ''; $('#cpForm').innerHTML = renderForm(); atualizaResumo(); }
  function criar(status) {
    var f = cp.f, cfg = D().cfg, agora = Date.now();
    var c = { id: 'cp' + D().seqCamp++, nome: f.nome.trim(), msg: f.msg.trim(), pub: { cats: f.cats.slice(), etqs: f.etqs.slice() }, status: status, criada: agora, agenda: 0, dest: [], log: [], proximo: 0, naRodada: 0, bloqueio: '' };
    if (status !== 'rascunho') c.dest = destinatarios(publico(f, cfg));
    if (status === 'agendada') { c.agenda = new Date(f.data).getTime(); novoLog(c, 'Agendada para ' + I.ctx().dataHora(c.agenda) + '.'); }
    if (status === 'enviando') novoLog(c, 'Campanha iniciada após a confirmação das travas.');
    if (cp.editId) D().camps = D().camps.filter(function (x) { return x.id !== cp.editId; });
    D().camps.unshift(c); cp.sel = c.id; I.salvar(); return c;
  }
  function checklist() {
    var f = cp.f, cfg = D().cfg, r = publico(f, cfg), n = r.enviar.length, itens = [], bloqueios = 0;
    function it(ok, t, d, bloq) { itens.push('<li class="' + (ok ? 'ok' : bloq ? 'no' : 'av') + '"><b>' + t + '</b><span>' + d + '</span></li>'); if (!ok && bloq) bloqueios++; }
    it(cfg.geral, 'Chave geral dos disparos', cfg.geral ? 'Ligada.' : 'DESLIGADA: ligue a chave geral nas travas para poder iniciar ou agendar.', true);
    if (cfg.teste) it(I.digitos(cfg.numTeste).length >= 10, 'Modo de teste', I.digitos(cfg.numTeste).length >= 10 ? 'Ligado: só o número ' + esc(cfg.numTeste) + ' vai receber, nenhum cliente.' : 'Ligado, mas sem número de teste cadastrado.', true);
    else it(true, 'Modo de teste', 'DESLIGADO: os ' + n + ' destinatários abaixo receberão a mensagem (nesta demonstração, de mentira).');
    var por = Math.ceil(n / cfg.rodada), minTot = Math.ceil(por * (60 + (cfg.rodada - 1) * (cfg.minS + cfg.maxS) / 2) / 60);
    it(true, 'Público', n + ' destinatários' + (r.pulados.length ? ' (' + r.pulados.length + ' fora: opt-out, disparo recente ou acima do lote de ' + cfg.lote + ')' : '') + '. Todos já conversaram com a loja.');
    it(true, 'Horário permitido', cfg.inicio + ' às ' + cfg.fim + ' (Fortaleza). ' + (dentroHorario() ? 'Agora está dentro da janela.' : 'Agora está FORA: o envio espera a janela abrir.'));
    it(true, 'Ritmo', 'Intervalo aleatório de ' + cfg.minS + ' a ' + cfg.maxS + ' s, até ' + cfg.rodada + ' por rodada. Duração estimada: cerca de ' + minTot + ' min (na demonstração, ' + Math.max(1, Math.round(minTot * 60 / ACEL)) + ' s).');
    var lim = limiteEfetivo(), dias = Math.ceil(n / lim);
    it(n <= lim - usadosHoje() || true, 'Limite diário e aquecimento', 'Hoje ' + usadosHoje() + ' de ' + lim + ' (menor entre limite ' + cfg.limiteDia + ' e aquecimento ' + aquecimento(cfg.diaNumero) + '). ' + (dias > 1 ? 'A campanha levará ' + dias + ' dias.' : 'Cabe em um dia.'));
    it(true, 'Travas fixas', 'Uma mensagem por pessoa, opt-out conferido na hora, rodapé “responda SAIR”, pausa após 3 falhas seguidas.');
    return { html: '<ul class="cp-check">' + itens.join('') + '</ul>', bloqueios: bloqueios };
  }
  function abreModal() {
    var cl = checklist(), f = cp.f, agendar = f.quando === 'agendar';
    $('#cpModal').innerHTML = '<div class="cp-fundo" data-cpfecha><div class="cp-modal" role="dialog" aria-modal="true" aria-labelledby="cpModalT" data-stop>' +
      '<h2 id="cpModalT">Confirmar ' + (agendar ? 'agendamento' : 'início') + ' da campanha</h2><p class="dica"><b>' + esc(f.nome) + '</b> · ' + publicoRot(f) + '</p>' + cl.html +
      '<label class="cp-ck cp-conf"><input type="checkbox" id="cpOk"> Revisei o público, o texto e as travas. Entendo que cada pessoa recebe no máximo uma mensagem desta campanha.</label>' +
      '<div class="acoes"><button class="btn verde" data-cpconfirma id="cpConfirma" disabled' + (cl.bloqueios ? ' data-bloq="1"' : '') + '>' + (agendar ? 'Confirmar e agendar' : 'Confirmar e iniciar') + '</button><button class="btn linha" data-cpfecha>Voltar e ajustar</button></div>' +
      (cl.bloqueios ? '<p class="er-t">Há travas bloqueando o início. Ajuste e tente de novo, ou salve como rascunho.</p>' : '') + '</div></div>';
  }
  function fechaModal() { var m = $('#cpModal'); if (m) m.innerHTML = ''; }

  document.addEventListener('click', function (e) {
    if (!I || I.ctx().modulo() !== 'campanhas') return;
    var cfg = D().cfg;
    if (e.target.matches('.cp-fundo')) { fechaModal(); return; }
    var t = e.target.closest('button'); if (!t) return;
    if (t.dataset.cpgeral !== undefined) { cfg.geral = !cfg.geral; I.salvar(); $('#cpTravas').innerHTML = renderTravas(); atualiza(); I.toast(cfg.geral ? 'Chave geral LIGADA. Campanhas em andamento voltam a enviar (respeitando as travas).' : 'Chave geral DESLIGADA. Nada é enviado.'); }
    else if (t.dataset.cpteste !== undefined) { cfg.teste = !cfg.teste; I.salvar(); $('#cpTravas').innerHTML = renderTravas(); atualiza(); I.toast(cfg.teste ? 'Modo de teste ligado: só o número de teste recebe.' : 'Modo de teste desligado: campanhas atingem os destinatários (simulado).'); }
    else if (t.dataset.cprelogio !== undefined) { cfg.relogio = cfg.relogio ? '' : '10:00'; I.salvar(); $('#cpTravas').innerHTML = renderTravas(); atualiza(); }
    else if (t.dataset.cpfalha !== undefined) { cfg.simFalha = !cfg.simFalha; I.salvar(); $('#cpTravas').innerHTML = renderTravas(); }
    else if (t.dataset.cpsalvar !== undefined) salvarRegras();
    else if (t.dataset.cpvar) { var ta = $('#cpMsg'), p = ta.selectionStart || ta.value.length; ta.value = ta.value.slice(0, p) + '{' + t.dataset.cpvar + '}' + ta.value.slice(ta.selectionEnd || p); cp.f.msg = ta.value; atualizaResumo(); ta.focus(); }
    else if (t.dataset.cprasc !== undefined) {
      lerForm(); if (!cp.f.nome.trim()) { cp.erro = 'Dê um nome à campanha.'; $('#cpForm').innerHTML = renderForm(); atualizaResumo(); return; }
      criar('rascunho'); limpaForm(); atualiza(); I.toast('Rascunho salvo.');
    }
    else if (t.dataset.cprevisar !== undefined) {
      var er = validaForm(); cp.erro = er || '';
      if (er) { $('#cpForm').innerHTML = renderForm(); atualizaResumo(); return; }
      $('#cpForm').innerHTML = renderForm(); atualizaResumo(); abreModal();
    }
    else if (t.dataset.cpfecha !== undefined) fechaModal();
    else if (t.dataset.cpconfirma !== undefined) {
      if (t.dataset.bloq) return;
      var agendar = cp.f.quando === 'agendar', c = criar(agendar ? 'agendada' : 'enviando');
      fechaModal(); limpaForm(); atualiza();
      I.toast(agendar ? 'Campanha agendada.' : 'Campanha iniciada. O envio segue as travas e o ritmo configurados.');
    }
    else if (t.dataset.cpabre) { cp.sel = t.dataset.cpabre; atualiza(); var d = $('#cpDetalhe'); if (d && d.scrollIntoView) d.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
    else if (t.dataset.cppausa) { var c1 = D().camps.filter(function (x) { return x.id === t.dataset.cppausa; })[0]; c1.status = 'pausada'; c1.pausaAuto = ''; novoLog(c1, 'Pausada manualmente.'); I.salvar(); atualiza(); I.toast('Campanha pausada.'); }
    else if (t.dataset.cpretoma) { var c2 = D().camps.filter(function (x) { return x.id === t.dataset.cpretoma; })[0]; c2.status = 'enviando'; c2.pausaAuto = ''; c2.proximo = 0; novoLog(c2, 'Retomada.'); I.salvar(); atualiza(); I.toast('Campanha retomada. Só quem ainda está na fila recebe.'); }
    else if (t.dataset.cppara) {
      var c3 = D().camps.filter(function (x) { return x.id === t.dataset.cppara; })[0]; c3.status = 'cancelada';
      c3.dest.forEach(function (r) { if (r.st === 'pendente') { r.st = 'pulado'; r.motivo = 'Campanha cancelada'; } });
      novoLog(c3, 'Cancelada. Quem estava na fila não recebe.'); I.salvar(); atualiza(); I.toast('Campanha cancelada.');
    }
    else if (t.dataset.cpedita) {
      var c4 = D().camps.filter(function (x) { return x.id === t.dataset.cpedita; })[0];
      cp.editId = c4.id; cp.f = { nome: c4.nome, cats: c4.pub.cats.slice(), etqs: c4.pub.etqs.slice(), msg: c4.msg, quando: 'ja', data: '' }; cp.erro = '';
      $('#cpForm').innerHTML = renderForm(); atualizaResumo(); $('#cpForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    else if (t.dataset.cpcancelaedit !== undefined) limpaForm();
  });
  document.addEventListener('change', function (e) {
    if (!I || I.ctx().modulo() !== 'campanhas') return;
    var t = e.target;
    if (t.id === 'cpOk') { var b = $('#cpConfirma'); if (b) b.disabled = !t.checked || !!b.dataset.bloq; }
    else if (t.dataset.cpcat) { var i = cp.f.cats.indexOf(t.dataset.cpcat); if (i >= 0) cp.f.cats.splice(i, 1); else cp.f.cats.push(t.dataset.cpcat); lerForm(); atualizaResumo(); }
    else if (t.dataset.cpetq) { var j = cp.f.etqs.indexOf(t.dataset.cpetq); if (j >= 0) cp.f.etqs.splice(j, 1); else cp.f.etqs.push(t.dataset.cpetq); lerForm(); atualizaResumo(); }
    else if (t.name === 'cpQuando') lerForm();
  });
  document.addEventListener('input', function (e) {
    if (!I || I.ctx().modulo() !== 'campanhas') return;
    if (e.target.id === 'cpMsg' || e.target.id === 'cpNome') { lerForm(); if (e.target.id === 'cpMsg') atualizaResumo(); }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && I && I.ctx().modulo() === 'campanhas') fechaModal(); });

  window.CRM.campanhas = { semear: function (Dd) { I = window.CRM.i; semear(Dd); }, render: function (tela) { I = window.CRM.i; render(tela); }, tick: function () { I = I || window.CRM.i; tick(); } };
})();
