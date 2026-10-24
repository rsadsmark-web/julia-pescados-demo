import { createRequire } from 'module'; import assert from 'assert';
const require = createRequire(import.meta.url);
const raiz = process.argv[2];
const IA = require(raiz + '/servidor/ia-lib.js');
const L = require(raiz + '/loja-lib.js');

const produtos = [
  { id: 'a', nome: 'Filé de Camarão Eviscerado XXG 16/20', cat: 'Camarões', un: 'kg', preco: 89.9, estoque: 12, min: 4 },
  { id: 'b', nome: 'Filé de Tilápia', cat: 'Peixes & Mariscos', un: 'kg', preco: 38, promo: 33, estoque: 8, min: 2 },
  { id: 'c', nome: 'Pastel de Queijo', cat: 'Petiscos - Fritura', un: '24 und', preco: 21.5, estoque: 0, min: 2 },
  { id: 'd', nome: 'Tempero Extra', cat: 'Temperos e Alhos', un: 'unidade', preco: 3.5, estoque: 30, min: 0 }];
const cfgLoja = L.mescla({});
const agora = new Date(2026, 9, 26, 10, 0, 0);

/* ---- base de conhecimento ---- */
const base = IA.montaBase(produtos, cfgLoja, agora);
assert.match(base.texto, /Filé de Camarão Eviscerado XXG 16\/20.*R\$ 89,90/); assert.match(base.texto, /Filé de Tilápia.*R\$ 33,00/, 'promoção vale como preço atual');
assert.match(base.texto, /Pastel de Queijo.*esgotado/i); assert.match(base.texto, /pedido mínimo.*R\$ 50,00/i); assert.match(base.texto, /Aldeota.*R\$ 6,00/);
assert.match(base.texto, /Segunda a sexta|segunda a sexta/i); assert.match(base.texto, /8h/);
assert.ok(base.precos.has('89,90') && base.precos.has('33,00') && base.precos.has('50,00') && base.precos.has('6,00'));
assert.ok(!base.precos.has('38,00'), 'preço cheio da promoção não é o preço vigente');

/* ---- seleção de produtos relevantes (a base inteira não vai no prompt) ---- */
const sel = IA.selecionaProdutos('quanto está o camarão xxg?', produtos, 3);
assert.equal(sel[0].id, 'a'); assert.ok(sel.length <= 3);
assert.deepEqual(IA.selecionaProdutos('bom dia', produtos, 3).map((p) => p.id), [], 'sem palavra de produto não escolhe nada');
assert.equal(IA.selecionaProdutos('tem tilapia?', produtos, 3)[0].id, 'b', 'ignora acento');

/* ---- quando passar para uma pessoa (sem gastar chamada) ---- */
const h = (t, o) => IA.precisaHumano(t, Object.assign({ limiteKg: 20, limiteValor: 1500 }, o));
for (const t of ['O camarão chegou estragado', 'Quero cancelar meu pedido', 'Vou ao Procon', 'passei mal depois de comer', 'Quero falar com a Júlia', 'preciso de um atendente', 'quero reembolso', 'está com cheiro ruim']) assert.equal(h(t).humano, true, t);
assert.equal(h('quero 30 kg de camarão').humano, true); assert.match(h('quero 30 kg de camarão').motivo, /grande/);
assert.equal(h('preciso de R$ 2.500,00 em camarão').humano, true);
assert.equal(h('[áudio]').humano, true); assert.match(h('[áudio]').motivo, /áudio/);
assert.equal(h('[imagem]').humano, true);
for (const t of ['quanto está o camarão?', 'vocês entregam na Aldeota?', 'qual o horário?', 'quero 2 kg de tilápia']) assert.equal(h(t).humano, false, t);
assert.equal(h('ok obrigado').cortesia, true); assert.equal(h('quanto custa?').cortesia, false);

/* ---- prompt ---- */
const p = IA.montaPrompt({ base, produtosRelevantes: sel, cfgIa: { promptExtra: 'Chame a cliente de "você".' }, historico: [{ d: 'c', t: 'oi' }, { d: 'j', t: 'Olá! Em que posso ajudar?' }, { d: 'c', t: 'quanto está o camarão?' }], nomeCliente: 'Ana Souza' });
assert.match(p.system, /Júlia Pescados/); assert.match(p.system, /nunca invent/i); assert.match(p.system, /assistente virtual/i); assert.match(p.system, /JSON/); assert.match(p.system, /Chame a cliente de "você"/);
assert.match(p.system, /R\$ 89,90/); assert.ok(!/Tempero Extra/.test(p.system.split('PRODUTOS EM DESTAQUE')[1] || ''), 'produtos não relacionados não entram no destaque');
assert.equal(p.messages[0].role, 'user'); assert.equal(p.messages[p.messages.length - 1].role, 'user');
assert.ok(p.messages.every((m, i) => i === 0 || m.role !== p.messages[i - 1].role), 'papéis alternam');
assert.match(p.messages[p.messages.length - 1].content, /quanto está o camarão/);
// histórico começando pela IA: primeira mensagem vira user para a API aceitar
const p2 = IA.montaPrompt({ base, produtosRelevantes: [], cfgIa: {}, historico: [{ d: 'j', t: 'Promoção hoje!' }, { d: 'c', t: 'qual?' }], nomeCliente: '' });
assert.equal(p2.messages[0].role, 'user');

/* ---- leitura da resposta do modelo ---- */
assert.deepEqual(IA.parseSaida('{"resposta":"Olá!","humano":false,"motivo":""}'), { resposta: 'Olá!', humano: false, motivo: '' });
assert.equal(IA.parseSaida('Claro:\n```json\n{"resposta":"Oi","humano":false}\n```').resposta, 'Oi');
assert.equal(IA.parseSaida('{"resposta":"","humano":true,"motivo":"reclamação"}').humano, true);
assert.equal(IA.parseSaida('texto solto sem json'), null); assert.equal(IA.parseSaida(''), null);

/* ---- travas na resposta (preço inventado não sai) ---- */
const v = (t) => IA.validaResposta(t, base);
assert.equal(v('O camarão XXG está R$ 89,90 o kg.').ok, true);
assert.equal(v('A tilápia está em promoção por R$ 33,00.').ok, true);
assert.equal(v('O camarão está R$ 79,90 hoje!').ok, false); assert.match(v('O camarão está R$ 79,90 hoje!').motivo, /preço/i);
assert.equal(v('Entregamos na Aldeota por R$ 6,00.').ok, true);
assert.equal(v('Entregamos em 20 minutos, garantido!').ok, false);
assert.equal(v('Acesse http://golpe.com/pagar').ok, false); assert.equal(v('Veja tudo em https://julia.rstechmarketing.com.br').ok, true);
assert.equal(v('').ok, false); assert.equal(v('a'.repeat(1300)).ok, false);
assert.equal(v('Me passe seu cartão de crédito completo').ok, false);
assert.equal(v('Olá! Posso ajudar com o pedido?').ok, true, 'sem preço, sem problema');

/* ---- limites de uso ---- */
const lim = IA.podeResponder({ ligado: true, maxPorConversaDia: 3, maxPorHora: 20 }, { respostasConversa24h: 3, respostasHora: 0 });
assert.equal(lim.ok, false); assert.match(lim.motivo, /conversa/);
assert.equal(IA.podeResponder({ ligado: true, maxPorConversaDia: 3, maxPorHora: 20 }, { respostasConversa24h: 1, respostasHora: 20 }).ok, false);
assert.equal(IA.podeResponder({ ligado: true, maxPorConversaDia: 3, maxPorHora: 20 }, { respostasConversa24h: 1, respostasHora: 5 }).ok, true);
assert.equal(IA.podeResponder({ ligado: false }, {}).ok, false);

console.log('testes ia ok');
