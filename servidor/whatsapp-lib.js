'use strict';
// Regras do WhatsApp (uazapi), sem rede nem banco: número, travas de envio, opt-out e leitura do webhook.
// O envio real só acontece quando TODAS as travas liberam; o padrão é tudo desligado.
const crypto = require('crypto');

function cfgPadrao() {
  return { ligado: false, teste: true, numerosTeste: [], inicio: '09:00', fim: '19:00', intervaloMin: 25, intervaloMax: 60, limiteDia: 250, diaAquecimento: 1, pausaFalhas: 3 };
}

// 5585997673481: DDI 55 + DDD + 9 dígitos (celular) ou 8 (fixo). Celular antigo com 8 dígitos ganha o 9.
function normalizaFone(v) {
  let d = String(v == null ? '' : v).replace(/\D/g, '');
  if (d.startsWith('0')) d = d.replace(/^0+/, '');
  if (d.length === 10 || d.length === 11) d = '55' + d;
  if (!(d.length === 12 || d.length === 13) || !d.startsWith('55')) return null;
  const ddd = d.slice(2, 4), local = d.slice(4);
  if (+ddd < 11) return null;
  if (local.length === 8 && /^[6-9]/.test(local)) return '55' + ddd + '9' + local;
  return d;
}
const mesmoNumero = (a, b) => { const x = normalizaFone(a), y = normalizaFone(b); return !!x && x === y; };

const minutos = (hhmm) => { const p = String(hhmm).split(':'); return +p[0] * 60 + +p[1]; };
function aquecimento(dia) { return dia <= 3 ? 20 : dia <= 7 ? 50 : dia <= 14 ? 100 : 250; }
const limiteEfetivo = (cfg) => Math.min(+cfg.limiteDia || 250, aquecimento(+cfg.diaAquecimento || 1));
function proximoIntervaloMs(cfg, rand) {
  const a = +cfg.intervaloMin || 25, b = Math.max(a, +cfg.intervaloMax || 60);
  return Math.round((a + (rand || Math.random)() * (b - a)) * 1000);
}

// tipo: 'resposta' (conversa 1 a 1) ou 'campanha' (disparo em massa, com travas extras)
function podeEnviar(cfg, c, fone, tipo) {
  const nao = (motivo) => ({ ok: false, motivo });
  if (!c.liberadoServidor) return nao('Envio real não liberado neste servidor.');
  if (!c.credenciais) return nao('Credencial da uazapi não configurada.');
  if (!cfg.ligado) return nao('Chave geral desligada.');
  const n = normalizaFone(fone); if (!n) return nao('Número inválido.');
  if (c.falhasSeguidas >= (cfg.pausaFalhas || 3)) return nao('Envio pausado depois de ' + c.falhasSeguidas + ' falhas seguidas.');
  if (cfg.teste && !(cfg.numerosTeste || []).some((t) => mesmoNumero(t, n))) return nao('Modo teste: só os números de teste recebem.');
  if (tipo === 'campanha') {
    if (c.optouts && c.optouts.has(n)) return nao('Cliente pediu para sair (opt-out).');
    const d = new Date(c.agora), m = d.getHours() * 60 + d.getMinutes();
    if (m < minutos(cfg.inicio) || m >= minutos(cfg.fim)) return nao('Fora do horário de campanhas (' + cfg.inicio + ' às ' + cfg.fim + ').');
    if (c.enviadas24h >= limiteEfetivo(cfg)) return nao('Limite diário atingido (' + c.enviadas24h + ' de ' + limiteEfetivo(cfg) + ').');
  }
  return { ok: true, fone: n };
}

const SAIR = /^(sair|parar|pare|stop|cancelar|descadastrar|remover)(\s+(inscri[cç][aã]o|mensagens?))?[.!]?$/i;
function ehOptout(t) {
  const s = String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
  if (!s) return false;
  return SAIR.test(s) || /\bn(ao|ão) quero (mais )?receber\b/.test(s) || /\b(sair|cancelar) (da )?(lista|inscricao)\b/.test(s);
}

const TIPOS = { imageMessage: '[imagem]', videoMessage: '[vídeo]', audioMessage: '[áudio]', pttMessage: '[áudio]', documentMessage: '[documento]', stickerMessage: '[figurinha]', locationMessage: '[localização]', contactMessage: '[contato]' };
// Lê o evento da uazapi. Devolve null para o que não interessa (grupo, presença, formato desconhecido).
function parseWebhook(ev) {
  if (!ev || typeof ev !== 'object') return null;
  const tipo = String(ev.EventType || ev.event || '').toLowerCase();
  if (tipo === 'messages' && ev.message && typeof ev.message === 'object') {
    const m = ev.message, chat = String(m.chatid || m.chatId || ''), isGrupo = /@g\.us$/.test(chat);
    if (isGrupo || !/@s\.whatsapp\.net$/.test(chat)) return null;
    const fone = normalizaFone(chat.split('@')[0]); if (!fone) return null;
    const texto = limpaTexto(m.text || m.content || '') || TIPOS[m.messageType] || '[mensagem sem texto]';
    return { tipo: 'mensagem', fone, texto, extId: String(m.id || m.messageid || ''), nome: m.senderName ? limpaTexto(m.senderName).slice(0, 80) : '', deMim: !!m.fromMe, quando: +m.messageTimestamp || Date.now() };
  }
  if (tipo === 'messages_update' && ev.event && Array.isArray(ev.event.MessageIDs)) {
    const t = String(ev.event.Type || '').toLowerCase();
    const estado = { read: 'lida', delivered: 'entregue', sent: 'enviada', played: 'lida' }[t];
    return estado ? { tipo: 'status', ids: ev.event.MessageIDs.map(String), estado } : null;
  }
  return null;
}

function limpaTexto(t) { return String(t == null ? '' : t).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, 4000); }

function segredoConfere(esperado, recebido) {
  if (!esperado || typeof recebido !== 'string' || !recebido) return false;
  const a = Buffer.from(String(esperado)), b = Buffer.from(recebido);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { cfgPadrao, normalizaFone, mesmoNumero, aquecimento, limiteEfetivo, proximoIntervaloMs, podeEnviar, ehOptout, parseWebhook, limpaTexto, segredoConfere };
