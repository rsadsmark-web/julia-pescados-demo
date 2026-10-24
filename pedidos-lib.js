/* Júlia Pescados — regras do pedido, sem tela: fluxo de status, estoque, entregador, pagamento e comanda.
   Roda no navegador (window.JPD) e no Node (testes). Mexe no estado do painel (jp_demo_v1) que recebe. */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(); else raiz.JPD = fabrica();
})(this, function () {
  var STATUS = ['novo', 'confirmado', 'separando', 'pronto', 'saiu', 'entregue', 'cancelado'];
  var ROTULO = { novo: 'Aguardando confirmação', confirmado: 'Confirmado', separando: 'Separando', pronto: 'Pronto', saiu: 'Saiu para entrega', entregue: 'Entregue', cancelado: 'Cancelado' };
  var limpa = function (v, n) { return String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, n); };
  var brl = function (v) { return 'R$ ' + (Math.round(+v * 100) / 100).toFixed(2).replace('.', ','); };
  var num = function (v) { return (Math.round(v * 100) / 100).toString().replace('.', ','); };
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  /* ---------- status ---------- */
  // pedidos antigos (sem status) são lidos pelos campos de antes
  function statusDe(p) {
    if (p.status && STATUS.indexOf(p.status) >= 0) return p.status;
    if (p.fixo === 'entregue') return 'entregue';
    return p.confirmado ? 'confirmado' : 'novo';
  }
  function proximos(p, de) {
    de = de || statusDe(p);
    var m = { novo: ['confirmado'], confirmado: ['separando'], separando: ['pronto'], pronto: [p.tipo === 'retirada' ? 'entregue' : 'saiu'], saiu: ['entregue'], entregue: [], cancelado: [] }[de] || [];
    return m.concat(de === 'entregue' || de === 'cancelado' ? [] : ['cancelado']);
  }
  function rotulo(p, st) {
    st = st || statusDe(p);
    if (p.tipo === 'retirada') { if (st === 'pronto') return 'Pronto para retirada'; if (st === 'entregue') return 'Retirado'; }
    return ROTULO[st];
  }
  function ativo(p) { var s = statusDe(p); return s !== 'entregue' && s !== 'cancelado'; }

  /* ---------- estoque ---------- */
  function mexeEstoque(S, p, sinal, agora) {
    var movs = [];
    (p.itens || []).forEach(function (i) {
      if (i.combo) i.combo.forEach(function (c) { movs.push([c[0], +(c[1] * i.qtd).toFixed(3)]); }); else movs.push([i.id, +i.qtd]);
    });
    movs.forEach(function (m) {
      var pr = (S.produtos || []).filter(function (x) { return x.id === m[0]; })[0]; if (!pr) return;
      pr.estoque = Math.max(0, +(pr.estoque - sinal * m[1]).toFixed(3));
      S.baixas.unshift({ quando: agora, pedido: p.id, produto: pr.nome, qtd: sinal * m[1], saldo: pr.estoque, tipo: sinal > 0 ? 'venda' : 'estorno' });
    });
  }

  /* ---------- entregador ---------- */
  function emRota(S, exceto) { // entregadores com pedido ainda aberto
    var ocupados = {};
    S.pedidos.forEach(function (x) { if (x !== exceto && x.motoboy && x.tipo === 'entrega' && ativo(x) && statusDe(x) !== 'novo') ocupados[x.motoboy] = (ocupados[x.motoboy] || 0) + 1; });
    return ocupados;
  }
  function escolheEntregador(S, p) {
    var oc = emRota(S, p), ativos = (S.motoboys || []).filter(function (m) { return m.ativo !== false; });
    ativos.sort(function (a, b) { return (oc[a.id] || 0) - (oc[b.id] || 0); });
    return ativos[0] || null;
  }
  function atribui(S, p, id) {
    if (!id) { if (statusDe(p) === 'saiu') return { ok: false, erro: 'O pedido já saiu; não dá para tirar o entregador.' }; p.motoboy = null; return { ok: true }; }
    var m = (S.motoboys || []).filter(function (x) { return x.id === id; })[0];
    if (!m) return { ok: false, erro: 'Entregador não encontrado.' };
    if (m.ativo === false) return { ok: false, erro: 'Entregador inativo.' };
    if (p.tipo !== 'entrega') return { ok: false, erro: 'Retirada não tem entregador.' };
    p.motoboy = id; return { ok: true };
  }

  /* ---------- mudança de status ---------- */
  function muda(S, p, para, op) {
    op = op || {}; var agora = op.agora || Date.now(), de = statusDe(p);
    if (de === para) return { ok: false, erro: 'O pedido já está em "' + rotulo(p, de) + '".' };
    if (proximos(p, de).indexOf(para) < 0) return { ok: false, erro: 'O pedido não pode ir de "' + rotulo(p, de) + '" para "' + rotulo(p, para) + '". Siga as etapas.' };
    var motivo = limpa(op.motivo, 200);
    if (para === 'cancelado' && !motivo) return { ok: false, erro: 'Informe o motivo do cancelamento.' };
    if (para === 'confirmado') {
      p.confirmado = true; p.confirmadoEm = agora;
      if (!p.baixa) { mexeEstoque(S, p, 1, agora); p.baixa = true; }
      if (p.tipo === 'entrega' && !p.motoboy) { var m = escolheEntregador(S, p); if (m) p.motoboy = m.id; }
    } else if (para === 'saiu') {
      if (!p.motoboy) { var m2 = escolheEntregador(S, p); if (!m2) return { ok: false, erro: 'Cadastre um entregador antes de mandar o pedido para a rua.' }; p.motoboy = m2.id; }
      p.saiuEm = agora;
    } else if (para === 'entregue') {
      p.fixo = 'entregue'; p.entregueEm = agora;
    } else if (para === 'cancelado') {
      if (p.baixa) { mexeEstoque(S, p, -1, agora); p.baixa = false; }
      p.motivoCancelamento = motivo; p.canceladoEm = agora;
    }
    p.status = para;
    (p.historico = p.historico || []).push({ st: para, em: agora, por: limpa(op.por, 40) || undefined, motivo: para === 'cancelado' ? motivo : undefined });
    return { ok: true };
  }

  /* ---------- pagamento ---------- */
  function pago(p) { return !!p.pago; }
  function registraPagamento(p, op) {
    op = op || {}; if (p.pago) return { ok: false, erro: 'Este pedido já está marcado como pago.' };
    p.pago = true; p.pagoEm = op.agora || Date.now(); p.pagoPor = limpa(op.por, 40) || undefined;
    p.comprovante = limpa(op.ref, 200) || undefined; if (op.total != null) p.valorPago = +op.total;
    return { ok: true };
  }
  function estornaPagamento(p, op) {
    op = op || {}; var motivo = limpa(op.motivo, 200);
    if (!p.pago) return { ok: false, erro: 'O pedido não está pago.' };
    if (!motivo) return { ok: false, erro: 'Informe o motivo do estorno.' };
    p.pago = false; p.estornoEm = op.agora || Date.now(); p.estornoMotivo = motivo; return { ok: true };
  }
  function resumoPagamento(p) {
    var f = String(p.pagamento || '');
    var quando = /retirada/i.test(f) ? 'na retirada' : /dinheiro|entrega/i.test(f) ? 'na entrega' : 'antes de sair';
    return { forma: f, quando: quando, pago: !!p.pago };
  }

  /* ---------- comanda (impressora térmica 80 mm) ---------- */
  function subtotal(p) { return (p.itens || []).reduce(function (t, i) { return t + Math.round(i.preco * 100) * i.qtd; }, 0) / 100; }
  function total(p) { return Math.round((subtotal(p) + (+p.taxa || 0)) * 100) / 100; }
  function quebra(txt, larg, recuo) {
    var out = [], atual = '', pre = '';
    String(txt).split(/\s+/).filter(Boolean).forEach(function (w) {
      while (w.length > larg - pre.length) { if (atual) { out.push(pre + atual); atual = ''; pre = recuo; } out.push(pre + w.slice(0, larg - pre.length)); w = w.slice(larg - pre.length); pre = recuo; }
      if ((atual + ' ' + w).trim().length > larg - pre.length) { out.push(pre + atual); atual = w; pre = recuo; } else atual = (atual + ' ' + w).trim();
    });
    if (atual) out.push(pre + atual); return out;
  }
  function comandaTexto(p, cfg, larg) {
    larg = larg || 40; var L = [], tr = new Array(larg + 1).join('-');
    var lado = function (a, b) { var e = Math.max(1, larg - a.length - b.length); return a + new Array(e + 1).join(' ') + b; };
    var centro = function (t) { return new Array(Math.max(0, Math.floor((larg - t.length) / 2)) + 1).join(' ') + t; };
    L.push(centro(String((cfg && cfg.nome) || 'Júlia Pescados').toUpperCase())); L.push(centro('PEDIDO ' + p.id)); L.push(tr);
    L = L.concat(quebra('Cliente: ' + p.cliente, larg, '  ')); L.push('WhatsApp: ' + p.fone);
    L.push(p.tipo === 'retirada' ? 'RETIRADA NO LOCAL' : 'ENTREGA — ' + (p.bairro || ''));
    if (p.tipo !== 'retirada' && p.endereco) L = L.concat(quebra(p.endereco, larg, '  '));
    if (p.agendado) L = L.concat(quebra('Agendado: ' + p.agendado, larg, '  '));
    L.push(tr);
    (p.itens || []).forEach(function (i) {
      L = L.concat(quebra(num(i.qtd) + ' ' + (i.un === 'kg' ? 'kg' : i.un || '') + ' ' + i.nome, larg, '  '));
      L.push(lado('  ' + num(i.qtd) + ' x ' + brl(i.preco), brl(Math.round(i.preco * 100) * i.qtd / 100)));
      if (i.obs) L = L.concat(quebra('* ' + i.obs, larg, '  '));
    });
    L.push(tr); L.push(lado('Subtotal', brl(subtotal(p))));
    if (p.tipo !== 'retirada') L.push(lado('Taxa de entrega', brl(p.taxa || 0)));
    L.push(lado('TOTAL', brl(total(p))));
    var pg = resumoPagamento(p);
    L = L.concat(quebra('Pagamento: ' + pg.forma + (p.pago ? ' (PAGO)' : ' (cobrar ' + pg.quando + ')'), larg, '  '));
    if (p.obs) { L.push(tr); L = L.concat(quebra('Obs: ' + p.obs, larg, '  ')); }
    L.push(tr); L.push(centro('Obrigada pela preferência!'));
    return L.join('\n');
  }
  function comandaHtml(p, cfg) {
    return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Comanda ' + esc(p.id) + '</title><style>' +
      '@page{size:80mm auto;margin:3mm}body{width:74mm;margin:0;font:12px/1.35 "Courier New",monospace;color:#000}pre{white-space:pre-wrap;margin:0;font:inherit}' +
      '</style></head><body><pre>' + esc(comandaTexto(p, cfg, 42)) + '</pre></body></html>';
  }

  /* ---------- resumo por entregador ---------- */
  function resumoEntregadores(S, desde) {
    var r = {};
    (S.motoboys || []).forEach(function (m) { r[m.id] = { nome: m.nome, entregues: 0, taxas: 0, emRota: 0 }; });
    S.pedidos.forEach(function (p) {
      var o = p.motoboy && r[p.motoboy]; if (!o || p.tipo !== 'entrega') return;
      var st = statusDe(p);
      if (st === 'entregue' && (p.entregueEm || p.criado) >= desde) { o.entregues++; o.taxas = Math.round((o.taxas + (+p.taxa || 0)) * 100) / 100; }
      else if (st === 'saiu') o.emRota++;
    });
    return r;
  }

  return { STATUS: STATUS, statusDe: statusDe, proximos: proximos, rotulo: rotulo, ativo: ativo, muda: muda, atribui: atribui, escolheEntregador: escolheEntregador,
    pago: pago, registraPagamento: registraPagamento, estornaPagamento: estornaPagamento, resumoPagamento: resumoPagamento,
    comandaTexto: comandaTexto, comandaHtml: comandaHtml, resumoEntregadores: resumoEntregadores, subtotal: subtotal, total: total };
});
