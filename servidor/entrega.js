'use strict';
// Rastreio de entrega: o painel cria os links, o entregador compartilha a posição pelo celular (sem app) e o cliente
// acompanha pelo mapa (sem login, link com token longo e prazo). Sem custo: mapa OpenStreetMap, rota pelo OSRM público e
// endereço → coordenada pelo Nominatim (com cache). Se a roteirização ou a geocodificação falharem, há plano B local.
// Privacidade: o rastro e a posição são apagados ao concluir; só o necessário fica guardado (ver docs/RASTREIO-ENTREGA.md).
const crypto = require('crypto');
const path = require('path');
const { limite } = require('./limite');
const JPE = require(path.join(process.env.SITE_DIR || path.join(__dirname, '..'), 'entrega-lib.js'));

const HORAS_VALIDADE = 12;       // prazo do link desde a criação
const MIN_APOS_FIM = 30;         // depois de entregue/cancelado o link ainda abre por 30 min (mostra o resultado)
const MIN_APOS_FALHA = 120;      // entrega que falhou pode ser retomada
const DIAS_GUARDAR = 30;         // linha sem posição (só datas e estado) some depois disso
const SEM_SINAL_ALERTA_MS = 3 * 60000;

const OSRM = (process.env.OSRM_URL || 'https://router.project-osrm.org').replace(/\/$/, '');
const NOMINATIM = (process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org').replace(/\/$/, '');
const UA = 'JuliaPescados-Entregas/1.0 (+https://julia.rstechmarketing.com.br)';
const TILES = {
  url: process.env.TILES_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  atribuicao: process.env.TILES_ATRIBUICAO || '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
  zoomMax: +process.env.TILES_ZOOM_MAX || 19
};

const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');
const novoToken = () => crypto.randomBytes(32).toString('base64url'); // 256 bits
const TOKEN_OK = /^[A-Za-z0-9_-]{43}$/;
const txt = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, n);
const seguro = (fn) => (req, res, next) => fn(req, res, next).catch(next);

module.exports = function (app, pool) {
  const metricas = { posicoes: 0, descartadas: 0, osrmOk: 0, osrmFalha: 0, geoOk: 0, geoFalha: 0, geoCache: 0, erros: 0, ultimaPosicao: 0 };

  async function iniciaTabelas() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS rastreios (
        id SERIAL PRIMARY KEY, pedido_id TEXT NOT NULL, token_cli TEXT NOT NULL UNIQUE, token_ent TEXT NOT NULL UNIQUE,
        estado TEXT NOT NULL DEFAULT 'aguardando', pedido_status TEXT,
        entregador_id TEXT, entregador_nome TEXT, cliente_nome TEXT, bairro TEXT, endereco TEXT, obs TEXT,
        dest_lat DOUBLE PRECISION, dest_lng DOUBLE PRECISION, dest_precisao TEXT,
        criado TIMESTAMPTZ NOT NULL DEFAULT now(), expira TIMESTAMPTZ NOT NULL, iniciado_em TIMESTAMPTZ, concluido_em TIMESTAMPTZ,
        ult_lat DOUBLE PRECISION, ult_lng DOUBLE PRECISION, ult_prec INT, ult_em BIGINT,
        eta_seg INT, dist_m INT, trilha JSONB NOT NULL DEFAULT '[]', rota JSONB, rota_em BIGINT, rota_lat DOUBLE PRECISION, rota_lng DOUBLE PRECISION, rota_eta INT, rota_dist INT,
        evento TEXT, evento_motivo TEXT, motivo_falha TEXT, ativo BOOLEAN NOT NULL DEFAULT TRUE);
      CREATE UNIQUE INDEX IF NOT EXISTS rastreios_pedido_ativo ON rastreios (pedido_id) WHERE ativo;
      CREATE TABLE IF NOT EXISTS geocache (chave TEXT PRIMARY KEY, lat DOUBLE PRECISION NOT NULL, lng DOUBLE PRECISION NOT NULL, em TIMESTAMPTZ NOT NULL DEFAULT now());`);
  }

  /* ---------- serviços de fora, com prazo curto e plano B ---------- */
  async function buscaJson(url, ms) {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: ctl.signal });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } finally { clearTimeout(t); }
  }

  let filaGeo = Promise.resolve(); // Nominatim: no máximo 1 consulta por segundo
  const chaveGeo = (e, b) => (txt(e, 200) + '|' + txt(b, 80)).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');
  async function geocodifica(endereco, bairro) {
    const chave = chaveGeo(endereco, bairro);
    if (!txt(endereco, 200)) return null;
    const c = await pool.query('SELECT lat, lng FROM geocache WHERE chave = $1', [chave]);
    if (c.rows[0]) { metricas.geoCache++; return { lat: c.rows[0].lat, lng: c.rows[0].lng, precisao: 'endereco' }; }
    const tarefa = filaGeo.then(async () => {
      await new Promise((r) => setTimeout(r, process.env.NOMINATIM_URL ? 0 : 1100));
      const q = encodeURIComponent([endereco, bairro, 'Fortaleza', 'Ceará', 'Brasil'].filter(Boolean).join(', '));
      const cx = JPE.CAIXA;
      const j = await buscaJson(NOMINATIM + '/search?format=jsonv2&limit=1&countrycodes=br&bounded=1&viewbox=' + cx.lngMin + ',' + cx.latMax + ',' + cx.lngMax + ',' + cx.latMin + '&q=' + q, 5000);
      const a = Array.isArray(j) && j[0]; const lat = a && +a.lat, lng = a && +a.lon;
      return a && JPE.naRegiao({ lat, lng }) ? { lat, lng } : null;
    });
    filaGeo = tarefa.catch(() => {});
    try {
      const r = await tarefa;
      if (!r) { metricas.geoFalha++; return null; }
      metricas.geoOk++;
      await pool.query('INSERT INTO geocache (chave, lat, lng) VALUES ($1,$2,$3) ON CONFLICT (chave) DO NOTHING', [chave, r.lat, r.lng]);
      return { lat: r.lat, lng: r.lng, precisao: 'endereco' };
    } catch (e) { metricas.geoFalha++; console.error('geocodificação:', e.message); return null; }
  }

  // Rota de ruas e tempo pelo OSRM. Guarda o desenho simplificado; o tempo vem do servidor e não pesa no celular.
  const calculando = new Set();
  async function atualizaRota(id, de, para) {
    if (calculando.has(id)) return; calculando.add(id);
    try {
      const j = await buscaJson(OSRM + '/route/v1/driving/' + de.lng + ',' + de.lat + ';' + para.lng + ',' + para.lat + '?overview=simplified&geometries=geojson', 3500);
      const r = j && j.routes && j.routes[0]; if (!r) throw new Error('sem rota');
      const pts = (r.geometry.coordinates || []).slice(0, 300).map((x) => [Math.round(x[1] * 1e5) / 1e5, Math.round(x[0] * 1e5) / 1e5]);
      metricas.osrmOk++;
      await pool.query(`UPDATE rastreios SET eta_seg = $2, dist_m = $3, rota_eta = $2, rota_dist = $3, rota = $4, rota_em = $5, rota_lat = $6, rota_lng = $7 WHERE id = $1 AND estado = 'em_rota'`,
        [id, Math.round(r.duration), Math.round(r.distance), JSON.stringify(pts), Date.now(), de.lat, de.lng]);
    } catch (e) { metricas.osrmFalha++; } finally { calculando.delete(id); }
  }

  /* ---------- linhas e links ---------- */
  const expiraEm = (min) => `now() + interval '${min} minutes'`;
  const linkCli = (req, t) => baseUrl(req) + '/r/' + t, linkEnt = (req, t) => baseUrl(req) + '/e/' + t;
  function baseUrl(req) {
    const proto = req.headers['x-forwarded-proto'] === 'https' || req.secure ? 'https' : 'http';
    return proto + '://' + String(req.headers['x-forwarded-host'] || req.headers.host || '').replace(/[^A-Za-z0-9.:-]/g, '');
  }
  const FINAIS = new Set(['entregue', 'cancelado']);
  async function porToken(coluna, token) {
    if (!TOKEN_OK.test(String(token))) return null;
    return (await pool.query(`SELECT * FROM rastreios WHERE ${coluna} = $1 AND ativo`, [sha(token)])).rows[0] || null;
  }
  const expirado = (r) => new Date(r.expira).getTime() < Date.now();

  // Apaga posição, rastro e rota: roda ao concluir, cancelar ou falhar (a posição do entregador não fica guardada).
  const LIMPA_POSICAO = 'ult_lat = NULL, ult_lng = NULL, ult_prec = NULL, ult_em = NULL, eta_seg = NULL, dist_m = NULL, trilha = \'[]\', rota = NULL, rota_em = NULL, rota_lat = NULL, rota_lng = NULL, rota_eta = NULL, rota_dist = NULL';
  async function encerra(id, estado, extra) {
    const min = estado === 'falhou' ? MIN_APOS_FALHA : MIN_APOS_FIM;
    await pool.query(`UPDATE rastreios SET estado = $2, concluido_em = now(), expira = ${expiraEm(min)}, ${LIMPA_POSICAO} ${extra ? ', ' + extra : ''} WHERE id = $1`, [id, estado]);
  }

  /* ---------- rotas públicas (token) ---------- */
  const lim = limite({ janelaMs: 60000, max: 180, grupo: 'rastreio:', mensagem: 'Muitas consultas. Aguarde um instante.' });
  const exigeJson = (req, res, next) => (req.is('application/json') ? next() : res.status(415).json({ erro: 'Formato inválido.' }));
  const naoAcha = (res) => res.status(404).json({ erro: 'Link não encontrado. Confira se copiou o endereço inteiro.' });
  const vencido = (res) => res.status(410).json({ erro: 'Este link expirou.', expirado: true });

  function rotasPublicas() {
    app.get('/api/mapa', (req, res) => res.json({ tiles: TILES.url, atribuicao: TILES.atribuicao, zoomMax: TILES.zoomMax }));

    app.get('/api/r/:token', lim, seguro(async (req, res) => {
      const r = await porToken('token_cli', req.params.token); if (!r) return naoAcha(res);
      if (expirado(r)) return vencido(res);
      res.json(JPE.visaoCliente({ ...r, ult_em: r.ult_em }));
    }));

    const doEntregador = (fn) => seguro(async (req, res) => {
      const r = await porToken('token_ent', req.params.token); if (!r) return naoAcha(res);
      if (expirado(r)) return vencido(res);
      return fn(req, res, r);
    });
    const visaoEntregador = (r) => ({
      estado: r.estado, pedido: r.pedido_id, entregador: r.entregador_nome, cliente: r.cliente_nome, bairro: r.bairro, endereco: r.endereco, obs: r.obs,
      destino: { lat: r.dest_lat, lng: r.dest_lng, exato: r.dest_precisao === 'endereco' }, pedidoStatus: r.pedido_status,
      podeIniciar: ['aguardando', 'falhou'].includes(r.estado) && ['pronto', 'saiu', 'falhou'].includes(r.pedido_status || ''), expira: r.expira
    });
    app.get('/api/e/:token', lim, doEntregador(async (req, res, r) => res.json(visaoEntregador(r))));

    app.post('/api/e/:token/iniciar', lim, exigeJson, doEntregador(async (req, res, r) => {
      if (!(req.body && req.body.aceite === true)) return res.status(400).json({ erro: 'É preciso aceitar o compartilhamento da localização.' });
      if (r.estado === 'em_rota') return res.json(visaoEntregador(r)); // tocar duas vezes não quebra nada
      if (r.estado === 'cancelado') return res.status(409).json({ erro: 'Este pedido foi cancelado. Não saia para entregar.' });
      if (r.estado === 'entregue') return res.status(409).json({ erro: 'Este pedido já foi entregue.' });
      if (!JPE.proximoEstado(r.estado, 'iniciar')) return res.status(409).json({ erro: 'Não é possível iniciar agora.' });
      if (!['pronto', 'saiu', 'falhou'].includes(r.pedido_status || '')) return res.status(409).json({ erro: 'O pedido ainda está sendo preparado. Aguarde a Júlia liberar.' });
      await pool.query(`UPDATE rastreios SET estado = 'em_rota', iniciado_em = now(), concluido_em = NULL, evento = 'saiu', evento_motivo = NULL, ${LIMPA_POSICAO} WHERE id = $1`, [r.id]);
      res.json({ ok: true });
    }));

    // Recebe um ou vários pontos (a fila offline manda tudo de uma vez quando o sinal volta).
    app.post('/api/e/:token/posicoes', lim, exigeJson, doEntregador(async (req, res, r) => {
      if (r.estado !== 'em_rota') return res.status(409).json({ erro: 'A entrega não está em andamento.', estado: r.estado });
      const brutos = Array.isArray(req.body && req.body.pontos) ? req.body.pontos.slice(0, 60) : [];
      const agora = Date.now(); let ultimo = r.ult_em ? { lat: r.ult_lat, lng: r.ult_lng, t: +r.ult_em } : null, aceitos = 0, trilha = r.trilha || [];
      const ordenados = brutos.map((b) => JPE.lePonto(b, agora)).filter((x) => x.ok).map((x) => x.ponto).sort((a, b) => a.t - b.t);
      let ult = null;
      for (const p of ordenados) {
        if (!JPE.aceitaPonto(ultimo, p)) { metricas.descartadas++; continue; }
        ultimo = p; ult = p; aceitos++; trilha = JPE.adicionaTrilha(trilha, p);
      }
      metricas.descartadas += brutos.length - ordenados.length;
      if (!ult) return res.json({ ok: true, aceitos: 0 });
      const dest = { lat: r.dest_lat, lng: r.dest_lng };
      const rotaFresca = r.rota_em && agora - +r.rota_em < 45000;
      // com rota recente do OSRM, o tempo e a distância dela encolhem na proporção do que falta em linha reta; senão, estimativa local
      let eta = JPE.etaLinhaReta(ult, dest);
      if (rotaFresca && r.rota_eta != null && r.rota_lat != null) {
        const f = Math.min(1, JPE.distanciaM(ult, dest) / Math.max(1, JPE.distanciaM({ lat: r.rota_lat, lng: r.rota_lng }, dest)));
        eta = { segundos: Math.round(r.rota_eta * f), distM: Math.round(r.rota_dist * f) };
      }
      await pool.query('UPDATE rastreios SET ult_lat=$2, ult_lng=$3, ult_prec=$4, ult_em=$5, trilha=$6, eta_seg=$7, dist_m=$8 WHERE id=$1',
        [r.id, ult.lat, ult.lng, ult.prec, ult.t, JSON.stringify(trilha), eta.segundos, eta.distM]);
      metricas.posicoes += aceitos; metricas.ultimaPosicao = agora;
      const moveuDaRota = r.rota_lat == null || JPE.distanciaM({ lat: r.rota_lat, lng: r.rota_lng }, ult) > 300;
      if (!rotaFresca && (moveuDaRota || !r.rota_em || agora - +r.rota_em > 45000)) atualizaRota(r.id, ult, dest); // sem esperar: o entregador não fica travado
      res.json({ ok: true, aceitos });
    }));

    app.post('/api/e/:token/concluir', lim, exigeJson, doEntregador(async (req, res, r) => {
      if (r.estado === 'entregue') return res.json({ ok: true });
      if (r.estado === 'cancelado') return res.status(409).json({ erro: 'Este pedido foi cancelado.' });
      if (r.estado !== 'em_rota') return res.status(409).json({ erro: 'A entrega ainda não foi iniciada.' });
      await encerra(r.id, 'entregue', "evento = 'entregue', evento_motivo = NULL");
      res.json({ ok: true });
    }));

    app.post('/api/e/:token/falhar', lim, exigeJson, doEntregador(async (req, res, r) => {
      const motivo = txt(req.body && req.body.motivo, 200);
      if (!motivo) return res.status(400).json({ erro: 'Diga o motivo (por exemplo: cliente ausente).' });
      if (r.estado === 'falhou') return res.json({ ok: true });
      if (r.estado !== 'em_rota') return res.status(409).json({ erro: 'A entrega não está em andamento.' });
      await encerra(r.id, 'falhou');
      await pool.query("UPDATE rastreios SET evento = 'falhou', evento_motivo = $2, motivo_falha = $2 WHERE id = $1", [r.id, motivo]);
      res.json({ ok: true });
    }));
  }

  /* ---------- rotas do painel (exigem login) ---------- */
  function visaoPainel(r) {
    const pos = r.ult_em ? { lat: r.ult_lat, lng: r.ult_lng, t: +r.ult_em, prec: r.ult_prec } : null;
    return { id: r.id, pedido: r.pedido_id, estado: r.estado, entregador: r.entregador_nome, entregadorId: r.entregador_id, cliente: r.cliente_nome, bairro: r.bairro,
      destino: { lat: r.dest_lat, lng: r.dest_lng, exato: r.dest_precisao === 'endereco' }, posicao: pos, etaSeg: r.eta_seg, distM: r.dist_m,
      trilha: (r.trilha || []).map((x) => [x[0], x[1]]), rota: r.rota || null, semSinal: r.estado === 'em_rota' && (!pos || Date.now() - pos.t > SEM_SINAL_ALERTA_MS),
      pedidoStatus: r.pedido_status, evento: r.evento, eventoMotivo: r.evento_motivo, expira: r.expira };
  }

  function rotasPainel(soAdmin) {
    // Cria (ou renova) os links do pedido. Devolve os links só agora: no banco fica apenas o resumo (hash) do token.
    app.post('/api/rastreios', seguro(async (req, res) => {
      const b = req.body || {}, pedido = txt(b.pedido, 30);
      if (!pedido) return res.status(400).json({ erro: 'Informe o pedido.' });
      if (!txt(b.entregadorNome, 40)) return res.status(400).json({ erro: 'Atribua um entregador ao pedido antes de gerar o rastreio.' });
      let dest = null;
      if (JPE.naRegiao({ lat: +b.lat, lng: +b.lng }) && b.precisao === 'endereco') dest = { lat: +b.lat, lng: +b.lng, precisao: 'endereco' };
      if (!dest) dest = await geocodifica(b.endereco, b.bairro);
      if (!dest && JPE.naRegiao({ lat: +b.lat, lng: +b.lng })) dest = { lat: +b.lat, lng: +b.lng, precisao: 'bairro' }; // centro do bairro, aproximado
      if (!dest) return res.status(422).json({ erro: 'Não consegui localizar o endereço no mapa. Confira o endereço e o bairro do pedido.' });
      const tc = novoToken(), te = novoToken();
      const campos = [pedido, sha(tc), sha(te), txt(b.statusPedido, 20) || null, txt(b.entregadorId, 30) || null, txt(b.entregadorNome, 40), txt(b.cliente, 80), txt(b.bairro, 80), txt(b.endereco, 200), txt(b.obs, 300), dest.lat, dest.lng, dest.precisao];
      const ex = await pool.query('SELECT id, estado FROM rastreios WHERE pedido_id = $1 AND ativo', [pedido]);
      if (ex.rows[0] && ex.rows[0].estado === 'em_rota') return res.status(409).json({ erro: 'A entrega já está em andamento; os links não podem ser trocados agora.' });
      if (ex.rows[0]) await pool.query('UPDATE rastreios SET ativo = FALSE WHERE id = $1', [ex.rows[0].id]);
      const n = await pool.query(`INSERT INTO rastreios (pedido_id, token_cli, token_ent, pedido_status, entregador_id, entregador_nome, cliente_nome, bairro, endereco, obs, dest_lat, dest_lng, dest_precisao, expira)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13, ${expiraEm(HORAS_VALIDADE * 60)}) RETURNING *`, campos);
      app.locals.auditar && app.locals.auditar(req, 'rastreio.criado', 'pedido ' + pedido);
      res.status(201).json({ ...visaoPainel(n.rows[0]), linkCliente: linkCli(req, tc), linkEntregador: linkEnt(req, te), aproximado: dest.precisao !== 'endereco' });
    }));

    app.get('/api/rastreios', seguro(async (req, res) => {
      const r = await pool.query(`SELECT * FROM rastreios WHERE ativo AND (estado IN ('aguardando','em_rota') OR evento IS NOT NULL OR concluido_em > now() - interval '30 minutes') ORDER BY id DESC LIMIT 200`);
      res.json(r.rows.map(visaoPainel));
    }));

    // O painel avisa que já aplicou o evento (saiu/entregue/falhou) no pedido.
    app.post('/api/rastreios/:pedido/aplicado', seguro(async (req, res) => {
      await pool.query('UPDATE rastreios SET evento = NULL, evento_motivo = NULL WHERE pedido_id = $1 AND ativo AND evento = $2', [txt(req.params.pedido, 30), txt(req.body && req.body.evento, 20)]);
      res.json({ ok: true });
    }));

    // O painel manda o status atual dos pedidos acompanhados: cancelamento ou entrega feita no painel encerra o rastreio.
    app.post('/api/rastreios/sincroniza', seguro(async (req, res) => {
      const lista = Array.isArray(req.body && req.body.pedidos) ? req.body.pedidos.slice(0, 200) : [];
      for (const x of lista) {
        const id = txt(x.id, 30), st = txt(x.status, 20); if (!id || !st) continue;
        const r = (await pool.query('SELECT id, estado FROM rastreios WHERE pedido_id = $1 AND ativo', [id])).rows[0]; if (!r) continue;
        await pool.query('UPDATE rastreios SET pedido_status = $2 WHERE id = $1', [r.id, st]);
        if (FINAIS.has(r.estado)) continue;
        if (st === 'cancelado') await encerra(r.id, 'cancelado');
        else if (st === 'entregue' && r.estado !== 'entregue') await encerra(r.id, 'entregue');
      }
      res.json({ ok: true });
    }));

    app.get('/api/rastreios/metricas', soAdmin, seguro(async (req, res) => {
      const c = (await pool.query(`SELECT count(*) FILTER (WHERE estado='em_rota')::int em_rota, count(*) FILTER (WHERE estado='aguardando')::int aguardando,
        count(*) FILTER (WHERE estado='em_rota' AND (ult_em IS NULL OR ult_em < $1))::int sem_sinal FROM rastreios WHERE ativo`, [Date.now() - SEM_SINAL_ALERTA_MS])).rows[0];
      res.json({ ...c, ...metricas, alerta: c.sem_sinal > 0 });
    }));
  }

  /* ---------- limpeza e vigia ---------- */
  async function limpa() {
    // link vencido ou entrega encerrada: nenhuma posição fica guardada
    await pool.query(`UPDATE rastreios SET ${LIMPA_POSICAO} WHERE ult_em IS NOT NULL AND (estado NOT IN ('em_rota') OR expira < now())`);
    await pool.query(`UPDATE rastreios SET estado = 'cancelado', concluido_em = now() WHERE estado IN ('aguardando','em_rota') AND expira < now()`);
    await pool.query(`DELETE FROM rastreios WHERE criado < now() - interval '${DIAS_GUARDAR} days'`);
    await pool.query(`DELETE FROM geocache WHERE em < now() - interval '180 days'`);
  }
  let vigia = null;
  function iniciaLimpeza() {
    vigia = setInterval(() => {
      limpa().catch((e) => { metricas.erros++; console.error('limpeza do rastreio:', e.message); });
      pool.query(`SELECT pedido_id FROM rastreios WHERE estado='em_rota' AND (ult_em IS NULL OR ult_em < $1)`, [Date.now() - SEM_SINAL_ALERTA_MS])
        .then((r) => { if (r.rows.length) console.warn('rastreio sem sinal há mais de 3 min: ' + r.rows.map((x) => x.pedido_id).join(', ')); }).catch(() => {});
    }, 5 * 60000);
    vigia.unref();
  }

  // As telas do entregador e do cliente: o token vai no caminho; a página nunca vai para buscadores nem passa o endereço adiante.
  function paginas(site) {
    const pagina = (arq) => (req, res) => {
      if (!TOKEN_OK.test(req.params.token)) return res.status(404).type('text').send('Link não encontrado.');
      res.set({ 'Referrer-Policy': 'origin', 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self), payment=()' });
      res.sendFile(arq, { root: site });
    };
    app.get('/e/:token', pagina('entregador.html'));
    app.get('/r/:token', pagina('acompanhar.html'));
    app.get('/e-sw.js', (req, res) => { res.set({ 'Service-Worker-Allowed': '/e/', 'Cache-Control': 'no-cache' }); res.type('application/javascript').sendFile('entregador-sw.js', { root: site }); });
  }

  return { iniciaTabelas, rotasPublicas, rotasPainel, paginas, iniciaLimpeza, limpa, geocodifica, metricas };
};
