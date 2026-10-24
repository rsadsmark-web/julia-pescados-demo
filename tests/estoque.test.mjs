import { createRequire } from 'module'; import assert from 'assert';
const require = createRequire(import.meta.url);
const raiz = process.argv[2];
const E = require(raiz + '/estoque-lib.js');
const PD = require(raiz + '/pedidos-lib.js');
const T = 1700000000000, DIA = 86400000;
const est = () => ({ produtos: [
  { id: 'a', nome: 'Camarão', un: 'kg', cat: 'Camarões', preco: 50, estoque: 10, min: 4 },
  { id: 'b', nome: 'Tilápia', un: 'kg', cat: 'Peixes', preco: 30, estoque: 3, min: 5 },
  { id: 'c', nome: 'Pastel', un: '24 und', cat: 'Petiscos', preco: 20, estoque: 0, min: 2 }], baixas: [], pedidos: [], motoboys: [] });

/* ---- entrada ---- */
let S = est(); let r = E.entrada(S, 'a', 5, { agora: T, por: 'ana', motivo: 'Compra do fornecedor', custo: 32 });
assert.equal(r.ok, true); assert.equal(S.produtos[0].estoque, 15);
assert.deepEqual([S.baixas[0].tipo, S.baixas[0].qtd, S.baixas[0].saldo, S.baixas[0].motivo, S.baixas[0].custo, S.baixas[0].por], ['entrada', 5, 15, 'Compra do fornecedor', 32, 'ana']);
assert.equal(E.entrada(S, 'a', 0, { agora: T }).ok, false); assert.equal(E.entrada(S, 'a', -2, { agora: T }).ok, false); assert.equal(E.entrada(S, 'zz', 2, { agora: T }).ok, false);
assert.equal(E.entrada(S, 'a', 1000001, { agora: T }).ok, false, 'quantidade absurda é recusada');
assert.equal(E.entrada(S, 'a', 0.5, { agora: T }).ok, true); assert.equal(S.produtos[0].estoque, 15.5);

/* ---- ajuste (contagem) e perda exigem motivo ---- */
S = est(); r = E.ajuste(S, 'a', 8, { agora: T }); assert.equal(r.ok, false); assert.match(r.erro, /motivo/i);
r = E.ajuste(S, 'a', 8, { agora: T, motivo: 'Contagem do freezer', por: 'ana' }); assert.equal(r.ok, true); assert.equal(S.produtos[0].estoque, 8);
assert.deepEqual([S.baixas[0].tipo, S.baixas[0].qtd], ['ajuste', -2]);
assert.equal(E.ajuste(S, 'a', -1, { agora: T, motivo: 'x' }).ok, false, 'saldo negativo não existe');
assert.equal(E.ajuste(S, 'a', 8, { agora: T, motivo: 'igual' }).ok, false, 'ajuste sem diferença');
r = E.perda(S, 'b', 1, { agora: T, motivo: 'Descongelou' }); assert.equal(r.ok, true); assert.equal(S.produtos[1].estoque, 2); assert.equal(S.baixas[0].tipo, 'perda');
assert.equal(E.perda(S, 'b', 5, { agora: T, motivo: 'x' }).ok, false, 'perda maior que o saldo'); assert.equal(E.perda(S, 'b', 1, { agora: T }).ok, false);

/* ---- mínimo ---- */
assert.equal(E.defineMinimo(S, 'a', 6).ok, true); assert.equal(S.produtos[0].min, 6);
assert.equal(E.defineMinimo(S, 'a', -1).ok, false); assert.equal(E.defineMinimo(S, 'a', 'x').ok, false);

/* ---- alertas ---- */
S = est();
const al = E.alertas(S);
assert.deepEqual(al.esgotados.map((p) => p.id), ['c']); assert.deepEqual(al.baixos.map((p) => p.id), ['b']);
assert.equal(E.situacao(S.produtos[0]).cod, 'normal'); assert.equal(E.situacao(S.produtos[1]).cod, 'baixo'); assert.equal(E.situacao(S.produtos[2]).cod, 'esgotado');
assert.equal(E.situacao({ estoque: 5, min: 5 }).cod, 'baixo', 'no mínimo já é baixo');
assert.equal(E.situacao({ estoque: 5, min: 0 }).cod, 'normal', 'mínimo zero desliga o alerta');
assert.equal(E.situacao({ estoque: 0, min: 0 }).cod, 'esgotado');

/* ---- vendas e sugestão de reposição ---- */
S = est(); S.pedidos.push({ id: 'P1', tipo: 'retirada', itens: [{ id: 'a', nome: 'Camarão', un: 'kg', preco: 50, qtd: 14 }], taxa: 0, criado: T });
PD.muda(S, S.pedidos[0], 'confirmado', { agora: T - 2 * DIA }); // 10 kg só tem 10: baixa vira zero
assert.equal(S.baixas[0].tipo, 'venda');
S = est(); S.produtos[0].estoque = 30;
S.baixas = [
  { quando: T - 1 * DIA, pedido: 'P1', produto: 'Camarão', qtd: 7, saldo: 23, tipo: 'venda' }, { quando: T - 3 * DIA, pedido: 'P2', produto: 'Camarão', qtd: 7, saldo: 30, tipo: 'venda' },
  { quando: T - 2 * DIA, pedido: 'P3', produto: 'Camarão', qtd: -2, saldo: 32, tipo: 'estorno' }, { quando: T - 20 * DIA, pedido: 'P0', produto: 'Camarão', qtd: 50, saldo: 0, tipo: 'venda' },
  { quando: T - 1 * DIA, produto: 'Tilápia', qtd: 4, saldo: 3, tipo: 'venda' }];
const v = E.vendidoNoPeriodo(S, 'a', 14, T); assert.equal(v, 12, 'vendas menos estornos, só dos últimos 14 dias');
assert.equal(E.mediaDiaria(S, 'a', 14, T), 12 / 14);
const sug = E.sugestoes(S, { dias: 14, cobertura: 7, agora: T });
const sb = sug.find((x) => x.id === 'b'); assert.ok(sb && sb.comprar > 0, 'Tilápia está abaixo do mínimo e vende');
assert.equal(sb.motivo, 'abaixo do mínimo');
assert.equal(sug.find((x) => x.id === 'a'), undefined, 'Camarão tem saldo para a cobertura');
const sc = sug.find((x) => x.id === 'c'); assert.ok(sc, 'esgotado entra na lista'); assert.ok(sc.comprar >= 2);
assert.equal(E.sugestoes(S, { dias: 14, cobertura: 7, agora: T })[0].id, 'c', 'esgotados primeiro');

/* ---- extrato e CSV ---- */
const ext = E.extrato(S, 'a', 10, T); assert.equal(ext.length, 4);
const csv = E.csv(est());
assert.match(csv.split('\n')[0], /Produto;Categoria;Unidade;Saldo;Mínimo;Situação/); assert.match(csv, /Tilápia;Peixes;kg;3;5;Baixo/);
assert.ok(!/"/.test(E.csv({ produtos: [{ id: 'x', nome: 'A;B', cat: 'C', un: 'kg', estoque: 1, min: 0 }] }).split('\n')[1].split(';').slice(3).join('')));
console.log('testes estoque ok');
