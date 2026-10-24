/* Conversas e Atendimento por IA da Julia Pescados — demonstração: tudo simulado no navegador, nenhuma IA é chamada e nada é enviado.
   O cliente só liga/desliga a IA e assume conversas; prompt e ajustes técnicos vêm de ia-config.js e só se editam em /config-ia (área da RS Tech). */
(function () {
  var I = window.CRM.i, D = null, ctx = null;
  var ATUAL = 'Júlia';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var mq = window.matchMedia('(max-width: 860px)');
  var X = { sel: null, busca: '', filtro: 'todas', resp: '', etq: '', perfil: true, aba: 'msg', mobile: 'lista', pop: '', rap: 0, carregandoLista: true, carregandoChat: false, gravando: null, tocando: null, empurrou: false, abertos: {} };
  var rascunhos = {}, digitando = {}, digitandoIA = {}, sug = {}, timers = {}, jaCarregou = false;

  /* ---------- utilidades ---------- */
  function esc(t) { return I.esc(t); }
  function toast(m) { I.toast(m); }
  function salvar() { I.salvar(); }
  function primeiro(n) { return I.primeiro(n); }
  function hora(ts) { return I.hora(ts); }
  function norm(t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function mobile() { return mq.matches; }
  function lead(id) { return I.lead(id); }
  function horaLista(ts) {
    var d = new Date(ts), h = new Date(), o = new Date(); o.setDate(h.getDate() - 1);
    if (d.toDateString() === h.toDateString()) return hora(ts);
    if (d.toDateString() === o.toDateString()) return 'Ontem';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }
  function haTempo(ts) {
    var m = Math.max(0, Math.round((Date.now() - ts) / 60000));
    if (m < 1) return 'agora'; if (m < 60) return 'há ' + m + ' min'; if (m < 1440) return 'há ' + Math.round(m / 60) + ' h'; return 'há ' + Math.round(m / 1440) + ' d';
  }
  function mmss(s) { s = Math.round(s); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  function realce(texto) {
    var t = esc(texto), b = X.busca.trim();
    if (!b) return t;
    var re = new RegExp('(' + esc(b).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
    return t.replace(re, '<mark>$1</mark>');
  }
  var IC = {
    voltar: '<path d="M15 5l-7 7 7 7"/>', enviar: '<path d="M21 3 10 14"/><path d="M21 3l-7 18-4-7-7-4z"/>',
    clipe: '<path d="M20 11.5l-8 8a5 5 0 0 1-7-7l9-9a3.5 3.5 0 0 1 5 5l-9 9a2 2 0 0 1-3-3l8-8"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>', raio: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    busca: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l5 5"/>', check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', check2: '<path d="M2.5 12.5l4 4L15 8M10.5 15.5l1 1L21 7"/>',
    relogio: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>', alerta: '<path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4.5M12 17.5v.1"/>',
    transferir: '<path d="M4 8h14l-4-4M20 16H6l4 4"/>', painel: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/>',
    brilho: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16v4M17 18h4"/>', play: '<path d="M8 5.5v13l11-6.5z"/>', pausa: '<path d="M8 5v14M16 5v14"/>',
    doc: '<path d="M6 2.5h8.5L19 7v14.5H6z"/><path d="M14 2.5V7h5"/>', imagem: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M21 16l-5-5-8 9"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>', teclado: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 10h.1M10 10h.1M14 10h.1M18 10h.1M7 14h10"/>',
    nota: '<path d="M5 3.5h14v13l-5 4H5z"/><path d="M14 20.5v-4h5"/>', reabrir: '<path d="M4 12a8 8 0 1 0 3-6.2M4 4v4h4"/>',
    usuario: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6"/>', conversa: '<path d="M21 11.5a8 8 0 0 1-11.8 7L3.5 20l1.6-4.6A8 8 0 1 1 21 11.5z"/>',
    engrenagem: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/>'
  };
  function ic(n, c) { return '<svg class="xic' + (c ? ' ' + c : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + IC[n] + '</svg>'; }
  function avatar(n, g) { return '<span class="xav' + (g ? ' g' : '') + '" style="background:' + I.corAvatar(n) + '" aria-hidden="true">' + esc(I.iniciais(n)) + '</span>'; }

  /* ---------- configuração e dados próprios (ficam dentro dos dados do CRM, então "Restaurar dados" também zera) ---------- */
  var ASSUNTOS = [['preco', 'Preços e catálogo'], ['entrega', 'Entrega, taxas e prazos'], ['horario', 'Horário de funcionamento'], ['pagamento', 'Formas de pagamento'], ['pedido', 'Andamento do pedido'], ['orcamento', 'Orçamentos']];
  var CORPO = {
    preco: 'Hoje temos camarão cinza a R$ 49,90/kg, camarão VG a R$ 64,90/kg, filé de tilápia a R$ 36,90/kg e o Kit Churrasco do Mar a R$ 84,90. Quer que eu monte o seu pedido?',
    entrega: 'Entregamos em Fortaleza e Caucaia. A taxa varia por bairro (de R$ 6,00 a R$ 22,00) e o prazo médio é de 60 a 90 minutos. Me diga o bairro e eu confirmo o valor.',
    horario: 'Funcionamos das 6h às 14h, de segunda a sábado.',
    pagamento: 'Você pode pagar no Pix. Assim que cair, separamos o pedido e avisamos a saída para entrega.',
    pedido: 'Vou conferir o andamento do seu pedido e já te retorno por aqui.',
    orcamento: 'Posso montar o orçamento agora. Me diga os produtos e as quantidades; a validade é de 24 horas e os preços podem mudar conforme a pesca do dia.'
  };
  var RAP = I.RAPIDAS.concat([['/horario', 'Funcionamos das 6h às 14h, de segunda a sábado, {nome}.'], ['/endereco', 'Pode me passar o endereço completo, com um ponto de referência? Assim calculo a taxa de entrega.'], ['/aguarde', 'Só um momento, {nome}, estou conferindo aqui e já te respondo.']]);
  var IDX_ENDERECO = RAP.length - 2;
  var SIMULAR = [
    ['Pergunta de preço', { t: 'Quanto está o quilo do camarão cinza?' }], ['Pergunta de entrega', { t: 'Vocês entregam no Meireles? Quanto fica a taxa?' }],
    ['Pedido grande', { t: 'Preciso de 40 kg de camarão para sexta, consegue?' }], ['Reclamação', { t: 'Meu pedido chegou atrasado e um pacote veio errado.' }],
    ['Áudio do cliente', { k: 'audio', dur: 12, t: '' }]
  ];

  function cfgPadrao() { return { ativa: true }; }
  function tec() { return window.JPIA.ler(); } // ajustes técnicos: definidos pela RS Tech, o cliente não altera
  function ensure() {
    D = I.dados(); ctx = I.ctx();
    if (D.conv) return;
    D.conv = { cfg: cfgPadrao(), meta: {}, contIA: { auto: 0, aprovadas: 0, passagens: 0 } };
    semear(); salvar();
  }
  function meta(l) { return D.conv.meta[l.id] || (D.conv.meta[l.id] = { ia: null, status: 'aberta', obs: '', precisa: '' }); }
  function insere(l, m) { l.msgs.push(m); l.msgs.sort(function (a, b) { return a.ts - b.ts; }); }
  function semear() {
    var min = function (n) { return Date.now() - n * 60000; }, l;
    if ((l = lead('l1'))) {
      l.msgs[1].ia = 1; meta(l).ia = 'humano'; meta(l).precisa = 'Pedido grande: 30 kg por semana';
      insere(l, { d: 's', ia: 1, t: 'A IA passou a conversa para atendimento humano: pedido grande (30 kg por semana).', ts: min(21) });
    }
    if ((l = lead('l2'))) { l.msgs[1].ia = 1; meta(l).ia = 'ia'; }
    if ((l = lead('l3'))) {
      insere(l, { d: 'j', k: 'img', src: 'img/lula.webp', t: 'Lula fresca que chegou hoje.', ts: min(71), st: 'lida' });
      insere(l, { d: 'c', k: 'audio', dur: 23, t: '', ts: min(11) }); l.nao = 3;
      meta(l).obs = 'Compra toda semana. Prefere entrega à tarde, depois das 15h. Pagamento sempre no Pix.';
    }
    if ((l = lead('l4'))) insere(l, { d: 'j', t: 'Se preferir, posso entregar hoje até as 11h.', ts: min(124), st: 'falhou' });
    if ((l = lead('l7'))) insere(l, { d: 'c', k: 'doc', arq: { nome: 'comprovante-pix.pdf', tam: '84 KB' }, t: '', ts: min(52.2) });
    if ((l = lead('l5'))) meta(l).obs = 'Cantina com pedido fixo toda segunda e quinta. Falar com a dona Nona.';
  }

  /* ---------- motor da IA (simulado: palavras-chave, nenhuma IA real) ---------- */
  function classificar(t) {
    var n = norm(t), kg = 0, valor = 0, m, re = /(\d+(?:[.,]\d+)?)\s*(?:kg|quilos?)/g;
    while ((m = re.exec(n))) kg = Math.max(kg, parseFloat(m[1].replace(',', '.')));
    re = /r\$\s*(\d+(?:\.\d{3})*(?:,\d+)?)/g;
    while ((m = re.exec(n))) valor = Math.max(valor, parseFloat(m[1].replace(/\./g, '').replace(',', '.')));
    var assunto = /meu pedido|rastre|onde esta|status|comprovante/.test(n) ? 'pedido' : /pix|cartao|pagar|pagamento|dinheiro/.test(n) ? 'pagamento' :
      /entreg|taxa|frete|bairro|prazo|retir|chega/.test(n) ? 'entrega' : /orcamento|cotacao|fechar o pedido|fechado/.test(n) ? 'orcamento' :
      /horario|abre|funcion|domingo|aberto|que horas/.test(n) ? 'horario' : /preco|quanto|valor|custa|tabela|catalogo|kit|camarao|tilapia|salmao|lula|file/.test(n) ? 'preco' : '';
    return { reclama: /reclam|atrasad|atraso|errad|pessim|horriv|devolu|estragad|cancel|procon|demorou|insatisf|nao chegou|cheiro|podre/.test(n), kg: kg, valor: valor,
      cortesia: !assunto && /^(ok|beleza|show|valeu|combinado|obrigad|certo|pode ser|perfeito|blz)/.test(n.trim()), assunto: assunto };
  }
  function tom(corpo, nome, t) {
    t = t || tec().tom;
    if (t === 'objetivo') return corpo;
    if (t === 'descontraido') return 'Oi, ' + nome + ', tudo bem? ' + corpo + ' Qualquer coisa é só chamar!';
    return 'Olá, ' + nome + '! ' + corpo + ' Fico à disposição.';
  }
  function rotAssunto(a) { return (ASSUNTOS.filter(function (x) { return x[0] === a; })[0] || [0, a])[1]; }
  function decidir(m, l, tomForcado) {
    var cfg = tec(), nome = primeiro(l ? l.nome : 'cliente');
    if (m.k === 'audio') return { humano: true, motivo: 'o cliente enviou um áudio (a IA ainda não ouve áudios)' };
    if (m.k) return { silencio: true };
    var c = classificar(m.t);
    if (cfg.humanoReclamacao && c.reclama) return { humano: true, motivo: 'reclamação detectada' };
    if (cfg.humanoGrande && c.kg >= cfg.limiteKg) return { humano: true, motivo: 'pedido grande (' + String(c.kg).replace('.', ',') + ' kg)' };
    if (cfg.humanoGrande && c.valor >= cfg.limiteValor) return { humano: true, motivo: 'pedido grande (' + ctx.brl(c.valor) + ')' };
    if (c.cortesia) return { silencio: true };
    if (!c.assunto) return { humano: true, motivo: 'assunto fora do que a IA pode responder' };
    if (!cfg.assuntos[c.assunto]) return { humano: true, motivo: 'o assunto “' + rotAssunto(c.assunto) + '” não está liberado para a IA' };
    return { humano: false, assunto: c.assunto, texto: tom(CORPO[c.assunto], nome, tomForcado) };
  }
  function dentroDaJanela() {
    var cfg = tec(), d = new Date(), min = d.getHours() * 60 + d.getMinutes();
    function m(h) { var p = h.split(':'); return (+p[0]) * 60 + (+p[1]); }
    if (cfg.quando === 'fora') return d.getDay() === 0 || min < 360 || min >= 840;
    if (cfg.quando === 'faixa') { var a = m(cfg.de), b = m(cfg.ate); return a <= b ? (min >= a && min < b) : (min >= a || min < b); }
    return true;
  }
  // sistema real: a IA roda no servidor (tela WhatsApp); o motor de palavras-chave abaixo é só da demonstração
  function efetivaIA(l) { return !window.JP_VAZIO && D.conv.cfg.ativa && meta(l).ia !== 'humano' && dentroDaJanela(); }
  function ultimaMsg(l) { return l.msgs.filter(function (m) { return m.d === 'c' || m.d === 'j'; }).slice(-1)[0]; }
  function aguardando(l) { var u = ultimaMsg(l); return !!u && u.d === 'c' && meta(l).status !== 'resolvida' && !l.optout; }
  function aberta(id) { return X.sel === id && ctx.modulo() === 'conversas' && (!mobile() || X.mobile === 'chat'); }

  /* ---------- fluxo de mensagens ---------- */
  function enviarMsg(l, spec, opcoes) {
    opcoes = opcoes || {};
    var m = { d: 'j', t: spec.t || '', ts: Date.now(), st: 'enviando' };
    ['k', 'src', 'arq', 'dur'].forEach(function (c) { if (spec[c] !== undefined) m[c] = spec[c]; });
    if (opcoes.ia) m.ia = opcoes.ia;
    if (!l.resp && opcoes.ia !== 1) { l.resp = ATUAL; I.sistema(l, 'Conversa atribuída a ' + ATUAL + ' ao responder.'); }
    if (opcoes.ia !== 1) meta(l).precisa = '';
    insere(l, m); meta(l).status = 'aberta'; l.nao = 0; delete sug[l.id]; salvar();
    if (window.JP_VAZIO) enviaReal(l, m); // sistema real: nada de entrega nem resposta de mentira
    else { entrega(l, m); if (opcoes.ia !== 1) simulaCliente(l); }
    return m;
  }
  // Manda pelo servidor (uazapi). Se o WhatsApp estiver desligado ou travado, a mensagem fica como "não enviada" com o motivo.
  function enviaReal(l, m) {
    var id = l.id;
    function falha(motivo) { m.st = 'falhou'; m.erro = motivo; salvar(); atualizaMsgs(id); desenhaItem(id); toast('Não enviada: ' + motivo); }
    if (m.k) { setTimeout(function () { falha('o envio de anexos e áudios ainda não está disponível.'); }, 0); return; }
    fetch('/api/whatsapp/enviar', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-jp': '1' }, body: JSON.stringify({ fone: l.fone, texto: m.t, lead: l.id }) })
      .then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (j) {
        if (j.ok) { m.st = 'enviada'; delete m.erro; salvar(); atualizaMsgs(id); desenhaItem(id); }
        else falha(j.motivo || j.erro || 'o servidor recusou o envio.');
      })
      .catch(function () { falha('sem conexão com o servidor.'); });
  }
  function entrega(l, m) {
    var id = l.id;
    function passo(st, ms) { setTimeout(function () { if (m.st === 'falhou') return; m.st = st; salvar(); atualizaMsgs(id); desenhaItem(id); }, ms); }
    passo('enviada', 350); passo('entregue', 900); passo('lida', 2000);
  }
  function simulaCliente(l) {
    var id = l.id;
    if (l.optout) return;
    setTimeout(function () { digitando[id] = true; atualizaMsgs(id); atualizaCab(id); desenhaItem(id); }, 2600);
    setTimeout(function () {
      digitando[id] = false;
      recebe(l, { t: I.RESPOSTAS[Math.floor(Math.random() * I.RESPOSTAS.length)] });
    }, 5200);
  }
  function recebe(l, spec) {
    var m = { d: 'c', t: spec.t || '', ts: Date.now() };
    ['k', 'dur'].forEach(function (c) { if (spec[c] !== undefined) m[c] = spec[c]; });
    insere(l, m); meta(l).status = 'aberta';
    if (!aberta(l.id)) l.nao = (l.nao || 0) + 1;
    salvar(); ctx.selos();
    if (ctx.modulo() === 'conversas') { desenhaLista(); if (X.sel === l.id) { atualizaMsgs(l.id, true); atualizaCab(l.id); } }
    aposCliente(l, m);
  }
  function aposCliente(l, m) {
    if (!efetivaIA(l) || l.optout) { if (X.sel === l.id) desenhaSug(); return; }
    var id = l.id;
    if (tec().modo === 'auto') {
      var d = decidir(m, l);
      if (d.silencio) return;
      digitandoIA[id] = true; atualizaMsgs(id, true); desenhaItem(id);
      setTimeout(function () {
        digitandoIA[id] = false;
        if (!efetivaIA(l)) { atualizaMsgs(id); desenhaItem(id); return; }
        if (d.humano) passaParaHumano(l, d.motivo);
        else { enviarMsg(l, { t: d.texto }, { ia: 1 }); D.conv.contIA.auto++; salvar(); }
        if (ctx.modulo() === 'conversas') { desenhaLista(); atualizaMsgs(id, true); atualizaCab(id); desenhaSug(); }
      }, 1500);
    } else gerarSugestao(l, m);
  }
  function passaParaHumano(l, motivo) {
    var mt = meta(l); mt.ia = 'humano'; mt.precisa = motivo;
    I.sistema(l, 'A IA passou a conversa para atendimento humano: ' + motivo + '.'); l.msgs[l.msgs.length - 1].ia = 1;
    D.conv.contIA.passagens++;
    if (!aberta(l.id)) l.nao = (l.nao || 0) + 1;
    salvar(); ctx.selos();
    toast('A IA passou a conversa de ' + l.nome + ' para atendimento humano: ' + motivo + '.');
  }
  function gerarSugestao(l, m, tomForcado) {
    var id = l.id; sug[id] = { estado: 'gerando', ts: m.ts };
    if (X.sel === id) desenhaSug();
    clearTimeout(timers['sug' + id]);
    timers['sug' + id] = setTimeout(function () {
      var u = ultimaMsg(l); if (!u || u.ts !== m.ts || !sug[id]) return;
      var d = decidir(m, l, tomForcado);
      sug[id] = d.silencio ? { estado: 'nenhuma', ts: m.ts } : { estado: 'pronta', ts: m.ts, d: d };
      if (X.sel === id && ctx.modulo() === 'conversas') desenhaSug();
    }, 900);
  }
  function garanteSugestao(l) {
    var u = ultimaMsg(l);
    if (tec().modo !== 'sugerir' || !efetivaIA(l) || !aguardando(l)) return;
    if (!sug[l.id] || sug[l.id].ts !== u.ts) gerarSugestao(l, u);
  }

  /* ---------- lista ---------- */
  function filtradas() {
    var b = norm(X.busca).trim(), nb = I.digitos(X.busca);
    return D.leads.filter(function (l) {
      if (X.filtro === 'nao' && !l.nao) return false;
      if (X.filtro === 'aguardando' && !aguardando(l)) return false;
      if (X.filtro === 'minhas' && l.resp !== ATUAL) return false;
      if (X.filtro === 'ia' && !efetivaIA(l)) return false;
      if (X.etq && l.etq.indexOf(X.etq) < 0) return false;
      if (X.resp === '__sem' ? !!l.resp : (X.resp && l.resp !== X.resp)) return false;
      if (b && !(norm(l.nome).indexOf(b) >= 0 || (nb && I.digitos(l.fone).indexOf(nb) >= 0) || l.msgs.some(function (m) { return m.d !== 's' && norm(m.t).indexOf(b) >= 0; }))) return false;
      return true;
    }).sort(function (a, c) { return I.ordemUlt(c) - I.ordemUlt(a); });
  }
  function contagens() {
    return { todas: D.leads.length, nao: D.leads.filter(function (l) { return l.nao; }).length, aguardando: D.leads.filter(aguardando).length,
      minhas: D.leads.filter(function (l) { return l.resp === ATUAL; }).length, ia: D.leads.filter(efetivaIA).length };
  }
  function tickMini(m) {
    if (m.st === 'falhou') return ic('alerta', 'p erro');
    if (m.st === 'enviando') return ic('relogio', 'p');
    return ic(m.st === 'enviada' ? 'check' : 'check2', 'p' + (m.st === 'lida' ? ' lida' : ''));
  }
  function previa(l) {
    var b = norm(X.busca).trim(), u = ultimaMsg(l);
    if (digitando[l.id]) return '<span class="xpre dig">digitando…</span>';
    if (digitandoIA[l.id]) return '<span class="xpre dig ia">IA digitando…</span>';
    if (b) {
      var ach = l.msgs.filter(function (m) { return m.d !== 's' && m.t && norm(m.t).indexOf(b) >= 0; }).slice(-1)[0];
      if (ach && ach !== u) return '<span class="xpre">' + realce(ach.t) + '</span>';
    }
    if (!u) return '<span class="xpre">Sem mensagens</span>';
    var eu = u.d === 'j', corpo = u.k === 'audio' ? ic('mic', 'p') + 'Áudio ' + mmss(u.dur) : u.k === 'img' ? ic('imagem', 'p') + esc(u.t || 'Foto') : u.k === 'doc' ? ic('doc', 'p') + esc(u.arq.nome) : realce(u.t);
    return '<span class="xpre' + (u.st === 'falhou' ? ' erro' : '') + '">' + (eu ? tickMini(u) : '') + corpo + '</span>';
  }
  function itemHtml(l) {
    var mt = meta(l), ag = aguardando(l), u = ultimaMsg(l), ia = efetivaIA(l);
    return '<button class="xi' + (X.sel === l.id ? ' ativo' : '') + (mt.status === 'resolvida' ? ' resolvida' : '') + (l.nao ? ' nao' : '') + '" data-x-abre="' + l.id + '" id="xi-' + l.id + '"' + (X.sel === l.id ? ' aria-current="true"' : '') + '>' + avatar(l.nome) +
      '<span class="xi-meio"><span class="xi-topo"><b>' + realce(l.nome) + '</b><time>' + (u ? horaLista(u.ts) : '') + '</time></span>' +
      '<span class="xi-previa">' + previa(l) + (l.nao ? '<span class="xnao" aria-label="' + l.nao + ' não lidas">' + l.nao + '</span>' : '') + '</span>' +
      '<span class="xi-pe">' + (mt.precisa ? '<span class="xtag humano">' + ic('alerta') + 'Precisa de humano</span>' : '') + (ia && !mt.precisa ? '<span class="xtag ia">' + ic('brilho') + 'IA atende</span>' : '') +
      l.etq.slice(0, mt.precisa || ia ? 1 : 2).map(I.chipEtq).join('') +
      (mt.status === 'resolvida' ? '<span class="xtag ok">' + ic('check') + 'Resolvida</span>' : ag ? '<span class="xtag espera">' + ic('relogio') + 'Aguarda ' + haTempo(u.ts).replace('há ', '') + '</span>' : '') +
      '<span class="xi-resp">' + (l.resp ? esc(primeiro(l.resp)) : 'Sem responsável') + '</span></span></span></button>';
  }
  function esqueletoLista() {
    var s = ''; for (var i = 0; i < 7; i++) s += '<div class="xi sk"><span class="xav sk"></span><span class="xi-meio"><i class="sk l1"></i><i class="sk l2"></i><i class="sk l3"></i></span></div>';
    return s;
  }
  function desenhaLista() {
    var el = $('#xItens'); if (!el) return;
    var c = contagens(), ch = [['todas', 'Todas'], ['nao', 'Não lidas'], ['aguardando', 'Aguardando'], ['minhas', 'Minhas'], ['ia', 'IA']];
    $('#xChips').innerHTML = ch.map(function (f) { return '<button class="xchip' + (X.filtro === f[0] ? ' ativo' : '') + '" data-x-f="' + f[0] + '" aria-pressed="' + (X.filtro === f[0]) + '">' + f[1] + '<b>' + c[f[0]] + '</b></button>'; }).join('');
    if (X.carregandoLista) { el.innerHTML = esqueletoLista(); el.setAttribute('aria-busy', 'true'); return; }
    el.removeAttribute('aria-busy');
    var ls = filtradas(), filtrando = X.busca || X.filtro !== 'todas' || X.resp || X.etq;
    el.innerHTML = ls.length ? ls.map(itemHtml).join('') :
      '<div class="xvazio peq">' + ic(X.busca ? 'busca' : 'conversa', 'grande') + '<h3>' + (X.busca ? 'Nada encontrado para “' + esc(X.busca) + '”' : 'Nenhuma conversa neste filtro') + '</h3><p>' +
      (X.busca ? 'Busque por nome, telefone ou um trecho da mensagem.' : 'Quando chegar uma mensagem que combine com este filtro, ela aparece aqui.') + '</p>' + (filtrando ? '<button class="btn pequeno linha" data-x-limpar>Limpar filtros</button>' : '') + '</div>';
    $('#xContagem').textContent = ls.length + (ls.length === 1 ? ' conversa' : ' conversas');
  }
  function desenhaItem(id) {
    var l = lead(id), el = $('#xi-' + id); if (!l || !el || X.carregandoLista) return;
    var novo = document.createElement('div'); novo.innerHTML = itemHtml(l); el.replaceWith(novo.firstChild);
  }

  /* ---------- chat ---------- */
  function tick(m) {
    var rot = { enviando: 'Enviando', enviada: 'Enviada', entregue: 'Entregue', lida: 'Lida', falhou: 'Falhou' }[m.st || 'enviada'];
    var s = m.st === 'falhou' ? ic('alerta', 'tk erro') : m.st === 'enviando' ? ic('relogio', 'tk') : ic(m.st === 'enviada' ? 'check' : 'check2', 'tk' + (m.st === 'lida' ? ' lida' : ''));
    return '<span class="xtk" title="' + rot + '" role="img" aria-label="' + rot + '">' + s + '</span>';
  }
  function onda(seed, n) {
    var h = '', s = seed;
    for (var i = 0; i < n; i++) { s = (s * 9301 + 49297) % 233280; h += '<i style="height:' + (22 + Math.round(s / 233280 * 70)) + '%"></i>'; }
    return h;
  }
  function corpoMsg(m, i) {
    if (m.k === 'img') return '<img class="xm-img" src="' + m.src + '" alt="Foto enviada" loading="lazy">' + (m.t ? '<p>' + esc(m.t).replace(/\n/g, '<br>') + '</p>' : '');
    if (m.k === 'doc') return '<div class="xm-doc">' + ic('doc') + '<span><b>' + esc(m.arq.nome) + '</b><small>' + esc(m.arq.tam) + ' · PDF</small></span></div>' + (m.t ? '<p>' + esc(m.t) + '</p>' : '');
    if (m.k === 'audio') {
      var on = X.tocando && X.tocando.i === i && X.tocando.id === X.sel;
      return '<div class="xm-audio" data-x-ai="' + i + '" style="--p:' + (on ? X.tocando.p : 0) + '"><button class="xplay" data-x-play="' + i + '" aria-label="' + (on ? 'Pausar' : 'Ouvir') + ' áudio">' + ic(on ? 'pausa' : 'play') + '</button><span class="xonda" aria-hidden="true">' + onda(Math.round(m.ts % 9973), 30) + '</span><span class="xdur">' + mmss(m.dur) + '</span></div>';
    }
    return esc(m.t).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>').replace(/\n/g, '<br>');
  }
  function bolha(m, i, seq) {
    if (m.d === 's') return '<div class="xsis' + (m.ia ? ' ia' : '') + '">' + (m.ia ? ic('brilho') : '') + '<span>' + esc(m.t) + '</span></div>';
    if (m.d === 'n') return '<div class="xnota"><small>' + ic('nota') + 'Nota interna · ' + esc(m.por || '') + ' · só a equipe vê</small>' + esc(m.t).replace(/\n/g, '<br>') + '<time>' + hora(m.ts) + '</time></div>';
    var eu = m.d === 'j';
    return '<div class="xm ' + (eu ? 'j' : 'c') + (seq ? ' seq' : '') + (m.st === 'falhou' ? ' falhou' : '') + '" data-i="' + i + '">' + (m.camp ? '<small class="xm-camp">Campanha: ' + esc(m.camp) + '</small>' : '') + corpoMsg(m, i) +
      '<span class="xm-rod">' + (m.ia ? '<em class="xia" title="' + (m.ia === 2 ? 'Resposta escrita pela IA e aprovada por ' + ATUAL : 'Resposta enviada pela IA') + '">' + ic('brilho') + (m.ia === 2 ? 'IA · aprovada' : 'IA') + '</em>' : '') + '<time>' + hora(m.ts) + '</time>' + (eu ? tick(m) : '') + '</span>' +
      (m.st === 'falhou' ? '<button class="xm-retry" data-x-retry="' + i + '" title="' + esc(m.erro || '') + '">' + ic('alerta') + 'Não enviada' + (m.erro ? ': ' + esc(String(m.erro).replace(/\.$/, '')) : '') + '. Tentar de novo</button>' : '') + '</div>';
  }
  function esqueletoChat() {
    return '<div class="xmsgs-sk" aria-hidden="true"><i class="sk c" style="width:52%"></i><i class="sk c" style="width:34%"></i><i class="sk j" style="width:44%"></i><i class="sk c" style="width:60%"></i><i class="sk j" style="width:30%"></i></div>';
  }
  function msgsHtml(l) {
    var dia = '', html = '', prev = null;
    l.msgs.forEach(function (m, i) {
      var r = I.diaRotulo(m.ts);
      if (r !== dia) { dia = r; prev = null; html += '<div class="xdia"><span>' + esc(r) + '</span></div>'; }
      html += bolha(m, i, prev && (m.d === 'c' || m.d === 'j') && prev.d === m.d && (m.ts - prev.ts) < 300000);
      prev = m;
    });
    if (!l.msgs.length) html = '<div class="xvazio peq">' + ic('conversa', 'grande') + '<h3>Nenhuma mensagem ainda</h3><p>Escreva a primeira mensagem abaixo ou use uma resposta rápida.</p></div>';
    if (digitando[l.id]) html += '<div class="xm c dig"><span class="xpontos" aria-label="digitando"><i></i><i></i><i></i></span></div>';
    if (digitandoIA[l.id]) html += '<div class="xm j dig"><em class="xia">' + ic('brilho') + 'IA</em><span class="xpontos" aria-label="IA digitando"><i></i><i></i><i></i></span></div>';
    return html;
  }
  function atualizaMsgs(id, forcar) {
    if (X.sel !== id || ctx.modulo() !== 'conversas') return;
    var el = $('#xMsgs'), l = lead(id); if (!el || !l || X.carregandoChat) return;
    var perto = forcar || el.scrollHeight - el.scrollTop - el.clientHeight < 90, antes = el.scrollTop;
    el.innerHTML = msgsHtml(l);
    el.scrollTop = perto ? el.scrollHeight : antes;
  }
  function atualizaCab(id) { if (X.sel === id && ctx.modulo() === 'conversas') desenhaCab(); }
  function desenhaCab() {
    var el = $('#xCab'), l = lead(X.sel); if (!el || !l) return;
    var mt = meta(l), cfg = D.conv.cfg, iaOn = cfg.ativa && mt.ia !== 'humano';
    var sub = digitando[l.id] ? '<small class="dig">digitando…</small>' : '<small>' + esc(l.fone) + ' · ' + esc(I.catOf(l).rot) + (l.resp ? ' · com ' + esc(primeiro(l.resp)) : '') + '</small>';
    el.innerHTML = '<button class="xbtn-ic xvolta" data-x-volta aria-label="Voltar à lista">' + ic('voltar') + '</button>' + avatar(l.nome) +
      '<div class="xcab-nome"><b>' + esc(l.nome) + '</b>' + sub + '</div>' +
      '<div class="xcab-acoes"><div class="xseg" role="group" aria-label="Quem atende esta conversa" title="' + (cfg.ativa ? 'Quem atende esta conversa (Alt+I)' : 'O atendimento por IA está desligado no geral') + '">' +
      '<button data-x-ia="ia" aria-pressed="' + iaOn + '"' + (cfg.ativa ? '' : ' disabled') + '>' + ic('brilho') + 'IA</button><button data-x-ia="humano" aria-pressed="' + !iaOn + '">' + ic('usuario') + 'Humano</button></div>' +
      '<span class="xpopbox"><button class="btn pequeno linha" data-x-pop="transf" aria-haspopup="true" aria-expanded="' + (X.pop === 'transf') + '">' + ic('transferir') + '<span class="t">Transferir</span></button><div class="xpop" id="xPopTransf"' + (X.pop === 'transf' ? '' : ' hidden') + '></div></span>' +
      (mt.status === 'resolvida' ? '<button class="btn pequeno linha" data-x-status="aberta" title="Alt+Enter">' + ic('reabrir') + '<span>Reabrir</span></button>' : '<button class="btn pequeno" data-x-status="resolvida" title="Alt+Enter">' + ic('check') + '<span>Resolver</span></button>') +
      '<button class="xbtn-ic' + (X.perfil || X.mobile === 'perfil' ? ' on' : '') + '" data-x-perfil aria-label="Painel do cliente" aria-pressed="' + X.perfil + '" title="Painel do cliente (Alt+P)">' + ic('painel') + '</button></div>' +
      (l.optout ? '<div class="xaviso">Este contato pediu para sair (SAIR) e está fora das campanhas. Você ainda pode responder se ele escrever.</div>' : '');
    if (X.pop === 'transf') desenhaTransferencia();
  }
  function desenhaTransferencia() {
    var el = $('#xPopTransf'), l = lead(X.sel); if (!el || !l) return;
    el.innerHTML = '<h4>Transferir conversa</h4>' + I.ATENDENTES.map(function (a) {
      var n = D.leads.filter(function (x) { return x.resp === a && aguardando(x); }).length;
      return '<button class="xpop-it" data-x-transf="' + a + '"' + (l.resp === a ? ' disabled' : '') + '><span>' + avatar(a, 1) + '<b>' + esc(a) + (a === ATUAL ? ' (você)' : '') + '</b></span><small>' + (l.resp === a ? 'Atende agora' : n + ' aguardando') + '</small></button>';
    }).join('') + '<label class="sr" for="xTransfNota">Nota para quem recebe</label><textarea id="xTransfNota" rows="2" placeholder="Nota para quem recebe (opcional)"></textarea><small class="xdica">A conversa passa para atendimento humano e a nota fica visível só para a equipe.</small>';
  }
  function desenhaSug() {
    var el = $('#xSug'), l = lead(X.sel); if (!el || !l) return;
    var cfg = D.conv.cfg, s = sug[l.id], mt = meta(l), h = '';
    if (cfg.ativa && mt.ia !== 'humano' && !dentroDaJanela()) h = '<div class="xsug info">' + ic('brilho') + '<span>A IA está fora do horário de atuação combinado. Esta conversa fica com a equipe.</span></div>';
    else if (mt.precisa) h = '<div class="xsug atencao">' + ic('alerta') + '<div><b>A IA passou esta conversa para a equipe</b><span>Motivo: ' + esc(mt.precisa) + '.</span></div>' + (l.resp === ATUAL ? '' : '<button class="btn pequeno" data-x-assumir>Assumir conversa</button>') + '</div>';
    else if (efetivaIA(l) && tec().modo === 'sugerir' && aguardando(l) && s) {
      if (s.estado === 'gerando') h = '<div class="xsug gerando" aria-live="polite">' + ic('brilho') + '<span>A IA está preparando uma resposta</span><span class="xpontos"><i></i><i></i><i></i></span></div>';
      else if (s.estado === 'pronta' && s.d.humano) h = '<div class="xsug atencao">' + ic('alerta') + '<div><b>A IA recomenda atendimento humano</b><span>Motivo: ' + esc(s.d.motivo) + '. Nenhuma resposta foi sugerida.</span></div><button class="btn pequeno linha" data-x-descarta>Entendi</button></div>';
      else if (s.estado === 'pronta') h = '<div class="xsug pronta"><div class="xsug-topo"><span class="xia">' + ic('brilho') + 'Sugestão da IA</span><span class="xtag">' + esc(rotAssunto(s.d.assunto)) + '</span><button class="xbtn-ic peq" data-x-descarta aria-label="Descartar sugestão">' + ic('x') + '</button></div><p>' + esc(s.d.texto) + '</p>' +
        '<div class="xsug-acoes"><button class="btn pequeno" data-x-aprova>' + ic('check') + 'Aprovar e enviar</button><button class="btn pequeno linha" data-x-edita>Editar antes</button><button class="btn pequeno linha" data-x-outra>Outra versão</button></div></div>';
    }
    el.innerHTML = h;
    var m = $('#xMsgs'); if (m && h && m.scrollHeight - m.scrollTop - m.clientHeight < 160) m.scrollTop = m.scrollHeight;
  }
  function desenhaCompor() {
    var el = $('#xCompor'), l = lead(X.sel); if (!el || !l) return;
    var nota = X.aba === 'nota', txt = rascunhos[l.id] || '';
    if (X.gravando) {
      el.innerHTML = '<div class="xgrav"><span class="xrec"></span><b id="xRecT">0:00</b><span class="xonda vivo" aria-hidden="true">' + onda(7, 34) + '</span><button class="btn pequeno linha" data-x-grav="cancela">Cancelar</button><button class="btn pequeno" data-x-grav="envia">' + ic('enviar') + 'Enviar áudio</button></div>';
      return;
    }
    el.innerHTML = '<div class="xabas" role="tablist"><button role="tab" aria-selected="' + !nota + '" class="' + (nota ? '' : 'ativo') + '" data-x-aba="msg">Mensagem</button><button role="tab" aria-selected="' + nota + '" class="' + (nota ? 'ativo nota' : '') + '" data-x-aba="nota">Nota interna</button>' +
      (window.JP_VAZIO ? '</div>' : '<span class="xabas-dir"><span class="xpopbox"><button class="btn pequeno linha" data-x-pop="sim" aria-haspopup="true" title="Só na demonstração: faz o cliente escrever">' + ic('usuario') + '<span>Simular cliente</span></button><div class="xpop direita" id="xPopSim"' + (X.pop === 'sim' ? '' : ' hidden') + '></div></span></span></div>') +
      '<div class="xrap" id="xRap" role="listbox" aria-label="Respostas rápidas" hidden></div>' +
      '<div class="xlinha' + (nota ? ' nota' : '') + '"><span class="xpopbox"><button class="xbtn-ic" data-x-pop="anexo" aria-label="Anexar" aria-haspopup="true" title="Anexar"' + (nota ? ' disabled' : '') + '>' + ic('clipe') + '</button><div class="xpop" id="xPopAnexo"' + (X.pop === 'anexo' ? '' : ' hidden') + '></div></span>' +
      '<button class="xbtn-ic" data-x-rapb aria-label="Respostas rápidas" title="Respostas rápidas (Alt+R)"' + (nota ? ' disabled' : '') + '>' + ic('raio') + '</button>' +
      '<textarea id="xTexto" rows="1" placeholder="' + (nota ? 'Anotação interna (o cliente não recebe)' : mobile() ? 'Mensagem' : 'Escreva uma mensagem ou digite /') + '" aria-label="' + (nota ? 'Nota interna' : 'Mensagem') + '"></textarea>' +
      '<button class="xbtn-ic" data-x-grav="inicia" aria-label="Gravar áudio" title="Gravar áudio"' + (nota ? ' disabled' : '') + '>' + ic('mic') + '</button>' +
      '<button class="btn xenviar" data-x-enviar>' + ic(nota ? 'nota' : 'enviar') + '<span>' + (nota ? 'Salvar nota' : 'Enviar') + '</span></button></div>' +
      '<small class="xdica">Enter envia · Shift+Enter quebra a linha · / respostas rápidas · <button class="xlink" data-x-atalhos>todos os atalhos</button></small>';
    var ta = $('#xTexto'); ta.value = txt; cresce(ta);
    if (X.pop === 'anexo') desenhaAnexo(); if (X.pop === 'sim') desenhaSimular();
  }
  function cresce(ta) { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 130) + 'px'; }
  function desenhaAnexo() {
    var el = $('#xPopAnexo'); if (!el) return;
    el.innerHTML = '<h4>Anexar</h4><button class="xpop-it" data-x-anexo="img">' + ic('imagem') + '<b>Foto do produto</b></button><button class="xpop-it" data-x-anexo="orc">' + ic('doc') + '<b>Orçamento em PDF</b></button><button class="xpop-it" data-x-anexo="tab">' + ic('doc') + '<b>Tabela de preços do dia</b></button><small class="xdica">Anexos simulados. O texto digitado vai como legenda.</small>';
  }
  function desenhaSimular() {
    var el = $('#xPopSim'); if (!el) return;
    el.innerHTML = '<h4>Simular mensagem do cliente</h4>' + SIMULAR.map(function (s, i) { return '<button class="xpop-it col" data-x-sim="' + i + '"><b>' + s[0] + '</b><small>' + (s[1].t ? esc(s[1].t) : 'Áudio de 12 segundos') + '</small></button>'; }).join('') + '<small class="xdica">Só para a demonstração: veja a IA sugerir, responder ou passar para a equipe.</small>';
  }
  function desenhaRapidas(filtro) {
    var el = $('#xRap'), l = lead(X.sel); if (!el || !l) return;
    var f = filtro ? filtro.toLowerCase() : '';
    var lista = RAP.filter(function (r) { return !f || r[0].indexOf(f) === 0 || norm(r[1]).indexOf(norm(f.slice(1))) >= 0; });
    X.rapLista = lista; X.rap = Math.min(X.rap, Math.max(0, lista.length - 1));
    el.innerHTML = lista.length ? lista.map(function (r, i) { return '<button role="option" aria-selected="' + (i === X.rap) + '" class="' + (i === X.rap ? 'ativo' : '') + '" data-x-usa="' + RAP.indexOf(r) + '"><b>' + r[0] + '</b><span>' + esc(r[1].replace(/\{nome\}/g, primeiro(l.nome))) + '</span></button>'; }).join('') + '<small class="xdica">↑ ↓ para escolher · Enter ou Tab para usar · Esc fecha</small>' :
      '<p class="xvazio-t">Nenhuma resposta rápida com esse atalho.</p>';
    var at = $('.ativo', el); if (at && at.scrollIntoView) at.scrollIntoView({ block: 'nearest' });
  }
  function abreRapidas(filtro) { X.rapAberta = true; var el = $('#xRap'); if (!el) return; el.hidden = false; desenhaRapidas(filtro || ''); }
  function fechaRapidas() { X.rapAberta = false; X.rap = 0; var el = $('#xRap'); if (el) el.hidden = true; }
  function desenhaChat() {
    var el = $('#xChat'); if (!el) return;
    var l = X.sel ? lead(X.sel) : null;
    if (!l) {
      el.innerHTML = '<div class="xvazio">' + ic('conversa', 'grande') + '<h2>Selecione uma conversa</h2><p>Escolha um contato na lista para ver o histórico, responder, anotar e mover no funil. Dica: Ctrl+K busca por nome, telefone ou mensagem.</p></div>';
      return;
    }
    el.innerHTML = '<header class="xcab" id="xCab"></header><div class="xmsgs" id="xMsgs" tabindex="0" aria-label="Mensagens"></div><div id="xSug" aria-live="polite"></div><footer class="xcompor" id="xCompor"></footer>';
    desenhaCab(); desenhaSug(); desenhaCompor();
    var m = $('#xMsgs');
    if (X.carregandoChat) { m.innerHTML = esqueletoChat(); m.setAttribute('aria-busy', 'true'); }
    else { m.innerHTML = msgsHtml(l); m.scrollTop = m.scrollHeight; }
  }

  /* ---------- painel do cliente ---------- */
  function sec(chave, titulo, corpo, aberta) {
    var ab = X.abertos[chave] === undefined ? aberta : X.abertos[chave];
    return '<details class="xsec" data-x-sec="' + chave + '"' + (ab ? ' open' : '') + '><summary>' + titulo + '</summary><div class="xsec-c">' + corpo + '</div></details>';
  }
  function enderecoDe(l) {
    var S = ctx.estado(), ped = S.pedidos.filter(function (p) { return p.cliente === l.nome && p.endereco; })[0], c = I.cliente(l), bairro = (ped && ped.bairro) || (c && c.bairro) || l.bairro;
    var b = bairro ? window.JP.BAIRROS.filter(function (x) { return x.nome === bairro; })[0] : null;
    var taxa = b ? '<p class="xmut">Taxa de entrega do bairro: ' + ctx.brl(b.taxa) + '</p>' : '';
    var pedir = '<button class="btn pequeno linha" data-x-usa="' + IDX_ENDERECO + '">Pedir endereço completo</button>';
    if (ped) return '<p class="xend"><b>' + esc(ped.endereco) + '</b><br>' + esc(ped.bairro) + ' · Fortaleza, CE</p>' + taxa;
    if (bairro) return '<p class="xend"><b>Bairro ' + esc(bairro) + '</b><br>Rua e número ainda não informados.</p>' + taxa + pedir;
    return '<div class="xvazio peq">' + ic('usuario', 'grande') + '<p>Endereço ainda não informado. Pergunte o bairro para calcular a taxa de entrega.</p>' + pedir + '</div>';
  }
  function desenhaPerfil() {
    var el = $('#xPerfil'); if (!el) return;
    var l = X.sel ? lead(X.sel) : null;
    el.hidden = !l || (!X.perfil && !mobile()); if (!l) { el.innerHTML = ''; return; }
    var c = I.cliente(l), cat = I.catOf(l), S = ctx.estado(), mt = meta(l);
    var peds = S.pedidos.filter(function (p) { return p.cliente === l.nome; }).slice(0, 4);
    var etqs = D.etiquetas.map(function (e) { return '<button class="xetq ' + I.etqCls(e) + (l.etq.indexOf(e) >= 0 ? ' on' : '') + '" data-x-etq="' + esc(e) + '" aria-pressed="' + (l.etq.indexOf(e) >= 0) + '">' + esc(e) + '</button>'; }).join('');
    var opEtapa = I.ETAPAS.map(function (e) { return '<option value="' + e[0] + '"' + (l.etapa === e[0] ? ' selected' : '') + '>' + e[1] + '</option>'; }).join('');
    var opResp = '<option value="">Sem responsável</option>' + I.ATENDENTES.map(function (a) { return '<option' + (l.resp === a ? ' selected' : '') + '>' + a + '</option>'; }).join('');
    var reais = function (v) { return ctx.brl(v).replace(/,00$/, ''); };
    el.innerHTML = '<div class="xp-cab"><button class="xbtn-ic xvolta-p" data-x-volta-chat aria-label="Voltar à conversa">' + ic('voltar') + '</button><b>Cliente</b><button class="xbtn-ic xfecha" data-x-perfil aria-label="Fechar painel">' + ic('x') + '</button></div>' +
      '<div class="xp-corpo"><div class="xp-topo">' + avatar(l.nome, 1) + '<div><h2>' + esc(l.nome) + '</h2><span class="chip ' + cat.cls + '">' + cat.rot + '</span></div></div>' +
      (c ? '<div class="xp-nums"><div><b>' + c.pedidos + '</b><small>pedidos</small></div><div><b>' + reais(c.total) + '</b><small>comprados</small></div><div><b>' + reais(c.total / c.pedidos) + '</b><small>ticket médio</small></div></div><p class="xmut">Última compra ' + ctx.ha(c.ultima) + '.</p>' : '<p class="xmut">Ainda não comprou: classificado como prospect.</p>') +
      '<dl class="xdl"><dt>Telefone</dt><dd>' + esc(l.fone) + '</dd><dt>Origem</dt><dd>' + esc(l.origem) + '</dd><dt>Interesse</dt><dd>' + esc(l.itens) + '</dd><dt>Em negociação</dt><dd>' + ctx.brl(l.valor) + '</dd>' +
      '<dt><label for="xEtapa">Etapa</label></dt><dd><select id="xEtapa" class="peq">' + opEtapa + '</select></dd><dt><label for="xResp">Responsável</label></dt><dd><select id="xResp" class="peq">' + opResp + '</select></dd>' +
      '<dt>Campanhas</dt><dd>' + (l.optout ? '<span class="chip perigo">Pediu para sair</span>' : '<span class="chip ok">Pode receber</span>') + '</dd></dl>' +
      sec('end', 'Endereço de entrega', enderecoDe(l), true) +
      sec('obs', 'Observações', '<label class="sr" for="xObs">Observações do cliente</label><textarea id="xObs" rows="4" placeholder="Preferências, horários, cuidados com o pedido…">' + esc(mt.obs) + '</textarea><small class="xdica" id="xObsEstado">Salvo automaticamente.</small>', true) +
      sec('ped', 'Pedidos', peds.length ? peds.map(function (p) { return '<div class="xped"><b>' + p.id + '</b><span>' + ctx.brl(ctx.totalPedido(p)) + '</span><small>' + (p.fixo === 'entregue' ? 'Entregue' : p.confirmado ? 'Confirmado' : 'Aguardando confirmação') + ' · ' + (p.tipo === 'retirada' ? 'Retirada' : 'Entrega') + '</small></div>'; }).join('') + '<a class="xlink" href="#pedidos">Ver em Pedidos e delivery</a>' : '<p class="xmut">Nenhum pedido registrado na loja.</p>', true) +
      sec('etq', 'Etiquetas', '<div class="xetqs">' + etqs + '</div><form class="xnovaetq" data-x-nova><input id="xNovaEtq" maxlength="20" placeholder="Nova etiqueta" aria-label="Nova etiqueta"><button class="btn pequeno claro">Criar</button></form>', true) +
      (l.vendido ? '<div class="caixa-venda venda-feita"><h3>Venda confirmada</h3><p>Venda de ' + ctx.brl(l.valor) + ' registrada. Veja o registro no Funil.</p></div>' :
        '<div class="caixa-venda"><h3>Confirmar a venda</h3><p>Move o lead para Vendido, soma na carteira e gera o registro do evento de venda (simulado).</p><button class="btn verde" data-x-venda>Confirmar venda</button></div>') +
      sec('hist', 'Histórico', '<ol class="xhist">' + l.hist.slice().reverse().slice(0, 12).map(function (h) { return '<li><time>' + ctx.dataHora(h.ts) + '</time>' + esc(h.t) + '</li>'; }).join('') + '</ol>', false) + '</div>';
  }

  /* ---------- telas ---------- */
  function cabecalho() {
    var cfg = D.conv.cfg;
    return '<div class="cab xcab-pg"><div><h1>Conversas</h1><p>Atendimento no estilo WhatsApp Web. ' + (window.JP_VAZIO ? 'As mensagens saem pelo WhatsApp (uazapi) quando a integração estiver ligada; enquanto estiver desligada, ficam como não enviadas.' : 'Demonstração: envios simulados, nada sai do navegador.') + '</p></div>' +
      (window.JP_VAZIO ? '<div class="xcab-dir"><a class="btn pequeno linha" href="#whatsapp">IA e WhatsApp: ajustes na tela WhatsApp</a></div></div>' : '<div class="xcab-dir"><span class="xglobal"><span class="xrotulo">Atendimento geral</span><span class="xseg" role="group" aria-label="Atendimento geral"><button data-x-geral="ia" aria-pressed="' + cfg.ativa + '">' + ic('brilho') + 'IA atende</button><button data-x-geral="humano" aria-pressed="' + !cfg.ativa + '">' + ic('usuario') + 'Humano atende</button></span></span></div></div>');
  }
  function conversas(param, tela) {
    if (param && lead(param)) { X.sel = param; X.mobile = 'chat'; }
    else if (mobile()) X.mobile = 'lista';
    if (!X.sel && !mobile()) { var primeira = filtradas()[0]; if (primeira) X.sel = primeira.id; }
    if (X.sel && lead(X.sel) && lead(X.sel).nao && (!mobile() || X.mobile === 'chat')) { lead(X.sel).nao = 0; salvar(); }
    var opResp = '<option value="">Responsável</option><option value="__sem"' + (X.resp === '__sem' ? ' selected' : '') + '>Sem responsável</option>' + I.ATENDENTES.map(function (a) { return '<option' + (X.resp === a ? ' selected' : '') + '>' + a + '</option>'; }).join('');
    var opEtq = '<option value="">Etiqueta</option>' + D.etiquetas.map(function (e) { return '<option' + (X.etq === e ? ' selected' : '') + '>' + esc(e) + '</option>'; }).join('');
    tela.innerHTML = cabecalho() + '<div class="cx ' + (X.perfil ? 'com-perfil ' : '') + 'm-' + X.mobile + '" id="xRaiz">' +
      '<section class="xlista" aria-label="Lista de conversas"><div class="xbusca"><span class="xbusca-c">' + ic('busca') + '<input type="search" id="xBusca" placeholder="Buscar nome, telefone ou mensagem" value="' + esc(X.busca) + '" aria-label="Buscar conversas" autocomplete="off"><kbd title="Atalho">Ctrl K</kbd></span></div>' +
      '<div class="xchips" id="xChips" role="group" aria-label="Filtros"></div>' +
      '<div class="xselects"><select id="xFResp" aria-label="Responsável">' + opResp + '</select><select id="xFEtq" aria-label="Etiqueta">' + opEtq + '</select></div>' +
      '<div class="xcontagem"><span id="xContagem"></span><button class="xlink" data-x-atalhos>' + ic('teclado') + 'Atalhos</button></div>' +
      '<div class="xitens" id="xItens" role="list"></div></section>' +
      '<section class="xchat" id="xChat" aria-label="Conversa"></section><aside class="xperfil" id="xPerfil" aria-label="Painel do cliente"></aside></div>';
    X.carregandoLista = !jaCarregou;
    desenhaLista(); desenhaChat(); desenhaPerfil();
    if (X.sel && lead(X.sel)) { garanteSugestao(lead(X.sel)); desenhaSug(); }
    ctx.selos();
    if (!jaCarregou) { jaCarregou = true; setTimeout(function () { X.carregandoLista = false; if (ctx.modulo() === 'conversas') desenhaLista(); }, 480); }
  }
  function marcaRaiz() { var r = $('#xRaiz'); if (r) r.className = 'cx ' + (X.perfil ? 'com-perfil ' : '') + 'm-' + X.mobile; }
  function abre(id, opcoes) {
    var l = lead(id); if (!l) return;
    opcoes = opcoes || {};
    if (X.sel && lead(X.sel)) { var ta = $('#xTexto'); if (ta) rascunhos[X.sel] = ta.value; }
    pararAudio(); fechaPop(); fechaRapidas();
    var mudou = X.sel !== id;
    X.sel = id; X.mobile = 'chat'; l.nao = 0; salvar();
    if (mobile()) { history.pushState(null, '', '#conversas/' + id); X.empurrou = true; } else history.replaceState(null, '', '#conversas/' + id);
    marcaRaiz(); desenhaLista();
    if (mudou) {
      X.carregandoChat = true; desenhaChat(); desenhaPerfil();
      clearTimeout(timers.chat);
      timers.chat = setTimeout(function () {
        X.carregandoChat = false; if (X.sel !== id || ctx.modulo() !== 'conversas') return;
        var m = $('#xMsgs'); if (m) { m.removeAttribute('aria-busy'); m.innerHTML = msgsHtml(lead(id)); m.scrollTop = m.scrollHeight; }
        garanteSugestao(lead(id)); desenhaSug();
        if (!mobile()) { var t = $('#xTexto'); if (t) t.focus({ preventScroll: true }); }
      }, 170);
    }
    ctx.selos();
  }
  function navega(passo) {
    var ls = filtradas(); if (!ls.length) return;
    var i = ls.map(function (l) { return l.id; }).indexOf(X.sel), n = Math.max(0, Math.min(ls.length - 1, i < 0 ? 0 : i + passo));
    abre(ls[n].id); var it = $('#xi-' + ls[n].id); if (it && it.scrollIntoView) it.scrollIntoView({ block: 'nearest' });
  }

  /* ---------- ações ---------- */
  function fechaPop() { if (!X.pop) return; X.pop = ''; $$('.xpop').forEach(function (p) { p.hidden = true; }); $$('[data-x-pop]').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); }); }
  function alternaPop(nome) {
    var abrir = X.pop !== nome; fechaPop();
    if (!abrir) return;
    X.pop = nome;
    var el = { transf: '#xPopTransf', anexo: '#xPopAnexo', sim: '#xPopSim' }[nome]; if (!el || !$(el)) return;
    if (nome === 'transf') desenhaTransferencia(); else if (nome === 'anexo') desenhaAnexo(); else desenhaSimular();
    $(el).hidden = false; var b = $('[data-x-pop="' + nome + '"]'); if (b) b.setAttribute('aria-expanded', 'true');
  }
  function enviarTexto() {
    var l = lead(X.sel), ta = $('#xTexto'); if (!l || !ta) return;
    var t = ta.value.trim(); if (!t) { toast('Escreva algo antes de enviar.'); return; }
    ta.value = ''; rascunhos[l.id] = ''; cresce(ta); fechaRapidas();
    if (X.aba === 'nota') {
      insere(l, { d: 'n', t: t, ts: Date.now(), por: l.resp || ATUAL }); I.hist(l, 'Nota interna adicionada.'); salvar();
      atualizaMsgs(l.id, true); desenhaPerfil(); toast('Nota salva. O cliente não vê.'); return;
    }
    enviarMsg(l, { t: t });
    atualizaMsgs(l.id, true); atualizaCab(l.id); desenhaSug(); desenhaLista(); desenhaPerfil(); ctx.selos();
  }
  function anexar(tipo) {
    var l = lead(X.sel), ta = $('#xTexto'); if (!l) return;
    var legenda = ta ? ta.value.trim() : ''; if (ta) { ta.value = ''; rascunhos[l.id] = ''; cresce(ta); }
    var fotos = ['img/camarao-cru.webp', 'img/file-tilapia.webp', 'img/salmao.webp', 'img/frutos-do-mar.webp', 'img/camarao-descascado.webp'], spec;
    if (tipo === 'img') spec = { k: 'img', src: fotos[Math.floor(Math.random() * fotos.length)], t: legenda };
    else spec = { k: 'doc', arq: tipo === 'orc' ? { nome: 'orcamento-' + norm(primeiro(l.nome)) + '.pdf', tam: '92 KB' } : { nome: 'tabela-de-precos-do-dia.pdf', tam: '61 KB' }, t: legenda };
    fechaPop(); enviarMsg(l, spec); atualizaMsgs(l.id, true); desenhaLista(); atualizaCab(l.id); desenhaSug();
  }
  function gravacao(acao) {
    var l = lead(X.sel); if (!l) return;
    if (acao === 'inicia') {
      X.gravando = { t0: Date.now() }; desenhaCompor();
      X.gravando.timer = setInterval(function () { var e = $('#xRecT'); if (e && X.gravando) e.textContent = mmss((Date.now() - X.gravando.t0) / 1000); else if (!e) { clearInterval(X.gravando && X.gravando.timer); X.gravando = null; } }, 250);
      return;
    }
    var g = X.gravando; if (!g) return; clearInterval(g.timer); X.gravando = null;
    if (acao === 'envia') { enviarMsg(l, { k: 'audio', dur: Math.max(2, Math.round((Date.now() - g.t0) / 1000)), t: '' }); atualizaMsgs(l.id, true); desenhaLista(); atualizaCab(l.id); desenhaSug(); }
    desenhaCompor(); var ta = $('#xTexto'); if (ta) ta.focus();
  }
  function tocar(i) {
    var l = lead(X.sel), m = l && l.msgs[i]; if (!m) return;
    var ja = X.tocando && X.tocando.i === i; pararAudio(); if (ja) { atualizaMsgs(l.id); return; }
    X.tocando = { i: i, id: l.id, p: 0 };
    var passo = 100 / (m.dur * 10);
    X.tocando.timer = setInterval(function () {
      var t = X.tocando; if (!t) return; t.p += passo;
      var el = $('[data-x-ai="' + t.i + '"]'); if (t.p >= 100 || !el) { pararAudio(); atualizaMsgs(t.id); return; }
      el.style.setProperty('--p', t.p);
    }, 100);
    atualizaMsgs(l.id);
  }
  function pararAudio() { if (X.tocando) { clearInterval(X.tocando.timer); X.tocando = null; } }
  function aprovaSugestao(editar) {
    var l = lead(X.sel), s = l && sug[l.id]; if (!s || s.estado !== 'pronta' || s.d.humano) return;
    if (editar) { X.aba = 'msg'; delete sug[l.id]; rascunhos[l.id] = s.d.texto; desenhaCompor(); $('#xTexto').focus(); desenhaSug(); return; }
    enviarMsg(l, { t: s.d.texto }, { ia: 2 }); D.conv.contIA.aprovadas++; salvar();
    atualizaMsgs(l.id, true); atualizaCab(l.id); desenhaSug(); desenhaLista(); toast('Sugestão da IA aprovada e enviada (simulado).');
  }
  function mudaIA(l, v) {
    var mt = meta(l); if (v === 'ia' && !D.conv.cfg.ativa) return;
    if ((mt.ia || 'ia') === v) return;
    mt.ia = v; if (v === 'ia') mt.precisa = '';
    I.sistema(l, v === 'ia' ? ATUAL + ' ativou o atendimento por IA nesta conversa.' : ATUAL + ' assumiu a conversa: atendimento humano.'); if (v === 'humano') delete sug[l.id];
    salvar(); atualizaMsgs(l.id, true); desenhaCab(); desenhaLista(); garanteSugestao(l); desenhaSug();
    toast(v === 'ia' ? 'Atendimento por IA ligado nesta conversa.' : 'Esta conversa agora é atendida por humano.');
  }
  function mudaGeral(on) {
    var cfg = D.conv.cfg; if (cfg.ativa === on) return; cfg.ativa = on; salvar();
    $$('[data-x-geral]').forEach(function (b) { b.setAttribute('aria-pressed', String((b.dataset.xGeral === 'ia') === on)); });
    desenhaLista(); if (X.sel) { desenhaCab(); if (on) garanteSugestao(lead(X.sel)); desenhaSug(); }
    toast(on ? 'Atendimento por IA ligado no geral.' : 'Atendimento por IA desligado: a equipe atende tudo.');
  }
  function mudaStatus(l, st) {
    meta(l).status = st; var t = st === 'resolvida' ? ATUAL + ' marcou a conversa como resolvida.' : ATUAL + ' reabriu a conversa.';
    I.sistema(l, t); I.hist(l, t); if (st === 'resolvida') delete sug[l.id]; salvar();
    atualizaMsgs(l.id, true); desenhaCab(); desenhaLista(); desenhaSug(); toast(st === 'resolvida' ? 'Conversa resolvida.' : 'Conversa reaberta.');
  }
  function transfere(l, quem) {
    var nota = ($('#xTransfNota') || {}).value || '';
    I.atribui(l, quem); var mt = meta(l); mt.ia = 'humano'; mt.precisa = ''; delete sug[l.id];
    I.sistema(l, ATUAL + ' transferiu a conversa para ' + quem + '.');
    if (nota.trim()) insere(l, { d: 'n', t: nota.trim(), ts: Date.now() + 1, por: ATUAL });
    salvar(); fechaPop(); atualizaMsgs(l.id, true); desenhaCab(); desenhaSug(); desenhaLista(); desenhaPerfil();
    toast('Conversa transferida para ' + quem + (nota.trim() ? ', com nota interna.' : '.'));
  }
  function usaRapida(idx) {
    var l = lead(X.sel), q = RAP[idx]; if (!l || !q) return;
    if (X.aba !== 'msg') { X.aba = 'msg'; desenhaCompor(); }
    var ta = $('#xTexto'); ta.value = q[1].replace(/\{nome\}/g, primeiro(l.nome)); rascunhos[l.id] = ta.value; cresce(ta); fechaRapidas(); ta.focus();
  }
  function modalAtalhos() {
    if ($('#xModal')) return;
    var f = document.createElement('div'); f.className = 'cp-fundo xmodal'; f.id = 'xModal';
    var L = [['Ctrl + K', 'Buscar conversas'], ['Alt + ↑ / ↓', 'Conversa anterior ou seguinte'], ['Enter', 'Enviar mensagem'], ['Shift + Enter', 'Quebrar a linha'], ['/', 'Abrir respostas rápidas'], ['Alt + R', 'Respostas rápidas'], ['Alt + N', 'Alternar nota interna'], ['Alt + I', 'Alternar IA e humano na conversa'],
      ['Alt + P', 'Mostrar ou ocultar o painel do cliente'], ['Alt + Enter', 'Resolver ou reabrir a conversa'], ['Esc', 'Fechar menus ou voltar à lista'], ['?', 'Abrir esta ajuda']];
    f.innerHTML = '<div class="cp-modal xatalhos" role="dialog" aria-modal="true" aria-labelledby="xAtT"><h2 id="xAtT">Atalhos de teclado</h2><dl>' + L.map(function (a) { return '<dt><kbd>' + a[0] + '</kbd></dt><dd>' + a[1] + '</dd>'; }).join('') + '</dl><div class="xmodal-pe"><button class="btn" data-x-fechamodal>Fechar</button></div></div>';
    document.body.appendChild(f); $('[data-x-fechamodal]', f).focus();
  }
  function fechaModal() { var m = $('#xModal'); if (m) { m.remove(); return true; } return false; }

  /* ---------- eventos ---------- */
  document.addEventListener('click', function (e) {
    if (!D) return;
    var mod = ctx.modulo(), t = e.target.closest('button, a, summary');
    if (X.pop && !e.target.closest('.xpop, [data-x-pop]')) fechaPop();
    var modal = e.target.closest('#xModal');
    if (modal && (e.target === modal || (t && t.dataset.xFechamodal !== undefined))) { fechaModal(); return; }
    if (!t) return;
    var d = t.dataset;
    if (d.xAtalhos !== undefined) { modalAtalhos(); return; }
    if (mod !== 'conversas') return;
    var l = X.sel ? lead(X.sel) : null;
    if (d.xAbre) abre(d.xAbre);
    else if (d.xF) { X.filtro = d.xF; desenhaLista(); }
    else if (d.xLimpar !== undefined) { X.busca = ''; X.filtro = 'todas'; X.resp = ''; X.etq = ''; $('#xBusca').value = ''; $('#xFResp').value = ''; $('#xFEtq').value = ''; desenhaLista(); }
    else if (d.xVolta !== undefined) { pararAudio(); if (X.empurrou) { X.empurrou = false; history.back(); } else { history.replaceState(null, '', '#conversas'); X.mobile = 'lista'; marcaRaiz(); } }
    else if (d.xVoltaChat !== undefined) { X.mobile = 'chat'; marcaRaiz(); }
    else if (d.xPerfil !== undefined) { if (mobile()) X.mobile = X.mobile === 'perfil' ? 'chat' : 'perfil'; else X.perfil = !X.perfil; marcaRaiz(); desenhaPerfil(); desenhaCab(); }
    else if (d.xPop) alternaPop(d.xPop);
    else if (d.xGeral) mudaGeral(d.xGeral === 'ia');
    else if (!l) return;
    else if (d.xIa) mudaIA(l, d.xIa);
    else if (d.xStatus) mudaStatus(l, d.xStatus);
    else if (d.xTransf) transfere(l, d.xTransf);
    else if (d.xAba) { rascunhos[l.id] = ($('#xTexto') || {}).value || ''; X.aba = d.xAba; fechaRapidas(); desenhaCompor(); $('#xTexto').focus(); }
    else if (d.xEnviar !== undefined) enviarTexto();
    else if (d.xRapb !== undefined) { if (X.rapAberta) fechaRapidas(); else abreRapidas(''); }
    else if (d.xUsa !== undefined && d.xUsa !== '') usaRapida(+d.xUsa);
    else if (d.xAnexo) anexar(d.xAnexo);
    else if (d.xSim !== undefined) { fechaPop(); recebe(l, SIMULAR[+d.xSim][1]); }
    else if (d.xGrav) gravacao(d.xGrav);
    else if (d.xPlay) tocar(+d.xPlay);
    else if (d.xRetry) { var m = l.msgs[+d.xRetry]; if (m) { m.st = 'enviando'; salvar(); atualizaMsgs(l.id); if (window.JP_VAZIO) enviaReal(l, m); else entrega(l, m); } }
    else if (d.xAprova !== undefined) aprovaSugestao(false);
    else if (d.xEdita !== undefined) aprovaSugestao(true);
    else if (d.xOutra !== undefined) { var u = ultimaMsg(l); if (u) { var tons = ['cordial', 'objetivo', 'descontraido']; gerarSugestao(l, u, tons[(tons.indexOf(tec().tom) + 1) % 3]); } }
    else if (d.xDescarta !== undefined) { sug[l.id] = { estado: 'nenhuma', ts: (ultimaMsg(l) || {}).ts }; desenhaSug(); }
    else if (d.xAssumir !== undefined) { I.atribui(l, ATUAL); salvar(); atualizaMsgs(l.id, true); desenhaCab(); desenhaSug(); desenhaLista(); desenhaPerfil(); toast('Você assumiu a conversa.'); }
    else if (d.xEtq) { I.alternaEtq(l, d.xEtq); desenhaPerfil(); desenhaLista(); }
    else if (d.xVenda !== undefined) { I.confirmarVenda(l); atualizaMsgs(l.id, true); desenhaPerfil(); desenhaLista(); ctx.selos(); }
  });
  document.addEventListener('toggle', function (e) { var s = e.target; if (s && s.dataset && s.dataset.xSec) X.abertos[s.dataset.xSec] = s.open; }, true);
  document.addEventListener('change', function (e) {
    if (!D) return; var mod = ctx.modulo(), id = e.target.id || '';
    if (mod === 'conversas') {
      if (id === 'xFResp') { X.resp = e.target.value; desenhaLista(); }
      else if (id === 'xFEtq') { X.etq = e.target.value; desenhaLista(); }
      else if (id === 'xEtapa') { var l = lead(X.sel); I.mudaEtapa(l, e.target.value, l.resp || ATUAL); atualizaMsgs(l.id, true); desenhaPerfil(); desenhaLista(); }
      else if (id === 'xResp') { var l2 = lead(X.sel); I.atribui(l2, e.target.value); atualizaMsgs(l2.id, true); desenhaPerfil(); desenhaCab(); desenhaLista(); toast(e.target.value ? 'Conversa atribuída a ' + e.target.value + '.' : 'Atribuição removida.'); }
    }
  });
  var tObs = null;
  document.addEventListener('input', function (e) {
    if (!D || ctx.modulo() !== 'conversas') return; var id = e.target.id;
    if (id === 'xBusca') { X.busca = e.target.value; desenhaLista(); }
    else if (id === 'xTexto') {
      var v = e.target.value; cresce(e.target); rascunhos[X.sel] = v;
      if (v.charAt(0) === '/' && X.aba === 'msg' && v.indexOf(' ') < 0) { X.rap = 0; abreRapidas(v); } else if (X.rapAberta && v.charAt(0) !== '/') fechaRapidas();
    } else if (id === 'xObs') {
      var l = lead(X.sel), est = $('#xObsEstado'); if (est) est.textContent = 'Salvando…';
      clearTimeout(tObs); tObs = setTimeout(function () { meta(l).obs = e.target.value; salvar(); var e2 = $('#xObsEstado'); if (e2) e2.textContent = 'Salvo agora.'; }, 500);
    }
  });
  document.addEventListener('submit', function (e) {
    if (!D || e.target.dataset.xNova === undefined) return; e.preventDefault();
    var inp = $('#xNovaEtq'), nome = inp.value.trim().replace(/\s+/g, ' ');
    if (!nome) { toast('Digite o nome da etiqueta.'); return; }
    if (D.etiquetas.some(function (x) { return x.toLowerCase() === nome.toLowerCase(); })) { toast('Essa etiqueta já existe.'); return; }
    D.etiquetas.push(nome); I.alternaEtq(lead(X.sel), nome); desenhaPerfil(); desenhaLista(); toast('Etiqueta “' + nome + '” criada e aplicada.');
  });
  document.addEventListener('keydown', function (e) {
    if (!D) return;
    if (e.key === 'Escape' && fechaModal()) return;
    if (ctx.modulo() !== 'conversas') return;
    var tag = (e.target.tagName || '').toLowerCase(), digitandoAgora = tag === 'input' || tag === 'textarea' || tag === 'select';
    var l = X.sel ? lead(X.sel) : null;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if (mobile()) { X.mobile = 'lista'; marcaRaiz(); } var b = $('#xBusca'); if (b) { b.focus(); b.select(); } return; }
    if ((e.ctrlKey || e.metaKey) && e.key === '/') { e.preventDefault(); modalAtalhos(); return; }
    if (e.altKey && e.code === 'ArrowDown') { e.preventDefault(); navega(1); return; }
    if (e.altKey && e.code === 'ArrowUp') { e.preventDefault(); navega(-1); return; }
    if (e.altKey && e.code === 'KeyN' && l) { e.preventDefault(); rascunhos[l.id] = ($('#xTexto') || {}).value || ''; X.aba = X.aba === 'nota' ? 'msg' : 'nota'; desenhaCompor(); $('#xTexto').focus(); return; }
    if (e.altKey && e.code === 'KeyR' && l) { e.preventDefault(); if (X.rapAberta) fechaRapidas(); else { abreRapidas(''); var t0 = $('#xTexto'); if (t0) t0.focus(); } return; }
    if (e.altKey && e.code === 'KeyI' && l) { e.preventDefault(); mudaIA(l, meta(l).ia === 'humano' ? 'ia' : 'humano'); return; }
    if (e.altKey && e.code === 'KeyP' && l) { e.preventDefault(); X.perfil = !X.perfil; marcaRaiz(); desenhaPerfil(); desenhaCab(); return; }
    if (e.altKey && e.key === 'Enter' && l) { e.preventDefault(); mudaStatus(l, meta(l).status === 'resolvida' ? 'aberta' : 'resolvida'); return; }
    if (e.key === 'Escape') {
      if (X.pop) { fechaPop(); return; }
      if (X.rapAberta) { fechaRapidas(); return; }
      if (e.target.id === 'xBusca' && X.busca) { X.busca = ''; e.target.value = ''; desenhaLista(); return; }
      if (mobile() && X.mobile === 'chat') { var v = $('[data-x-volta]'); if (v) v.click(); } else if (mobile() && X.mobile === 'perfil') { X.mobile = 'chat'; marcaRaiz(); }
      return;
    }
    if (e.key === '?' && !digitandoAgora) { e.preventDefault(); modalAtalhos(); return; }
    if (e.target.id === 'xTexto') {
      if (X.rapAberta && X.rapLista && X.rapLista.length) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); X.rap = (X.rap + (e.key === 'ArrowDown' ? 1 : -1) + X.rapLista.length) % X.rapLista.length; desenhaRapidas(e.target.value.charAt(0) === '/' ? e.target.value : ''); return; }
        if ((e.key === 'Enter' && !e.shiftKey) || e.key === 'Tab') { e.preventDefault(); usaRapida(RAP.indexOf(X.rapLista[X.rap])); return; }
      }
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); enviarTexto(); }
      return;
    }
    if (e.key === '/' && !digitandoAgora && l) { e.preventDefault(); var ta = $('#xTexto'); if (ta) { ta.focus(); ta.value = '/'; rascunhos[X.sel] = '/'; X.rap = 0; abreRapidas('/'); } }
  });
  window.addEventListener('popstate', function () { if (!/#conversas\//.test(location.hash)) X.empurrou = false; });

  /* ---------- API ---------- */
  window.CRM.conv = {
    render: function (m, param, tela) {
      ensure(); pararAudio(); fechaPop(); fechaModal();
      conversas(param, tela);
    },
    garante: ensure,
    // redesenha a lista e o chat aberto depois de mensagens inseridas por outro módulo (pós-venda)
    atualizar: function () {
      if (!D || ctx.modulo() !== 'conversas') return;
      desenhaLista(); if (X.sel) { atualizaMsgs(X.sel, true); atualizaCab(X.sel); }
    }
  };
})();
