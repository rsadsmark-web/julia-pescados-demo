// Ponta a ponta: servidor de verdade (server.js + Postgres temporário) e um entregador simulado percorrendo uma rota,
// com GPS ruim, perda de internet no meio do caminho e o cliente acompanhando. Uso: node tests/entrega-e2e.test.mjs <raiz>
import { createRequire } from 'module'; import assert from 'assert'; import http from 'http'; import crypto from 'crypto'; import { execFileSync, spawn } from 'child_process'; import { mkdtempSync } from 'fs'; import { tmpdir } from 'os'; import { join } from 'path';
const raiz = process.argv[2];
const require = createRequire(raiz + '/servidor/');
const E = require(raiz + '/entrega-lib.js');
const NOME = 'julia_teste_e2e_' + process.pid;
const PG = ['/opt/homebrew/opt/postgresql@16/bin', '/opt/homebrew/bin', '/usr/local/bin', '/usr/bin'];
const bin = (n) => { for (const d of PG) { try { execFileSync(d + '/' + n, ['--version'], { stdio: 'ignore' }); return d + '/' + n; } catch (e) {} } return n; };
execFileSync(bin('createdb'), [NOME]);

const falsos = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'); res.setHeader('Content-Type', 'application/json');
  if (u.pathname.startsWith('/route/')) {
    const [a, b] = u.pathname.split('/').pop().split(';').map((s) => s.split(',').map(Number));
    const d = E.distanciaM({ lng: a[0], lat: a[1] }, { lng: b[0], lat: b[1] }) * 1.3;
    return res.end(JSON.stringify({ routes: [{ distance: d, duration: d / 7, geometry: { coordinates: [a, b] } }] }));
  }
  res.end(JSON.stringify([{ lat: '-3.7265', lon: '-38.4930' }]));
});
await new Promise((r) => falsos.listen(0, '127.0.0.1', r));
const pf = falsos.address().port, porta = 20000 + Math.floor(Math.random() * 20000);
const filho = spawn(process.execPath, [raiz + '/servidor/server.js'], { env: { ...process.env, DATABASE_URL: 'postgres:///' + NOME, PORT: String(porta), SITE_DIR: raiz, DINAMICO_DIR: mkdtempSync(join(tmpdir(), 'jp-din-')), OSRM_URL: 'http://127.0.0.1:' + pf, NOMINATIM_URL: 'http://127.0.0.1:' + pf }, stdio: ['ignore', 'pipe', 'pipe'] });
let saida = ''; filho.stdout.on('data', (d) => (saida += d)); filho.stderr.on('data', (d) => (saida += d));
const base = 'http://127.0.0.1:' + porta;
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
let cookie = '';
const chama = async (m, p, corpo, comCookie = true) => { const r = await fetch(base + p, { method: m, redirect: 'manual', headers: { 'Content-Type': 'application/json', 'X-JP': '1', ...(comCookie && cookie ? { Cookie: cookie } : {}) }, body: corpo === undefined ? undefined : JSON.stringify(corpo) }); let j = {}; try { j = await r.json(); } catch (e) {} return { s: r.status, j, h: r.headers }; };
const tok = (l) => l.split('/').pop();

try {
  for (let i = 0; i < 60; i++) { try { if ((await fetch(base + '/saude')).ok) break; } catch (e) {} await pausa(250); if (i === 59) throw new Error('servidor não subiu:\n' + saida); }
  // usuário de teste
  const { Pool } = require('pg'); const pool = new Pool({ connectionString: 'postgres:///' + NOME }); pool.on('error', () => {});
  const sal = 'ab'.repeat(8), hash = 'scrypt$' + sal + '$' + crypto.scryptSync('senha-de-teste-123', sal, 64).toString('hex');
  await pool.query("INSERT INTO usuarios (usuario, nome, senha_hash, papel) VALUES ('teste','Teste',$1,'admin')", [hash]);
  const lg = await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario: 'teste', senha: 'senha-de-teste-123' }) });
  assert.equal(lg.status, 200); cookie = lg.headers.get('set-cookie').split(';')[0];

  // sem login: painel fechado, telas públicas e API de token abertas
  assert.equal((await chama('GET', '/api/rastreios', undefined, false)).s, 401, 'a lista do painel exige login');
  assert.equal((await chama('POST', '/api/rastreios', { pedido: 'X' }, false)).s, 401);
  for (const a of ['/entregador.js', '/acompanhar.js', '/entrega-lib.js', '/entrega-mapa.js', '/entrega.css', '/base.css']) assert.equal((await fetch(base + a, { redirect: 'manual' })).status, 200, a + ' abre sem login');

  // painel gera os links (destino exato pelo "Nominatim")
  const DEST = { lat: -3.7265, lng: -38.493 };
  let r = await chama('POST', '/api/rastreios', { pedido: 'JP-2001', entregadorId: 'm1', entregadorNome: 'Danilo', cliente: 'Carla Mendonça', bairro: 'Meireles', endereco: 'Av. Beira Mar 1000', statusPedido: 'pronto', lat: DEST.lat, lng: DEST.lng, precisao: 'bairro' });
  assert.equal(r.s, 201); const tc = tok(r.j.linkCliente), te = tok(r.j.linkEntregador);
  for (const rota of ['/e/' + te, '/r/' + tc]) { const p = await fetch(base + rota, { redirect: 'manual' }); assert.equal(p.status, 200, rota + ' abre sem login'); assert.equal(p.headers.get('referrer-policy'), 'origin'); }

  /* ---- o entregador (mesma lógica da tela entregador.js) ---- */
  const aceite = await chama('POST', '/api/e/' + te + '/iniciar', { aceite: true }, false); assert.equal(aceite.s, 200);
  const N = 40, T0 = Date.now() - N * 5000, A = { lat: -3.7392, lng: -38.5058 };
  const fixo = (i) => ({ lat: A.lat + (DEST.lat - A.lat) * (i / (N - 1)), lng: A.lng + (DEST.lng - A.lng) * (i / (N - 1)), t: T0 + i * 5000, prec: 8 });
  let fila = [], ultimoEnviado = null, ultimoAceito = null, online = true, enviados = 0; const etas = [], descartadosLocal = { precisao: 0, salto: 0 };
  const flush = async () => {
    if (!online || !fila.length) return;
    const lote = fila.slice(0, 50); const r2 = await chama('POST', '/api/e/' + te + '/posicoes', { pontos: lote }, false);
    assert.equal(r2.s, 200); fila = fila.slice(lote.length); enviados += r2.j.aceitos;
  };
  for (let i = 0; i < N; i++) {
    let p = fixo(i);
    if (i === 6) p = { ...p, prec: 320 };                                   // sinal ruim: o aparelho ignora
    if (i === 14) p = { ...p, lat: p.lat + 0.02, lng: p.lng + 0.02 };       // salto de GPS de ~3 km
    if (i === 10) online = false;                                           // entra num túnel: sem internet por 10 fixos
    if (i === 20) online = true;
    if (p.prec > E.LIMITES.precisaoMaxM) { descartadosLocal.precisao++; continue; }
    if (!E.aceitaPonto(ultimoAceito, p)) { descartadosLocal.salto++; continue; }
    ultimoAceito = p;
    if (E.deveEnviar(ultimoEnviado, p)) { ultimoEnviado = p; fila = E.empilha(fila, p); }
    if (online) { await flush(); const c = await chama('GET', '/api/r/' + tc, undefined, false); assert.equal(c.s, 200); if (c.j.etaSeg != null) etas.push(c.j.etaSeg); }
    if (i === 15) { assert.ok(fila.length >= 4, 'offline: os pontos ficam guardados na fila (' + fila.length + ')'); }
  }
  await flush();
  assert.equal(descartadosLocal.precisao, 1); assert.equal(descartadosLocal.salto, 1, 'o salto de GPS foi barrado no aparelho');
  assert.ok(fila.length === 0, 'fila vazia: tudo enviado quando a internet voltou');
  assert.ok(enviados >= 35, 'quase todos os pontos chegaram (' + enviados + ')');

  /* ---- o cliente vê o resultado ---- */
  await pausa(300);
  let c = await chama('GET', '/api/r/' + tc, undefined, false);
  assert.equal(c.j.estado, 'em_rota'); assert.equal(c.j.semSinal, false);
  assert.ok(E.distanciaM(c.j.posicao, DEST) < 80, 'o entregador aparece junto do destino: ' + Math.round(E.distanciaM(c.j.posicao, DEST)) + ' m');
  assert.ok(c.j.etaSeg < 60, 'tempo estimado perto de zero'); assert.equal(c.j.etaTexto, 'chegando');
  assert.ok(etas.length > 20 && etas[0] > etas[etas.length - 1], 'o tempo estimado diminui ao longo do percurso (' + etas[0] + ' s → ' + etas[etas.length - 1] + ' s)');
  assert.ok(c.j.trilha.length > 5 && c.j.trilha.length <= 40, 'rastro limitado');
  assert.ok(!JSON.stringify(c.j).includes('Beira Mar'), 'cliente não vê o endereço completo');

  /* ---- o painel vê a entrega ao vivo e depois o entregador conclui ---- */
  let painel = (await chama('GET', '/api/rastreios')).j[0]; assert.equal(painel.estado, 'em_rota'); assert.equal(painel.evento, 'saiu'); assert.equal(painel.semSinal, false);
  r = await chama('POST', '/api/e/' + te + '/concluir', {}, false); assert.equal(r.s, 200);
  c = await chama('GET', '/api/r/' + tc, undefined, false); assert.equal(c.j.estado, 'entregue'); assert.equal(c.j.posicao, null);
  const sobra = (await pool.query('SELECT ult_lat, trilha, rota FROM rastreios')).rows[0]; assert.equal(sobra.ult_lat, null); assert.deepEqual(sobra.trilha, []); assert.equal(sobra.rota, null, 'nenhuma posição fica guardada');
  assert.equal((await chama('GET', '/saude', undefined, false)).s, 200);
  assert.ok(!/Error|erro interno/i.test(saida.replace(/geocodifica[^\n]*/g, '')), 'o servidor não registrou erros:\n' + saida);
  await pool.end();
  console.log('entrega-e2e.test.mjs: ok');
} catch (e) { console.error(e); process.exitCode = 1; console.error('--- saída do servidor ---\n' + saida.slice(-1500)); }
finally {
  filho.kill(); falsos.close(); await pausa(300);
  try { execFileSync(bin('dropdb'), ['--force', NOME]); } catch (e) { console.error('não consegui apagar ' + NOME); }
  setTimeout(() => process.exit(process.exitCode || 0), 100);
}
