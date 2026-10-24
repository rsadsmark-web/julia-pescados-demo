'use strict';
// Express 4 não captura erro de rota assíncrona: a requisição ficava pendurada até o cliente desistir.
// Este ajuste manda a rejeição da Promise para o tratador de erros (resposta 500 ou 4xx), sem mudar nenhuma rota.
const Layer = require('express/lib/router/layer');
Layer.prototype.handle_request = function (req, res, next) {
  const fn = this.handle;
  if (fn.length > 3) return next();
  try {
    const r = fn(req, res, next);
    if (r && typeof r.catch === 'function') r.catch(next);
  } catch (e) { next(e); }
};
