'use strict';
// Servidor da Júlia Pescados: login, usuários e armazenamento do estado (Postgres) + arquivos do site.
require('./async-erros');
const express = require('express');
const crypto = require('crypto');
const path = require('path');
const { Pool } = require('pg');
const { limite, ipDe } = require('./limite');

const PORTA = +process.env.PORT || 3000;
const SITE = process.env.SITE_DIR || path.join(__dirname, '..', 'site');
const SESSAO_DIAS = 7;
const COOKIE = 'jp_sess';

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 6 });
process.on('unhandledRejection', (e) => console.error('rejeição não tratada', e && e.message));
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

/* ---------- banco ---------- */
async function iniciaBanco() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY, usuario TEXT UNIQUE NOT NULL, nome TEXT NOT NULL, senha_hash TEXT NOT NULL,
      papel TEXT NOT NULL DEFAULT 'operador' CHECK (papel IN ('admin','operador')),
      ativo BOOLEAN NOT NULL DEFAULT TRUE, senha_provisoria BOOLEAN NOT NULL DEFAULT FALSE,
      criado TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS sessoes (
      token_hash TEXT PRIMARY KEY, usuario_id INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      criado TIMESTAMPTZ NOT NULL DEFAULT now(), expira TIMESTAMPTZ NOT NULL
    );
    CREATE TABLE IF NOT EXISTS auditoria (
      id BIGSERIAL PRIMARY KEY, quando TIMESTAMPTZ NOT NULL DEFAULT now(), usuario TEXT, acao TEXT NOT NULL, detalhe TEXT, ip TEXT);
    CREATE INDEX IF NOT EXISTS auditoria_quando ON auditoria (quando DESC);
    CREATE TABLE IF NOT EXISTS kv (
      chave TEXT PRIMARY KEY, valor TEXT NOT NULL, versao INT NOT NULL DEFAULT 1,
      atualizado TIMESTAMPTZ NOT NULL DEFAULT now(), atualizado_por INT
    );`);
}

/* ---------- auditoria: quem fez o quê (login, senhas, usuários, WhatsApp, nota fiscal). Nunca grava senha nem token. ---------- */
async function auditar(req, acao, detalhe, usuario) {
  try {
    await pool.query('INSERT INTO auditoria (usuario, acao, detalhe, ip) VALUES ($1,$2,$3,$4)',
      [String(usuario || (req.usuario && req.usuario.usuario) || '').slice(0, 60) || null, String(acao).slice(0, 60), detalhe ? String(detalhe).replace(/[\u0000-\u001f]/g, ' ').slice(0, 300) : null, ipDe(req)]);
  } catch (e) { console.error('auditoria', e.message); }
}
app.locals.auditar = auditar;

/* ---------- senhas ---------- */
function hashSenha(s) {
  const sal = crypto.randomBytes(16).toString('hex');
  return 'scrypt$' + sal + '$' + crypto.scryptSync(s, sal, 64).toString('hex');
}
function confereSenha(s, h) {
  const p = String(h).split('$'); if (p[0] !== 'scrypt') return false;
  const a = Buffer.from(p[2], 'hex'), b = crypto.scryptSync(s, p[1], 64);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');
function senhaFraca(s) { return typeof s !== 'string' || s.length < 10 || s.length > 200; }

/* ---------- limite de tentativas de login ---------- */
const falhas = new Map(); // chave -> [timestamps]
function bloqueado(chave) {
  const agora = Date.now(), l = (falhas.get(chave) || []).filter((t) => agora - t < 15 * 60000);
  falhas.set(chave, l); return l.length >= 5;
}
const falhou = (chave) => { const l = falhas.get(chave) || []; l.push(Date.now()); falhas.set(chave, l); };

/* ---------- cookies e sessão ---------- */
function cookies(req) {
  const o = {}; (req.headers.cookie || '').split(';').forEach((c) => { const i = c.indexOf('='); if (i > 0) o[c.slice(0, i).trim()] = decodeURIComponent(c.slice(i + 1).trim()); });
  return o;
}
function setaCookie(req, res, token, maxAge) {
  const seguro = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.append('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}` + (seguro ? '; Secure' : ''));
}
async function usuarioDaSessao(req) {
  const t = cookies(req)[COOKIE]; if (!t) return null;
  const r = await pool.query(
    `SELECT u.id, u.usuario, u.nome, u.papel, u.senha_provisoria FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id
     WHERE s.token_hash = $1 AND s.expira > now() AND u.ativo`, [sha(t)]);
  return r.rows[0] || null;
}

/* ---------- cabeçalhos de segurança ---------- */
app.use((req, res, next) => {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'same-origin', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()', 'Cache-Control': 'no-store' });
  if (req.headers['x-forwarded-proto'] === 'https') res.set('Strict-Transport-Security', 'max-age=31536000');
  next();
});

/* ---------- endereços limpos: /admin em vez de /admin.html (o antigo redireciona com 301) ---------- */
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  const m = /^(.*?)(?:\/index)?(?:\.html)?\/?$/.exec(req.path), alvo = (m && m[1]) || '/';
  if (alvo !== req.path && !req.path.startsWith('/api/') && (/\.html$/.test(req.path) || /^\/[a-z-]+\/?$/.test(req.path) || req.path === '/index')) {
    return res.redirect(301, alvo + req.url.slice(req.path.length));
  }
  next();
});

app.get('/saude', async (req, res) => {
  try { await pool.query('SELECT 1'); res.json({ ok: true }); } catch (e) { res.status(503).json({ ok: false }); }
});

/* ---------- rotas públicas: pedido e lista de espera da loja (com limite por IP) ---------- */
const wa = require('./whatsapp')(app, pool); // WhatsApp (uazapi): desligado por padrão; o webhook tem corpo próprio, por isso vem antes
app.use('/api', express.json({ limit: '20kb' }));
const pub = require('./publico')(app, pool);
const fotos = require('./fotos'); fotos.publico(app); // fotos dos produtos: leitura pública

/* ---------- login (público) ---------- */
app.post('/api/login', limite({ janelaMs: 60000, max: 20, grupo: 'login:', mensagem: 'Muitas tentativas. Aguarde um minuto.' }), async (req, res) => {
  const usuario = String((req.body || {}).usuario || '').trim().toLowerCase().slice(0, 60), senha = String((req.body || {}).senha || '');
  const k1 = 'ip:' + ipDe(req), k2 = 'u:' + usuario;
  if (bloqueado(k1) || bloqueado(k2)) return res.status(429).json({ erro: 'Muitas tentativas. Aguarde 15 minutos e tente de novo.' });
  const r = await pool.query('SELECT * FROM usuarios WHERE usuario = $1 AND ativo', [usuario]);
  const u = r.rows[0];
  const ok = u ? confereSenha(senha, u.senha_hash) : (confereSenha(senha, 'scrypt$00$' + '00'.repeat(64)), false);
  if (!ok) { falhou(k1); falhou(k2); auditar(req, 'login.falha', 'usuário informado: ' + usuario, usuario); return res.status(401).json({ erro: 'Usuário ou senha incorretos.' }); }
  const token = crypto.randomBytes(32).toString('hex');
  await pool.query('INSERT INTO sessoes (token_hash, usuario_id, expira) VALUES ($1,$2, now() + $3::int * interval \'1 day\')', [sha(token), u.id, SESSAO_DIAS]);
  await pool.query('DELETE FROM sessoes WHERE expira < now()');
  setaCookie(req, res, token, SESSAO_DIAS * 86400);
  auditar(req, 'login.ok', null, u.usuario);
  res.json({ ok: true, trocar: u.senha_provisoria });
});
app.get('/api/sair', async (req, res) => {
  const t = cookies(req)[COOKIE]; if (t) { const u = await usuarioDaSessao(req).catch(() => null); await pool.query('DELETE FROM sessoes WHERE token_hash = $1', [sha(t)]); if (u) auditar(req, 'sair', null, u.usuario); }
  setaCookie(req, res, '', 0); res.redirect('/login');
});

/* ---------- tudo abaixo exige login ---------- */
app.use('/api', limite({ janelaMs: 60000, max: 600, grupo: 'painel:' })); // folga para o painel; barra abuso
const LIVRES = new Set(['/login', '/login.js', '/img/marca/logo-julia-96.png', '/img/marca/logo-julia-192.png', '/img/marca/logo-julia-32.png', '/img/marca/apple-touch-icon.png', '/manifest.webmanifest']);
app.use(async (req, res, next) => {
  try {
    if (LIVRES.has(req.path)) return next();
    const u = await usuarioDaSessao(req);
    if (!u) {
      if (req.path.startsWith('/api/')) return res.status(401).json({ erro: 'Entre para continuar.' });
      return res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
    }
    req.usuario = u;
    if (u.senha_provisoria && !['/trocar-senha', '/api/trocar-senha', '/api/sair', '/trocar-senha.js'].includes(req.path) && !req.path.startsWith('/img/marca/')) {
      return req.path.startsWith('/api/') ? res.status(403).json({ erro: 'Troque a senha provisória.' }) : res.redirect('/trocar-senha');
    }
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.headers['x-jp'] !== '1' && !req.is('json')) return res.status(403).json({ erro: 'Requisição recusada.' });
    next();
  } catch (e) { next(e); }
});

app.get('/config.js', (req, res) => {
  res.type('application/javascript').send('window.JP_VAZIO=true;window.JP_USUARIO=' + JSON.stringify({ nome: req.usuario.nome, usuario: req.usuario.usuario, papel: req.usuario.papel }) + ';');
});
fotos.painel(app); // envio de foto do produto (exige login)
app.get('/api/eu', (req, res) => res.json(req.usuario));

app.post('/api/trocar-senha', async (req, res) => {
  const { atual, nova } = req.body || {};
  const r = await pool.query('SELECT senha_hash FROM usuarios WHERE id = $1', [req.usuario.id]);
  if (!confereSenha(String(atual || ''), r.rows[0].senha_hash)) return res.status(400).json({ erro: 'A senha atual não confere.' });
  if (senhaFraca(nova)) return res.status(400).json({ erro: 'A nova senha precisa ter ao menos 10 caracteres.' });
  if (nova === atual) return res.status(400).json({ erro: 'Escolha uma senha diferente da atual.' });
  await pool.query('UPDATE usuarios SET senha_hash = $1, senha_provisoria = FALSE WHERE id = $2', [hashSenha(nova), req.usuario.id]);
  auditar(req, 'senha.troca', null);
  const t = cookies(req)[COOKIE];
  await pool.query('DELETE FROM sessoes WHERE usuario_id = $1 AND token_hash <> $2', [req.usuario.id, sha(t)]);
  res.json({ ok: true });
});

/* ---------- estado do sistema (chave/valor) ---------- */
const CHAVES = new Set(['jp_demo_v1', 'jp_crm_v1', 'jp_ex_v1', 'jp_pv_v1', 'jp_rs_ia_v1', 'jp_loja_v1']);
app.get('/api/entradas/pendentes', async (req, res) => res.json({ n: (await pub.pendentes()) + (await wa.pendentesEntrada()) }));
app.get('/api/kv', async (req, res) => {
  try { await pub.absorve(); } catch (e) { console.error('absorve', e.message); }
  try { await wa.absorveEntrada(); } catch (e) { console.error('absorve whatsapp', e.message); } // pedidos e inscrições feitos na loja entram no estado antes de o painel carregar
  const r = await pool.query('SELECT chave, valor, versao FROM kv');
  const o = {}; r.rows.forEach((x) => { o[x.chave] = { valor: x.valor, versao: x.versao }; });
  res.json(o);
});
app.put('/api/kv/:chave', express.text({ type: '*/*', limit: '30mb' }), async (req, res) => {
  const k = req.params.chave; if (!CHAVES.has(k)) return res.status(400).json({ erro: 'Chave desconhecida.' });
  const base = parseInt(req.headers['if-match'], 10) || 0, valor = typeof req.body === 'string' ? req.body : '';
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const at = await c.query('SELECT versao FROM kv WHERE chave = $1 FOR UPDATE', [k]);
    if (at.rows[0] && at.rows[0].versao !== base) { await c.query('ROLLBACK'); return res.status(409).json({ erro: 'Dados alterados em outra sessão.', versao: at.rows[0].versao }); }
    if (!at.rows[0] && base !== 0) { await c.query('ROLLBACK'); return res.status(409).json({ erro: 'Dados alterados em outra sessão.' }); }
    const nv = at.rows[0] ? at.rows[0].versao + 1 : 1;
    await c.query(
      `INSERT INTO kv (chave, valor, versao, atualizado_por) VALUES ($1,$2,$3,$4)
       ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor, versao = EXCLUDED.versao, atualizado = now(), atualizado_por = EXCLUDED.atualizado_por`, [k, valor, nv, req.usuario.id]);
    await c.query('COMMIT'); res.json({ ok: true, versao: nv });
    if (k === 'jp_demo_v1' || k === 'jp_ex_v1' || k === 'jp_loja_v1') pub.agendaPublica(); // catálogo público atualizado
  } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; } finally { c.release(); }
});

/* ---------- usuários (só administrador) ---------- */
const soAdmin = (req, res, next) => (req.usuario.papel === 'admin' ? next() : res.status(403).json({ erro: 'Só o administrador faz isso.' }));
wa.rotasPainel(soAdmin);
const iaa = require('./ia')(app, pool, wa); iaa.rotas(soAdmin); // atendimento por IA: desligado e sem chave por padrão
const nfe = require('./nf')(app, pool); nfe.rotas(soAdmin); // nota fiscal: rascunhos e configuração; emissão desligada por padrão
app.get('/api/usuarios', soAdmin, async (req, res) => {
  res.json((await pool.query('SELECT id, usuario, nome, papel, ativo, senha_provisoria, criado FROM usuarios ORDER BY id')).rows);
});
app.post('/api/usuarios', soAdmin, async (req, res) => {
  const b = req.body || {}, usuario = String(b.usuario || '').trim().toLowerCase(), nome = String(b.nome || '').trim();
  const papel = b.papel === 'admin' ? 'admin' : 'operador';
  if (!/^[a-z0-9._-]{3,40}$/.test(usuario)) return res.status(400).json({ erro: 'Usuário: 3 a 40 letras minúsculas, números, ponto, hífen ou sublinhado.' });
  if (!nome) return res.status(400).json({ erro: 'Informe o nome.' });
  if (senhaFraca(b.senha)) return res.status(400).json({ erro: 'A senha provisória precisa ter ao menos 10 caracteres.' });
  try {
    await pool.query('INSERT INTO usuarios (usuario, nome, senha_hash, papel, senha_provisoria) VALUES ($1,$2,$3,$4,TRUE)', [usuario, nome, hashSenha(b.senha), papel]);
    auditar(req, 'usuario.criado', usuario + ' (' + papel + ')');
    res.json({ ok: true });
  } catch (e) { if (e.code === '23505') return res.status(409).json({ erro: 'Esse usuário já existe.' }); throw e; }
});
app.patch('/api/usuarios/:id', soAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10), b = req.body || {};
  if (!(id > 0)) return res.status(400).json({ erro: 'Usuário inválido.' });
  auditar(req, 'usuario.alterado', 'id ' + id + (b.ativo === false ? ': desativado' : b.ativo === true ? ': reativado' : '') + (b.senha !== undefined ? ': senha provisória redefinida' : ''));
  if (b.ativo === false) {
    const a = await pool.query("SELECT count(*)::int n FROM usuarios WHERE papel='admin' AND ativo AND id <> $1", [id]);
    if (!a.rows[0].n) return res.status(400).json({ erro: 'Não dá para desativar o último administrador.' });
    await pool.query('UPDATE usuarios SET ativo = FALSE WHERE id = $1', [id]); await pool.query('DELETE FROM sessoes WHERE usuario_id = $1', [id]);
  } else if (b.ativo === true) await pool.query('UPDATE usuarios SET ativo = TRUE WHERE id = $1', [id]);
  if (b.senha !== undefined) {
    if (senhaFraca(b.senha)) return res.status(400).json({ erro: 'A senha provisória precisa ter ao menos 10 caracteres.' });
    await pool.query('UPDATE usuarios SET senha_hash = $1, senha_provisoria = TRUE WHERE id = $2', [hashSenha(b.senha), id]);
    await pool.query('DELETE FROM sessoes WHERE usuario_id = $1', [id]);
  }
  res.json({ ok: true });
});

app.get('/api/auditoria', soAdmin, async (req, res) => {
  res.json((await pool.query('SELECT id, quando, usuario, acao, detalhe, ip FROM auditoria ORDER BY id DESC LIMIT 200')).rows);
});

/* ---------- arquivos do site ---------- */
app.use(express.static(SITE, { dotfiles: 'ignore', index: 'index.html', extensions: ['html'], redirect: false, setHeaders: (res, f) => { if (/\.(png|jpe?g|webp|svg|ico)$/i.test(f)) res.set('Cache-Control', 'private, max-age=86400'); } }));
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const st = err && err.status >= 400 && err.status < 500 ? err.status : 500;
  if (st === 500) console.error(err); // erro de entrada do cliente (JSON quebrado, corpo grande) não polui o registro
  res.status(st).json({ erro: st === 413 ? 'Dados grandes demais.' : st === 500 ? 'Erro interno.' : 'Requisição inválida.' });
});

module.exports = { pool, hashSenha, iniciaBanco };
if (require.main === module) {
  (async () => {
    for (let i = 0; i < 30; i++) { try { await iniciaBanco(); break; } catch (e) { console.log('aguardando o banco…', e.code || e.message); await new Promise((r) => setTimeout(r, 2000)); if (i === 29) process.exit(1); } }
    await pub.iniciaTabelas(); await wa.iniciaTabelas(); await nfe.iniciaTabelas(); await iaa.iniciaTabelas(); wa.iniciaFila(); await pub.publica().catch((e) => console.error('publica', e.message));
    app.listen(PORTA, () => console.log('Júlia Pescados no ar na porta ' + PORTA));
  })();
}
