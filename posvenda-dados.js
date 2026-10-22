/* Pós-venda da Julia Pescados — dados e regras compartilhados entre a loja e o painel.
   Receitas no WhatsApp e avaliação depois da entrega. Demonstração: tudo no localStorage, nada é enviado. */
(function () {
  var CHAVE = 'jp_pv_v1';

  var MSG_RECEITAS = 'Olá, {nome}! Separamos receitas para o seu pedido {pedido} ({produtos}): {link}\nÉ só abrir e escolher a que mais combina com a sua mesa. Bom apetite!';

  var MSG_AVALIACAO = '{nome}, seu pedido {pedido} foi entregue! De 1 a 5, que nota você dá para a Julia Pescados? Se puder, conte em uma frase como foi. E se gostou, indique a gente para amigos e família: é só passar o nosso perfil @juliapescados.';

  // comentários de exemplo usados na simulação da resposta do cliente
  var COMENTARIOS = {
    5: ['Tudo perfeito, o camarão chegou fresquinho e antes do horário.', 'Qualidade excelente, já vou indicar para a família.'],
    4: ['Tudo certo com o produto, só demorou um pouco a entrega.', 'Gostei muito, só achei a embalagem um pouco grande.'],
    3: ['O produto estava bom, mas chegou com pouco gelo.', 'Mais ou menos: o pedido chegou fora do horário combinado.'],
    2: ['O pacote chegou um pouco aberto e a entrega atrasou.', 'Esperava mais, o camarão veio menor do que o de costume.'],
    1: ['Veio um produto diferente do que eu pedi.', 'Pedido chegou muito atrasado e o peixe já descongelado.']
  };

  function padrao() { return { receitas: { ativa: true, edits: {}, texto: MSG_RECEITAS }, aval: { ativa: true, texto: MSG_AVALIACAO }, envios: [], processados: {}, lista: [], semeado: false }; }
  var estado = null;
  function ler() {
    if (estado) return estado;
    var base = padrao();
    try {
      var s = JSON.parse(localStorage.getItem(CHAVE) || 'null');
      if (s && typeof s === 'object') Object.keys(base).forEach(function (k) { if (s[k] !== undefined) base[k] = s[k]; });
    } catch (e) {}
    if (!base.receitas.edits) base.receitas.edits = {};
    if (!base.receitas.texto) base.receitas.texto = MSG_RECEITAS;
    estado = base; return estado;
  }
  function salvar() { try { localStorage.setItem(CHAVE, JSON.stringify(estado || ler())); } catch (e) {} }
  function recarregar() { estado = null; return ler(); }
  function reset() { try { localStorage.removeItem(CHAVE); } catch (e) {} estado = null; }

  // Receitas: texto padrão (receitas-dados.js) + edições feitas no painel.
  function receitas() {
    var ed = ler().receitas.edits || {};
    return window.RECEITAS_LISTA.map(function (r) { var e = ed[r.id]; return e ? Object.assign({}, r, e, { editada: true }) : Object.assign({}, r, { editada: false }); });
  }
  function receitasDoProduto(prod) { return receitas().filter(function (r) { return r.prod === prod; }); }
  function modeloReceitas(nome, pedido, produtos, link) {
    return ler().receitas.texto.replace(/\{nome\}/g, nome).replace(/\{pedido\}/g, pedido).replace(/\{produtos\}/g, produtos).replace(/\{link\}/g, link);
  }
  // Endereço público da página de receitas, com os produtos do pedido em destaque.
  function linkReceitas(prods, pedido) {
    var u = new URL('receitas.html', location.href);
    if (prods && prods.length) u.searchParams.set('p', prods.join(','));
    if (pedido) u.searchParams.set('pedido', pedido);
    return u.href;
  }

  function doPedido(id) { return ler().lista.filter(function (a) { return a.pedido === id; })[0]; }
  function avaliar(d) {
    var s = ler();
    if (doPedido(d.pedido)) return null;
    var a = { id: 'av' + Date.now() + Math.floor(Math.random() * 99), pedido: d.pedido, cliente: d.cliente, fone: d.fone || '', nota: d.nota, comentario: (d.comentario || '').trim(),
      indicou: !!d.indicou, origem: d.origem || 'Loja', quando: d.quando || Date.now(), respondida: false, resposta: '', convOk: !!d.convOk };
    s.lista.unshift(a); salvar(); return a;
  }
  function baixa(a) { return a.nota <= 3; }
  function media() {
    var l = ler().lista; if (!l.length) return 0;
    return l.reduce(function (t, a) { return t + a.nota; }, 0) / l.length;
  }

  window.PV = {
    MSG_RECEITAS: MSG_RECEITAS, MSG_AVALIACAO: MSG_AVALIACAO, COMENTARIOS: COMENTARIOS,
    ler: ler, salvar: salvar, recarregar: recarregar, reset: reset, receitas: receitas, receitasDoProduto: receitasDoProduto, modeloReceitas: modeloReceitas, linkReceitas: linkReceitas,
    doPedido: doPedido, avaliar: avaliar, baixa: baixa, media: media, CHAVE: CHAVE
  };
})();
