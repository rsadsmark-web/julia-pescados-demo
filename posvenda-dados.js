/* Pós-venda da Julia Pescados — dados e regras compartilhados entre a loja e o painel.
   Receitas no WhatsApp e avaliação depois da entrega. Demonstração: tudo no localStorage, nada é enviado. */
(function () {
  var CHAVE = 'jp_pv_v1';

  var RECEITAS = {
    p1: 'Camarão na manteiga com alho (serve 4)\nIngredientes: 1 kg de camarão cinza lavado, 4 dentes de alho picados, 3 colheres (sopa) de manteiga, suco de 1 limão, sal e salsinha a gosto.\nModo de preparo: tempere o camarão com sal e limão e deixe 10 minutos. Doure o alho na manteiga, junte o camarão e mexe por 4 a 5 minutos, até ficar rosado. Finalize com a salsinha e sirva com arroz branco.',
    p2: 'Camarão ao leite de coco (serve 4)\nIngredientes: 800 g de camarão sem cabeça, 1 cebola, 2 tomates sem pele, 200 ml de leite de coco, coentro, azeite, sal e pimenta.\nModo de preparo: refogue a cebola no azeite, junte o tomate e deixe cozinhar por 5 minutos. Acrescente o camarão e o sal, mexa por 3 minutos, coloque o leite de coco e cozinhe mais 5 minutos. Finalize com o coentro.',
    p3: 'Camarão ao alho e óleo (serve 4)\nIngredientes: 1 kg de camarão descascado e descongelado, 6 dentes de alho laminados, 1/2 xícara de azeite, pimenta calabresa, sal e salsinha.\nModo de preparo: aqueça o azeite em fogo baixo e doure o alho sem deixar queimar. Aumente o fogo, junte o camarão com sal e a pimenta e deixe 3 a 4 minutos, só até ficar opaco. Salpique a salsinha.',
    p4: 'Camarão VG grelhado com ervas (serve 4)\nIngredientes: 1 kg de camarão VG, 3 colheres (sopa) de azeite, 2 dentes de alho amassados, suco de 1 limão, orégano, sal.\nModo de preparo: misture o azeite, o alho, o limão, o orégano e o sal e deixe o camarão nessa marinada por 15 minutos. Grelhe em chapa bem quente por 2 a 3 minutos de cada lado.',
    p5: 'Filé de tilápia grelhado com limão (serve 4)\nIngredientes: 1 kg de filé de tilápia, suco de 2 limões, 2 dentes de alho, azeite, sal, pimenta-do-reino e salsinha.\nModo de preparo: tempere o filé com alho, limão, sal e pimenta por 15 minutos. Aqueça uma frigideira com azeite e grelhe 3 a 4 minutos de cada lado, até dourar. Sirva com legumes ou purê.',
    p6: 'Tilápia inteira assada com batatas (serve 4)\nIngredientes: 1 tilápia inteira, 4 batatas em rodelas, 1 cebola em rodelas, 3 dentes de alho, suco de 2 limões, azeite, sal e colorau.\nModo de preparo: faça cortes na tilápia e tempere com alho, limão, sal e colorau. Forre uma assadeira com a batata e a cebola, coloque o peixe por cima e regue com azeite. Asse a 200 °C por cerca de 40 minutos.',
    p7: 'Salmão com limão e mostarda (serve 4)\nIngredientes: 1 kg de filé de salmão descongelado, 2 colheres (sopa) de mostarda, suco de 1 limão, 1 colher (sopa) de azeite, sal e pimenta-do-reino.\nModo de preparo: misture a mostarda, o limão, o azeite, o sal e a pimenta e espalhe sobre o salmão. Asse a 200 °C por 15 a 20 minutos, até o centro ficar macio.',
    p8: 'Serra frita crocante (serve 4)\nIngredientes: 1 kg de postas de serra, suco de 2 limões, 3 dentes de alho amassados, sal, farinha de trigo e óleo para fritar.\nModo de preparo: tempere as postas com alho, limão e sal por 20 minutos. Passe na farinha de trigo e frite em óleo quente por 4 a 5 minutos de cada lado. Escorra em papel toalha e sirva com limão.',
    p9: 'Anéis de lula à dorê (serve 4)\nIngredientes: 500 g de anéis de lula, 2 ovos batidos, 1 xícara de farinha de trigo, 1 xícara de farinha de rosca, sal, limão e óleo para fritar.\nModo de preparo: tempere a lula com sal e limão. Passe na farinha de trigo, nos ovos e na farinha de rosca. Frite em óleo bem quente por 1 a 2 minutos, só até dourar, para não endurecer.',
    p10: 'Arroz cremoso de frutos do mar (serve 4)\nIngredientes: 500 g de mix de frutos do mar, 2 xícaras de arroz, 1 cebola, 3 dentes de alho, 1 tomate, azeite, caldo de peixe ou legumes, sal e cheiro-verde.\nModo de preparo: refogue a cebola e o alho no azeite, junte o tomate e o mix de frutos do mar por 3 minutos. Acrescente o arroz, cubra com o caldo quente e cozinhe até ficar macio e cremoso. Finalize com cheiro-verde.',
    p11: 'Espetinho de camarão e tilápia na grelha (serve 4)\nIngredientes: 1 kg de camarão sem cabeça, 1 kg de filé de tilápia em cubos, azeite, suco de 2 limões, alho, sal e pimentão em pedaços.\nModo de preparo: deixe o camarão e a tilápia marinando no limão, alho, azeite e sal por 15 minutos. Monte os espetos alternando com o pimentão e leve à grelha por 3 a 4 minutos de cada lado.',
    p12: 'Moqueca do Kit Família (serve 6)\nIngredientes: 1 kg de camarão descascado, 1 kg de filé de peixe, 500 g de lula, 2 tomates, 1 cebola, 1 pimentão, 200 ml de leite de coco, azeite de dendê, coentro, sal e limão.\nModo de preparo: tempere o camarão, o filé e a lula com limão e sal. Em uma panela, faça camadas de cebola, tomate e pimentão, coloque o peixe e a lula e cozinhe por 10 minutos. Junte o camarão, o leite de coco e o dendê e cozinhe mais 5 minutos. Finalize com coentro.'
  };

  var MSG_AVALIACAO = '{nome}, seu pedido {pedido} foi entregue! De 1 a 5, que nota você dá para a Julia Pescados? Se puder, conte em uma frase como foi. E se gostou, indique a gente para amigos e família: é só passar o nosso perfil @juliapescados.';

  // comentários de exemplo usados na simulação da resposta do cliente
  var COMENTARIOS = {
    5: ['Tudo perfeito, o camarão chegou fresquinho e antes do horário.', 'Qualidade excelente, já vou indicar para a família.'],
    4: ['Tudo certo com o produto, só demorou um pouco a entrega.', 'Gostei muito, só achei a embalagem um pouco grande.'],
    3: ['O produto estava bom, mas chegou com pouco gelo.', 'Mais ou menos: o pedido chegou fora do horário combinado.'],
    2: ['O pacote chegou um pouco aberto e a entrega atrasou.', 'Esperava mais, o camarão veio menor do que o de costume.'],
    1: ['Veio um produto diferente do que eu pedi.', 'Pedido chegou muito atrasado e o peixe já descongelado.']
  };

  function padrao() { return { receitas: { ativa: true, textos: {} }, aval: { ativa: true, texto: MSG_AVALIACAO }, envios: [], processados: {}, lista: [], semeado: false }; }
  var estado = null;
  function ler() {
    if (estado) return estado;
    var base = padrao();
    try {
      var s = JSON.parse(localStorage.getItem(CHAVE) || 'null');
      if (s && typeof s === 'object') Object.keys(base).forEach(function (k) { if (s[k] !== undefined) base[k] = s[k]; });
    } catch (e) {}
    estado = base; return estado;
  }
  function salvar() { try { localStorage.setItem(CHAVE, JSON.stringify(estado || ler())); } catch (e) {} }
  function recarregar() { estado = null; return ler(); }
  function reset() { try { localStorage.removeItem(CHAVE); } catch (e) {} estado = null; }

  function receita(id) { var t = ler().receitas.textos[id]; return t != null ? t : (RECEITAS[id] || ''); }
  function editada(id) { var t = ler().receitas.textos[id]; return t != null && t !== RECEITAS[id]; }

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
    RECEITAS: RECEITAS, MSG_AVALIACAO: MSG_AVALIACAO, COMENTARIOS: COMENTARIOS,
    ler: ler, salvar: salvar, recarregar: recarregar, reset: reset, receita: receita, editada: editada,
    doPedido: doPedido, avaliar: avaliar, baixa: baixa, media: media, CHAVE: CHAVE
  };
})();
