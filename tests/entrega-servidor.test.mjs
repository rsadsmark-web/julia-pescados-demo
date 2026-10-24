// Servidor do rastreio com Postgres de verdade (banco temporário) e OSRM/Nominatim de mentira.
// Uso: node tests/entrega-servidor.test.mjs <raiz-do-projeto>   (precisa de postgres local acessível por createdb/psql)
import { createRequire } from 'module'; import assert from 'assert'; import http from 'http'; import { execFileSync } from 'child_process';
const raiz = process.argv[2];
const require = createRequire(raiz + '/servidor/');
const NOME = 'julia_teste_rastreio_' + process.pid;
const PG = ['/opt/homebrew/opt/postgresql@16/bin', '/opt/homebrew/bin', '/usr/local/bin', '/usr/bin'];
const bin = (n) => { for (const d of PG) { try { execFileSync(d + '/' + n, ['--version'], { stdio: 'ignore' }); return d + '/' + n; } catch (e) {} } return n; };
execFileSync(bin('createdb'), [NOME]);
const E = require(raiz + '/entrega-lib.js');

/* serviços de mentira */
let osrmCai = false, geoCai = false, osrmChamadas = 0, geoChamadas = 0;
const falsos = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'); res.setHeader('Content-Type', 'application/json');
  if (u.pathname.startsWith('/route/')) {
    osrmChamadas++; if (osrmCai) { res.statusCode = 500; return res.end('{}'); }
    const [a, b] = u.pathname.split('/').pop().split(';').map((s) => s.split(',').map(Number));
    const d = E.distanciaM({ lng: a[0], lat: a[1] }, { lng: b[0], lat: b[1] }) * 1.3;
    return res.end(JSON.stringify({ routes: [{ distance: d, duration: d / 8, geometry: { coordinates: [a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], b] } }] }));
  }
  if (u.pathname === '/search') {
    geoChamadas++; if (geoCai) { res.statusCode = 503; return res.end('{}'); }
    const q = u.searchParams.get('q') || '';
    if (/Rua Certa 100/.test(q)) return res.end(JSON.stringify([{ lat: '-3.7300', lon: '-38.4950' }]));
    if (/Rua Longe/.test(q)) return res.end(JSON.stringify([{ lat: '-23.55', lon: '-46.63' }])); // resultado fora da região
    return res.end('[]');
  }
  res.statusCode = 404; res.end('{}');
});
await new Promise((r) => falsos.listen(0, '127.0.0.1', r));
const pf = falsos.address().port;
process.env.OSRM_URL = 'http://127.0.0.1:' + pf; process.env.NOMINATIM_URL = 'http://127.0.0.1:' + pf; process.env.SITE_DIR = raiz;

const express = require('express'); const { Pool } = require('pg'); require('./async-erros');
const pool = new Pool({ connectionString: 'postgres:///' + NOME, max: 4 });
const app = express(); app.use('/api', express.json({ limit: '20kb' }));
const ent = require('./entrega')(app, pool);
await ent.iniciaTabelas(); ent.rotasPublicas(); ent.paginas(raiz); ent.rotasPainel((q, s, n) => n());
app.use((err, req, res, next) => res.status(err.status >= 400 && err.status < 500 ? err.status : 500).json({ erro: 'x' }));
const srv = http.createServer(app); await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const base = 'http://127.0.0.1:' + srv.address().port;
const chama = async (m, p, corpo, h) => { const r = await fetch(base + p, { method: m, headers: { 'Content-Type': 'application/json', ...(h || {}) }, body: corpo === undefined ? undefined : JSON.stringify(corpo) }); let j = {}; try { j = await r.json(); } catch (e) {} return { s: r.status, j, h: r.headers }; };
const tok = (link) => link.split('/').pop();
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
const agora = Date.now();
const pt = (i, t) => ({ lat: -3.7392 + i * 0.0006, lng: -38.5058 + i * 0.0006, t: t, prec: 10 });
// continuação do trajeto a 10 m/s depois do último ponto do lote offline (movimento coerente com o relógio)
const ptT = (t) => ({ lat: pt(7, 0).lat + (t - (agora - 10000)) * 9e-8, lng: pt(7, 0).lng + (t - (agora - 10000)) * 9e-8, t: t, prec: 10 });
const novo = (extra) => ({ pedido: 'JP-1', entregadorId: 'm1', entregadorNome: 'Wellington', cliente: 'Carla Mendonça', bairro: 'Meireles', endereco: 'Rua Certa 100', obs: 'Interfone 402', lat: -3.7265, lng: -38.493, precisao: 'bairro', statusPedido: 'confirmado', ...extra });

try {
  /* ---- criar o rastreio ---- */
  let r = await chama('POST', '/api/rastreios', { pedido: 'JP-1' });
  assert.equal(r.s, 400, 'sem entregador não gera'); assert.match(r.j.erro, /entregador/);
  r = await chama('POST', '/api/rastreios', novo());
  assert.equal(r.s, 201); assert.equal(r.j.aproximado, false, 'endereço achado no Nominatim: ponto exato');
  assert.equal(r.j.destino.lat, -3.73); assert.equal(r.j.destino.exato, true);
  const tc = tok(r.j.linkCliente), te = tok(r.j.linkEntregador);
  assert.match(r.j.linkCliente, /^http:\/\/127\.0\.0\.1:\d+\/r\/[A-Za-z0-9_-]{43}$/, 'token de 256 bits'); assert.match(r.j.linkEntregador, /\/e\/[A-Za-z0-9_-]{43}$/); assert.notEqual(tc, te);
  const guardado = (await pool.query('SELECT token_cli, token_ent FROM rastreios')).rows[0];
  assert.ok(!JSON.stringify(guardado).includes(tc) && !JSON.stringify(guardado).includes(te), 'no banco fica só o hash do token');
  assert.equal(geoChamadas, 1);
  // mesmo endereço de novo: sai do cache, sem chamar o Nominatim
  r = await chama('POST', '/api/rastreios', novo()); assert.equal(r.s, 201); assert.equal(geoChamadas, 1, 'cache da geocodificação'); assert.equal(ent.metricas.geoCache, 1);
  const tc2 = tok(r.j.linkCliente), te2 = tok(r.j.linkEntregador);
  assert.equal((await chama('GET', '/api/r/' + tc)).s, 404, 'gerar de novo invalida os links antigos');
  assert.equal((await chama('GET', '/api/r/' + tc2)).s, 200);

  /* ---- links inválidos, expirados ---- */
  assert.equal((await chama('GET', '/api/r/curto')).s, 404);
  assert.equal((await chama('GET', '/api/r/' + 'A'.repeat(43))).s, 404);
  assert.equal((await chama('GET', '/api/e/' + tc2)).s, 404, 'o link do cliente não abre a tela do entregador');
  assert.equal((await chama('GET', '/api/r/' + te2)).s, 404, 'nem o do entregador abre a do cliente');
  assert.equal((await fetch(base + '/r/' + 'x')).status, 404, 'página com token malformado');
  const pg = await fetch(base + '/e/' + te2); assert.equal(pg.status, 200);
  assert.equal(pg.headers.get('referrer-policy'), 'origin'); assert.match(pg.headers.get('permissions-policy'), /geolocation=\(self\)/); assert.match(pg.headers.get('x-robots-tag'), /noindex/);
  assert.match(await pg.text(), /Iniciar entrega/);

  /* ---- entregador: ainda em preparo ---- */
  let v = await chama('GET', '/api/e/' + te2); assert.equal(v.j.estado, 'aguardando'); assert.equal(v.j.podeIniciar, false); assert.equal(v.j.endereco, 'Rua Certa 100');
  r = await chama('POST', '/api/e/' + te2 + '/iniciar', { aceite: true }); assert.equal(r.s, 409); assert.match(r.j.erro, /preparado|preparando/);
  r = await chama('POST', '/api/rastreios/sincroniza', { pedidos: [{ id: 'JP-1', status: 'pronto' }] }); assert.equal(r.s, 200);
  r = await chama('POST', '/api/e/' + te2 + '/iniciar', {}); assert.equal(r.s, 400, 'sem aceitar o compartilhamento não inicia');
  r = await chama('POST', '/api/e/' + te2 + '/posicoes', { pontos: [pt(0, agora)] }); assert.equal(r.s, 409, 'sem iniciar não aceita posição');

  /* ---- iniciar e mandar posições ---- */
  r = await chama('POST', '/api/e/' + te2 + '/iniciar', { aceite: true }); assert.equal(r.s, 200);
  assert.equal((await chama('POST', '/api/e/' + te2 + '/iniciar', { aceite: true })).s, 200, 'tocar duas vezes não quebra');
  let painel = (await chama('GET', '/api/rastreios')).j[0]; assert.equal(painel.evento, 'saiu', 'o painel é avisado para marcar "saiu para entrega"');
  await chama('POST', '/api/rastreios/JP-1/aplicado', { evento: 'saiu' }); assert.equal((await chama('GET', '/api/rastreios')).j[0].evento, null);
  let c = await chama('GET', '/api/r/' + tc2); assert.equal(c.j.estado, 'em_rota'); assert.equal(c.j.semSinal, true, 'sem posição ainda: avisa que aguarda sinal'); assert.equal(c.j.posicao, null);

  // fila offline: 8 pontos antigos de uma vez (com um salto absurdo e um ponto fora da região no meio)
  const lote = []; for (let i = 0; i < 8; i++) lote.push(pt(i, agora - (9 - i) * 5000));
  lote.splice(4, 0, { lat: -3.9, lng: -38.5, t: agora - 5 * 5000 + 500, prec: 8 }); // salto de 17 km
  lote.splice(2, 0, { lat: -23.5, lng: -46.6, t: agora - 7 * 5000 + 500, prec: 8 }); // São Paulo
  r = await chama('POST', '/api/e/' + te2 + '/posicoes', { pontos: lote }); assert.equal(r.s, 200); assert.equal(r.j.aceitos, 8, 'entram os 8 bons; o salto e o ponto fora da região caem');
  c = await chama('GET', '/api/r/' + tc2);
  assert.equal(c.j.semSinal, false); assert.ok(Math.abs(c.j.posicao.lat - pt(7, 0).lat) < 1e-6, 'posição atual = último ponto bom'); assert.equal(c.j.trilha.length, 8);
  assert.ok(c.j.etaSeg > 0 && c.j.etaTexto, 'tem tempo estimado'); assert.ok(c.j.distTexto);
  assert.equal(c.j.entregador, 'Wellington'); assert.equal(c.j.nome, 'Carla Mendonça');
  const bruto = JSON.stringify(c.j); for (const s of ['Rua Certa', 'Interfone', tc2, te2]) assert.ok(!bruto.includes(s), 'cliente não pode ver: ' + s);
  // roteirização acontece em segundo plano e melhora o tempo/traçado
  await pausa(300); c = await chama('GET', '/api/r/' + tc2); assert.ok(c.j.rota && c.j.rota.length >= 2, 'rota do OSRM chegou'); assert.ok(osrmChamadas >= 1);
  const n1 = osrmChamadas; await chama('POST', '/api/e/' + te2 + '/posicoes', { pontos: [ptT(agora + 100)] }); await pausa(200);
  assert.equal(osrmChamadas, n1, 'a rota não é recalculada a cada ponto (poupa o serviço gratuito)');
  // ponto fora de ordem / repetido é ignorado
  r = await chama('POST', '/api/e/' + te2 + '/posicoes', { pontos: [pt(3, agora - 20000)] }); assert.equal(r.j.aceitos, 0);
  // lixo no corpo
  assert.equal((await chama('POST', '/api/e/' + te2 + '/posicoes', { pontos: 'oi' })).j.aceitos, 0);
  assert.equal((await fetch(base + '/api/e/' + te2 + '/posicoes', { method: 'POST', body: 'x', headers: { 'Content-Type': 'text/plain' } })).status, 415);
  // o painel vê a posição, o rastro e o aviso de sem sinal ao envelhecer
  painel = (await chama('GET', '/api/rastreios')).j[0]; assert.equal(painel.estado, 'em_rota'); assert.ok(painel.posicao); assert.equal(painel.semSinal, false);
  await pool.query("UPDATE rastreios SET ult_em = $1 WHERE ativo", [Date.now() - 4 * 60000]);
  painel = (await chama('GET', '/api/rastreios')).j[0]; assert.equal(painel.semSinal, true, 'passou de 3 min sem posição: alerta no painel');
  const m = await chama('GET', '/api/rastreios/metricas'); assert.equal(m.j.em_rota, 1); assert.equal(m.j.sem_sinal, 1); assert.equal(m.j.alerta, true); assert.ok(m.j.posicoes >= 9);
  await chama('POST', '/api/e/' + te2 + '/posicoes', { pontos: [ptT(Date.now())] }); await pausa(300); // deixa a rota em segundo plano terminar

  /* ---- roteirização fora do ar: o tempo continua aparecendo ---- */
  osrmCai = true; await pool.query('UPDATE rastreios SET rota_em = NULL, rota = NULL WHERE ativo');
  r = await chama('POST', '/api/e/' + te2 + '/posicoes', { pontos: [ptT(Date.now() + 3000)] }); await pausa(200);
  c = await chama('GET', '/api/r/' + tc2); assert.ok(c.j.etaSeg > 0, 'sem OSRM, usa o cálculo em linha reta'); assert.ok(ent.metricas.osrmFalha >= 1); osrmCai = false;

  /* ---- concluir apaga a posição ---- */
  r = await chama('POST', '/api/e/' + te2 + '/falhar', {}); assert.equal(r.s, 400, 'não entregar pede o motivo');
  r = await chama('POST', '/api/e/' + te2 + '/concluir', {}); assert.equal(r.s, 200);
  assert.equal((await chama('POST', '/api/e/' + te2 + '/concluir', {})).s, 200, 'concluir duas vezes é inofensivo');
  const apagado = (await pool.query('SELECT ult_lat, ult_lng, ult_em, trilha, rota, eta_seg FROM rastreios WHERE ativo')).rows[0];
  assert.equal(apagado.ult_lat, null); assert.equal(apagado.ult_em, null); assert.deepEqual(apagado.trilha, []); assert.equal(apagado.rota, null, 'posição, rastro e rota apagados ao concluir');
  c = await chama('GET', '/api/r/' + tc2); assert.equal(c.j.estado, 'entregue'); assert.equal(c.j.posicao, null); assert.equal(c.j.destino, null);
  r = await chama('POST', '/api/e/' + te2 + '/posicoes', { pontos: [ptT(Date.now() + 6000)] }); assert.equal(r.s, 409, 'depois de entregue não aceita mais posição');
  assert.equal((await chama('POST', '/api/e/' + te2 + '/iniciar', { aceite: true })).s, 409);
  painel = (await chama('GET', '/api/rastreios')).j[0]; assert.equal(painel.evento, 'entregue');

  /* ---- link expira ---- */
  await pool.query("UPDATE rastreios SET expira = now() - interval '1 minute' WHERE ativo");
  r = await chama('GET', '/api/r/' + tc2); assert.equal(r.s, 410); assert.equal(r.j.expirado, true);
  assert.equal((await chama('GET', '/api/e/' + te2)).s, 410);
  assert.equal((await chama('POST', '/api/e/' + te2 + '/iniciar', { aceite: true })).s, 410);

  /* ---- pedido cancelado no painel ---- */
  r = await chama('POST', '/api/rastreios', novo({ pedido: 'JP-2', endereco: 'Rua Sem Resposta 5', precisao: 'bairro' }));
  assert.equal(r.s, 201); assert.equal(r.j.aproximado, true, 'endereço não achado: cai no centro do bairro e avisa'); const tc3 = tok(r.j.linkCliente), te3 = tok(r.j.linkEntregador);
  await chama('POST', '/api/rastreios/sincroniza', { pedidos: [{ id: 'JP-2', status: 'pronto' }] });
  await chama('POST', '/api/e/' + te3 + '/iniciar', { aceite: true });
  await chama('POST', '/api/e/' + te3 + '/posicoes', { pontos: [pt(1, Date.now())] });
  await chama('POST', '/api/rastreios/sincroniza', { pedidos: [{ id: 'JP-2', status: 'cancelado' }] });
  c = await chama('GET', '/api/r/' + tc3); assert.equal(c.j.estado, 'cancelado'); assert.equal(c.j.posicao, null); assert.match(c.j.texto, /cancelado/);
  r = await chama('POST', '/api/e/' + te3 + '/posicoes', { pontos: [pt(2, Date.now() + 1)] }); assert.equal(r.s, 409, 'entregador em rota recebe aviso de que o pedido foi cancelado');
  v = await chama('GET', '/api/e/' + te3); assert.equal(v.j.estado, 'cancelado');
  r = await chama('POST', '/api/e/' + te3 + '/iniciar', { aceite: true }); assert.equal(r.s, 409); assert.match(r.j.erro, /cancelado/);

  /* ---- entrega que falhou e nova tentativa ---- */
  r = await chama('POST', '/api/rastreios', novo({ pedido: 'JP-3', endereco: 'Rua Certa 100' })); const tc4 = tok(r.j.linkCliente), te4 = tok(r.j.linkEntregador);
  await chama('POST', '/api/rastreios/sincroniza', { pedidos: [{ id: 'JP-3', status: 'pronto' }] });
  await chama('POST', '/api/e/' + te4 + '/iniciar', { aceite: true }); await chama('POST', '/api/e/' + te4 + '/posicoes', { pontos: [pt(1, Date.now())] });
  r = await chama('POST', '/api/e/' + te4 + '/falhar', { motivo: 'Cliente ausente' }); assert.equal(r.s, 200);
  painel = (await chama('GET', '/api/rastreios')).j.find((x) => x.pedido === 'JP-3'); assert.equal(painel.evento, 'falhou'); assert.equal(painel.eventoMotivo, 'Cliente ausente');
  c = await chama('GET', '/api/r/' + tc4); assert.equal(c.j.estado, 'falhou'); assert.equal(c.j.posicao, null);
  await chama('POST', '/api/rastreios/sincroniza', { pedidos: [{ id: 'JP-3', status: 'falhou' }] });
  r = await chama('POST', '/api/e/' + te4 + '/iniciar', { aceite: true }); assert.equal(r.s, 200, 'depois de falhar, dá para tentar de novo');

  /* ---- entrega concluída pelo painel encerra o rastreio ---- */
  await chama('POST', '/api/rastreios/sincroniza', { pedidos: [{ id: 'JP-3', status: 'entregue' }] });
  c = await chama('GET', '/api/r/' + tc4); assert.equal(c.j.estado, 'entregue');

  /* ---- geocodificação ruim ---- */
  r = await chama('POST', '/api/rastreios', novo({ pedido: 'JP-4', endereco: 'Rua Longe 1', lat: undefined, lng: undefined }));
  assert.equal(r.s, 422, 'resultado fora da região e sem plano B: pede para conferir o endereço');
  geoCai = true; r = await chama('POST', '/api/rastreios', novo({ pedido: 'JP-5', endereco: 'Qualquer 9' }));
  assert.equal(r.s, 201, 'Nominatim fora do ar: usa o centro do bairro'); assert.equal(r.j.aproximado, true); assert.ok(ent.metricas.geoFalha >= 2); geoCai = false;
  r = await chama('POST', '/api/rastreios', novo({ pedido: 'JP-6', lat: 10, lng: 10, endereco: 'Qualquer 9' })); assert.equal(r.s, 422);

  /* ---- em rota não troca os links; limpeza; limite ---- */
  r = await chama('POST', '/api/rastreios', novo({ pedido: 'JP-7' })); const te7 = tok(r.j.linkEntregador);
  await chama('POST', '/api/rastreios/sincroniza', { pedidos: [{ id: 'JP-7', status: 'pronto' }] }); await chama('POST', '/api/e/' + te7 + '/iniciar', { aceite: true });
  assert.equal((await chama('POST', '/api/rastreios', novo({ pedido: 'JP-7' }))).s, 409, 'com a entrega em andamento, os links não mudam');
  await chama('POST', '/api/e/' + te7 + '/posicoes', { pontos: [pt(1, Date.now())] });
  await pool.query("UPDATE rastreios SET expira = now() - interval '1 minute' WHERE pedido_id = 'JP-7'"); await ent.limpa();
  const l7 = (await pool.query("SELECT estado, ult_lat FROM rastreios WHERE pedido_id = 'JP-7'")).rows[0]; assert.equal(l7.estado, 'cancelado'); assert.equal(l7.ult_lat, null, 'link vencido: a limpeza apaga a posição que sobrou');
  await pool.query("UPDATE rastreios SET criado = now() - interval '31 days'"); await ent.limpa();
  assert.equal((await pool.query('SELECT count(*)::int n FROM rastreios')).rows[0].n, 0, 'registros com mais de 30 dias são apagados');
  let barrou = 0; for (let i = 0; i < 200; i++) { if ((await chama('GET', '/api/r/' + 'B'.repeat(43))).s === 429) barrou++; } assert.ok(barrou > 0, 'limite de consultas por IP');
  assert.equal((await chama('GET', '/api/mapa')).j.tiles.includes('{z}'), true);
  console.log('entrega-servidor.test.mjs: ok');
} finally {
  srv.close(); falsos.close(); await pool.end().catch(() => {});
  try { execFileSync(bin('dropdb'), ['--force', NOME]); } catch (e) { console.error('não consegui apagar o banco de teste ' + NOME); }
  setTimeout(() => process.exit(process.exitCode || 0), 100);
}
