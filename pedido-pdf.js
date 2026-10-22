/* PDF do pedido e da lista de pedidos do dia — Julia Pescados (usa jsPDF; funciona no navegador e no Node para testes) */
(function (raiz) {
  var VINHO = [156, 36, 23], PETROLEO = [11, 74, 92], LARANJA = [247, 154, 46], CREME = [253, 240, 226], TEXTO = [47, 29, 22], SUAVE = [112, 90, 80];

  function brl(v) { return 'R$ ' + (Math.round(v * 100) / 100).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function qtdTxt(q) { return String(q).replace('.', ','); }
  function dataHora(ms) {
    var d = new Date(ms), z = function (n) { return (n < 10 ? '0' : '') + n; };
    return z(d.getDate()) + '/' + z(d.getMonth() + 1) + '/' + d.getFullYear() + ' às ' + z(d.getHours()) + ':' + z(d.getMinutes());
  }
  function subtotal(p) { return p.itens.reduce(function (s, i) { return s + i.preco * i.qtd; }, 0); }
  function total(p) { return subtotal(p) + (p.taxa || 0); }
  function situacao(p, sit) { return !p.confirmado ? 'Aguardando confirmação' : sit ? sit(p) : 'Confirmado'; }

  function cabecalho(doc, logo, titulo, sub) {
    var L = doc.internal.pageSize.getWidth();
    doc.setFillColor.apply(doc, VINHO); doc.rect(0, 0, L, 30, 'F');
    doc.setFillColor.apply(doc, LARANJA); doc.rect(0, 30, L, 1.6, 'F');
    if (logo) doc.addImage(logo, 'PNG', 12, 5, 20, 20);
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.text('Julia Pescados', logo ? 36 : 14, 15);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.text('Peixes e frutos do mar frescos · Fortaleza e Caucaia', logo ? 36 : 14, 21);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text(titulo, L - 12, 14, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.text(sub, L - 12, 21, { align: 'right' });
    doc.setTextColor.apply(doc, TEXTO);
  }
  function rodape(doc) {
    var L = doc.internal.pageSize.getWidth(), A = doc.internal.pageSize.getHeight(), n = doc.getNumberOfPages();
    for (var i = 1; i <= n; i++) {
      doc.setPage(i); doc.setDrawColor.apply(doc, LARANJA); doc.setLineWidth(.5); doc.line(12, A - 14, L - 12, A - 14);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor.apply(doc, SUAVE);
      doc.text('Julia Pescados · @juliapescados · Documento de demonstração, valores de exemplo', 12, A - 9);
      doc.text('Página ' + i + ' de ' + n, L - 12, A - 9, { align: 'right' });
    }
  }
  function rotulo(doc, txt, x, y) { doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor.apply(doc, SUAVE); doc.text(txt.toUpperCase(), x, y); doc.setTextColor.apply(doc, TEXTO); }
  function valor(doc, linhas, x, y, larg) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5);
    var l = doc.splitTextToSize(String(linhas || '—'), larg); doc.text(l, x, y); return y + l.length * 4.8;
  }

  /* um pedido por página; desenha a partir de yIni e devolve o y final */
  function blocoPedido(doc, p, sit) {
    var L = doc.internal.pageSize.getWidth(), y = 42, entrega = p.tipo !== 'retirada';
    doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor.apply(doc, VINHO); doc.text('Pedido ' + p.id, 12, y);
    doc.setFontSize(10); doc.setTextColor.apply(doc, PETROLEO); doc.text(situacao(p, sit).toUpperCase(), L - 12, y, { align: 'right' });
    doc.setTextColor.apply(doc, SUAVE); doc.setFont('helvetica', 'normal'); doc.text('Feito em ' + dataHora(p.criado), 12, y + 6);
    y += 14;

    doc.setFillColor.apply(doc, CREME); doc.setDrawColor.apply(doc, LARANJA); doc.roundedRect(12, y, L - 24, entrega ? 40 : 30, 2, 2, 'FD');
    var c1 = 16, c2 = L / 2 + 2, w = L / 2 - 20, yy = y + 6;
    rotulo(doc, 'Cliente', c1, yy); rotulo(doc, 'WhatsApp', c2, yy);
    var a = valor(doc, p.cliente, c1, yy + 5, w), b = valor(doc, p.fone, c2, yy + 5, w);
    yy = Math.max(a, b) + 2;
    rotulo(doc, entrega ? 'Entrega' : 'Retirada', c1, yy); rotulo(doc, 'Forma de pagamento', c2, yy);
    var e = valor(doc, entrega ? (p.endereco + (p.bairro ? ' — ' + p.bairro : '')) : 'Retirada no local', c1, yy + 5, w);
    valor(doc, p.pagamento, c2, yy + 5, w);
    y += (entrega ? 40 : 30) + 8;

    // tabela de itens
    var X = { prod: 14, qtd: L - 84, preco: L - 52, tot: L - 14 };
    doc.setFillColor.apply(doc, PETROLEO); doc.rect(12, y, L - 24, 8, 'F');
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5);
    doc.text('PRODUTO', X.prod, y + 5.4); doc.text('QTD.', X.qtd, y + 5.4, { align: 'right' }); doc.text('PREÇO UNIT.', X.preco, y + 5.4, { align: 'right' }); doc.text('TOTAL', X.tot, y + 5.4, { align: 'right' });
    y += 8; doc.setTextColor.apply(doc, TEXTO); doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5);
    p.itens.forEach(function (i, n) {
      if (n % 2) { doc.setFillColor(251, 245, 237); doc.rect(12, y, L - 24, 8, 'F'); }
      doc.text(String(i.nome), X.prod, y + 5.4);
      doc.text(qtdTxt(i.qtd) + ' ' + (i.un || ''), X.qtd, y + 5.4, { align: 'right' });
      doc.text(brl(i.preco) + (i.un ? ' / ' + i.un : ''), X.preco, y + 5.4, { align: 'right' });
      doc.text(brl(i.preco * i.qtd), X.tot, y + 5.4, { align: 'right' });
      y += 8;
    });
    doc.setDrawColor.apply(doc, PETROLEO); doc.setLineWidth(.4); doc.line(12, y, L - 12, y); y += 7;

    function linhaTot(r, v, forte) {
      doc.setFont('helvetica', forte ? 'bold' : 'normal'); doc.setFontSize(forte ? 13 : 10.5);
      if (forte) doc.setTextColor.apply(doc, VINHO);
      doc.text(r, L - 62, y, { align: 'right' }); doc.text(v, X.tot, y, { align: 'right' }); doc.setTextColor.apply(doc, TEXTO); y += forte ? 8 : 6;
    }
    linhaTot('Subtotal', brl(subtotal(p)));
    linhaTot(entrega ? 'Taxa de entrega' + (p.bairro ? ' (' + p.bairro + ')' : '') : 'Retirada', brl(p.taxa || 0));
    linhaTot('Total do pedido', brl(total(p)), true);

    y += 6; rotulo(doc, 'Observações', 12, y); y += 5;
    y = valor(doc, p.obs || 'Sem observações.', 12, y, L - 24);
    if (p.agendado) { y += 2; doc.setFont('helvetica', 'bold'); doc.setTextColor.apply(doc, VINHO); doc.setFontSize(10); doc.text('Atenção: ' + p.agendado + ' (pedido feito após o horário de corte).', 12, y); doc.setTextColor.apply(doc, TEXTO); y += 5; }
    return y;
  }

  function novo(J) { return new (J.jsPDF || J)({ unit: 'mm', format: 'a4' }); }

  function pedidoPdf(J, p, logo, sit) {
    var doc = novo(J); cabecalho(doc, logo, 'Comprovante de pedido', p.id); blocoPedido(doc, p, sit); rodape(doc); return doc;
  }

  /* lista do dia: resumo + uma linha por pedido, com os itens abaixo */
  function listaPdf(J, lista, logo, rotuloDia, sit) {
    var doc = novo(J), L = doc.internal.pageSize.getWidth(), A = doc.internal.pageSize.getHeight();
    cabecalho(doc, logo, 'Pedidos do dia', rotuloDia);
    var y = 42, conf = lista.filter(function (p) { return p.confirmado; }), fat = lista.reduce(function (s, p) { return s + total(p); }, 0);
    doc.setFillColor.apply(doc, CREME); doc.setDrawColor.apply(doc, LARANJA); doc.roundedRect(12, y, L - 24, 18, 2, 2, 'FD');
    [['Pedidos', String(lista.length)], ['Confirmados', String(conf.length)], ['Aguardando', String(lista.length - conf.length)], ['Valor total', brl(fat)]].forEach(function (k, n) {
      var x = 16 + n * ((L - 32) / 4); rotulo(doc, k[0], x, y + 6.5); doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor.apply(doc, VINHO); doc.text(k[1], x, y + 13.5); doc.setTextColor.apply(doc, TEXTO);
    });
    y += 26;
    lista.forEach(function (p) {
      var h = 16 + p.itens.length * 5 + (p.obs ? 6 : 0);
      if (y + h > A - 20) { doc.addPage(); y = 14; }
      doc.setFillColor.apply(doc, PETROLEO); doc.rect(12, y, L - 24, 7, 'F');
      doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
      doc.text(p.id + ' · ' + p.cliente, 14, y + 4.8); doc.text(brl(total(p)), L - 14, y + 4.8, { align: 'right' });
      y += 11; doc.setTextColor.apply(doc, TEXTO); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
      doc.text((p.tipo === 'retirada' ? 'Retirada' : p.endereco + (p.bairro ? ' — ' + p.bairro : '')) + '  ·  ' + p.pagamento + '  ·  ' + situacao(p, sit), 14, y); y += 5;
      p.itens.forEach(function (i) {
        doc.text('• ' + qtdTxt(i.qtd) + ' ' + (i.un || '') + ' de ' + i.nome, 16, y); doc.text(brl(i.preco * i.qtd), L - 14, y, { align: 'right' }); y += 5;
      });
      if (p.obs) { doc.setTextColor.apply(doc, SUAVE); doc.text('Obs.: ' + p.obs, 16, y); doc.setTextColor.apply(doc, TEXTO); y += 5; }
      y += 4;
    });
    rodape(doc); return doc;
  }

  raiz.JPPDF = { pedido: pedidoPdf, lista: listaPdf, brl: brl };
  if (typeof module !== 'undefined') module.exports = raiz.JPPDF;
})(typeof window !== 'undefined' ? window : globalThis);
