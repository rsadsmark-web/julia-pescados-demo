'use strict';
// Atendimento por IA da Júlia Pescados, sem rede nem banco: base de conhecimento do catálogo, quando passar para uma
// pessoa, montagem do prompt, leitura da resposta e as travas que impedem a IA de inventar preço, prazo ou link.
const path = require('path');
const L = require(path.join(process.env.SITE_DIR || path.join(__dirname, '..'), 'loja-lib.js'));

const brl = (v) => 'R$ ' + (Math.round(+v * 100) / 100).toFixed(2).replace('.', ',');
const num2 = (v) => (Math.round(+v * 100) / 100).toFixed(2).replace('.', ',');
const norm = (t) => String(t == null ? '' : t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const DOMINIOS = ['julia.rstechmarketing.com.br', 'wa.me'];

/* ---------- base de conhecimento (tudo que a IA pode afirmar) ---------- */
function montaBase(produtos, cfgLoja, agora) {
  const cfg = L.mescla(cfgLoja), precos = new Set(), por = {}, linhas = [];
  const guarda = (v) => { precos.add(num2(v)); return brl(v); };
  produtos.forEach((p) => { (por[p.cat || 'Outros'] = por[p.cat || 'Outros'] || []).push(p); });
  Object.keys(por).sort().forEach((cat) => {
    linhas.push(cat + ':');
    por[cat].forEach((p) => {
      const pr = L.precoEfetivo(p), un = L.unidade(p).rotulo;
      linhas.push('- ' + p.nome + ' — ' + guarda(pr) + ' (' + un + ')' + (L.emPromocao(p) ? ' [em promoção]' : '') + (p.estoque > 0 ? '' : ' [esgotado agora]'));
    });
  });
  const combos = L.combosAtivos(cfg, produtos).map((c) => '- ' + c.nome + ' — ' + guarda(c.preco) + ': ' + (c.desc || ''));
  const bairros = cfg.bairros.map((b) => b.nome + ' ' + guarda(b.taxa)).join('; ');
  precos.add(num2(cfg.frete.porKm)); const minimo = guarda(cfg.minimo);
  const texto = [
    'LOJA: ' + cfg.nome + '. Endereço: ' + cfg.contato.endereco + '. WhatsApp: ' + cfg.contato.telefone + '. Instagram: @' + cfg.contato.instagram + '.',
    'HORÁRIO DE ATENDIMENTO: ' + L.resumoHorario(cfg) + '. ' + L.situacaoLoja(cfg, agora).texto + '.',
    'PEDIDO MÍNIMO: ' + minimo + ' (sem contar o frete).',
    'ENTREGA em Fortaleza e Caucaia, taxa por bairro: ' + bairros + '. Acima de ' + String(cfg.frete.franquiaKm).replace('.', ',') + ' km soma-se ' + brl(cfg.frete.porKm) + ' por km excedente (o valor exato aparece no pedido). Também há RETIRADA no endereço da loja.',
    'PAGAMENTO: Pix, dinheiro, cartão na entrega ou na retirada.',
    'ITENS POR PESO (kg) têm o valor ajustado na pesagem; bandejas e pacotes são vendidos inteiros.',
    combos.length ? 'COMBOS:\n' + combos.join('\n') : '',
    'CATÁLOGO (preço atual):\n' + linhas.join('\n')
  ].filter(Boolean).join('\n');
  return { texto, precos, dominios: DOMINIOS.slice() };
}

function selecionaProdutos(texto, produtos, n) {
  const palavras = norm(texto).split(/[^a-z0-9/]+/).filter((w) => w.length >= 3 && !['que', 'quanto', 'esta', 'tem', 'para', 'com', 'uma', 'por', 'voces', 'qual', 'quero', 'custa', 'preco', 'valor', 'kilo', 'quilo', 'bom', 'dia', 'boa', 'tarde', 'noite'].includes(w));
  if (!palavras.length) return [];
  const pontos = produtos.map((p) => { const alvo = norm(p.nome + ' ' + (p.cat || '')); return { p, s: palavras.reduce((t, w) => t + (alvo.includes(w) ? 1 + (w.length > 5 ? 1 : 0) : 0), 0) }; });
  return pontos.filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, n || 5).map((x) => x.p);
}

/* ---------- quando uma pessoa assume ---------- */
const RECLAMA = /estragad|podre|cheiro (ruim|forte)|passei mal|intoxic|vencid|reclam|pessim|horriv|absurd|procon|advogad|processo|golpe|enganad|nao chegou|atrasad|demorou/;
const CANCELA = /cancel|reembols|devolu|estorno|dinheiro de volta/;
const PEDE_HUMANO = /atendente|humano|\bpessoa\b|falar com (a |o )?(julia|dona|gerente|alguem|responsavel)|gerente|responsavel/;
function precisaHumano(texto, cfg) {
  cfg = cfg || {}; const t = String(texto || ''), n = norm(t);
  const m = /^\[(audio|imagem|video|documento|localizacao|contato|figurinha)\]/.exec(n);
  if (m) return { humano: true, motivo: m[1] === 'audio' ? 'o cliente enviou um áudio (a IA não ouve áudios)' : 'o cliente enviou ' + (m[1] === 'imagem' ? 'uma imagem' : m[1] === 'video' ? 'um vídeo' : 'um anexo') + ' que a IA não vê' };
  if (RECLAMA.test(n)) return { humano: true, motivo: 'reclamação ou problema com o pedido' };
  if (CANCELA.test(n)) return { humano: true, motivo: 'cancelamento, devolução ou reembolso' };
  if (PEDE_HUMANO.test(n)) return { humano: true, motivo: 'o cliente pediu para falar com uma pessoa' };
  let kg = 0, valor = 0, x; const reKg = /(\d+(?:[.,]\d+)?)\s*(?:kg|quilos?)/g, reV = /r\$\s*(\d+(?:\.\d{3})*(?:,\d+)?)/g;
  while ((x = reKg.exec(n))) kg = Math.max(kg, parseFloat(x[1].replace(',', '.')));
  while ((x = reV.exec(n))) valor = Math.max(valor, parseFloat(x[1].replace(/\./g, '').replace(',', '.')));
  if (kg >= (cfg.limiteKg || 20)) return { humano: true, motivo: 'pedido grande (' + String(kg).replace('.', ',') + ' kg)' };
  if (valor >= (cfg.limiteValor || 1500)) return { humano: true, motivo: 'pedido grande (' + brl(valor) + ')' };
  const cortesia = n.trim().length < 30 && !/\?/.test(n) && /^(ok|beleza|show|valeu|combinado|obrigad|certo|pode ser|perfeito|blz|👍)/.test(n.trim());
  return { humano: false, cortesia };
}

/* ---------- prompt ---------- */
const REGRAS = [
  'Você é a assistente virtual da {loja} no WhatsApp. Se perguntarem, diga que é a assistente virtual da loja (nunca finja ser uma pessoa).',
  'Responda em português do Brasil, em tom cordial e curto (no máximo 4 frases), sem markdown.',
  'Use SOMENTE as informações da base abaixo. Nunca invente preço, estoque, prazo, promoção ou política. Se não souber, diga que vai chamar a equipe e marque humano=true.',
  'Não calcule totais: informe o preço unitário e convide a fazer o pedido pelo link da loja ou confirmar por aqui; itens por peso são ajustados na pesagem.',
  'Não prometa horário ou tempo de entrega. Diga apenas o horário de atendimento e que a entrega é combinada na confirmação.',
  'Nunca peça dados de cartão, senha ou documentos. Não fale de assuntos que não sejam da loja.',
  'Para pedir, indique o link da loja: https://julia.rstechmarketing.com.br (pedido sem cadastro, só nome e WhatsApp).',
  'Reclamações, cancelamentos, pedidos grandes, pagamentos com problema e qualquer dúvida sua: humano=true e resposta curta avisando que a equipe vai assumir.',
  'Responda APENAS com um JSON: {"resposta":"texto para o cliente","humano":false,"motivo":""}. Quando humano=true, "motivo" explica em poucas palavras.'
];
function montaPrompt(o) {
  const cfgIa = o.cfgIa || {}, rel = o.produtosRelevantes || [];
  const destaque = rel.length ? '\n\nPRODUTOS EM DESTAQUE (relacionados à última mensagem):\n' + rel.map((p) => '- ' + p.nome + ' — ' + brl(L.precoEfetivo(p)) + ' (' + L.unidade(p).rotulo + ')' + (p.estoque > 0 ? ', disponível' : ', esgotado agora')).join('\n') : '\n\nPRODUTOS EM DESTAQUE: nenhum específico.';
  const system = REGRAS.join('\n').replace('{loja}', 'Júlia Pescados') + (cfgIa.promptExtra ? '\n\nORIENTAÇÕES EXTRAS DA LOJA:\n' + String(cfgIa.promptExtra).slice(0, 1500) : '') +
    (o.nomeCliente ? '\n\nO cliente se chama ' + String(o.nomeCliente).split(' ')[0] + '.' : '') + '\n\nBASE DE CONHECIMENTO:\n' + o.base.texto + destaque;
  const hist = (o.historico || []).filter((m) => (m.d === 'c' || m.d === 'j') && String(m.t || '').trim());
  let msgs = hist.map((m) => ({ role: m.d === 'c' ? 'user' : 'assistant', content: String(m.t).slice(0, 1200) }));
  while (msgs.length && msgs[msgs.length - 1].role === 'assistant') msgs.pop();
  const antes = []; while (msgs.length && msgs[0].role === 'assistant') antes.push(msgs.shift().content);
  if (antes.length && msgs.length) msgs[0].content = '(mensagem anterior da loja: ' + antes.join(' / ') + ')\n' + msgs[0].content;
  const juntas = []; msgs.forEach((m) => { const u = juntas[juntas.length - 1]; if (u && u.role === m.role) u.content += '\n' + m.content; else juntas.push(m); });
  return { system, messages: juntas.slice(-12) };
}

function parseSaida(t) {
  const s = String(t || ''), i = s.indexOf('{'), j = s.lastIndexOf('}'); if (i < 0 || j <= i) return null;
  try { const o = JSON.parse(s.slice(i, j + 1)); if (typeof o.resposta !== 'string') return null; return { resposta: o.resposta.trim(), humano: o.humano === true, motivo: typeof o.motivo === 'string' ? o.motivo.trim() : '' }; } catch (e) { return null; }
}

/* ---------- travas da resposta ---------- */
function validaResposta(texto, base) {
  const t = String(texto || '').trim(), nao = (motivo) => ({ ok: false, motivo });
  if (!t) return nao('resposta vazia'); if (t.length > 1000) return nao('resposta longa demais');
  const urls = t.match(/https?:\/\/[^\s)]+/gi) || [];
  for (const u of urls) { let h = ''; try { h = new URL(u).hostname; } catch (e) { return nao('link inválido'); } if (!(base.dominios || DOMINIOS).includes(h)) return nao('link fora da loja: ' + h); }
  if (/\b(em|dentro de|ate|até|prazo de)\s+\d+\s*(min|minutos|hora|horas)\b/i.test(t) || /garant(o|imos|ido|ida)\b/i.test(norm(t))) return nao('promessa de prazo ou garantia');
  if (/numero do cart|cvv|senha|cartao de credito completo|dados do cartao/.test(norm(t))) return nao('pede dado sensível');
  const re = /R\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)/g; let m;
  while ((m = re.exec(t))) {
    let v = m[1].replace(/\./g, ''); if (!v.includes(',')) v += ',00'; else if (/,\d$/.test(v)) v += '0';
    if (!base.precos.has(v)) return nao('preço fora da tabela: R$ ' + v);
  }
  return { ok: true };
}

function podeResponder(cfg, uso) {
  if (!cfg.ligado) return { ok: false, motivo: 'IA desligada' };
  if ((uso.respostasConversa24h || 0) >= (cfg.maxPorConversaDia || 6)) return { ok: false, motivo: 'limite de respostas por conversa no dia' };
  if ((uso.respostasHora || 0) >= (cfg.maxPorHora || 40)) return { ok: false, motivo: 'limite de respostas por hora' };
  return { ok: true };
}

module.exports = { montaBase, selecionaProdutos, precisaHumano, montaPrompt, parseSaida, validaResposta, podeResponder, norm };
