/* Júlia Pescados — nota fiscal (NF-e) pronta para o provedor, sem emitir nada: valida emitente, destinatário e produtos,
   monta o corpo da nota no formato do Focus NFe (confira os campos na homologação do provedor) e diz o que falta.
   A emissão real é outra trava (nf.js no servidor): provedor escolhido, credencial e liberação do servidor. */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(); else raiz.JPNF = fabrica();
})(this, function () {
  var dig = function (v) { return String(v == null ? '' : v).replace(/\D/g, ''); };
  var txt = function (v, n) { return String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, n); };
  var cent = function (v) { return Math.round(+v * 100); };
  var reais = function (c) { return Math.round(c) / 100; };

  function cpfValido(v) {
    var d = dig(v); if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
    for (var t = 9; t < 11; t++) { var s = 0; for (var i = 0; i < t; i++) s += +d[i] * (t + 1 - i); if ((s * 10) % 11 % 10 !== +d[t]) return false; }
    return true;
  }
  function cnpjValido(v) {
    var d = dig(v); if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
    for (var t = 12; t < 14; t++) { var s = 0, p = t - 7; for (var i = 0; i < t; i++) { s += +d[i] * p--; if (p < 2) p = 9; } var r = s % 11 < 2 ? 0 : 11 - s % 11; if (r !== +d[t]) return false; }
    return true;
  }
  function tipoDoc(v) { var d = dig(v); return d.length === 11 ? 'cpf' : d.length === 14 ? 'cnpj' : null; }
  var ncmValido = function (v) { return dig(v).length === 8; };

  function cfgPadrao() {
    return {
      provedor: 'nenhum', ambiente: 'homologacao', serie: 1, naturezaOperacao: 'Venda de mercadoria', cfopPadrao: '5102', csosnPadrao: '102', origemPadrao: 0,
      emitente: { razao: '', cnpj: '', ie: '', regime: 1, logradouro: '', numero: '', bairro: '', municipio: 'Fortaleza', uf: 'CE', cep: '', fone: '', codMunicipio: '2304400' }
    };
  }
  function mescla(p) {
    var c = cfgPadrao(); p = p || {};
    ['provedor', 'ambiente', 'naturezaOperacao', 'cfopPadrao', 'csosnPadrao'].forEach(function (k) { if (p[k] !== undefined && p[k] !== '') c[k] = p[k]; });
    if (+p.serie > 0) c.serie = Math.floor(+p.serie); if (p.origemPadrao !== undefined) c.origemPadrao = +p.origemPadrao || 0;
    if (p.emitente) Object.keys(p.emitente).forEach(function (k) { if (k in c.emitente) c.emitente[k] = p.emitente[k]; });
    return c;
  }
  function pendenciasEmitente(cfg) {
    var e = cfg.emitente || {}, p = [];
    var falta = function (campo, msg) { p.push({ campo: 'emitente.' + campo, msg: msg }); };
    if (!txt(e.razao, 100)) falta('razao', 'Informe a razão social do emitente.');
    if (!cnpjValido(e.cnpj)) falta('cnpj', 'CNPJ do emitente inválido ou em branco.');
    if (!dig(e.ie)) falta('ie', 'Informe a inscrição estadual do emitente.');
    if (![1, 2, 3].includes(+e.regime)) falta('regime', 'Informe o regime tributário (1 Simples, 2 Simples com excesso, 3 normal).');
    if (!txt(e.logradouro, 100) || !txt(e.numero, 20)) falta('logradouro', 'Informe o endereço do emitente (rua e número).');
    if (!txt(e.bairro, 60)) falta('bairro', 'Informe o bairro do emitente.');
    if (dig(e.cep).length !== 8) falta('cep', 'CEP do emitente inválido.');
    if (!txt(e.municipio, 60) || !/^[A-Z]{2}$/.test(String(e.uf || '').toUpperCase()) || dig(e.codMunicipio).length !== 7) falta('municipio', 'Informe município, UF e código IBGE do município do emitente.');
    return p;
  }

  var PAG = { Pix: '17', Dinheiro: '01', 'Cartão na entrega': '03', 'Cartão na retirada': '03', 'Pagar na retirada': '99' };
  function formaPagamento(f) { return PAG[f] || '99'; }
  function cidadeDe(bairro) { return /^caucaia/i.test(bairro || '') ? { nome: 'Caucaia', ibge: '2303709' } : { nome: 'Fortaleza', ibge: '2304400' }; }
  var refDe = function (pedido, cfg) { return pedido.id + '-' + (cfg.serie || 1); };

  // dest: { nome, doc, ie?, logradouro, numero, complemento?, bairro?, cep, municipio? }
  function montaNota(pedido, produtos, cfg, dest, op) {
    cfg = mescla(cfg); dest = dest || {}; op = op || {};
    var pend = pendenciasEmitente(cfg), falta = function (campo, msg) { pend.push({ campo: campo, msg: msg }); };
    var entrega = pedido.tipo !== 'retirada', t = tipoDoc(dest.doc);
    if (!txt(dest.nome, 100)) falta('destinatario.nome', 'Informe o nome do destinatário.');
    if (t === 'cpf' ? !cpfValido(dest.doc) : t === 'cnpj' ? !cnpjValido(dest.doc) : true) falta('destinatario.doc', 'CPF ou CNPJ do destinatário inválido ou em branco.');
    if (entrega) {
      if (dig(dest.cep).length !== 8) falta('destinatario.cep', 'Informe o CEP da entrega.');
      if (!txt(dest.logradouro, 100)) falta('destinatario.logradouro', 'Informe o logradouro (rua) da entrega separado do número.');
      if (!txt(dest.numero, 20)) falta('destinatario.numero', 'Informe o número do endereço da entrega.');
    }
    var itens = pedido.itens || [];
    if (!itens.length) falta('itens', 'O pedido não tem itens.');
    var linhas = itens.map(function (i, k) {
      var pr = (produtos || []).filter(function (x) { return x.id === i.id; })[0] || {}, cop = txt(pr.cfop, 4) || cfg.cfopPadrao;
      if (!ncmValido(pr.ncm)) falta('item.' + (k + 1) + '.ncm', 'NCM do produto "' + (i.nome || pr.nome || i.id) + '" não informado (8 dígitos).');
      var un = String(i.un || pr.un || '').toLowerCase() === 'kg' ? 'KG' : 'UN', bruto = Math.round(cent(i.preco) * i.qtd);
      return { numero_item: k + 1, codigo_produto: txt(i.id, 60), descricao: txt(i.nome || pr.nome, 120), codigo_ncm: dig(pr.ncm), cfop: cop, unidade_comercial: un, quantidade_comercial: +i.qtd,
        valor_unitario_comercial: +i.preco, unidade_tributavel: un, quantidade_tributavel: +i.qtd, valor_unitario_tributavel: +i.preco, valor_bruto: reais(bruto),
        icms_situacao_tributaria: txt(pr.csosn, 3) || cfg.csosnPadrao, icms_origem: pr.origem !== undefined ? +pr.origem : cfg.origemPadrao, pis_situacao_tributaria: '07', cofins_situacao_tributaria: '07', _c: bruto };
    });
    var totProd = linhas.reduce(function (s, l) { return s + l._c; }, 0), frete = entrega ? cent(pedido.taxa || 0) : 0, total = totProd + frete;
    linhas.forEach(function (l) { delete l._c; });
    var e = cfg.emitente, cid = cidadeDe(pedido.bairro), valorTotal = reais(total);
    var payload = {
      natureza_operacao: cfg.naturezaOperacao, data_emissao: new Date(op.agora || Date.now()).toISOString(), tipo_documento: 1, local_destino: 1, finalidade_emissao: 1, consumidor_final: 1,
      presenca_comprador: entrega ? 9 : 1, serie: cfg.serie,
      cnpj_emitente: dig(e.cnpj), nome_emitente: txt(e.razao, 100), inscricao_estadual_emitente: dig(e.ie), regime_tributario_emitente: +e.regime,
      logradouro_emitente: txt(e.logradouro, 100), numero_emitente: txt(e.numero, 20), bairro_emitente: txt(e.bairro, 60), municipio_emitente: txt(e.municipio, 60), uf_emitente: String(e.uf || '').toUpperCase(), cep_emitente: dig(e.cep),
      nome_destinatario: txt(dest.nome, 100), indicador_inscricao_estadual_destinatario: 9,
      modalidade_frete: entrega ? 0 : 9, valor_frete: reais(frete), valor_produtos: reais(totProd), valor_total: valorTotal,
      items: linhas, formas_pagamento: [{ forma_pagamento: formaPagamento(pedido.pagamento), valor_pagamento: valorTotal }]
    };
    if (t === 'cnpj') payload.cnpj_destinatario = dig(dest.doc); else if (t === 'cpf') payload.cpf_destinatario = dig(dest.doc);
    if (entrega) {
      var mun = txt(dest.municipio, 60) || cid.nome;
      Object.assign(payload, { logradouro_destinatario: txt(dest.logradouro, 100), numero_destinatario: txt(dest.numero, 20), bairro_destinatario: txt(dest.bairro, 60) || txt(pedido.bairro, 60), municipio_destinatario: mun,
        uf_destinatario: 'CE', cep_destinatario: dig(dest.cep), codigo_municipio_destinatario: mun === cid.nome ? cid.ibge : undefined });
      if (payload.codigo_municipio_destinatario === undefined) delete payload.codigo_municipio_destinatario;
    }
    return { ok: pend.length === 0, pendencias: pend, payload: payload, ref: refDe(pedido, cfg) };
  }

  // Emitir de verdade exige tudo ao mesmo tempo; o padrão é nada.
  function podeEmitir(cfg, amb) {
    cfg = mescla(cfg); amb = amb || {};
    if (!amb.liberado) return { ok: false, motivo: 'Emissão não liberada neste servidor (NF_EMISSAO_LIBERADA).' };
    if (cfg.provedor !== 'focus') return { ok: false, motivo: 'Nenhum provedor de nota fiscal escolhido.' };
    if (!amb.token) return { ok: false, motivo: 'Credencial (token) do provedor não configurada no servidor.' };
    var p = pendenciasEmitente(cfg); if (p.length) return { ok: false, motivo: 'Dados do emitente incompletos (' + p.length + ' pendência(s)).' };
    return { ok: true };
  }

  return { cpfValido: cpfValido, cnpjValido: cnpjValido, tipoDoc: tipoDoc, ncmValido: ncmValido, cfgPadrao: cfgPadrao, mescla: mescla, pendenciasEmitente: pendenciasEmitente,
    formaPagamento: formaPagamento, montaNota: montaNota, refDe: refDe, podeEmitir: podeEmitir };
});
