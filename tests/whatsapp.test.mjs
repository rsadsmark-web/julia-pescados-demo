import { createRequire } from 'module'; import assert from 'assert';
const require = createRequire(import.meta.url);
const raiz = process.argv[2];
const W = require(raiz + '/servidor/whatsapp-lib.js');

/* ---- número brasileiro ---- */
assert.equal(W.normalizaFone('(85) 99767-3481'), '5585997673481');
assert.equal(W.normalizaFone('85997673481'), '5585997673481');
assert.equal(W.normalizaFone('+55 85 99767-3481'), '5585997673481');
assert.equal(W.normalizaFone('0 85 99767-3481'), '5585997673481', 'tira o zero da operadora');
assert.equal(W.normalizaFone('558597673481'), '5585997673481', 'celular sem o nono dígito ganha o 9');
assert.equal(W.normalizaFone('(85) 3226-1234'), '558532261234', 'fixo continua com 8 dígitos');
assert.equal(W.normalizaFone('123'), null); assert.equal(W.normalizaFone(''), null); assert.equal(W.normalizaFone('abc'), null);
assert.equal(W.mesmoNumero('(85) 99767-3481', '558597673481'), true);

/* ---- configuração padrão: tudo desligado ---- */
const cfg0 = W.cfgPadrao();
assert.equal(cfg0.ligado, false); assert.equal(cfg0.teste, true); assert.deepEqual(cfg0.numerosTeste, []);

/* ---- travas de envio ---- */
const hora = (h, m = 0) => new Date(2026, 9, 26, h, m, 0).getTime(); // segunda-feira
const ctx = (o) => Object.assign({ agora: hora(10), enviadas24h: 0, ultimoEnvioMs: 0, falhasSeguidas: 0, optouts: new Set(), credenciais: true, liberadoServidor: true }, o);
const ligada = (o) => Object.assign(W.cfgPadrao(), { ligado: true, teste: false }, o);
const nega = (cfg, c, fone, tipo, re) => { const r = W.podeEnviar(cfg, c, fone, tipo); assert.equal(r.ok, false, 'deveria negar: ' + re); assert.match(r.motivo, re); };
nega(ligada(), ctx({ liberadoServidor: false }), '85997673481', 'resposta', /liberado/i);
nega(ligada(), ctx({ credenciais: false }), '85997673481', 'resposta', /credencial/i);
nega(W.cfgPadrao(), ctx(), '85997673481', 'resposta', /desligad/i);
nega(ligada(), ctx(), '123', 'resposta', /número/i);
nega(ligada({ teste: true, numerosTeste: ['85988887777'] }), ctx(), '85997673481', 'resposta', /teste/i);
assert.equal(W.podeEnviar(ligada({ teste: true, numerosTeste: ['(85) 98888-7777'] }), ctx(), '85988887777', 'resposta').ok, true, 'número de teste passa');
assert.equal(W.podeEnviar(ligada(), ctx(), '85997673481', 'resposta').ok, true);
nega(ligada(), ctx({ falhasSeguidas: 3 }), '85997673481', 'resposta', /pausad/i);
// campanha: horário, limite diário com aquecimento, opt-out
nega(ligada(), ctx({ agora: hora(7) }), '85997673481', 'campanha', /horário/i);
nega(ligada(), ctx({ agora: hora(19, 30) }), '85997673481', 'campanha', /horário/i);
assert.equal(W.podeEnviar(ligada(), ctx({ agora: hora(7) }), '85997673481', 'resposta').ok, true, 'resposta ao cliente não tem horário');
nega(ligada({ diaAquecimento: 1 }), ctx({ enviadas24h: 20 }), '85997673481', 'campanha', /limite/i);
assert.equal(W.podeEnviar(ligada({ diaAquecimento: 1 }), ctx({ enviadas24h: 19 }), '85997673481', 'campanha').ok, true);
assert.equal(W.limiteEfetivo(ligada({ diaAquecimento: 10, limiteDia: 250 })), 100); assert.equal(W.limiteEfetivo(ligada({ diaAquecimento: 30, limiteDia: 250 })), 250); assert.equal(W.limiteEfetivo(ligada({ diaAquecimento: 30, limiteDia: 40 })), 40);
nega(ligada(), ctx({ optouts: new Set(['5585997673481']) }), '(85) 99767-3481', 'campanha', /sair|opt/i);
assert.equal(W.podeEnviar(ligada(), ctx({ optouts: new Set(['5585997673481']) }), '85997673481', 'resposta').ok, true, 'quem pediu para sair ainda recebe resposta direta');
// intervalo aleatório entre mensagens de campanha
const cA = ligada({ intervaloMin: 25, intervaloMax: 60 });
assert.equal(W.proximoIntervaloMs(cA, () => 0), 25000); assert.equal(W.proximoIntervaloMs(cA, () => 0.999999) >= 59900, true);
/* ---- entrada: opt-out e webhook da uazapi ---- */
for (const t of ['SAIR', 'sair', ' Parar ', 'STOP', 'não quero receber', 'Nao quero mais receber mensagens', 'cancelar inscrição']) assert.equal(W.ehOptout(t), true, t);
for (const t of ['quero saber o preço', 'bom dia', 'preciso sair mais cedo amanhã', '']) assert.equal(W.ehOptout(t), false, t);
const ev = { EventType: 'messages', message: { id: 'ABC1', chatid: '5585997673481@s.whatsapp.net', fromMe: false, text: 'Quanto está o camarão?', messageTimestamp: 1761270000000, messageType: 'conversation', senderName: 'Ana' } };
const m = W.parseWebhook(ev);
assert.deepEqual([m.tipo, m.fone, m.texto, m.extId, m.nome, m.deMim], ['mensagem', '5585997673481', 'Quanto está o camarão?', 'ABC1', 'Ana', false]);
assert.equal(W.parseWebhook({ EventType: 'messages', message: { chatid: '120363@g.us', text: 'oi', fromMe: false, id: 'G1' } }), null, 'grupos são ignorados');
assert.equal(W.parseWebhook({ EventType: 'messages', message: { chatid: '5585997673481@s.whatsapp.net', fromMe: true, text: 'eu', id: 'X' } }).deMim, true);
assert.equal(W.parseWebhook({ EventType: 'presence' }), null); assert.equal(W.parseWebhook(null), null); assert.equal(W.parseWebhook('x'), null);
const st = W.parseWebhook({ EventType: 'messages_update', event: { MessageIDs: ['ABC1'], Type: 'Read' } });
assert.equal(st.tipo, 'status'); assert.deepEqual(st.ids, ['ABC1']); assert.equal(st.estado, 'lida');
assert.equal(W.parseWebhook({ EventType: 'messages', message: { id: 'Z', chatid: '5585997673481@s.whatsapp.net', fromMe: false, messageType: 'imageMessage', text: '' } }).texto, '[imagem]', 'mídia vira marcador');

/* ---- texto de saída ---- */
assert.equal(W.limpaTexto('  oi\u0000 tudo bem?  '), 'oi tudo bem?');
assert.equal(W.limpaTexto('x'.repeat(5000)).length, 4000);
assert.equal(W.limpaTexto(''), '');

/* ---- segredo do webhook ---- */
assert.equal(W.segredoConfere('abc123', 'abc123'), true); assert.equal(W.segredoConfere('abc123', 'abc124'), false);
assert.equal(W.segredoConfere('', ''), false, 'sem segredo configurado o webhook fica fechado'); assert.equal(W.segredoConfere(undefined, 'x'), false);

console.log('testes whatsapp ok');
