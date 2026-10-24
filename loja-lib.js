/* Júlia Pescados — regras da loja pública, sem tela: unidade e fração, preço, horário, agendamento, frete, mínimo,
   busca, combos e recompra. Roda no navegador (window.JPL) e no servidor (require), então a loja e o pedido
   seguem a mesma conta. */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(); else raiz.JPL = fabrica();
})(this, function () {
  var SEM = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  var SEM_CURTO = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  var ORDEM_SEMANA = [1, 2, 3, 4, 5, 6, 0];

  function semAcento(t) { return String(t == null ? '' : t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function centavos(v) { return Math.round(+v * 100); }
  function num(v) { return (Math.round(v * 100) / 100).toString().replace('.', ','); }

  /* ---------- configuração da loja (o que a Júlia edita no painel) ---------- */
  function padrao() {
    return {
      nome: 'Júlia Pescados',
      horario: { 0: null, 1: ['08:00', '17:30'], 2: ['08:00', '17:30'], 3: ['08:00', '17:30'], 4: ['08:00', '17:30'], 5: ['08:00', '17:30'], 6: ['08:00', '12:00'] },
      minimo: 50,
      bairros: [
        ['Aldeota', -3.738, -38.5, 6], ['Meireles', -3.7265, -38.493, 7], ['Praia de Iracema', -3.72, -38.51, 8], ['Centro', -3.726, -38.526, 8],
        ['Joaquim Távora', -3.74, -38.51, 6], ['Dionísio Torres', -3.745, -38.5, 6], ['Varjota', -3.729, -38.485, 7], ['Papicu', -3.7385, -38.485, 8],
        ['Cocó', -3.75, -38.48, 9], ['Fátima', -3.755, -38.533, 9], ['Benfica', -3.74, -38.538, 9], ['Montese', -3.77, -38.54, 11],
        ['Parangaba', -3.775, -38.56, 14.5], ['Edson Queiroz', -3.79, -38.485, 12], ['Cambeba', -3.8, -38.49, 16], ['Maraponga', -3.8, -38.57, 21.5],
        ['Messejana', -3.83, -38.495, 24], ['Caucaia (Centro)', -3.736, -38.653, 42]
      ].map(function (b) { return { nome: b[0], lat: b[1], lng: b[2], taxa: b[3] }; }),
      banner: {
        titulo: 'Camarão e pescados frescos, do jeito que a sua mesa merece.',
        texto: 'Distribuidora em Fortaleza: filé de camarão, peixes, petiscos prontos para fritar e produtos regionais. Entregamos em Fortaleza e Caucaia, ou você retira com a gente.',
        selo: 'Pedido sem cadastro'
      },
      contato: { telefone: '(85) 99767-3481', whats: '558597673481', endereco: 'Rua Ceci, 1129, Fortaleza, CE', instagram: 'juliapescados' },
      apresentacao: 'A Júlia Pescados abastece famílias e restaurantes de Fortaleza com camarão, peixes, mariscos e petiscos congelados e embalados com cuidado. Escolha o que precisa, informe seu nome e WhatsApp e pronto: a gente confirma o pedido com você.',
      combos: [
        { id: 'cb-moqueca', nome: 'Kit Moqueca', ativo: true, desc: 'Tudo para uma moqueca cearense: posta de serra, filé de camarão e filé de tilápia.', itens: [['s0101010', 1], ['s1010', 0.5], ['s118', 1]], preco: 0 },
        { id: 'cb-petiscos', nome: 'Kit Petiscos', ativo: true, desc: 'Para a mesa de petiscos: bolinha de camarão, pastel de queijo e coxinha de frango.', itens: [['s244', 1], ['s246', 1], ['s241', 1]], preco: 0 }
      ]
    };
  }
  function mescla(p) {
    var c = padrao(); p = p || {};
    if (p.nome) c.nome = p.nome;
    if (p.horario) Object.keys(p.horario).forEach(function (d) { c.horario[d] = p.horario[d]; });
    if (p.minimo !== undefined && p.minimo !== null && p.minimo !== '') c.minimo = Math.max(0, +p.minimo || 0);
    if (Array.isArray(p.bairros)) c.bairros = p.bairros;
    if (p.banner) Object.keys(p.banner).forEach(function (k) { c.banner[k] = p.banner[k]; });
    if (p.contato) Object.keys(p.contato).forEach(function (k) { c.contato[k] = p.contato[k]; });
    if (p.apresentacao !== undefined) c.apresentacao = p.apresentacao;
    if (Array.isArray(p.combos)) c.combos = p.combos;
    return c;
  }

  /* ---------- unidade, fração e preço ---------- */
  function unidade(p) {
    var un = String(p.un || '').trim().toLowerCase();
    var frac = p.fracionado !== undefined && p.fracionado !== null ? !!p.fracionado : un === 'kg';
    var m, rotulo;
    if (un === 'kg') rotulo = 'por kg';
    else if ((m = /^bandeja (\d+) ?und/.exec(un))) rotulo = 'bandeja com ' + m[1] + ' unidades';
    else if ((m = /^(\d+) ?und/.exec(un))) rotulo = 'pacote com ' + m[1] + ' unidades';
    else if ((m = /^(\d+) ?g$/.exec(un))) rotulo = 'pacote de ' + m[1] + ' g';
    else if (un === 'unidade') rotulo = 'por unidade';
    else if (un === 'peça') rotulo = 'por peça';
    else if (un === 'kit') rotulo = 'kit';
    else rotulo = un ? 'por ' + un : 'por unidade';
    var curto, plural;
    if (un === 'kg') { curto = 'kg'; plural = 'kg'; }
    else if (/^bandeja/.test(un)) { curto = 'bandeja'; plural = 'bandejas'; }
    else if (un === 'unidade') { curto = 'un'; plural = 'un'; }
    else if (un === 'peça') { curto = 'peça'; plural = 'peças'; }
    else if (un === 'kit') { curto = 'kit'; plural = 'kits'; }
    else { curto = 'pacote'; plural = 'pacotes'; }
    return { fracionado: frac, passo: frac ? 0.5 : 1, min: frac ? 0.5 : 1, rotulo: rotulo, curto: curto, plural: plural, porQuilo: un === 'kg' };
  }
  function arredonda(p, q) {
    q = +q; if (!(q > 0)) return 0;
    var u = unidade(p);
    return Math.max(u.min, Math.ceil(Math.round(q / u.passo * 1000) / 1000) * u.passo);
  }
  function arredondaBaixo(p, q) { var u = unidade(p); return Math.floor(Math.round(q / u.passo * 1000) / 1000) * u.passo; }
  function fmtQtd(p, q) {
    var u = unidade(p);
    return num(q) + ' ' + (q === 1 ? u.curto : u.plural);
  }
  function avisoPeso(p, q) {
    var u = unidade(p);
    if (u.porQuilo) return 'Cerca de ' + num(q) + ' kg. O valor é ajustado na pesagem, pelo peso real do que separarmos.';
    if (+p.pesoAprox > 0) return 'Cada ' + u.curto + ' pesa cerca de ' + num(p.pesoAprox) + ' kg (≈ ' + num(p.pesoAprox * q) + ' kg no total). O valor final pode variar um pouco na pesagem.';
    return '';
  }
  function precoEfetivo(p) { var pr = +p.promo; return pr > 0 && pr < +p.preco ? pr : +p.preco; }
  function emPromocao(p) { return precoEfetivo(p) < +p.preco; }
  function totalLinha(p, q) { return Math.round(centavos(precoEfetivo(p)) * q) / 100; }

  /* ---------- horário de funcionamento ---------- */
  function hhmm(d) { return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
  function fmtH(s) { var p = s.split(':'), h = +p[0], m = +p[1]; return h + 'h' + (m ? ('0' + m).slice(-2) : ''); }
  function pad(n) { return ('0' + n).slice(-2); }
  function isoDe(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function dataDe(iso) { var p = iso.split('-'); return new Date(+p[0], +p[1] - 1, +p[2], 12, 0, 0); }
  // "agora" no relógio de Fortaleza, qualquer que seja o fuso do aparelho
  function agora() {
    try { return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Fortaleza' })); } catch (e) { return new Date(); }
  }
  function situacaoLoja(cfg, now) {
    var h = cfg.horario, dia = now.getDay(), hoje = h[dia], t = hhmm(now);
    if (hoje && t >= hoje[0] && t < hoje[1]) return { aberto: true, ate: hoje[1], texto: 'Aberto agora, atendemos até ' + fmtH(hoje[1]) };
    if (hoje && t < hoje[0]) return { aberto: false, texto: 'Fechado agora. Abrimos hoje às ' + fmtH(hoje[0]) };
    for (var i = 1; i <= 7; i++) {
      var d2 = (dia + i) % 7, a = h[d2];
      if (a) return { aberto: false, texto: 'Fechado agora. Abrimos ' + SEM[d2] + ' às ' + fmtH(a[0]) };
    }
    return { aberto: false, texto: 'Fechado no momento.' };
  }
  function resumoHorario(cfg) {
    var grupos = [];
    ORDEM_SEMANA.forEach(function (d) {
      var chave = JSON.stringify(cfg.horario[d] || null), u = grupos[grupos.length - 1];
      if (u && u.chave === chave) u.dias.push(d); else grupos.push({ chave: chave, dias: [d], h: cfg.horario[d] });
    });
    return grupos.map(function (g) {
      var nome = g.dias.length >= 3 ? SEM_CURTO[g.dias[0]] + ' a ' + SEM_CURTO[g.dias[g.dias.length - 1]].toLowerCase()
        : g.dias.length === 2 ? SEM_CURTO[g.dias[0]] + ' e ' + SEM_CURTO[g.dias[1]].toLowerCase() : SEM_CURTO[g.dias[0]];
      return nome + ', ' + (g.h ? fmtH(g.h[0]) + ' às ' + fmtH(g.h[1]) : 'fechado');
    }).join(' · ');
  }

  /* ---------- agendamento ---------- */
  function janelas(cfg, iso, now) {
    var d = dataDe(iso), h = cfg.horario[d.getDay()]; if (!h) return [];
    var ini = +h[0].split(':')[0] * 60 + +h[0].split(':')[1], fim = +h[1].split(':')[0] * 60 + +h[1].split(':')[1], out = [];
    var minutos = function (m) { return pad(Math.floor(m / 60)) + ':' + pad(m % 60); };
    for (var a = ini; a < fim; a += 120) {
      var b = Math.min(a + 120, fim), de = minutos(a), ate = minutos(b);
      if (iso === isoDe(now) && de < hhmm(now)) continue;
      out.push({ de: de, ate: ate, rotulo: 'entre ' + fmtH(de) + ' e ' + fmtH(ate) });
    }
    return out;
  }
  function diasAgendaveis(cfg, now, n) {
    var out = [];
    for (var i = 0; i < 21 && out.length < n; i++) {
      var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, 12, 0, 0), iso = isoDe(d);
      if (!janelas(cfg, iso, now).length) continue;
      out.push({ iso: iso, hoje: i === 0, rotulo: SEM[d.getDay()] + ', ' + pad(d.getDate()) + '/' + pad(d.getMonth() + 1) });
    }
    return out;
  }
  function textoAgendado(iso, j) {
    var d = dataDe(iso);
    return SEM[d.getDay()].replace('-feira', '') + ', ' + pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + ', entre ' + fmtH(j.de) + ' e ' + fmtH(j.ate);
  }

  /* ---------- frete e pedido mínimo ---------- */
  function frete(cfg, nome) {
    var alvo = semAcento(nome).trim(); if (!alvo) return null;
    var b = (cfg.bairros || []).filter(function (x) { return semAcento(x.nome) === alvo; })[0];
    return b ? { bairro: b, taxa: +b.taxa || 0 } : null;
  }
  function minimo(cfg, subtotal) {
    var m = +cfg.minimo || 0, ok = subtotal + 1e-9 >= m;
    return { ok: ok, falta: ok ? 0 : Math.round((m - subtotal) * 100) / 100, minimo: m };
  }

  /* ---------- busca, filtro e ordem ---------- */
  function filtra(lista, o) {
    o = o || {};
    var palavras = semAcento(o.termo).split(/\s+/).filter(Boolean);
    var r = lista.filter(function (p) {
      if (o.cat && o.cat !== 'Todos' && p.cat !== o.cat) return false;
      if (o.so === 'promo' && !emPromocao(p)) return false;
      if (o.so === 'dest' && !p.dest) return false;
      var alvo = semAcento(p.nome + ' ' + (p.cat || ''));
      return palavras.every(function (w) { return alvo.indexOf(w) >= 0; });
    });
    var cmp = { menor: function (a, b) { return precoEfetivo(a) - precoEfetivo(b); }, maior: function (a, b) { return precoEfetivo(b) - precoEfetivo(a); },
      az: function (a, b) { return String(a.nome).localeCompare(b.nome, 'pt-BR'); }, promo: function (a, b) { return (emPromocao(b) ? 1 : 0) - (emPromocao(a) ? 1 : 0); } }[o.ordem];
    return cmp ? r.slice().sort(cmp) : r;
  }

  /* ---------- combos ---------- */
  function achaProd(prods, id) { return prods.filter(function (p) { return p.id === id; })[0]; }
  function precoSeparado(combo, prods) {
    return Math.round((combo.itens || []).reduce(function (t, c) { var p = achaProd(prods, c[0]); return t + (p ? centavos(precoEfetivo(p)) * c[1] : 0); }, 0)) / 100;
  }
  function comboDisponivel(combo, prods) {
    return !!(combo.itens && combo.itens.length) && combo.itens.every(function (c) { var p = achaProd(prods, c[0]); return p && p.estoque >= c[1]; });
  }
  function comboComoProduto(combo, prods) {
    var primeiro = achaProd(prods, ((combo.itens || [])[0] || [])[0]) || {};
    var est = (combo.itens || []).reduce(function (m, c) { var p = achaProd(prods, c[0]); return Math.min(m, p ? Math.floor(p.estoque / c[1]) : 0); }, Infinity);
    return { id: combo.id, nome: combo.nome, cat: 'Combos', un: 'kit', preco: +combo.preco, estoque: est === Infinity ? 0 : est, min: 0, img: combo.img || primeiro.img || 'sem-foto.svg', desc: combo.desc || '', combo: true, itens: combo.itens, dest: true };
  }
  // preço de um combo sem preço combinado = soma dos itens
  function combosAtivos(cfg, prods) {
    return (cfg.combos || []).filter(function (c) { return c.ativo !== false; }).map(function (c) {
      var x = Object.assign({}, c); if (!(+x.preco > 0)) x.preco = precoSeparado(x, prods); return x;
    });
  }

  /* ---------- recompra ---------- */
  function refazPedido(itens, catalogo) {
    var out = [], faltou = [];
    (itens || []).forEach(function (i) {
      var p = achaProd(catalogo, i[0]);
      if (!p || !(p.estoque > 0)) { faltou.push(i[0]); return; }
      var q = i[1];
      if (q > p.estoque) { q = arredondaBaixo(p, p.estoque); faltou.push(i[0]); }
      if (q > 0) out.push([i[0], q]);
    });
    return { itens: out, faltou: faltou };
  }

  return {
    padrao: padrao, mescla: mescla, unidade: unidade, arredonda: arredonda, arredondaBaixo: arredondaBaixo, fmtQtd: fmtQtd, avisoPeso: avisoPeso,
    precoEfetivo: precoEfetivo, emPromocao: emPromocao, totalLinha: totalLinha, agora: agora, situacaoLoja: situacaoLoja, resumoHorario: resumoHorario,
    janelas: janelas, diasAgendaveis: diasAgendaveis, textoAgendado: textoAgendado, frete: frete, minimo: minimo, filtra: filtra,
    precoSeparado: precoSeparado, comboDisponivel: comboDisponivel, comboComoProduto: comboComoProduto, combosAtivos: combosAtivos, refazPedido: refazPedido,
    semAcento: semAcento, num: num
  };
});
