'use strict';
// Parte pública do servidor: recebe pedidos e inscrições da loja (sem login, com limite por IP) e publica o catálogo
// como arquivo estático para o Caddy/Cloudflare servirem. Os pedidos ficam numa fila (tabela entradas) e entram no
// estado do painel quando alguém abre o painel (absorve), sem brigar com quem está editando.
const express = require('express');
const fs = require('fs');
const path = require('path');
const { limite } = require('./limite');

const DIR = process.env.DINAMICO_DIR || path.join(__dirname, '..', 'dinamico');
const MAX_ITENS = 40;
const PAGAMENTOS = ['Pix', 'Dinheiro', 'Cartão na entrega', 'Pagar na retirada'];
const txt = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, n);
const digitos = (v) => String(v || '').replace(/\D/g, '');

const seguro = (fn) => (req, res, next) => fn(req, res, next).catch(next); // Express 4 não captura erro de rota assíncrona

module.exports = function (app, pool) {
  async function iniciaTabelas() {
    await pool.query(`CREATE TABLE IF NOT EXISTS entradas (
      id SERIAL PRIMARY KEY, tipo TEXT NOT NULL, codigo TEXT NOT NULL, dados JSONB NOT NULL,
      criado TIMESTAMPTZ NOT NULL DEFAULT now(), processado BOOLEAN NOT NULL DEFAULT FALSE, UNIQUE (tipo, codigo));
      CREATE INDEX IF NOT EXISTS entradas_pend ON entradas (id) WHERE NOT processado;`);
  }

  /* ---------- catálogo estático ---------- */
  let timer = null;
  async function publica() {
    const r = await pool.query("SELECT chave, valor FROM kv WHERE chave IN ('jp_demo_v1','jp_ex_v1')");
    const kv = {}; r.rows.forEach((x) => { try { kv[x.chave] = JSON.parse(x.valor); } catch (e) {} });
    if (!kv.jp_demo_v1 || !Array.isArray(kv.jp_demo_v1.produtos)) return;
    const saida = {
      produtos: kv.jp_demo_v1.produtos.map((p) => ({ id: p.id, fresco: p.fresco, dest: p.dest, nome: p.nome, cat: p.cat, un: p.un, preco: p.preco, estoque: p.estoque, min: p.min,
        img: String(p.img || '').replace(/\.jpg$/, '.webp'), desc: p.desc, inclui: p.inclui })),
      corte: kv.jp_ex_v1 && kv.jp_ex_v1.entrega && +kv.jp_ex_v1.entrega.corte || 14
    };
    fs.mkdirSync(DIR, { recursive: true });
    const tmp = path.join(DIR, '.estado-publico.tmp'), dest = path.join(DIR, 'estado-publico.json');
    fs.writeFileSync(tmp, JSON.stringify(saida)); fs.renameSync(tmp, dest);
  }
  const agendaPublica = () => { clearTimeout(timer); timer = setTimeout(() => publica().catch((e) => console.error('publica', e.message)), 1000); };

  /* ---------- rotas públicas (antes do login) ---------- */
  const exigeJson = (req, res, next) => (req.is('application/json') ? next() : res.status(415).json({ erro: 'Formato inválido.' }));
  const porIp = limite({ janelaMs: 10 * 60000, max: 12, grupo: 'pub:', mensagem: 'Muitos pedidos deste aparelho. Tente de novo em alguns minutos ou chame no WhatsApp.' });
  const geral = limite({ janelaMs: 1000, max: 40, grupo: 'rajada:' });
  let globalMarcas = [];
  const globalDoBanco = (req, res, next) => { // proteção do banco: no máximo 120 gravações públicas por minuto no total
    const a = Date.now(); globalMarcas = globalMarcas.filter((t) => a - t < 60000);
    if (globalMarcas.length >= 120) return res.status(503).set('Retry-After', '30').json({ erro: 'Muitos pedidos agora. Tente de novo em instantes.' });
    globalMarcas.push(a); next();
  };

  app.post('/api/pedidos', geral, porIp, globalDoBanco, exigeJson, seguro(async (req, res) => {
    const b = req.body || {}, codigo = txt(b.id, 20).toUpperCase();
    if (!/^JP-[A-Z0-9]{4,10}$/.test(codigo)) return res.status(400).json({ erro: 'Pedido inválido.' });
    const kvr = await pool.query("SELECT valor FROM kv WHERE chave = 'jp_demo_v1'");
    if (!kvr.rows[0]) return res.status(503).json({ erro: 'Loja ainda não liberada.' });
    let catalogo; try { catalogo = JSON.parse(kvr.rows[0].valor).produtos; } catch (e) { return res.status(503).json({ erro: 'Loja indisponível.' }); }
    const porId = new Map(catalogo.map((p) => [p.id, p]));
    const itens = (Array.isArray(b.itens) ? b.itens : []).slice(0, MAX_ITENS).map((i) => {
      const p = porId.get(txt(i.id, 20)), q = +i.qtd;
      return p && q > 0 && q <= 500 ? { id: p.id, nome: p.nome, un: p.un, preco: p.preco, qtd: q } : null; // o preço é sempre o do catálogo do servidor
    }).filter(Boolean);
    const fone = digitos(b.fone);
    if (!itens.length || fone.length < 10 || fone.length > 13 || !txt(b.cliente, 80)) return res.status(400).json({ erro: 'Pedido incompleto.' });
    const entrega = b.tipo === 'entrega';
    const pedido = {
      id: codigo, cliente: txt(b.cliente, 80), fone: txt(b.fone, 20), tipo: entrega ? 'entrega' : 'retirada',
      bairro: entrega ? txt(b.bairro, 60) : '', endereco: entrega ? txt(b.endereco, 200) : '', obs: txt(b.obs, 300),
      pagamento: PAGAMENTOS.includes(b.pagamento) ? b.pagamento : txt(b.pagamento, 30), itens, taxa: Math.min(Math.max(+b.taxa || 0, 0), 150),
      criado: Date.now(), confirmado: false, baixa: false, motoboy: null, fixo: null, origemSite: true,
      agendado: txt(b.agendado, 60) || undefined, recompra: b.recompra ? true : undefined
    };
    const r = await pool.query('INSERT INTO entradas (tipo, codigo, dados) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', ['pedido', codigo, pedido]);
    res.status(r.rowCount ? 201 : 409).json({ ok: !!r.rowCount, id: codigo });
  }));

  app.post('/api/espera', geral, porIp, globalDoBanco, exigeJson, seguro(async (req, res) => {
    const b = req.body || {}, codigo = txt(b.id, 30);
    if (!codigo || digitos(b.fone).length < 10 || !txt(b.prod, 20)) return res.status(400).json({ erro: 'Inscrição inválida.' });
    const ins = { id: codigo, prod: txt(b.prod, 20), nome: txt(b.nome, 80), fone: txt(b.fone, 20), quando: Date.now(), avisado: 0 };
    const r = await pool.query('INSERT INTO entradas (tipo, codigo, dados) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', ['espera', codigo, ins]);
    res.status(r.rowCount ? 201 : 409).json({ ok: !!r.rowCount });
  }));

  /* ---------- entrada no painel ---------- */
  async function pendentes() { return (await pool.query('SELECT count(*)::int n FROM entradas WHERE NOT processado')).rows[0].n; }

  // Move pedidos e inscrições da fila para o estado do painel (uma transação; trava as linhas do estado).
  async function absorve() {
    if (!(await pendentes())) return false;
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      const fila = (await c.query('SELECT id, tipo, dados FROM entradas WHERE NOT processado ORDER BY id FOR UPDATE SKIP LOCKED')).rows;
      if (!fila.length) { await c.query('ROLLBACK'); return false; }
      const le = async (k) => { const r = await c.query('SELECT valor, versao FROM kv WHERE chave = $1 FOR UPDATE', [k]); return r.rows[0] ? { s: JSON.parse(r.rows[0].valor), v: r.rows[0].versao } : null; };
      const grava = (k, o) => c.query(`UPDATE kv SET valor = $2, versao = versao + 1, atualizado = now() WHERE chave = $1`, [k, JSON.stringify(o.s)]);
      const demo = await le('jp_demo_v1'), ex = await le('jp_ex_v1');
      let mudouDemo = false, mudouEx = false;
      for (const e of fila) {
        const d = e.dados;
        if (e.tipo === 'pedido' && demo) {
          if (demo.s.pedidos.some((p) => p.id === d.id)) continue;
          const tot = d.itens.reduce((t, i) => t + i.preco * i.qtd, 0) + (d.taxa || 0), dig = d.fone.replace(/\D/g, ''), agora = Date.now();
          demo.s.pedidos.unshift(d);
          const cli = demo.s.clientes.find((x) => x.fone.replace(/\D/g, '') === dig), its = d.itens.map((i) => [i.id, i.qtd]);
          if (cli) { cli.pedidos += 1; cli.total += tot; cli.ultima = agora; cli.itens = its; }
          else demo.s.clientes.unshift({ id: 'c' + (demo.s.clientes.length + 1), nome: d.cliente, fone: d.fone, bairro: d.bairro || 'Retirada', pedidos: 1, total: tot, ultima: agora, itens: its });
          demo.s.leads.unshift({ id: 'l' + agora + e.id, nome: d.cliente, fone: d.fone, origem: 'Site — pedido ' + d.id, etapa: 'orcamento', valor: tot,
            itens: d.itens.map((i) => i.qtd + ' ' + i.un + ' ' + i.nome).join(', '), msgs: [['c', 'Pedido ' + d.id + ' feito pelo site.']] });
          mudouDemo = true;
        } else if (e.tipo === 'espera' && ex) {
          const l = ex.s.espera.inscritos;
          if (!l.some((x) => x.id === d.id)) { l.unshift(d); mudouEx = true; }
        } else continue; // sem estado do painel ainda: deixa na fila
        await c.query('UPDATE entradas SET processado = TRUE WHERE id = $1', [e.id]);
      }
      if (mudouDemo) await grava('jp_demo_v1', demo);
      if (mudouEx) await grava('jp_ex_v1', ex);
      await c.query('COMMIT');
      return true;
    } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; } finally { c.release(); }
  }

  return { iniciaTabelas, publica, agendaPublica, absorve, pendentes };
};
