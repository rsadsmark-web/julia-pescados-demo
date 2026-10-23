'use strict';
// Limite de requisições por IP (janela deslizante, em memória). O Caddy repassa o IP real em X-Cliente-IP
// (já resolvido pelo CF-Connecting-IP quando a Cloudflare está na frente). O cabeçalho só vale se vier do proxy local.
const privado = (ip) => /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1|::ffff:(127|10|192\.168|172\.(1[6-9]|2\d|3[01]))\.|fc|fd)/i.test(ip || '');

function ipDe(req) {
  const peer = req.socket.remoteAddress || '';
  const h = req.headers['x-cliente-ip'];
  return privado(peer) && typeof h === 'string' && h.length < 64 ? h.trim() : peer;
}

// limite({ janelaMs, max, mensagem }) -> middleware; a chave é o IP (mais o grupo, se vários limites convivem).
function limite({ janelaMs, max, mensagem, grupo = '' }) {
  const marcas = new Map(); // ip -> [timestamps]
  setInterval(() => { const corte = Date.now() - janelaMs; for (const [k, l] of marcas) if (!l.length || l[l.length - 1] < corte) marcas.delete(k); }, 60000).unref();
  return (req, res, next) => {
    const agora = Date.now(), k = grupo + ipDe(req), l = (marcas.get(k) || []).filter((t) => agora - t < janelaMs);
    if (l.length >= max) {
      res.set('Retry-After', String(Math.ceil((l[0] + janelaMs - agora) / 1000)));
      return res.status(429).json({ erro: mensagem || 'Muitas requisições. Aguarde um pouco e tente de novo.' });
    }
    l.push(agora); marcas.set(k, l); next();
  };
}
module.exports = { limite, ipDe };
