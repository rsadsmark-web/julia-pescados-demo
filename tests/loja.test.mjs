import { createRequire } from 'module'; import assert from 'assert';
const require = createRequire(import.meta.url);
const raiz = process.argv[2];
const L = require(raiz + '/loja-lib.js');
const { validaPedido } = require(raiz + '/servidor/pedido.js');

const cfg = L.mescla({});
const P = (o) => Object.assign({ id: 'x', nome: 'X', cat: 'C', un: 'kg', preco: 50, estoque: 10, min: 1 }, o);

/* ---- unidade e quantidade fracionada ---- */
assert.deepEqual([L.unidade(P({ un: 'kg' })).fracionado, L.unidade(P({ un: 'kg' })).passo], [true, 0.5]);
assert.equal(L.unidade(P({ un: 'bandeja 12 und' })).fracionado, false, 'bandeja é inteira');
assert.equal(L.unidade(P({ un: '500 g' })).fracionado, false);
assert.equal(L.unidade(P({ un: 'unidade' })).passo, 1);
assert.equal(L.unidade(P({ un: 'kg', fracionado: false })).fracionado, false, 'o painel pode desligar a fração');
assert.equal(L.unidade(P({ un: 'peça', fracionado: true })).passo, 0.5, 'o painel pode ligar a fração');
assert.equal(L.unidade(P({ un: 'kg' })).rotulo, 'por kg');
assert.equal(L.unidade(P({ un: 'bandeja 24 und' })).rotulo, 'bandeja com 24 unidades');
assert.equal(L.unidade(P({ un: '24 und' })).rotulo, 'pacote com 24 unidades');
assert.equal(L.unidade(P({ un: '500 g' })).rotulo, 'pacote de 500 g');
assert.equal(L.unidade(P({ un: 'unidade' })).rotulo, 'por unidade');
assert.equal(L.arredonda(P({ un: 'kg' }), 1.3), 1.5, 'kg arredonda para cima ao meio quilo');
assert.equal(L.arredonda(P({ un: 'kg' }), 0.2), 0.5, 'mínimo de meio quilo');
assert.equal(L.arredonda(P({ un: 'bandeja 12 und' }), 1.5), 2, 'bandeja arredonda para inteiro');
assert.equal(L.arredonda(P({ un: 'unidade' }), 0), 0);
assert.equal(L.fmtQtd(P({ un: 'kg' }), 1.5), '1,5 kg');
assert.equal(L.fmtQtd(P({ un: 'kg' }), 2), '2 kg');
assert.equal(L.fmtQtd(P({ un: 'bandeja 12 und' }), 2), '2 bandejas');
assert.equal(L.fmtQtd(P({ un: 'bandeja 12 und' }), 1), '1 bandeja');
assert.equal(L.fmtQtd(P({ un: 'unidade' }), 3), '3 un');
assert.match(L.avisoPeso(P({ un: 'kg' }), 1.5), /1,5 kg.*pesagem/i, 'aviso de ajuste na pesagem');
assert.equal(L.avisoPeso(P({ un: 'bandeja 12 und' }), 2), '', 'bandeja não pesa');
assert.match(L.avisoPeso(P({ un: 'peça', pesoAprox: 0.4 }), 2), /0,8 kg/, 'peso aproximado informado no painel');

/* ---- preço e promoção ---- */
assert.equal(L.precoEfetivo(P({ preco: 50 })), 50);
assert.equal(L.precoEfetivo(P({ preco: 50, promo: 42 })), 42);
assert.equal(L.precoEfetivo(P({ preco: 50, promo: 60 })), 50, 'promoção maior que o preço é ignorada');
assert.equal(L.precoEfetivo(P({ preco: 50, promo: 0 })), 50);
assert.equal(L.totalLinha(P({ preco: 55.5 }), 1.5), 83.25);
assert.equal(L.totalLinha(P({ preco: 33.33 }), 0.5), 16.67, 'arredonda em centavos');

/* ---- horário ---- */
const d = (s) => new Date(s); // horário local do teste
assert.equal(cfg.horario[0], null, 'domingo fechado');
assert.deepEqual(cfg.horario[1], ['08:00', '17:30']); assert.deepEqual(cfg.horario[6], ['08:00', '12:00']);
let h = L.situacaoLoja(cfg, d('2026-10-23T10:00:00')); // sexta
assert.equal(h.aberto, true); assert.match(h.texto, /17h30/);
h = L.situacaoLoja(cfg, d('2026-10-23T17:31:00'));
assert.equal(h.aberto, false); assert.match(h.texto, /sábado/); assert.match(h.texto, /8h/);
h = L.situacaoLoja(cfg, d('2026-10-24T12:00:00')); // sábado exatamente no fechamento
assert.equal(h.aberto, false); assert.match(h.texto, /segunda/);
h = L.situacaoLoja(cfg, d('2026-10-24T11:59:00')); assert.equal(h.aberto, true);
h = L.situacaoLoja(cfg, d('2026-10-25T09:00:00')); // domingo
assert.equal(h.aberto, false); assert.match(h.texto, /segunda/);
h = L.situacaoLoja(cfg, d('2026-10-26T07:59:00')); // segunda, antes de abrir
assert.equal(h.aberto, false); assert.match(h.texto, /hoje.*8h/i);
assert.match(L.resumoHorario(cfg), /segunda a sexta.*8h às 17h30/i); assert.match(L.resumoHorario(cfg), /sábado.*8h às 12h/i); assert.match(L.resumoHorario(cfg), /domingo.*fechado/i);

/* ---- agendamento ---- */
const dias = L.diasAgendaveis(cfg, d('2026-10-23T18:00:00'), 4); // sexta depois de fechar
assert.deepEqual(dias.map((x) => x.iso), ['2026-10-24', '2026-10-26', '2026-10-27', '2026-10-28'], 'pula o domingo');
assert.match(dias[0].rotulo, /sábado/i);
const aberto = L.diasAgendaveis(cfg, d('2026-10-23T10:00:00'), 2);
assert.equal(aberto[0].iso, '2026-10-23', 'aberto: hoje ainda entra, para depois da hora atual');
const jan = L.janelas(cfg, '2026-10-24', d('2026-10-23T18:00:00'));
assert.deepEqual(jan[0], { de: '08:00', ate: '10:00', rotulo: 'entre 8h e 10h' });
assert.equal(jan[jan.length - 1].ate, '12:00', 'sábado fecha às 12h');
const hoje = L.janelas(cfg, '2026-10-23', d('2026-10-23T14:10:00'));
assert.ok(hoje.every((j) => j.de >= '14:10'), 'hoje só janelas que ainda não começaram');
assert.equal(L.textoAgendado('2026-10-24', { de: '08:00', ate: '10:00' }), 'sábado, 24/10, entre 8h e 10h');

/* ---- frete e mínimo ---- */
assert.ok(cfg.bairros.length >= 10);
const b0 = cfg.bairros[0];
assert.equal(L.frete(cfg, b0.nome).taxa, b0.taxa);
assert.equal(L.frete(cfg, 'Bairro Que Não Existe'), null);
assert.equal(L.frete(cfg, 'aldeota').bairro.nome, 'Aldeota', 'ignora caixa e acento na busca do bairro');
const c2 = L.mescla({ minimo: 60 });
assert.deepEqual(L.minimo(c2, 45), { ok: false, falta: 15, minimo: 60 });
assert.deepEqual(L.minimo(c2, 60), { ok: true, falta: 0, minimo: 60 });
assert.equal(L.minimo(L.mescla({ minimo: 0 }), 1).ok, true, 'sem mínimo configurado');
assert.equal(L.mescla({ horario: { 1: ['09:00', '10:00'] } }).horario[1][0], '09:00', 'mescla troca só o que veio');
assert.equal(L.mescla({ horario: { 1: ['09:00', '10:00'] } }).horario[2][0], '08:00', '…e mantém o resto');

/* ---- busca, filtro e ordenação ---- */
const lista = [
  P({ id: 'a', nome: 'Filé de Camarão G1', cat: 'Camarões', preco: 62.5 }),
  P({ id: 'b', nome: 'Pastel de Queijo', cat: 'Petiscos', preco: 24.5, un: 'bandeja 12 und' }),
  P({ id: 'c', nome: 'Posta de Serra', cat: 'Peixes', preco: 38, dest: true }),
  P({ id: 'd', nome: 'Pescada Amarela', cat: 'Peixes', preco: 57, promo: 49 })
];
const ids = (o) => L.filtra(lista, o).map((p) => p.id).join('');
assert.equal(ids({}), 'abcd');
assert.equal(ids({ termo: 'camarao' }), 'a', 'busca sem acento');
assert.equal(ids({ termo: 'FILÉ camarão' }), 'a', 'várias palavras, qualquer caixa');
assert.equal(ids({ termo: 'queijo past' }), 'b', 'ordem das palavras não importa');
assert.equal(ids({ termo: 'xyz' }), '');
assert.equal(ids({ cat: 'Peixes' }), 'cd');
assert.equal(ids({ cat: 'Peixes', termo: 'serra' }), 'c');
assert.equal(ids({ ordem: 'menor' }), 'bcda', 'menor preço (com promoção) primeiro');
assert.equal(ids({ ordem: 'maior' }), 'adcb');
assert.equal(ids({ ordem: 'az' }), 'abdc', 'ordem alfabética');
assert.equal(ids({ ordem: 'promo' }), 'dabc', 'promoções primeiro');
assert.equal(ids({ so: 'promo' }), 'd'); assert.equal(ids({ so: 'dest' }), 'c');
assert.equal(ids({ so: 'dest', cat: 'Camarões' }), '');

/* ---- combos ---- */
const prods = [P({ id: 's1', preco: 40, estoque: 5 }), P({ id: 's2', preco: 30, estoque: 0.4 }), P({ id: 's3', preco: 10, estoque: 9, un: 'bandeja 12 und' })];
const combo = { id: 'cb1', nome: 'Kit', preco: 60, itens: [['s1', 1], ['s2', 0.5]], ativo: true };
assert.equal(L.precoSeparado(combo, prods), 55);
assert.equal(L.comboDisponivel(combo, prods), false, 'falta estoque de um item');
assert.equal(L.comboDisponivel(Object.assign({}, combo, { itens: [['s1', 1]] }), prods), true);
assert.equal(L.comboDisponivel(Object.assign({}, combo, { itens: [['sNao', 1]] }), prods), false, 'item que não existe mais');
assert.equal(L.comboDisponivel(Object.assign({}, combo, { itens: [['s1', 6]] }), prods), false);
assert.equal(L.comboComoProduto(combo, prods).un, 'kit');
assert.equal(L.comboComoProduto(combo, prods).id, 'cb1');

/* ---- recompra ---- */
const cat = [P({ id: 's1', estoque: 3 }), P({ id: 's2', estoque: 0 }), P({ id: 's3', un: 'bandeja 12 und', estoque: 9 })];
const r = L.refazPedido([['s1', 5], ['s2', 1], ['s3', 2], ['sGone', 1]], cat);
assert.deepEqual(r.itens, [['s1', 3], ['s3', 2]], 'limita ao estoque e tira o que acabou');
assert.deepEqual(r.faltou.sort(), ['s1', 's2', 'sGone'].sort(), 'avisa o que não entrou inteiro');

/* ---- validação do pedido no servidor ---- */
const catalogo = [
  P({ id: 's1', nome: 'Filé de Tilápia', un: 'kg', preco: 49, estoque: 10 }),
  P({ id: 's2', nome: 'Pastel', un: 'bandeja 12 und', preco: 24.5, estoque: 10 }),
  P({ id: 's3', nome: 'Posta', un: 'kg', preco: 40, promo: 35, estoque: 10 })
];
const cfgS = L.mescla({ minimo: 50, combos: [{ id: 'cb1', nome: 'Kit Teste', preco: 70, itens: [['s1', 1], ['s2', 1]], ativo: true }] });
const base = { id: 'JP-ABC123', cliente: 'Maria', fone: '(85) 99999-1234', tipo: 'entrega', bairro: 'Aldeota', endereco: 'Rua A, 10', itens: [{ id: 's1', qtd: 1.5, obs: 'sem pele' }] };
const ok = validaPedido(base, catalogo, cfgS);
assert.ok(!ok.erro, ok.erro);
assert.equal(ok.itens[0].preco, 49); assert.equal(ok.itens[0].qtd, 1.5); assert.equal(ok.itens[0].obs, 'sem pele');
assert.equal(ok.taxa, L.frete(cfgS, 'Aldeota').taxa, 'frete vem da tabela do servidor, não do cliente');
assert.equal(validaPedido(Object.assign({}, base, { taxa: 0 }), catalogo, cfgS).taxa, ok.taxa, 'cliente não escolhe a taxa');
assert.match(validaPedido(Object.assign({}, base, { itens: [{ id: 's1', qtd: 0.5 }] }), catalogo, cfgS).erro, /mínimo/i, 'abaixo do pedido mínimo');
assert.match(validaPedido(Object.assign({}, base, { bairro: 'Lugar Nenhum' }), catalogo, cfgS).erro, /bairro/i);
assert.ok(!validaPedido(Object.assign({}, base, { tipo: 'retirada', bairro: '', endereco: '' }), catalogo, cfgS).erro, 'retirada não precisa de bairro');
assert.equal(validaPedido(Object.assign({}, base, { tipo: 'retirada' }), catalogo, cfgS).taxa, 0);
assert.equal(validaPedido(Object.assign({}, base, { itens: [{ id: 's2', qtd: 2.5 }, { id: 's1', qtd: 1 }] }), catalogo, cfgS).itens[0].qtd, 3, 'bandeja arredonda para inteiro');
assert.equal(validaPedido(Object.assign({}, base, { itens: [{ id: 's3', qtd: 2, preco: 99 }] }), catalogo, cfgS).itens[0].preco, 35, 'preço é o promocional do servidor; cliente não sobe preço');
assert.equal(validaPedido(Object.assign({}, base, { itens: [{ id: 's1', qtd: 2, preco: 10 }] }), catalogo, cfgS).itens[0].preco, 49, 'cliente também não baixa o preço');
const at = validaPedido(Object.assign({}, base, { itens: [{ id: 's1', qtd: 2, preco: 40 }] }), catalogo, cfgS, { atacado: true });
assert.equal(at.itens[0].preco, 40, 'atacado aceita preço menor');
assert.match(validaPedido(Object.assign({}, base, { itens: [{ id: 's1', qtd: 11 }] }), catalogo, cfgS).erro, /estoque/i, 'acima do estoque');
assert.match(validaPedido(Object.assign({}, base, { itens: [] }), catalogo, cfgS).erro, /itens|incompleto/i);
assert.match(validaPedido(Object.assign({}, base, { fone: '123' }), catalogo, cfgS).erro, /whatsapp|incompleto/i);
assert.match(validaPedido(Object.assign({}, base, { id: 'xx' }), catalogo, cfgS).erro, /inválido/i);
const cb = validaPedido(Object.assign({}, base, { itens: [{ id: 'cb1', qtd: 2 }] }), catalogo, cfgS);
assert.ok(!cb.erro, cb.erro); assert.equal(cb.itens[0].preco, 70); assert.equal(cb.itens[0].un, 'kit'); assert.deepEqual(cb.itens[0].combo, [['s1', 1], ['s2', 1]]);
assert.match(validaPedido(Object.assign({}, base, { itens: [{ id: 'cb9', qtd: 1 }] }), catalogo, cfgS).erro, /itens|incompleto/i, 'combo inexistente');
const ag = validaPedido(Object.assign({}, base, { agendado: 'sábado, 24/10, entre 8h e 10h' }), catalogo, cfgS);
assert.equal(ag.agendado, 'sábado, 24/10, entre 8h e 10h');
assert.equal(validaPedido(Object.assign({}, base, { obs: '<b>oi</b>' }), catalogo, cfgS).obs.includes('<'), false, 'tira marcação do texto livre');

console.log('testes loja ok');
