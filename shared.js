/* Júlia Pescados — dados e utilidades compartilhados entre a loja e o painel.
   Tudo roda no navegador (localStorage). Nada é enviado a servidor algum. */
(function () {
  var CHAVE = 'jp_demo_v1';
  var WHATS = '558597673481'; // número real do perfil @juliapescados
  var BASE = { nome: 'Base de distribuição', lat: -3.7392, lng: -38.5058 };

  // Tabela de exemplo: taxa fixa por bairro; acima de 8 km soma-se valor por km.
  var BAIRROS = [
    ['Aldeota', -3.7380, -38.5000, 6],
    ['Meireles', -3.7265, -38.4930, 7],
    ['Praia de Iracema', -3.7200, -38.5100, 8],
    ['Centro', -3.7260, -38.5260, 8],
    ['Joaquim Távora', -3.7400, -38.5100, 6],
    ['Dionísio Torres', -3.7450, -38.5000, 6],
    ['Varjota', -3.7290, -38.4850, 7],
    ['Papicu', -3.7385, -38.4850, 8],
    ['Cocó', -3.7500, -38.4800, 9],
    ['Fátima', -3.7550, -38.5330, 9],
    ['Benfica', -3.7400, -38.5380, 9],
    ['Montese', -3.7700, -38.5400, 11],
    ['Parangaba', -3.7750, -38.5600, 12],
    ['Edson Queiroz', -3.7900, -38.4850, 12],
    ['Cambeba', -3.8000, -38.4900, 14],
    ['Maraponga', -3.8000, -38.5700, 14],
    ['Messejana', -3.8300, -38.4950, 16],
    ['Caucaia (Centro)', -3.7360, -38.6530, 22]
  ].map(function (b) { return { nome: b[0], lat: b[1], lng: b[2], taxa: b[3] }; });

  var CATEGORIAS = ['Camarão', 'Peixes e filés', 'Frutos do mar', 'Kits'];

  var PRODUTOS = [
    { id: 'p1', nome: 'Camarão cinza inteiro', cat: 'Camarão', un: 'kg', preco: 49.9, estoque: 42, min: 15, img: 'camarao-cru.jpg', desc: 'Camarão cinza fresco, calibre 40/50. Ideal para frigideira e moqueca.', ncm: '0306.17.00', dest: true },
    { id: 'p2', nome: 'Camarão sem cabeça', cat: 'Camarão', un: 'kg', preco: 56.9, estoque: 36, min: 15, img: 'camarao-congelado.jpg', desc: 'Sem cabeça e com casca. Mais rendimento, menos trabalho.', ncm: '0306.17.00' },
    { id: 'p3', nome: 'Camarão descascado', cat: 'Camarão', un: 'kg', preco: 79.9, estoque: 18, min: 10, img: 'camarao-descascado.jpg', desc: 'Limpo e pronto para o preparo. Congelado em pacote de 1 kg.', ncm: '0306.17.00', dest: true },
    { id: 'p4', nome: 'Camarão VG', cat: 'Camarão', un: 'kg', preco: 64.9, estoque: 9, min: 12, img: 'camarao-cru.jpg', desc: 'Camarão graúdo, perfeito para grelhar ou empanar.', ncm: '0306.17.00' },
    { id: 'p5', nome: 'Filé de tilápia', cat: 'Peixes e filés', un: 'kg', preco: 36.9, estoque: 55, min: 20, img: 'file-tilapia.jpg', desc: 'Filé sem espinha, embalado a vácuo. Campeão de vendas.', ncm: '0304.62.00', dest: true },
    { id: 'p6', nome: 'Tilápia inteira', cat: 'Peixes e filés', un: 'kg', preco: 24.9, estoque: 30, min: 12, img: 'peixes.jpg', desc: 'Inteira, escamada e eviscerada. Pronta para assar.', ncm: '0303.23.00' },
    { id: 'p7', nome: 'Filé de salmão', cat: 'Peixes e filés', un: 'kg', preco: 89.9, estoque: 14, min: 8, img: 'salmao.jpg', desc: 'Filé de salmão em peça, congelado.', ncm: '0304.41.00' },
    { id: 'p8', nome: 'Posta de serra', cat: 'Peixes e filés', un: 'kg', preco: 39.9, estoque: 7, min: 10, img: 'peixes.jpg', desc: 'Postas altas, ótimas para frito, assado ou caldeirada.', ncm: '0303.89.90' },
    { id: 'p9', nome: 'Anéis de lula', cat: 'Frutos do mar', un: 'kg', preco: 42.9, estoque: 20, min: 8, img: 'lula.jpg', desc: 'Lula limpa em anéis, para fritar ou refogar.', ncm: '0307.43.00' },
    { id: 'p10', nome: 'Mix de frutos do mar', cat: 'Frutos do mar', un: 'kg', preco: 58.9, estoque: 16, min: 8, img: 'frutos-do-mar.jpg', desc: 'Camarão, lula e marisco para paella e risoto.', ncm: '0307.99.90' },
    { id: 'p11', nome: 'Kit Churrasco do Mar', cat: 'Kits', un: 'kit', preco: 84.9, estoque: 25, min: 8, img: 'camarao-congelado.jpg', desc: '1 kg de camarão sem cabeça + 1 kg de filé de tilápia.', ncm: '0306.17.00', dest: true },
    { id: 'p12', nome: 'Kit Família', cat: 'Kits', un: 'kit', preco: 119.9, estoque: 12, min: 6, img: 'frutos-do-mar.jpg', desc: '1 kg de camarão descascado + 1 kg de filé + 500 g de lula.', ncm: '0306.17.00' }
  ];

  function agoraMs() { return Date.now(); }
  function dias(n) { return agoraMs() - n * 86400000; }

  function semente() {
    var nomes = [
      ['Marcos Vinícius', 'Aldeota', 18, 3420, 2], ['Restaurante Maré Cheia', 'Centro', 41, 9860, 3],
      ['Carla Mendonça', 'Meireles', 5, 1180, 4], ['Paulo Henrique', 'Cocó', 12, 2240, 6],
      ['Bar do Zeca', 'Varjota', 9, 4310, 1], ['Letícia Alves', 'Fátima', 2, 148, 1],
      ['Joana Darc', 'Messejana', 3, 232, 20], ['Francisco Teixeira', 'Montese', 7, 980, 33],
      ['Denise Marques', 'Papicu', 1, 96, 3], ['Rafael Costa', 'Parangaba', 4, 612, 51],
      ['Silvana Rocha', 'Edson Queiroz', 2, 190, 68], ['Eduardo Pinheiro', 'Aldeota', 15, 3050, 4],
      ['Cantina da Nona', 'Benfica', 22, 5420, 8], ['Tereza Cristina', 'Cambeba', 1, 119, 11],
      ['André Lima', 'Joaquim Távora', 3, 345, 97], ['Beatriz Fontenele', 'Meireles', 6, 1390, 15],
      ['Ivan Gomes', 'Caucaia (Centro)', 2, 260, 72], ['Mônica Sales', 'Dionísio Torres', 8, 1520, 6]
    ];
    var clientes = nomes.map(function (n, i) {
      return { id: 'c' + (i + 1), nome: n[0], fone: '(85) 9' + (8000 + i * 137) + '-' + (1000 + i * 211), bairro: n[1], pedidos: n[2], total: n[3], ultima: dias(n[4]) };
    });

    var motoboys = [
      { id: 'm1', nome: 'Wellington', moto: 'Honda CG 160', fone: '(85) 98877-1020' },
      { id: 'm2', nome: 'Danilo', moto: 'Yamaha Factor 150', fone: '(85) 98833-4417' },
      { id: 'm3', nome: 'Iago', moto: 'Honda Biz 125', fone: '(85) 98122-9054' }
    ];

    var t = agoraMs();
    function it(id, q) { var p = PRODUTOS.filter(function (x) { return x.id === id; })[0]; return { id: id, nome: p.nome, un: p.un, preco: p.preco, qtd: q }; }
    var pedidos = [
      { id: 'JP-1047', cliente: 'Eduardo Pinheiro', fone: '(85) 98211-3340', bairro: 'Aldeota', endereco: 'Rua Desembargador Leite Albuquerque, 820', tipo: 'entrega', pagamento: 'Pix', itens: [it('p1', 3), it('p5', 2)], taxa: 6, criado: t - 40 * 60000, confirmadoEm: t - 38 * 60000, confirmado: true, baixa: true, motoboy: 'm1', laco: 70000, fixo: null },
      { id: 'JP-1048', cliente: 'Carla Mendonça', fone: '(85) 98744-2201', bairro: 'Meireles', endereco: 'Av. Beira Mar, 3100, ap. 402', tipo: 'entrega', pagamento: 'Cartão na entrega', itens: [it('p3', 2), it('p9', 1)], taxa: 7, criado: t - 25 * 60000, confirmadoEm: t - 24 * 60000, confirmado: true, baixa: true, motoboy: 'm2', laco: 90000, fixo: null },
      { id: 'JP-1049', cliente: 'Cantina da Nona', fone: '(85) 98650-1177', bairro: 'Benfica', endereco: 'Rua Carapinima, 1450', tipo: 'entrega', pagamento: 'Pix', itens: [it('p1', 8), it('p10', 3)], taxa: 9, criado: t - 12 * 60000, confirmadoEm: t - 10 * 60000, confirmado: true, baixa: true, motoboy: 'm3', laco: 110000, fixo: null },
      { id: 'JP-1050', cliente: 'Letícia Alves', fone: '(85) 98112-7045', bairro: 'Fátima', endereco: 'Rua Marechal Deodoro, 640', tipo: 'entrega', pagamento: 'Pix', itens: [it('p5', 1), it('p6', 1)], taxa: 9, criado: t - 4 * 60000, confirmado: false, baixa: false, motoboy: null, fixo: null },
      { id: 'JP-1051', cliente: 'Paulo Henrique', fone: '(85) 98399-5522', bairro: '', endereco: '', tipo: 'retirada', pagamento: 'Pagar na retirada', itens: [it('p11', 1)], taxa: 0, criado: t - 2 * 60000, confirmado: false, baixa: false, motoboy: null, fixo: null },
      { id: 'JP-1044', cliente: 'Restaurante Maré Cheia', fone: '(85) 98530-8812', bairro: 'Centro', endereco: 'Rua Major Facundo, 512', tipo: 'entrega', pagamento: 'Pix', itens: [it('p1', 12), it('p9', 4)], taxa: 8, criado: dias(0) - 5 * 3600000, confirmadoEm: dias(0) - 5 * 3600000, confirmado: true, baixa: true, motoboy: 'm1', fixo: 'entregue' },
      { id: 'JP-1045', cliente: 'Marcos Vinícius', fone: '(85) 98801-9034', bairro: 'Aldeota', endereco: 'Rua Silva Jatahy, 233', tipo: 'entrega', pagamento: 'Cartão na entrega', itens: [it('p2', 2), it('p7', 1)], taxa: 6, criado: dias(0) - 4 * 3600000, confirmadoEm: dias(0) - 4 * 3600000, confirmado: true, baixa: true, motoboy: 'm2', fixo: 'entregue' },
      { id: 'JP-1046', cliente: 'Denise Marques', fone: '(85) 98410-6620', bairro: 'Papicu', endereco: 'Rua Ana Bilhar, 1180', tipo: 'entrega', pagamento: 'Pix', itens: [it('p12', 1)], taxa: 8, criado: dias(0) - 3 * 3600000, confirmadoEm: dias(0) - 3 * 3600000, confirmado: true, baixa: true, motoboy: 'm3', fixo: 'entregue' }
    ];

    var leads = [
      { id: 'l1', nome: 'Hotel Terral Praia', fone: '(85) 98701-3321', origem: 'Indicação', etapa: 'novo', valor: 2400, itens: 'Camarão VG 30 kg/semana', msgs: [['c', 'Boa tarde! Vi vocês no Instagram. Vocês entregam camarão no atacado para hotel?'], ['j', 'Boa tarde! Entregamos sim, Fortaleza e Caucaia. Qual volume semanal?'], ['c', 'Em torno de 30 kg de camarão VG.']] },
      { id: 'l2', nome: 'Sabrina Oliveira', fone: '(85) 98604-7712', origem: 'Instagram — Stories', etapa: 'novo', valor: 190, itens: 'Kit Churrasco do Mar', msgs: [['c', 'Oi, quanto está o kit churrasco?'], ['j', 'Oi, Sabrina! O Kit Churrasco do Mar está R$ 84,90.']] },
      { id: 'l3', nome: 'Bar do Zeca', fone: '(85) 98219-0045', origem: 'Indicação', etapa: 'conversa', valor: 1850, itens: 'Anéis de lula 20 kg + camarão 15 kg', msgs: [['c', 'Preciso de lula e camarão para sexta.'], ['j', 'Consigo entregar na quinta à tarde. Fecha?'], ['c', 'Me passa o valor fechado.']] },
      { id: 'l4', nome: 'Rodrigo Brandão', fone: '(85) 98903-5521', origem: 'Instagram', etapa: 'conversa', valor: 260, itens: 'Camarão descascado 2 kg + filé 1 kg', msgs: [['c', 'Entregam no Cambeba?'], ['j', 'Entregamos! A taxa é R$ 14,00.']] },
      { id: 'l5', nome: 'Cantina da Nona', fone: '(85) 98650-1177', origem: 'Cliente recorrente', etapa: 'orcamento', valor: 1320, itens: 'Camarão cinza 15 kg + mix frutos do mar 5 kg', msgs: [['j', 'Segue o orçamento do pedido semanal.'], ['c', 'Pode fechar, pago no Pix.']] },
      { id: 'l6', nome: 'Helena Barros', fone: '(85) 98305-8870', origem: 'Instagram', etapa: 'orcamento', valor: 215, itens: 'Filé de salmão 1 kg + camarão 2 kg', msgs: [['j', 'Total R$ 215,00 com entrega.'], ['c', 'Vou confirmar com meu marido e já retorno.']] },
      { id: 'l7', nome: 'Eduardo Pinheiro', fone: '(85) 98211-3340', origem: 'Cliente recorrente', etapa: 'pago', valor: 358, itens: 'Camarão cinza 3 kg + filé 2 kg', msgs: [['c', 'Comprovante do Pix enviado.'], ['j', 'Recebido! Já separamos o pedido.']] },
      { id: 'l8', nome: 'Gustavo Nogueira', fone: '(85) 98177-2209', origem: 'Indicação', etapa: 'vendido', valor: 980, itens: 'Camarão sem cabeça 15 kg + posta de serra 3 kg', msgs: [['c', 'Entrega recebida, tudo certo.']], vendido: true }
    ];

    return {
      produtos: PRODUTOS, clientes: clientes, motoboys: motoboys, pedidos: pedidos, leads: leads,
      notas: [], baixas: [], seq: 1052
    };
  }

  var estado = null;
  function carregar() {
    try { var s = localStorage.getItem(CHAVE); if (s) { estado = JSON.parse(s); return estado; } } catch (e) {}
    estado = semente(); salvar(); return estado;
  }
  function salvar() { try { localStorage.setItem(CHAVE, JSON.stringify(estado)); } catch (e) {} }
  function resetar() { try { localStorage.removeItem(CHAVE); } catch (e) {} estado = null; carregar(); }

  function brl(v) { return 'R$ ' + (v || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function dataHora(ms) {
    var d = new Date(ms);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  function km(a, b, c, d) {
    var R = 6371, r = Math.PI / 180, dLa = (c - a) * r, dLo = (d - b) * r;
    var x = Math.sin(dLa / 2) * Math.sin(dLa / 2) + Math.cos(a * r) * Math.cos(c * r) * Math.sin(dLo / 2) * Math.sin(dLo / 2);
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  // Distância de rua estimada = linha reta × 1,3. Acima de 8 km, R$ 1,50 por km excedente.
  function frete(bairroNome) {
    var b = BAIRROS.filter(function (x) { return x.nome === bairroNome; })[0];
    if (!b) return null;
    var dist = km(BASE.lat, BASE.lng, b.lat, b.lng) * 1.3;
    var extra = dist > 8 ? Math.ceil((dist - 8) * 1.5 * 2) / 2 : 0;
    return { bairro: b, km: dist, taxaBairro: b.taxa, extra: extra, total: b.taxa + extra };
  }
  function subtotal(p) { return p.itens.reduce(function (s, i) { return s + i.preco * i.qtd; }, 0); }
  function totalPedido(p) { return subtotal(p) + (p.taxa || 0); }

  // Linha da rota: base → pontos intermediários → destino (rota simulada, sem serviço de roteirização).
  function rota(b) {
    var a = [BASE.lat, BASE.lng], z = [b.lat, b.lng];
    var dx = z[0] - a[0], dy = z[1] - a[1], pts = [a];
    // percurso em "L" suavizado para parecer ruas
    var meio1 = [a[0], a[1] + dy * 0.55], meio2 = [a[0] + dx * 0.7, a[1] + dy * 0.55];
    pts.push([a[0] + dx * 0.05, a[1] + dy * 0.2], meio1, [meio1[0] + dx * 0.25, meio1[1]], meio2, [meio2[0] + dx * 0.15, meio2[1] + dy * 0.3], [z[0], a[1] + dy * 0.92], z);
    return pts;
  }
  function pontoNaRota(pts, f) {
    f = Math.max(0, Math.min(1, f));
    var seg = [], tot = 0, i;
    for (i = 0; i < pts.length - 1; i++) { var l = km(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]); seg.push(l); tot += l; }
    var alvo = f * tot, acc = 0;
    for (i = 0; i < seg.length; i++) {
      if (acc + seg[i] >= alvo) { var u = seg[i] ? (alvo - acc) / seg[i] : 0; return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * u, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * u]; }
      acc += seg[i];
    }
    return pts[pts.length - 1];
  }

  // Demonstração acelerada: 5 s recebido, 10 s preparando, 40 s em rota.
  var T_PREP = 5000, T_ROTA = 15000, T_VIAGEM = 40000;
  function situacao(p) {
    if (p.fixo === 'entregue') return { cod: 'chegou', rotulo: 'Entregue', prog: 1 };
    if (!p.confirmado) return { cod: 'recebido', rotulo: 'Aguardando confirmação', prog: 0 };
    var agora = agoraMs();
    if (p.laco) { // pedidos de exemplo que ficam em rota o tempo todo
      return { cod: 'saiu', rotulo: 'Saiu para entrega', prog: ((agora - p.confirmadoEm) % p.laco) / p.laco };
    }
    var e = agora - p.confirmadoEm;
    if (p.tipo === 'retirada') {
      if (e < T_PREP + 5000) return { cod: 'preparando', rotulo: 'Preparando', prog: 0 };
      return { cod: 'chegou', rotulo: 'Pronto para retirada', prog: 1 };
    }
    if (e < T_PREP) return { cod: 'recebido', rotulo: 'Pedido confirmado', prog: 0 };
    if (e < T_ROTA) return { cod: 'preparando', rotulo: 'Preparando', prog: 0 };
    if (e < T_ROTA + T_VIAGEM) return { cod: 'saiu', rotulo: 'Saiu para entrega', prog: (e - T_ROTA) / T_VIAGEM };
    return { cod: 'chegou', rotulo: 'Entregue', prog: 1 };
  }

  // Confirma o pedido: dá baixa no estoque, atribui motoboy livre, registra cliente.
  function confirmarPedido(id) {
    var s = carregar(), p = s.pedidos.filter(function (x) { return x.id === id; })[0];
    if (!p || p.confirmado) return p;
    p.confirmado = true; p.confirmadoEm = agoraMs();
    if (!p.baixa) {
      p.itens.forEach(function (i) {
        var pr = s.produtos.filter(function (x) { return x.id === i.id; })[0];
        if (!pr) return;
        pr.estoque = Math.max(0, +(pr.estoque - i.qtd).toFixed(1));
        s.baixas.unshift({ quando: agoraMs(), pedido: p.id, produto: pr.nome, qtd: i.qtd, saldo: pr.estoque });
      });
      p.baixa = true;
    }
    if (p.tipo === 'entrega' && !p.motoboy) {
      var ocup = s.pedidos.filter(function (x) { return x.confirmado && x.fixo !== 'entregue' && x.motoboy && situacao(x).cod !== 'chegou'; }).map(function (x) { return x.motoboy; });
      var livre = s.motoboys.filter(function (m) { return ocup.indexOf(m.id) < 0; })[0] || s.motoboys[0];
      p.motoboy = livre.id;
    }
    salvar(); return p;
  }

  window.JP = {
    WHATS: WHATS, BASE: BASE, BAIRROS: BAIRROS, CATEGORIAS: CATEGORIAS,
    estado: carregar, salvar: salvar, resetar: resetar,
    brl: brl, dataHora: dataHora, km: km, frete: frete, subtotal: subtotal, totalPedido: totalPedido,
    rota: rota, pontoNaRota: pontoNaRota, situacao: situacao,
    confirmarPedido: confirmarPedido,
    agora: agoraMs, T_PREP: T_PREP, T_ROTA: T_ROTA, T_VIAGEM: T_VIAGEM
  };
})();
