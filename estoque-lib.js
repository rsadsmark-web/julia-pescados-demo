/* Júlia Pescados — regras de estoque, sem tela: entrada, ajuste de contagem, perda, mínimo, alertas, média de venda e
   sugestão de reposição. Toda mudança vira uma linha em S.baixas (tipo: venda, estorno, entrada, ajuste, perda). */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(); else raiz.JPE = fabrica();
})(this, function () {
  var DIA = 86400000, MAX = 1000000;
  var limpa = function (v, n) { return String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, n); };
  var arred = function (v) { return Math.round(v * 1000) / 1000; };
  function acha(S, id) { return (S.produtos || []).filter(function (p) { return p.id === id; })[0]; }
  function registra(S, p, tipo, qtd, op) {
    S.baixas = S.baixas || [];
    var l = { quando: op.agora || Date.now(), produto: p.nome, qtd: arred(qtd), saldo: p.estoque, tipo: tipo };
    if (op.motivo) l.motivo = limpa(op.motivo, 200); if (op.por) l.por = limpa(op.por, 40); if (op.custo > 0) l.custo = +op.custo; if (op.pedido) l.pedido = op.pedido;
    S.baixas.unshift(l); return l;
  }
  function qtdValida(q) { q = +q; return q > 0 && q <= MAX ? q : 0; }

  function entrada(S, id, qtd, op) {
    op = op || {}; var p = acha(S, id), q = qtdValida(qtd);
    if (!p) return { ok: false, erro: 'Produto não encontrado.' };
    if (!q) return { ok: false, erro: 'Informe uma quantidade maior que zero.' };
    p.estoque = arred(p.estoque + q); registra(S, p, 'entrada', q, op); return { ok: true, saldo: p.estoque };
  }
  // contagem física: o saldo passa a ser o contado; a diferença fica registrada
  function ajuste(S, id, novoSaldo, op) {
    op = op || {}; var p = acha(S, id), n = +novoSaldo;
    if (!p) return { ok: false, erro: 'Produto não encontrado.' };
    if (!limpa(op.motivo, 200)) return { ok: false, erro: 'Informe o motivo do ajuste.' };
    if (!(n >= 0) || n > MAX) return { ok: false, erro: 'O saldo contado precisa ser zero ou mais.' };
    var dif = arred(n - p.estoque); if (dif === 0) return { ok: false, erro: 'O saldo contado é igual ao do sistema.' };
    p.estoque = arred(n); registra(S, p, 'ajuste', dif, op); return { ok: true, saldo: p.estoque, diferenca: dif };
  }
  function perda(S, id, qtd, op) {
    op = op || {}; var p = acha(S, id), q = qtdValida(qtd);
    if (!p) return { ok: false, erro: 'Produto não encontrado.' };
    if (!limpa(op.motivo, 200)) return { ok: false, erro: 'Informe o motivo da perda.' };
    if (!q) return { ok: false, erro: 'Informe uma quantidade maior que zero.' };
    if (q > p.estoque) return { ok: false, erro: 'A perda é maior que o saldo em estoque.' };
    p.estoque = arred(p.estoque - q); registra(S, p, 'perda', q, op); return { ok: true, saldo: p.estoque };
  }
  function defineMinimo(S, id, min) {
    var p = acha(S, id), n = parseFloat(min);
    if (!p) return { ok: false, erro: 'Produto não encontrado.' };
    if (!(n >= 0) || n > MAX) return { ok: false, erro: 'O mínimo precisa ser zero ou mais.' };
    p.min = arred(n); return { ok: true };
  }

  /* ---------- situação e alertas ---------- */
  function situacao(p) {
    if (!(p.estoque > 0)) return { cod: 'esgotado', rotulo: 'Esgotado' };
    if (+p.min > 0 && p.estoque <= p.min) return { cod: 'baixo', rotulo: 'Baixo' };
    return { cod: 'normal', rotulo: 'Normal' };
  }
  function alertas(S) {
    var r = { esgotados: [], baixos: [] };
    (S.produtos || []).forEach(function (p) { var c = situacao(p).cod; if (c === 'esgotado' && +p.min > 0) r.esgotados.push(p); else if (c === 'baixo') r.baixos.push(p); });
    return r;
  }

  /* ---------- vendas e reposição ---------- */
  function vendidoNoPeriodo(S, id, dias, agora) {
    var p = acha(S, id); if (!p) return 0; agora = agora || Date.now();
    return arred((S.baixas || []).reduce(function (t, b) {
      if (b.produto !== p.nome || b.quando < agora - dias * DIA || b.quando > agora) return t;
      return t + (b.tipo === 'venda' ? b.qtd : b.tipo === 'estorno' ? b.qtd : 0); // estorno vem com quantidade negativa
    }, 0));
  }
  function mediaDiaria(S, id, dias, agora) { return vendidoNoPeriodo(S, id, dias, agora) / dias; }
  // quanto comprar para cobrir `cobertura` dias de venda, nunca abaixo do mínimo; esgotados e baixos primeiro
  function sugestoes(S, o) {
    o = o || {}; var dias = o.dias || 14, cob = o.cobertura || 7, agora = o.agora || Date.now(), out = [];
    (S.produtos || []).forEach(function (p) {
      var sit = situacao(p).cod, med = mediaDiaria(S, p.id, dias, agora), alvo = Math.max(+p.min || 0, med * cob), falta = alvo - p.estoque;
      var abaixo = sit !== 'normal' && (+p.min > 0 || med > 0), cobre = med > 0 && p.estoque < med * cob;
      if (!(abaixo || cobre) || falta <= 0) return;
      out.push({ id: p.id, nome: p.nome, un: p.un, saldo: p.estoque, min: p.min, mediaDia: arred(med), comprar: Math.ceil(falta * 2) / 2,
        motivo: sit === 'esgotado' ? 'esgotado' : sit === 'baixo' ? 'abaixo do mínimo' : 'não cobre ' + cob + ' dias de venda', ordem: sit === 'esgotado' ? 0 : sit === 'baixo' ? 1 : 2 });
    });
    return out.sort(function (a, b) { return a.ordem - b.ordem || b.mediaDia - a.mediaDia; });
  }
  function extrato(S, id, limite, agora) {
    var p = acha(S, id); if (!p) return [];
    return (S.baixas || []).filter(function (b) { return b.produto === p.nome; }).slice(0, limite || 30);
  }
  function csv(S) {
    var cel = function (v) { return String(v == null ? '' : v).replace(/[;"\n\r]/g, ' '); };
    return ['Produto;Categoria;Unidade;Saldo;Mínimo;Situação'].concat((S.produtos || []).map(function (p) {
      return [p.nome, p.cat, p.un, String(p.estoque).replace('.', ','), String(p.min == null ? 0 : p.min).replace('.', ','), situacao(p).rotulo].map(cel).join(';');
    })).join('\n');
  }

  return { entrada: entrada, ajuste: ajuste, perda: perda, defineMinimo: defineMinimo, situacao: situacao, alertas: alertas,
    vendidoNoPeriodo: vendidoNoPeriodo, mediaDiaria: mediaDiaria, sugestoes: sugestoes, extrato: extrato, csv: csv };
});
