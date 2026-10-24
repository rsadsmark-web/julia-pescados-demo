import { createRequire } from 'module'; import assert from 'assert';
const require = createRequire(import.meta.url);
const raiz = process.argv[2];
const L = require(raiz + '/loja-lib.js');
const PD = require(raiz + '/pedidos-lib.js');

const cfg = L.mescla({});
const T0 = 1700000000000;

/* ---- frete: taxa do bairro + R$ 1,50 por km acima de 8 km ---- */
const aldeota = L.frete(cfg, 'Aldeota');
assert.ok(aldeota.km > 0 && aldeota.km < 8, 'Aldeota fica a menos de 8 km');
assert.equal(aldeota.extra, 0, 'sem acréscimo até 8 km');
assert.equal(aldeota.taxa, aldeota.bairro.taxa);
const longe = L.frete(cfg, 'Caucaia (Centro)');
assert.ok(longe.km > 8 && longe.extra > 0, 'Caucaia passa de 8 km');
assert.equal(longe.taxaBairro, longe.bairro.taxa);
assert.equal(longe.taxa, longe.taxaBairro + longe.extra, 'taxa final = bairro + excedente');
assert.equal(Math.round(longe.extra * 100) % 50, 0, 'excedente arredondado para cima em R$ 0,50');
const cfgKm = L.mescla({ frete: { franquiaKm: 4, porKm: 2 } });
assert.ok(L.frete(cfgKm, 'Aldeota').extra > 0 || L.frete(cfgKm, 'Aldeota').km <= 4, 'franquia e valor por km são configuráveis');
assert.equal(L.frete(L.mescla({ frete: { porKm: 0 } }), 'Caucaia (Centro)').extra, 0, 'valor por km zero desliga o excedente');

/* ---- status do pedido ---- */
const estado = () => ({
  produtos: [{ id: 'a', nome: 'Camarão', un: 'kg', preco: 50, estoque: 10 }, { id: 'b', nome: 'Tilápia', un: 'kg', preco: 30, estoque: 5 }],
  motoboys: [{ id: 'm1', nome: 'Wellington', ativo: true }, { id: 'm2', nome: 'Danilo', ativo: true }],
  pedidos: [], baixas: [], clientes: []
});
const ped = (o) => Object.assign({ id: 'JP-1', cliente: 'Ana', fone: '(85) 99999-1111', tipo: 'entrega', bairro: 'Aldeota', endereco: 'Rua A, 1', pagamento: 'Pix', itens: [{ id: 'a', nome: 'Camarão', un: 'kg', preco: 50, qtd: 2 }], taxa: 6, criado: T0, confirmado: false, baixa: false, motoboy: null, fixo: null }, o);

assert.equal(PD.statusDe(ped()), 'novo');
assert.equal(PD.statusDe(ped({ confirmado: true })), 'confirmado');
assert.equal(PD.statusDe(ped({ confirmado: true, fixo: 'entregue' })), 'entregue');
assert.equal(PD.statusDe(ped({ status: 'separando' })), 'separando');
assert.deepEqual(PD.proximos(ped(), 'novo'), ['confirmado', 'cancelado']);
assert.deepEqual(PD.proximos(ped({ tipo: 'retirada' }), 'pronto'), ['entregue', 'cancelado'], 'retirada não sai para entrega');
assert.deepEqual(PD.proximos(ped(), 'pronto'), ['saiu', 'cancelado']);
assert.deepEqual(PD.proximos(ped(), 'entregue'), []);

let S = estado(), p = ped(); S.pedidos.push(p);
let r = PD.muda(S, p, 'saiu', { agora: T0 }); assert.equal(r.ok, false, 'não pula etapa'); assert.match(r.erro, /confirmado|etapa|não pode/i);
r = PD.muda(S, p, 'confirmado', { agora: T0 + 1000, por: 'ana' });
assert.equal(r.ok, true); assert.equal(p.status, 'confirmado'); assert.equal(p.confirmado, true); assert.equal(p.confirmadoEm, T0 + 1000);
assert.equal(S.produtos[0].estoque, 8, 'confirmar dá baixa no estoque'); assert.equal(p.baixa, true);
assert.equal(S.baixas[0].pedido, 'JP-1'); assert.equal(S.baixas[0].saldo, 8);
assert.ok(p.motoboy, 'entrega recebe entregador livre ao confirmar');
assert.deepEqual(p.historico.map((h) => h.st), ['confirmado']); assert.equal(p.historico[0].por, 'ana');
r = PD.muda(S, p, 'confirmado', { agora: T0 }); assert.equal(r.ok, false, 'não repete o mesmo status');
PD.muda(S, p, 'separando', { agora: T0 + 2000 }); PD.muda(S, p, 'pronto', { agora: T0 + 3000 });
r = PD.muda(S, p, 'saiu', { agora: T0 + 4000 }); assert.equal(r.ok, true); assert.equal(p.saiuEm, T0 + 4000);
r = PD.muda(S, p, 'entregue', { agora: T0 + 5000 }); assert.equal(r.ok, true);
assert.equal(p.fixo, 'entregue'); assert.equal(p.entregueEm, T0 + 5000); assert.equal(p.historico.length, 5);
r = PD.muda(S, p, 'cancelado', { agora: T0 + 6000, motivo: 'x' }); assert.equal(r.ok, false, 'pedido entregue não se cancela');

// entrega sem entregador cadastrado não sai
S = estado(); S.motoboys = []; p = ped(); S.pedidos.push(p);
PD.muda(S, p, 'confirmado', { agora: T0 }); PD.muda(S, p, 'separando', { agora: T0 }); PD.muda(S, p, 'pronto', { agora: T0 });
r = PD.muda(S, p, 'saiu', { agora: T0 }); assert.equal(r.ok, false); assert.match(r.erro, /entregador/i);

// cancelamento exige motivo e devolve o estoque
S = estado(); p = ped(); S.pedidos.push(p);
PD.muda(S, p, 'confirmado', { agora: T0 }); assert.equal(S.produtos[0].estoque, 8);
r = PD.muda(S, p, 'cancelado', { agora: T0 }); assert.equal(r.ok, false); assert.match(r.erro, /motivo/i);
r = PD.muda(S, p, 'cancelado', { agora: T0 + 10, motivo: 'Cliente desistiu', por: 'ana' });
assert.equal(r.ok, true); assert.equal(p.status, 'cancelado'); assert.equal(p.motivoCancelamento, 'Cliente desistiu');
assert.equal(S.produtos[0].estoque, 10, 'cancelar devolve o estoque'); assert.equal(p.baixa, false);
assert.equal(S.baixas[0].qtd, -2, 'devolução registrada como baixa negativa');
S = estado(); p = ped(); S.pedidos.push(p); // cancelado antes de confirmar: não mexe no estoque
PD.muda(S, p, 'cancelado', { agora: T0, motivo: 'Fora da área' }); assert.equal(S.produtos[0].estoque, 10); assert.equal(S.baixas.length, 0);

// combo: baixa e devolução em cada item
S = estado(); p = ped({ itens: [{ id: 'cb', nome: 'Kit', un: 'kit', preco: 100, qtd: 2, combo: [['a', 1], ['b', 0.5]] }] }); S.pedidos.push(p);
PD.muda(S, p, 'confirmado', { agora: T0 }); assert.deepEqual([S.produtos[0].estoque, S.produtos[1].estoque], [8, 4]);
PD.muda(S, p, 'cancelado', { agora: T0, motivo: 'teste' }); assert.deepEqual([S.produtos[0].estoque, S.produtos[1].estoque], [10, 5]);

// retirada: pronto → entregue (retirado), sem entregador
S = estado(); p = ped({ tipo: 'retirada', bairro: '', endereco: '', taxa: 0 }); S.pedidos.push(p);
PD.muda(S, p, 'confirmado', { agora: T0 }); assert.equal(p.motoboy, null);
PD.muda(S, p, 'separando', { agora: T0 }); PD.muda(S, p, 'pronto', { agora: T0 }); assert.equal(PD.muda(S, p, 'entregue', { agora: T0 }).ok, true);
assert.equal(PD.rotulo(p, 'entregue'), 'Retirado'); assert.equal(PD.rotulo(ped(), 'entregue'), 'Entregue'); assert.equal(PD.rotulo(p, 'pronto'), 'Pronto para retirada');

// entregador: troca só até sair; o mais livre é escolhido
S = estado(); const p1 = ped({ id: 'JP-1' }), p2 = ped({ id: 'JP-2' }); S.pedidos.push(p1, p2);
PD.muda(S, p1, 'confirmado', { agora: T0 }); PD.muda(S, p2, 'confirmado', { agora: T0 });
assert.notEqual(p1.motoboy, p2.motoboy, 'dois pedidos abertos vão para entregadores diferentes');
assert.equal(PD.atribui(S, p2, 'm1').ok, true); assert.equal(p2.motoboy, 'm1');
assert.equal(PD.atribui(S, p2, 'zz').ok, false, 'entregador inexistente');
S.motoboys[1].ativo = false; assert.equal(PD.atribui(S, p2, 'm2').ok, false, 'entregador inativo não recebe pedido');

/* ---- pagamento ---- */
p = ped(); assert.equal(PD.pago(p), false);
r = PD.registraPagamento(p, { agora: T0, por: 'ana', ref: 'Pix E123', total: 106 });
assert.equal(r.ok, true); assert.equal(PD.pago(p), true); assert.equal(p.pagoEm, T0); assert.equal(p.comprovante, 'Pix E123');
assert.equal(PD.registraPagamento(p, { agora: T0 }).ok, false, 'já pago');
assert.equal(PD.estornaPagamento(p, { agora: T0, motivo: '' }).ok, false);
assert.equal(PD.estornaPagamento(p, { agora: T0 + 1, motivo: 'Devolvido' }).ok, true); assert.equal(PD.pago(p), false);
assert.equal(PD.registraPagamento(ped(), { agora: T0, ref: '<b>x</b>'.repeat(60) }).ok, true);
const px = ped(); PD.registraPagamento(px, { agora: T0, ref: '<b>x</b>'.repeat(60) }); assert.ok(px.comprovante.length <= 200 && !/[<>]/.test(px.comprovante), 'referência limpa e curta');
assert.equal(PD.resumoPagamento(ped({ pagamento: 'Dinheiro' })).quando, 'na entrega');
assert.equal(PD.resumoPagamento(ped({ tipo: 'retirada', pagamento: 'Pagar na retirada' })).quando, 'na retirada');
assert.equal(PD.resumoPagamento(ped({ pagamento: 'Pix' })).quando, 'antes de sair');

/* ---- comanda para impressão (80 mm) ---- */
const c = PD.comandaTexto(ped({ obs: 'Sem casca', itens: [{ id: 'a', nome: 'Filé de Camarão Cinza Limpo', un: 'kg', preco: 50, qtd: 1.5, obs: 'bem limpo' }] }), cfg, 40);
const linhas = c.split('\n');
assert.ok(linhas.every((l) => l.length <= 40), 'nenhuma linha passa de 40 colunas');
assert.match(c, /JP-1/); assert.match(c, /Ana/); assert.match(c, /Aldeota/); assert.match(c, /1,5 kg/); assert.match(c, /R\$ 75,00/); assert.match(c, /TOTAL.*R\$ 81,00/); assert.match(c, /Sem casca/); assert.match(c, /bem limpo/);
const html = PD.comandaHtml(ped({ cliente: '<script>x</script>' }), cfg);
assert.ok(!/<script>x/.test(html), 'comanda escapa HTML do cliente'); assert.match(html, /@page/); assert.match(html, /80mm/);

/* ---- resumo por entregador ---- */
S = estado();
const e1 = ped({ id: 'E1', motoboy: 'm1', status: 'entregue', fixo: 'entregue', confirmado: true, entregueEm: T0, taxa: 6 });
const e2 = ped({ id: 'E2', motoboy: 'm1', status: 'entregue', fixo: 'entregue', confirmado: true, entregueEm: T0, taxa: 9 });
const e3 = ped({ id: 'E3', motoboy: 'm2', status: 'saiu', confirmado: true });
S.pedidos.push(e1, e2, e3);
const rs = PD.resumoEntregadores(S, T0 - 1000);
assert.deepEqual([rs.m1.entregues, rs.m1.taxas, rs.m1.emRota], [2, 15, 0]); assert.deepEqual([rs.m2.entregues, rs.m2.emRota], [0, 1]);

console.log('testes pedidos ok');
