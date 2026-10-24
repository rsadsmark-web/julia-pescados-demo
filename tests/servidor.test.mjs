// Teste do limite por IP e do tratamento de erro assíncrono (sem banco). Uso: node tests/servidor.test.mjs <raiz-do-projeto>
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import http from 'node:http';
const raiz = process.argv[2];
const require = createRequire(raiz + '/servidor/');
require('./async-erros');
const express = require('express');
const { limite, ipDe } = require('./limite');

const app = express();
app.use(express.json({ limit: '1kb' }));
app.get('/limitado', limite({ janelaMs: 60000, max: 2, mensagem: 'Calma.' }), (req, res) => res.json({ ok: true, ip: ipDe(req) }));
app.get('/quebra', async () => { throw Object.assign(new Error('boom'), { code: 'X' }); });
app.post('/eco', (req, res) => res.json(req.body));
app.use((err, req, res, next) => res.status(err.status >= 400 && err.status < 500 ? err.status : 500).json({ erro: 'x' }));

const srv = http.createServer(app);
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const base = 'http://127.0.0.1:' + srv.address().port;
const get = (p, h) => fetch(base + p, { headers: h });

assert.equal((await get('/limitado')).status, 200);
assert.equal((await get('/limitado')).status, 200);
const r3 = await get('/limitado');
assert.equal(r3.status, 429, 'terceira chamada na janela é barrada');
assert.ok(+r3.headers.get('retry-after') > 0, 'Retry-After informado');
assert.equal((await r3.json()).erro, 'Calma.');
// IP vindo do proxy local conta separado (cada visitante tem o seu limite)
assert.equal((await get('/limitado', { 'x-cliente-ip': '203.0.113.9' })).status, 200);
assert.equal((await (await get('/limitado', { 'x-cliente-ip': '203.0.113.10' })).json()).ip, '203.0.113.10');
// cabeçalho forjado por quem não é o proxy local não vale
assert.equal(ipDe({ socket: { remoteAddress: '198.51.100.7' }, headers: { 'x-cliente-ip': '1.2.3.4' } }), '198.51.100.7');
assert.equal(ipDe({ socket: { remoteAddress: '172.18.0.5' }, headers: { 'x-cliente-ip': '1.2.3.4' } }), '1.2.3.4');

// rota assíncrona que falha responde 500 (antes ficava pendurada)
const q = await Promise.race([get('/quebra'), new Promise((r) => setTimeout(() => r('travou'), 3000))]);
assert.notEqual(q, 'travou', 'rota assíncrona com erro não pode travar');
assert.equal(q.status, 500);
// JSON quebrado e corpo grande dão 4xx
const ruim = await fetch(base + '/eco', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{quebrado' });
assert.equal(ruim.status, 400);
const grande = await fetch(base + '/eco', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ a: 'x'.repeat(5000) }) });
assert.equal(grande.status, 413);
srv.close();
console.log('testes servidor ok');
