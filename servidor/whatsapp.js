'use strict';
// WhatsApp pela uazapi: fila de saída com travas, webhook de entrada e leitura das mensagens para o CRM.
// Nasce DESLIGADO. Para enviar de verdade é preciso, ao mesmo tempo: WHATSAPP_LIBERADO=sim no servidor, UAZAPI_URL e
// UAZAPI_TOKEN preenchidos e a chave geral ligada no painel (e, em modo teste, só os números de teste recebem).
const express = require('express');
const W = require('./whatsapp-lib');
const { limite } = require('./limite');

const seguro = (fn) => (req, res, next) => fn(req, res, next).catch(next);

module.exports = function (app, pool, ganchos) {
  const env = () => ({ url: String(process.env.UAZAPI_URL || '').replace(/\/+$/, ''), token: process.env.UAZAPI_TOKEN || '', segredo: process.env.UAZAPI_WEBHOOK_SECRET || '', liberado: process.env.WHATSAPP_LIBERADO === 'sim' });
  const credenciais = () => { const e = env(); return !!(e.url && e.token); };

  async function iniciaTabelas() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS wa_config (id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1), cfg JSONB NOT NULL, atualizado TIMESTAMPTZ NOT NULL DEFAULT now());
      CREATE TABLE IF NOT EXISTS wa_saida (
        id SERIAL PRIMARY KEY, fone TEXT NOT NULL, texto TEXT NOT NULL, tipo TEXT NOT NULL DEFAULT 'resposta',
        estado TEXT NOT NULL, motivo TEXT, lead TEXT, campanha TEXT, ext_id TEXT, criado TIMESTAMPTZ NOT NULL DEFAULT now(), enviado_em TIMESTAMPTZ);
      CREATE INDEX IF NOT EXISTS wa_saida_fila ON wa_saida (id) WHERE estado = 'fila';
      CREATE INDEX IF NOT EXISTS wa_saida_ext ON wa_saida (ext_id) WHERE ext_id IS NOT NULL;
      CREATE TABLE IF NOT EXISTS wa_entrada (
        id SERIAL PRIMARY KEY, ext_id TEXT UNIQUE, fone TEXT NOT NULL, texto TEXT NOT NULL, nome TEXT, de_mim BOOLEAN NOT NULL DEFAULT FALSE,
        quando BIGINT NOT NULL, processado BOOLEAN NOT NULL DEFAULT FALSE);
      CREATE INDEX IF NOT EXISTS wa_entrada_pend ON wa_entrada (id) WHERE NOT processado;
      CREATE TABLE IF NOT EXISTS wa_optout (fone TEXT PRIMARY KEY, motivo TEXT, criado TIMESTAMPTZ NOT NULL DEFAULT now());`);
  }
  async function lerCfg() {
    const r = await pool.query('SELECT cfg FROM wa_config WHERE id = 1');
    return Object.assign(W.cfgPadrao(), r.rows[0] ? r.rows[0].cfg : {});
  }

  async function contexto(agora) {
    const [c24, fal, ult, opt] = await Promise.all([
      pool.query("SELECT count(*)::int n FROM wa_saida WHERE estado IN ('enviada','entregue','lida') AND enviado_em > now() - interval '24 hours'"),
      pool.query("SELECT estado FROM wa_saida WHERE estado IN ('enviada','entregue','lida','falhou') ORDER BY id DESC LIMIT 10"),
      pool.query("SELECT extract(epoch from max(enviado_em))*1000 t FROM wa_saida WHERE tipo = 'campanha' AND estado IN ('enviada','entregue','lida')"),
      pool.query('SELECT fone FROM wa_optout')]);
    let falhas = 0; for (const x of fal.rows) { if (x.estado === 'falhou') falhas++; else break; }
    return { agora, enviadas24h: c24.rows[0].n, falhasSeguidas: falhas, ultimoEnvioMs: +ult.rows[0].t || 0, optouts: new Set(opt.rows.map((x) => x.fone)), credenciais: credenciais(), liberadoServidor: env().liberado };
  }

  /* ---------- saída: registra e deixa na fila só o que as travas liberam ---------- */
  async function enfileira({ fone, texto, tipo, lead, campanha }) {
    texto = W.limpaTexto(texto); tipo = tipo === 'campanha' ? 'campanha' : 'resposta';
    if (!texto) return { ok: false, erro: 'Mensagem vazia.' };
    const cfg = await lerCfg(), d = W.podeEnviar(cfg, await contexto(Date.now()), fone, tipo);
    const alvo = W.normalizaFone(fone) || String(fone || '').replace(/\D/g, '').slice(0, 20) || '0';
    const r = await pool.query('INSERT INTO wa_saida (fone, texto, tipo, estado, motivo, lead, campanha) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
      [alvo, texto, tipo, d.ok ? 'fila' : 'bloqueado', d.ok ? null : d.motivo, lead ? String(lead).slice(0, 60) : null, campanha ? String(campanha).slice(0, 60) : null]);
    return d.ok ? { ok: true, id: r.rows[0].id, estado: 'fila' } : { ok: false, id: r.rows[0].id, estado: 'bloqueado', motivo: d.motivo };
  }

  async function chamaUazapi(caminho, corpo, metodo) {
    const e = env(), ac = new AbortController(), t = setTimeout(() => ac.abort(), 15000);
    try {
      const r = await fetch(e.url + caminho, { method: metodo || 'POST', headers: { token: e.token, 'Content-Type': 'application/json', Accept: 'application/json' }, body: corpo ? JSON.stringify(corpo) : undefined, signal: ac.signal });
      const j = await r.json().catch(() => ({}));
      return { ok: r.ok, status: r.status, j };
    } finally { clearTimeout(t); }
  }

  let enviando = false;
  // Pega a próxima da fila; revalida as travas na hora do envio (a chave pode ter sido desligada depois de enfileirar).
  async function processaFila() {
    if (enviando) return; enviando = true;
    try {
      const prox = (await pool.query("SELECT * FROM wa_saida WHERE estado = 'fila' ORDER BY id LIMIT 1")).rows[0]; if (!prox) return;
      const cfg = await lerCfg(), c = await contexto(Date.now());
      if (prox.tipo === 'campanha' && c.ultimoEnvioMs && Date.now() - c.ultimoEnvioMs < W.proximoIntervaloMs(Object.assign({}, cfg, { intervaloMax: cfg.intervaloMin }))) return; // espera o intervalo mínimo
      const d = W.podeEnviar(cfg, c, prox.fone, prox.tipo);
      if (!d.ok) { await pool.query("UPDATE wa_saida SET estado = 'bloqueado', motivo = $2 WHERE id = $1", [prox.id, d.motivo]); return; }
      let r; try { r = await chamaUazapi('/send/text', { number: d.fone, text: prox.texto }); } catch (e) { r = { ok: false, j: { erro: e.name === 'AbortError' ? 'tempo esgotado' : e.message } }; }
      if (r.ok) await pool.query("UPDATE wa_saida SET estado = 'enviada', enviado_em = now(), ext_id = $2, motivo = NULL WHERE id = $1", [prox.id, String(r.j.messageid || r.j.id || (r.j.message && r.j.message.id) || '') || null]);
      else await pool.query("UPDATE wa_saida SET estado = 'falhou', motivo = $2 WHERE id = $1", [prox.id, ('uazapi ' + (r.status || '') + ' ' + String(r.j.error || r.j.erro || r.j.message || '')).trim().slice(0, 200)]);
    } catch (e) { console.error('fila whatsapp', e.message); } finally { enviando = false; }
  }
  let relogio = null;
  function iniciaFila() { if (!relogio) { relogio = setInterval(processaFila, 5000); relogio.unref && relogio.unref(); } }

  /* ---------- webhook (público, protegido por segredo no endereço) ---------- */
  app.post('/api/uazapi/webhook/:segredo', limite({ janelaMs: 1000, max: 60, grupo: 'wa-hook:' }), express.json({ limit: '200kb' }), seguro(async (req, res) => {
    if (!W.segredoConfere(env().segredo, req.params.segredo)) return res.status(404).end();
    const ev = W.parseWebhook(req.body);
    if (ev && ev.tipo === 'mensagem') {
      await pool.query('INSERT INTO wa_entrada (ext_id, fone, texto, nome, de_mim, quando) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (ext_id) DO NOTHING', [ev.extId || null, ev.fone, ev.texto, ev.nome || null, ev.deMim, ev.quando]);
      if (!ev.deMim && W.ehOptout(ev.texto)) await pool.query('INSERT INTO wa_optout (fone, motivo) VALUES ($1,$2) ON CONFLICT DO NOTHING', [ev.fone, 'respondeu: ' + ev.texto.slice(0, 40)]);
    } else if (ev && ev.tipo === 'status') {
      await pool.query("UPDATE wa_saida SET estado = $2 WHERE ext_id = ANY($1) AND estado IN ('enviada','entregue')", [ev.ids, ev.estado]);
    }
    res.json({ ok: true });
  }));

  /* ---------- entrada no CRM: mensagens recebidas viram conversa do lead (estado do CRM: jp_crm_v1) ---------- */
  async function pendentesEntrada() { return (await pool.query('SELECT count(*)::int n FROM wa_entrada WHERE NOT processado')).rows[0].n; }
  async function absorveEntrada() {
    if (!(await pendentesEntrada())) return false;
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      const fila = (await c.query('SELECT * FROM wa_entrada WHERE NOT processado ORDER BY id FOR UPDATE SKIP LOCKED')).rows;
      const r = await c.query('SELECT valor FROM kv WHERE chave = $1 FOR UPDATE', ['jp_crm_v1']);
      if (!fila.length || !r.rows[0]) { await c.query('ROLLBACK'); return false; } // o CRM ainda não foi aberto: as mensagens esperam na fila
      let D; try { D = JSON.parse(r.rows[0].valor); } catch (e) { await c.query('ROLLBACK'); return false; }
      D.leads = D.leads || []; D.optout = D.optout || [];
      for (const e of fila) {
        let l = D.leads.find((x) => W.mesmoNumero(x.fone, e.fone));
        const ts = +e.quando || Date.now();
        if (!l) {
          if (e.de_mim) { await c.query('UPDATE wa_entrada SET processado = TRUE WHERE id = $1', [e.id]); continue; } // mensagem nossa para quem nunca falou conosco
          const f = e.fone.slice(2);
          l = { id: 'wa' + e.id + '-' + ts, nome: e.nome || '+' + e.fone, fone: '(' + f.slice(0, 2) + ') ' + f.slice(2, -4) + '-' + f.slice(-4), origem: 'WhatsApp', etapa: 'novo', valor: 0, itens: '', etq: [], resp: '', nao: 0, vendido: false, clienteId: null, optout: false, ultimoDisparo: 0, bairro: '', msgs: [], hist: [{ ts, t: 'Contato criado — origem: WhatsApp' }] };
          D.leads.unshift(l);
        }
        l.msgs = l.msgs || []; l.hist = l.hist || [];
        l.msgs.push({ d: e.de_mim ? 'j' : 'c', t: e.texto, ts, st: e.de_mim ? 'enviada' : '', wa: e.ext_id || undefined });
        l.msgs.sort((a, b) => a.ts - b.ts);
        if (!e.de_mim) {
          l.nao = (l.nao || 0) + 1;
          if (W.ehOptout(e.texto) && !l.optout) {
            l.optout = true; if (D.optout.indexOf(e.fone) < 0) D.optout.push(e.fone);
            l.msgs.push({ d: 's', t: 'Cliente pediu para sair: não receberá mais campanhas (opt-out).', ts: ts + 1 }); l.hist.push({ ts: ts + 1, t: 'Opt-out: respondeu "' + e.texto.slice(0, 30) + '"' });
          }
        }
        await c.query('UPDATE wa_entrada SET processado = TRUE WHERE id = $1', [e.id]);
      }
      await c.query('UPDATE kv SET valor = $2, versao = versao + 1, atualizado = now() WHERE chave = $1', ['jp_crm_v1', JSON.stringify(D)]);
      await c.query('COMMIT'); return true;
    } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; } finally { c.release(); }
  }

  /* ---------- rotas do painel (exigem login; configuração só administrador) ---------- */
  function rotasPainel(soAdmin) {
    app.get('/api/whatsapp/estado', seguro(async (req, res) => {
      const cfg = await lerCfg(), c = await contexto(Date.now()), e = env();
      const pend = (await pool.query("SELECT count(*)::int n FROM wa_saida WHERE estado = 'fila'")).rows[0].n;
      const bloq = (await pool.query("SELECT count(*)::int n FROM wa_saida WHERE estado = 'bloqueado' AND criado > now() - interval '24 hours'")).rows[0].n;
      res.json({ cfg, liberadoServidor: e.liberado, credenciais: credenciais(), webhookConfigurado: !!e.segredo, ligadoEfetivo: !!(cfg.ligado && e.liberado && credenciais()),
        enviadas24h: c.enviadas24h, falhasSeguidas: c.falhasSeguidas, optouts: c.optouts.size, naFila: pend, bloqueadas24h: bloq, limiteEfetivo: W.limiteEfetivo(cfg) });
    }));
    app.get('/api/whatsapp/saida', seguro(async (req, res) => {
      res.json((await pool.query('SELECT id, fone, left(texto, 120) AS texto, tipo, estado, motivo, lead, campanha, criado, enviado_em FROM wa_saida ORDER BY id DESC LIMIT 50')).rows);
    }));
    app.post('/api/whatsapp/enviar', seguro(async (req, res) => {
      const b = req.body || {}, r = await enfileira({ fone: b.fone, texto: b.texto, tipo: b.tipo, lead: b.lead, campanha: b.campanha });
      res.status(r.ok ? 202 : r.erro ? 400 : 200).json(r);
    }));
    app.put('/api/whatsapp/config', soAdmin, seguro(async (req, res) => {
      const b = req.body || {}, atual = await lerCfg(), n = Object.assign({}, atual);
      const num = (v, min, max, nome) => { const x = +v; if (!Number.isFinite(x) || x < min || x > max) throw Object.assign(new Error(nome + ': de ' + min + ' a ' + max + '.'), { http: 400 }); return x; };
      try {
        if (b.teste !== undefined) n.teste = !!b.teste;
        if (b.numerosTeste !== undefined) {
          const l = (Array.isArray(b.numerosTeste) ? b.numerosTeste : String(b.numerosTeste).split(/[,;\n]/)).map((x) => W.normalizaFone(x)).filter(Boolean);
          if (l.length > 10) throw Object.assign(new Error('No máximo 10 números de teste.'), { http: 400 }); n.numerosTeste = [...new Set(l)];
        }
        ['inicio', 'fim'].forEach((k) => { if (b[k] !== undefined) { if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(b[k])) throw Object.assign(new Error('Horário inválido (use HH:MM).'), { http: 400 }); n[k] = b[k]; } });
        if (b.intervaloMin !== undefined) n.intervaloMin = num(b.intervaloMin, 5, 600, 'Intervalo mínimo (s)');
        if (b.intervaloMax !== undefined) n.intervaloMax = num(b.intervaloMax, 5, 1200, 'Intervalo máximo (s)');
        if (n.intervaloMax < n.intervaloMin) throw Object.assign(new Error('O intervalo máximo não pode ser menor que o mínimo.'), { http: 400 });
        if (b.limiteDia !== undefined) n.limiteDia = num(b.limiteDia, 1, 250, 'Limite diário');
        if (b.diaAquecimento !== undefined) n.diaAquecimento = num(b.diaAquecimento, 1, 365, 'Dia do aquecimento');
        if (b.ligado !== undefined) {
          if (b.ligado && !env().liberado) throw Object.assign(new Error('O envio real não está liberado neste servidor. Isso depende da RS Tech e da credencial da uazapi.'), { http: 409 });
          if (b.ligado && !credenciais()) throw Object.assign(new Error('A credencial da uazapi ainda não foi configurada no servidor.'), { http: 409 });
          n.ligado = !!b.ligado;
        }
      } catch (e) { if (e.http) return res.status(e.http).json({ erro: e.message }); throw e; }
      await pool.query('INSERT INTO wa_config (id, cfg) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET cfg = EXCLUDED.cfg, atualizado = now()', [n]);
      app.locals.auditar && app.locals.auditar(req, 'whatsapp.config', 'chave geral ' + (n.ligado ? 'LIGADA' : 'desligada') + ', modo teste ' + (n.teste ? 'sim' : 'NAO') + ', ' + n.numerosTeste.length + ' número(s) de teste');
      res.json({ ok: true, cfg: n });
    }));
    app.post('/api/whatsapp/optout', seguro(async (req, res) => {
      const f = W.normalizaFone((req.body || {}).fone); if (!f) return res.status(400).json({ erro: 'Número inválido.' });
      await pool.query('INSERT INTO wa_optout (fone, motivo) VALUES ($1,$2) ON CONFLICT DO NOTHING', [f, String((req.body || {}).motivo || 'registrado no painel').slice(0, 80)]);
      res.json({ ok: true });
    }));
  }

  return { iniciaTabelas, iniciaFila, rotasPainel, absorveEntrada, pendentesEntrada, enfileira, processaFila, lerCfg };
};
