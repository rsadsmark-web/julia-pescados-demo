/* Novidades da Julia Pescados — dados e regras compartilhados entre a loja e o painel:
   recompra automática, lista de espera de lote fresco, tabela de atacado, corte de pedidos e aviso de saída para entrega.
   Demonstração: tudo no localStorage deste navegador, nada é enviado. */
(function () {
  var CHAVE = 'jp_ex_v1';
  var DIA = 86400000;

  var TXT_RECOMPRA = 'Olá, {nome}! Faz {dias} dias do seu último pedido ({itens}). Quer repetir? É só tocar no link e confirmar: {link}';
  var TXT_ESPERA = 'Olá, {nome}! Chegou lote fresco de {produto}. Garanta o seu antes de acabar: {link}';
  var TXT_SAIU = 'Olá, {nome}! Seu pedido {pedido} saiu para entrega com o {motoboy}. Chega em instantes: fique de olho no portão.';
  var TXT_AGENDADO = 'Olá, {nome}! Recebemos o seu pedido {pedido} depois das {corte}h, o nosso horário de corte. Ele será entregue {quando}. Qualquer ajuste, é só responder por aqui.';

  var SEM = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

  function restaurantes() {
    return [
      { id: 'a1', nome: 'Restaurante Maré Cheia', codigo: 'MARE', fone: '(85) 98530-8812', bairro: 'Centro', endereco: 'Rua Major Facundo, 512', dias: 'terça e sexta', itens: [{ id: 'p1', qtd: 12 }, { id: 'p9', qtd: 4 }] },
      { id: 'a2', nome: 'Cantina da Nona', codigo: 'NONA', fone: '(85) 98650-1177', bairro: 'Benfica', endereco: 'Rua Carapinima, 1450', dias: 'segunda e quinta', itens: [{ id: 'p1', qtd: 8 }, { id: 'p10', qtd: 3 }] },
      { id: 'a3', nome: 'Bar do Zeca', codigo: 'ZECA', fone: '(85) 98219-0045', bairro: 'Varjota', endereco: 'Rua Frederico Borges, 340', dias: 'quarta e sexta', itens: [{ id: 'p9', qtd: 20 }, { id: 'p1', qtd: 15 }] }
    ];
  }
  function padrao() {
    var t = Date.now();
    if (window.JP_VAZIO) return {
      recompra: { ativa: true, auto: true, min: 10, max: 15, texto: TXT_RECOMPRA, enviados: {}, historico: [] },
      espera: { texto: TXT_ESPERA, avisos: [], inscritos: [] },
      atacado: { precos: {}, restaurantes: [], pedidosDe: {} },
      entrega: { corte: 14, simulacao: 'real', avisoSaiu: true, textoSaiu: TXT_SAIU, textoAgendado: TXT_AGENDADO, processados: {} }
    };
    return {
      recompra: { ativa: true, auto: true, min: 10, max: 15, texto: TXT_RECOMPRA, enviados: {}, historico: [
        { quando: t - 5 * DIA, clienteId: 'c12', cliente: 'Eduardo Pinheiro', dias: 11, status: 'repetiu', pedido: 'JP-1047' },
        { quando: t - DIA, clienteId: 'c16', cliente: 'Beatriz Fontenele', dias: 14, status: 'enviado' }
      ] },
      espera: { texto: TXT_ESPERA, avisos: [], inscritos: [
        { id: 'e1', prod: 'p4', nome: 'Restaurante Maré Cheia', fone: '(85) 98530-8812', quando: t - 3 * DIA, avisado: 0 },
        { id: 'e2', prod: 'p4', nome: 'Paulo Henrique', fone: '(85) 98399-5522', quando: t - 2 * DIA, avisado: 0 },
        { id: 'e3', prod: 'p4', nome: 'Carla Mendonça', fone: '(85) 98744-2201', quando: t - DIA, avisado: 0 },
        { id: 'e4', prod: 'p8', nome: 'Bar do Zeca', fone: '(85) 98219-0045', quando: t - 2 * DIA, avisado: 0 },
        { id: 'e5', prod: 'p8', nome: 'Francisco Teixeira', fone: '(85) 98122-9054', quando: t - 5 * 3600000, avisado: 0 },
        { id: 'e6', prod: 'p1', nome: 'Cantina da Nona', fone: '(85) 98650-1177', quando: t - 7 * 3600000, avisado: 0 },
        { id: 'e7', prod: 'p6', nome: 'Mônica Sales', fone: '(85) 98701-3321', quando: t - 3 * DIA, avisado: t - 2 * DIA }
      ] },
      atacado: { precos: {}, restaurantes: restaurantes(), pedidosDe: {} },
      entrega: { corte: 14, simulacao: 'real', avisoSaiu: true, textoSaiu: TXT_SAIU, textoAgendado: TXT_AGENDADO, processados: {} }
    };
  }

  var estado = null;
  function ler() {
    if (estado) return estado;
    var base = padrao();
    try {
      var s = JSON.parse(localStorage.getItem(CHAVE) || 'null');
      if (s && typeof s === 'object') Object.keys(base).forEach(function (k) { if (s[k] !== undefined) base[k] = Object.assign(base[k], s[k]); });
    } catch (e) {}
    estado = base; return estado;
  }
  function salvar() { try { localStorage.setItem(CHAVE, JSON.stringify(estado || ler())); } catch (e) {} }
  function recarregar() { estado = null; return ler(); }
  function reset() { try { localStorage.removeItem(CHAVE); } catch (e) {} estado = null; }

  /* ---------- corte de pedidos ---------- */
  // Hora de referência: a real, ou a simulada pelo painel (ou por ?hora=15 na loja) para a demonstração.
  function hora() {
    var h = /[?&]hora=(\d{1,2})/.exec(location.search);
    if (h) return +h[1] + 0.5;
    var sim = ler().entrega.simulacao;
    if (sim === 'antes') return 9.5;
    if (sim === 'depois') return 15.2;
    var d = new Date(); return d.getHours() + d.getMinutes() / 60;
  }
  function diaDe(d) { return SEM[d.getDay()]; }
  function fmtData(d) { return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2); }
  // Próximo dia útil de entrega (a Julia não entrega aos domingos).
  function proxDia() {
    var d = new Date(Date.now() + DIA);
    if (d.getDay() === 0) d = new Date(d.getTime() + DIA);
    var amanha = d.getTime() - Date.now() < 1.5 * DIA && d.getDate() === new Date(Date.now() + DIA).getDate();
    return { amanha: amanha, texto: (amanha ? 'amanhã, ' : '') + diaDe(d) + ' (' + fmtData(d) + ')' };
  }
  // Depois do horário de corte (ou em domingo) o pedido é aceito, mas a entrega é no dia útil seguinte.
  function aposCorte() { var hoje = new Date().getDay(); return hora() >= (window.JP_CORTE || ler().entrega.corte) || hoje === 0; }
  function horaCorte() { return (window.JP_CORTE || ler().entrega.corte) + 'h'; }   // JP_CORTE vem do servidor na página pública

  /* ---------- atacado ---------- */
  function restaurante(id) { return ler().atacado.restaurantes.filter(function (r) { return r.id === id; })[0]; }
  function precoAtacado(prod) {
    var e = ler().atacado.precos[prod.id];
    return e != null ? e : Math.floor(prod.preco * 0.88 * 10) / 10;
  }

  /* ---------- lista de espera ---------- */
  function inscrever(d) {
    var s = ler(), dig = String(d.fone || '').replace(/\D/g, '');
    var ja = s.espera.inscritos.filter(function (x) { return x.prod === d.prod && String(x.fone).replace(/\D/g, '') === dig && !x.avisado; })[0];
    if (ja) return { ja: true, ins: ja };
    var ins = { id: 'e' + Date.now(), prod: d.prod, nome: d.nome, fone: d.fone, quando: Date.now(), avisado: 0 };
    s.espera.inscritos.unshift(ins); salvar(); return { ja: false, ins: ins };
  }
  function pendentes(prod) { return ler().espera.inscritos.filter(function (x) { return x.prod === prod && !x.avisado; }); }

  /* ---------- recompra ---------- */
  function marcarRepetiu(clienteId, pedido) {
    var h = ler().recompra.historico.filter(function (x) { return x.clienteId === clienteId && x.status === 'enviado'; })[0];
    if (h) { h.status = 'repetiu'; h.pedido = pedido; salvar(); }
  }

  window.EX = {
    TXT_RECOMPRA: TXT_RECOMPRA, TXT_ESPERA: TXT_ESPERA, TXT_SAIU: TXT_SAIU, TXT_AGENDADO: TXT_AGENDADO,
    ler: ler, salvar: salvar, recarregar: recarregar, reset: reset, CHAVE: CHAVE,
    hora: hora, aposCorte: aposCorte, proxDia: proxDia, horaCorte: horaCorte,
    restaurante: restaurante, precoAtacado: precoAtacado,
    inscrever: inscrever, pendentes: pendentes, marcarRepetiu: marcarRepetiu
  };
})();
