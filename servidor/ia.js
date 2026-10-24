'use strict';
// Atendimento por IA: roda no servidor quando chega mensagem do cliente (webhook), usa só a base do catálogo e as travas de
// ia-lib.js, e responde pela fila do WhatsApp (que tem as próprias travas). Nasce DESLIGADO e sem chave.
// Para funcionar: ANTHROPIC_API_KEY no servidor + "IA ligada" na tela WhatsApp + WhatsApp liberado.
const IA = require('./ia-lib');
const W = require('./whatsapp-lib');

const seguro = (fn) => (req, res, next) => fn(req, res, next).catch(next);
const CFG_PADRAO = { ligado: false, modo: 'sugestao', modelo: 'claude-haiku-5-5', limiteKg: 20, limiteValor: 1500, maxPorConversaDia: 6, maxPorHora: 40, promptExtra: '' };
const AVISO_RECLAMA = 'Sinto muito pelo transtorno. Já chamei uma pessoa da equipe para resolver isso com você.';
const AVISO_NEUTRO = 'Entendi! Vou chamar uma pessoa da equipe para te atender. Já já ela responde por aqui.';

module.exports = function (app, pool, wa) {
  const chave = () => process.env.ANTHROPIC_API_KEY || '';
  const urlApi = () => String(process.env.ANTHROPIC_URL || 'https://api.anthropic.com').replace(/\/+$/, '');

  async function iniciaTabelas() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ia_config (id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1), cfg JSONB NOT NULL, atualizado TIMESTAMPTZ NOT NULL DEFAULT now());
      CREATE TABLE IF NOT EXISTS ia_registro (
        id BIGSERIAL PRIMARY KEY, quando TIMESTAMPTZ NOT NULL DEFAULT now(), fone TEXT NOT NULL, entrada TEXT, saida TEXT, estado TEXT NOT NULL,
        humano BOOLEAN NOT NULL DEFAULT FALSE, motivo TEXT, modelo TEXT, tokens_in INT, tokens_out INT);
      CREATE INDEX IF NOT EXISTS ia_registro_fone ON ia_registro (fone, quando DESC);`);
  }
  async function lerCfg() { const r = await pool.query('SELECT cfg FROM ia_config WHERE id = 1'); return Object.assign({}, CFG_PADRAO, r.rows[0] ? r.rows[0].cfg : {}); }
  async function registra(o) {
    await pool.query('INSERT INTO ia_registro (fone, entrada, saida, estado, humano, motivo, modelo, tokens_in, tokens_out) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [o.fone, String(o.entrada || '').slice(0, 500), o.saida ? String(o.saida).slice(0, 1000) : null, o.estado, !!o.humano, o.motivo ? String(o.motivo).slice(0, 200) : null, o.modelo || null, o.tin || null, o.tout || null]);
  }

  async function chamaModelo(cfg, prompt) {
    const r = await fetch(urlApi() + '/v1/messages', { method: 'POST', headers: { 'x-api-key': chave(), 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: cfg.modelo, max_tokens: 500, temperature: 0.2, system: prompt.system, messages: prompt.messages }), signal: AbortSignal.timeout(25000) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error('modelo ' + r.status + ' ' + String((j.error && j.error.message) || '').slice(0, 120));
    return { texto: (j.content || []).filter((b) => b.type === 'text').map((b) => b.text).join(''), tin: j.usage && j.usage.input_tokens, tout: j.usage && j.usage.output_tokens };
  }

  async function historico(fone) {
    const r = await pool.query(`
      SELECT d, t FROM (
        SELECT CASE WHEN de_mim THEN 'j' ELSE 'c' END AS d, texto AS t, quando FROM wa_entrada WHERE fone = $1
        UNION ALL SELECT 'j', texto, (extract(epoch from criado) * 1000)::bigint FROM wa_saida WHERE fone = $1 AND estado IN ('enviada','entregue','lida')
      ) x ORDER BY quando DESC LIMIT 12`, [fone]);
    return r.rows.reverse();
  }

  // { fone, texto, nome } -> decisão. opcoes.simular: não envia nem conta limites (tela de teste).
  async function atende(ev, opcoes) {
    opcoes = opcoes || {}; const cfg = await lerCfg(), fone = ev.fone, texto = ev.texto;
    const fim = async (o) => { await registra(Object.assign({ fone: fone, entrada: texto }, o)); return o; };
    if (!opcoes.simular && !cfg.ligado) return { estado: 'desligada' };
    if (!chave()) return opcoes.simular ? { estado: 'sem_chave' } : fim({ estado: 'sem_chave', motivo: 'ANTHROPIC_API_KEY não configurada' });
    const ph = IA.precisaHumano(texto, cfg);
    if (ph.cortesia) return opcoes.simular ? { estado: 'silencio' } : fim({ estado: 'silencio', motivo: 'cortesia' });
    const envia = async (msg, estado, extra) => {
      if (opcoes.simular || cfg.modo !== 'auto') return fim(Object.assign({ estado: opcoes.simular ? 'teste' : 'sugestao', saida: msg }, extra));
      const e = await wa.enfileira({ fone, texto: msg, tipo: 'resposta' });
      return fim(Object.assign({ estado: e.ok ? estado : 'bloqueada', saida: msg, motivo: e.ok ? (extra && extra.motivo) : e.motivo }, extra, e.ok ? {} : { motivo: e.motivo }));
    };
    if (ph.humano) return envia(/reclama|cancel/.test(ph.motivo) ? AVISO_RECLAMA : AVISO_NEUTRO, 'humano', { humano: true, motivo: ph.motivo });
    if (!opcoes.simular) {
      const u = (await pool.query(`SELECT
        (SELECT count(*)::int FROM ia_registro WHERE fone = $1 AND estado IN ('respondida','humano') AND quando > now() - interval '24 hours') AS conv,
        (SELECT count(*)::int FROM ia_registro WHERE estado IN ('respondida','humano') AND quando > now() - interval '1 hour') AS hora`, [fone])).rows[0];
      const lim = IA.podeResponder(cfg, { respostasConversa24h: u.conv, respostasHora: u.hora });
      if (!lim.ok) return fim({ estado: 'humano', humano: true, motivo: lim.motivo });
    }
    const kv = await pool.query("SELECT chave, valor FROM kv WHERE chave IN ('jp_demo_v1','jp_loja_v1')"), E = {}; kv.rows.forEach((x) => { try { E[x.chave] = JSON.parse(x.valor); } catch (e) {} });
    const produtos = (E.jp_demo_v1 && E.jp_demo_v1.produtos) || [];
    if (!produtos.length) return fim({ estado: 'erro', motivo: 'catálogo vazio' });
    const base = IA.montaBase(produtos, E.jp_loja_v1, new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Fortaleza' })));
    const hist = opcoes.historico || await historico(fone);
    if (!hist.length || hist[hist.length - 1].d !== 'c') hist.push({ d: 'c', t: texto });
    const prompt = IA.montaPrompt({ base, produtosRelevantes: IA.selecionaProdutos(texto, produtos, 5), cfgIa: cfg, historico: hist, nomeCliente: ev.nome });
    let saida; try { saida = await chamaModelo(cfg, prompt); } catch (e) { return fim({ estado: 'erro', humano: true, motivo: String(e.message).slice(0, 150), modelo: cfg.modelo }); }
    const p = IA.parseSaida(saida.texto), meta = { modelo: cfg.modelo, tin: saida.tin, tout: saida.tout };
    if (!p) return envia(AVISO_NEUTRO, 'humano', Object.assign({ humano: true, motivo: 'resposta do modelo ilegível' }, meta));
    const v = IA.validaResposta(p.resposta, base);
    if (!v.ok) return envia(AVISO_NEUTRO, 'humano', Object.assign({ humano: true, motivo: 'resposta barrada: ' + v.motivo + ' (texto barrado: ' + p.resposta.slice(0, 80) + ')' }, meta));
    return envia(p.resposta, p.humano ? 'humano' : 'respondida', Object.assign({ humano: p.humano, motivo: p.humano ? p.motivo : undefined }, meta));
  }

  // chamado pelo webhook; nunca derruba o servidor
  app.locals.iaAtende = (ev) => atende(ev).catch((e) => console.error('ia', e.message));

  function rotas(soAdmin) {
    app.get('/api/ia/estado', seguro(async (req, res) => {
      const cfg = await lerCfg(), c = (await pool.query("SELECT count(*) FILTER (WHERE estado IN ('respondida')) AS resp, count(*) FILTER (WHERE humano) AS hum, count(*) FILTER (WHERE estado = 'sugestao') AS sug FROM ia_registro WHERE quando > now() - interval '7 days'")).rows[0];
      res.json({ cfg, chave: !!chave(), ligadoEfetivo: !!(cfg.ligado && chave()), semana: { respondidas: +c.resp, humano: +c.hum, sugestoes: +c.sug } });
    }));
    app.get('/api/ia/registro', soAdmin, seguro(async (req, res) => { res.json((await pool.query('SELECT id, quando, fone, left(entrada, 160) AS entrada, left(saida, 300) AS saida, estado, humano, motivo FROM ia_registro ORDER BY id DESC LIMIT 40')).rows); }));
    app.put('/api/ia/config', soAdmin, seguro(async (req, res) => {
      const b = req.body || {}, n = Object.assign({}, await lerCfg());
      if (b.ligado !== undefined) { if (b.ligado && !chave()) return res.status(409).json({ erro: 'A chave da IA (ANTHROPIC_API_KEY) ainda não foi configurada no servidor.' }); n.ligado = !!b.ligado; }
      if (b.modo !== undefined) { if (!['sugestao', 'auto'].includes(b.modo)) return res.status(400).json({ erro: 'Modo inválido.' }); n.modo = b.modo; }
      const num = (k, min, max) => { if (b[k] !== undefined) { const x = +b[k]; if (!Number.isFinite(x) || x < min || x > max) throw Object.assign(new Error(k + ': de ' + min + ' a ' + max), { http: 400 }); n[k] = x; } };
      try { num('limiteKg', 1, 1000); num('limiteValor', 50, 100000); num('maxPorConversaDia', 1, 50); num('maxPorHora', 1, 500); } catch (e) { return res.status(e.http || 500).json({ erro: e.message }); }
      if (b.promptExtra !== undefined) n.promptExtra = String(b.promptExtra).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, 1500);
      if (b.modelo !== undefined) { if (!/^claude-[a-z0-9-]{3,40}$/.test(String(b.modelo))) return res.status(400).json({ erro: 'Modelo inválido.' }); n.modelo = b.modelo; }
      await pool.query('INSERT INTO ia_config (id, cfg) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET cfg = EXCLUDED.cfg, atualizado = now()', [n]);
      app.locals.auditar && app.locals.auditar(req, 'ia.config', 'IA ' + (n.ligado ? 'LIGADA' : 'desligada') + ', modo ' + n.modo);
      res.json({ ok: true, cfg: n });
    }));
    app.post('/api/ia/testar', soAdmin, seguro(async (req, res) => {
      const b = req.body || {}, texto = W.limpaTexto(b.mensagem).slice(0, 500); if (!texto) return res.status(400).json({ erro: 'Escreva a mensagem do cliente.' });
      const r = await atende({ fone: '0000000000000', texto, nome: String(b.nome || '').slice(0, 40) }, { simular: true, historico: [] });
      res.json(r);
    }));
  }
  return { iniciaTabelas, rotas, atende, lerCfg };
};
