// Regras do rastreio de entrega (sem rede e sem banco). Uso: node tests/entrega.test.mjs <raiz-do-projeto>
import { createRequire } from 'module'; import assert from 'assert';
const require = createRequire(import.meta.url);
const raiz = process.argv[2];
const E = require(raiz + '/entrega-lib.js');
const PD = require(raiz + '/pedidos-lib.js');
const BASE = { lat: -3.7392, lng: -38.5058 }, CASA = { lat: -3.738, lng: -38.5 };
const AG = 1700000000000;

// distância e tempo
assert.ok(Math.abs(E.distanciaM({ lat: 0, lng: 0 }, { lat: 0, lng: 1 }) - 111195) < 200, 'um grau de longitude no equador ≈ 111 km');
assert.equal(E.distanciaM(BASE, BASE), 0);
const eta = E.etaLinhaReta(BASE, CASA);
assert.ok(eta.distM > 600 && eta.distM < 1100 && eta.segundos > 100 && eta.segundos < 250, 'ETA coerente para 700 m em linha reta: ' + JSON.stringify(eta));
assert.equal(E.textoEta(30), 'chegando'); assert.equal(E.textoEta(5 * 60), 'cerca de 5 min'); assert.equal(E.textoEta(95 * 60), 'cerca de 1 h 35 min'); assert.equal(E.textoEta(null), '');
assert.equal(E.textoDistancia(420), '420 m'); assert.equal(E.textoDistancia(2350), '2,4 km');

// leitura de ponto: região, precisão, relógio do aparelho, ponto velho
assert.ok(E.lePonto({ lat: -3.74, lng: -38.5, t: AG, prec: 12 }, AG).ok);
assert.equal(E.lePonto({ lat: 0, lng: 0 }, AG).ok, false, '0,0 é erro de GPS');
assert.equal(E.lePonto({ lat: -23.5, lng: -46.6 }, AG).ok, false, 'São Paulo fica fora da região de entrega');
assert.equal(E.lePonto({ lat: 'abc', lng: null }, AG).ok, false);
assert.equal(E.lePonto({ lat: -3.74, lng: -38.5, t: AG, prec: 900 }, AG).ok, false, 'precisão ruim não entra');
assert.equal(E.lePonto({ lat: -3.74, lng: -38.5, t: AG - 11 * 60000 }, AG).ok, false, 'ponto de mais de 10 min não vale');
assert.equal(E.lePonto({ lat: -3.74, lng: -38.5, t: AG + 3600000 }, AG).ponto.t, AG, 'relógio adiantado usa a hora do servidor');
assert.equal(E.lePonto({ lat: -3.7400004, lng: -38.5000004, t: AG }, AG).ponto.lat, -3.74, 'arredonda para 6 casas');

// salto impossível e ponto fora de ordem
const a = { lat: -3.74, lng: -38.5, t: AG };
assert.ok(E.aceitaPonto(null, a));
assert.ok(E.aceitaPonto(a, { lat: -3.7405, lng: -38.5, t: AG + 5000 }), '55 m em 5 s é moto');
assert.equal(E.aceitaPonto(a, { lat: -3.78, lng: -38.5, t: AG + 5000 }), false, '4,4 km em 5 s é erro do GPS');
assert.equal(E.aceitaPonto(a, { lat: -3.7405, lng: -38.5, t: AG - 1000 }), false, 'fora de ordem');
assert.equal(E.aceitaPonto(a, { lat: -3.7405, lng: -38.5, t: AG }), false, 'mesmo instante');

// economia de bateria: parado manda menos
assert.ok(E.deveEnviar(null, a));
assert.equal(E.deveEnviar(a, { ...a, t: AG + 2000 }), false, 'antes de 4 s não manda');
assert.equal(E.deveEnviar(a, { ...a, t: AG + 6000 }), false, 'parado e antes de 15 s não manda');
assert.ok(E.deveEnviar(a, { ...a, t: AG + 16000 }), 'parado manda a cada 15 s');
assert.ok(E.deveEnviar(a, { lat: -3.7402, lng: -38.5, t: AG + 5000 }), 'andou 22 m: manda');

// fila offline: limitada, sem duplicar ponto colado
let f = []; for (let i = 0; i < 300; i++) f = E.empilha(f, { lat: -3.74, lng: -38.5, t: AG + i * 5000 });
assert.equal(f.length, E.LIMITES.filaMax, 'fila limitada'); assert.equal(f[f.length - 1].t, AG + 299 * 5000, 'descarta os mais antigos');
assert.equal(E.empilha([{ t: AG }], { t: AG + 1000 }).length, 1, 'ponto colado não entra');
let tr = []; for (let i = 0; i < 100; i++) tr = E.adicionaTrilha(tr, { lat: -3.74, lng: -38.5, t: AG + i });
assert.equal(tr.length, E.LIMITES.trilhaMax, 'rastro limitado ao necessário');

// máquina de estados
assert.equal(E.proximoEstado('aguardando', 'iniciar'), 'em_rota'); assert.equal(E.proximoEstado('em_rota', 'concluir'), 'entregue');
assert.equal(E.proximoEstado('em_rota', 'falhar'), 'falhou'); assert.equal(E.proximoEstado('falhou', 'iniciar'), 'em_rota');
assert.equal(E.proximoEstado('entregue', 'iniciar'), null); assert.equal(E.proximoEstado('cancelado', 'iniciar'), null); assert.equal(E.proximoEstado('aguardando', 'concluir'), null);

// o que o cliente vê: nada de telefone, endereço completo ou token
const linha = { estado: 'em_rota', pedido_id: 'JP-1', cliente_nome: 'Carla Mendonça', bairro: 'Meireles', entregador_nome: 'Danilo', dest_lat: -3.7265, dest_lng: -38.493, dest_precisao: 'endereco',
  ult_lat: -3.73, ult_lng: -38.49, ult_em: String(AG), eta_seg: 420, dist_m: 2100, trilha: [[-3.73, -38.49, AG]], rota: [[-3.73, -38.49]], endereco: 'Rua Secreta 10', token_cli: 'x', token_ent: 'y', fone: '85999990000' };
const v = E.visaoCliente(linha, AG + 4000);
assert.equal(v.etaTexto, 'cerca de 7 min'); assert.equal(v.distTexto, '2,1 km'); assert.equal(v.atualizadoHa, 4); assert.equal(v.semSinal, false);
const texto = JSON.stringify(v);
for (const segredo of ['Rua Secreta', '85999990000', '"token', 'token_cli']) assert.ok(!texto.includes(segredo), 'não pode vazar: ' + segredo);
assert.equal(E.visaoCliente(linha, AG + 11 * 60000).semSinal, true, 'posição de mais de 10 min vira "aguardando sinal"');
assert.equal(E.visaoCliente({ ...linha, ult_lat: null, ult_em: null }, AG).semSinal, true);
const ent = E.visaoCliente({ ...linha, estado: 'entregue', ult_lat: null, ult_em: null, trilha: [], rota: null }, AG);
assert.equal(ent.posicao, null); assert.equal(ent.destino, null); assert.equal(ent.trilha.length, 0, 'entregue não mostra mais o destino nem o rastro');
assert.equal(E.visaoCliente({ ...linha, estado: 'aguardando', ult_lat: -3.7, ult_em: String(AG) }, AG).posicao, null, 'antes de sair, não mostra posição');

// pedido: status "falhou" (entrega não realizada) e nova tentativa
const S = { produtos: [], baixas: [], motoboys: [{ id: 'm1', nome: 'W' }], pedidos: [] };
const p = { id: 'JP-9', tipo: 'entrega', itens: [], motoboy: 'm1', status: 'pronto', baixa: true };
S.pedidos.push(p);
assert.ok(PD.muda(S, p, 'saiu', { agora: AG }).ok);
assert.ok(PD.proximos(p).includes('falhou') && PD.proximos(p).includes('entregue'));
assert.equal(PD.muda(S, p, 'falhou', { agora: AG }).ok, false, 'falha pede motivo');
assert.ok(PD.muda(S, p, 'falhou', { agora: AG, motivo: 'Cliente ausente' }).ok);
assert.equal(PD.statusDe(p), 'falhou'); assert.equal(PD.rotulo(p), 'Entrega não realizada'); assert.ok(PD.ativo(p), 'falhou continua em aberto');
assert.deepEqual(PD.proximos(p).sort(), ['cancelado', 'saiu'], 'depois da falha: nova tentativa ou cancelar');
assert.ok(PD.muda(S, p, 'saiu', { agora: AG + 1 }).ok, 'nova tentativa');
assert.ok(PD.muda(S, p, 'entregue', { agora: AG + 2 }).ok);
assert.equal(p.historico.filter((h) => h.st === 'falhou')[0].motivo, 'Cliente ausente');
console.log('entrega.test.mjs: ok');
