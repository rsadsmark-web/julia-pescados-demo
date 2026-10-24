'use strict';
// Nota fiscal: guarda a configuração fiscal e os rascunhos (corpo da nota já validado) e só chama o provedor se TUDO estiver
// liberado: NF_EMISSAO_LIBERADA=sim, provedor escolhido, FOCUS_TOKEN no servidor e emitente completo. Padrão: não emite.
const path = require('path');
const NF = require(path.join(process.env.SITE_DIR || path.join(__dirname, '..'), 'nf-lib.js'));

const seguro = (fn) => (req, res, next) => fn(req, res, next).catch(next);

module.exports = function (app, pool) {
  const amb = () => ({ liberado: process.env.NF_EMISSAO_LIBERADA === 'sim', token: process.env.FOCUS_TOKEN || '' });
  const base = (cfg) => process.env.NF_FOCUS_URL || (cfg.ambiente === 'producao' ? 'https://api.focusnfe.com.br' : 'https://homologacao.focusnfe.com.br');

  async function iniciaTabelas() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS nf_config (id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1), cfg JSONB NOT NULL, atualizado TIMESTAMPTZ NOT NULL DEFAULT now());
      CREATE TABLE IF NOT EXISTS nf_rascunho (
        ref TEXT PRIMARY KEY, pedido TEXT NOT NULL, payload JSONB NOT NULL, pendencias JSONB NOT NULL DEFAULT '[]', estado TEXT NOT NULL DEFAULT 'rascunho',
        retorno JSONB, criado TIMESTAMPTZ NOT NULL DEFAULT now(), atualizado TIMESTAMPTZ NOT NULL DEFAULT now());`);
  }
  async function lerCfg() { const r = await pool.query('SELECT cfg FROM nf_config WHERE id = 1'); return NF.mescla(r.rows[0] ? r.rows[0].cfg : {}); }

  function rotas(soAdmin) {
    app.get('/api/nf/estado', seguro(async (req, res) => {
      const cfg = await lerCfg(), a = amb();
      const rs = (await pool.query("SELECT ref, pedido, estado, jsonb_array_length(pendencias) AS pendencias, atualizado FROM nf_rascunho ORDER BY atualizado DESC LIMIT 30")).rows;
      res.json({ cfg, emitenteOk: NF.pendenciasEmitente(cfg).length === 0, pendenciasEmitente: NF.pendenciasEmitente(cfg), liberadoServidor: a.liberado, credencial: !!a.token, podeEmitir: NF.podeEmitir(cfg, a), rascunhos: rs });
    }));
    app.put('/api/nf/config', soAdmin, seguro(async (req, res) => {
      const b = req.body || {}, atual = await lerCfg();
      const novo = NF.mescla(Object.assign({}, atual, b, { emitente: Object.assign({}, atual.emitente, b.emitente || {}) }));
      if (!['nenhum', 'focus'].includes(novo.provedor)) return res.status(400).json({ erro: 'Provedor desconhecido.' });
      if (!['homologacao', 'producao'].includes(novo.ambiente)) return res.status(400).json({ erro: 'Ambiente inválido.' });
      const e = novo.emitente; ['razao', 'logradouro', 'bairro', 'municipio'].forEach((k) => { e[k] = String(e[k] || '').replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, 100); });
      e.uf = String(e.uf || '').toUpperCase().slice(0, 2); e.cnpj = String(e.cnpj || '').replace(/\D/g, '').slice(0, 14); e.cep = String(e.cep || '').replace(/\D/g, '').slice(0, 8);
      e.ie = String(e.ie || '').replace(/\D/g, '').slice(0, 14); e.numero = String(e.numero || '').slice(0, 20); e.fone = String(e.fone || '').replace(/\D/g, '').slice(0, 13); e.codMunicipio = String(e.codMunicipio || '').replace(/\D/g, '').slice(0, 7);
      await pool.query('INSERT INTO nf_config (id, cfg) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET cfg = EXCLUDED.cfg, atualizado = now()', [novo]);
      app.locals.auditar && app.locals.auditar(req, 'nf.config', 'provedor ' + novo.provedor + ', ambiente ' + novo.ambiente);
      res.json({ ok: true, cfg: novo });
    }));
    app.post('/api/nf/rascunho', seguro(async (req, res) => {
      const b = req.body || {}, kv = await pool.query("SELECT valor FROM kv WHERE chave = 'jp_demo_v1'");
      if (!kv.rows[0]) return res.status(404).json({ erro: 'Sem dados do painel.' });
      const S = JSON.parse(kv.rows[0].valor), ped = (S.pedidos || []).find((p) => p.id === String(b.pedido || ''));
      if (!ped) return res.status(404).json({ erro: 'Pedido não encontrado.' });
      const cfg = await lerCfg(), r = NF.montaNota(ped, S.produtos, cfg, b.destinatario || {}, { agora: Date.now() });
      const ja = (await pool.query('SELECT estado FROM nf_rascunho WHERE ref = $1', [r.ref])).rows[0];
      if (ja && ja.estado === 'emitida') return res.status(409).json({ erro: 'Este pedido já tem nota emitida.' });
      await pool.query(`INSERT INTO nf_rascunho (ref, pedido, payload, pendencias) VALUES ($1,$2,$3,$4)
        ON CONFLICT (ref) DO UPDATE SET payload = EXCLUDED.payload, pendencias = EXCLUDED.pendencias, atualizado = now()`, [r.ref, ped.id, r.payload, JSON.stringify(r.pendencias)]);
      app.locals.auditar && app.locals.auditar(req, 'nf.rascunho', r.ref + (r.ok ? ' pronto' : ' com ' + r.pendencias.length + ' pendência(s)'));
      res.json({ ok: r.ok, ref: r.ref, pendencias: r.pendencias, payload: r.payload });
    }));
    app.post('/api/nf/emitir', soAdmin, seguro(async (req, res) => {
      const cfg = await lerCfg(), a = amb(), d = NF.podeEmitir(cfg, a);
      if (!d.ok) return res.status(409).json({ ok: false, desligado: true, motivo: d.motivo });
      const x = (await pool.query('SELECT * FROM nf_rascunho WHERE ref = $1', [String((req.body || {}).ref || '')])).rows[0];
      if (!x) return res.status(404).json({ erro: 'Rascunho não encontrado.' });
      if (x.estado === 'emitida') return res.status(409).json({ erro: 'Nota já emitida.' });
      if (x.pendencias.length) return res.status(409).json({ erro: 'O rascunho tem pendências.', pendencias: x.pendencias });
      let r; try { r = await fetch(base(cfg) + '/v2/nfe?ref=' + encodeURIComponent(x.ref), { method: 'POST', headers: { Authorization: 'Basic ' + Buffer.from(a.token + ':').toString('base64'), 'Content-Type': 'application/json' }, body: JSON.stringify(x.payload), signal: AbortSignal.timeout(30000) }); }
      catch (e) { return res.status(502).json({ erro: 'Provedor indisponível: ' + e.message }); }
      const j = await r.json().catch(() => ({}));
      app.locals.auditar && app.locals.auditar(req, 'nf.emissao', x.ref + (r.ok ? ' enviada ao provedor' : ' recusada pelo provedor'));
      await pool.query('UPDATE nf_rascunho SET estado = $2, retorno = $3, atualizado = now() WHERE ref = $1', [x.ref, r.ok ? 'enviada' : 'erro', j]);
      res.status(r.ok ? 202 : 502).json({ ok: r.ok, retorno: j });
    }));
  }
  return { iniciaTabelas, rotas };
};
