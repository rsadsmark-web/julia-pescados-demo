import { createRequire } from 'module'; import assert from 'assert';
const require = createRequire(import.meta.url);
const raiz = process.argv[2];
const NF = require(raiz + '/nf-lib.js');

/* ---- documentos ---- */
assert.equal(NF.cpfValido('529.982.247-25'), true); assert.equal(NF.cpfValido('111.111.111-11'), false); assert.equal(NF.cpfValido('529.982.247-24'), false); assert.equal(NF.cpfValido('123'), false);
assert.equal(NF.cnpjValido('11.222.333/0001-81'), true); assert.equal(NF.cnpjValido('11.222.333/0001-82'), false); assert.equal(NF.cnpjValido('00.000.000/0000-00'), false);
assert.equal(NF.tipoDoc('529.982.247-25'), 'cpf'); assert.equal(NF.tipoDoc('11222333000181'), 'cnpj'); assert.equal(NF.tipoDoc('12'), null); assert.equal(NF.tipoDoc(''), null);
assert.equal(NF.ncmValido('0306.17.00'), true); assert.equal(NF.ncmValido('03061700'), true); assert.equal(NF.ncmValido('0306'), false); assert.equal(NF.ncmValido('abc'), false);

/* ---- configuração fiscal e pendências ---- */
const c0 = NF.cfgPadrao();
assert.equal(c0.provedor, 'nenhum'); assert.equal(c0.ambiente, 'homologacao'); assert.equal(c0.serie, 1); assert.equal(c0.cfopPadrao, '5102'); assert.equal(c0.csosnPadrao, '102');
const pe0 = NF.pendenciasEmitente(c0); assert.ok(pe0.length >= 6, 'emitente vazio tem várias pendências'); assert.ok(pe0.some((p) => /CNPJ/.test(p.msg)));
const emit = { razao: 'Júlia Pescados Ltda', cnpj: '11.222.333/0001-81', ie: '061234567', regime: 1, logradouro: 'Rua Ceci', numero: '1129', bairro: 'Centro', municipio: 'Fortaleza', uf: 'CE', cep: '60000-000', fone: '85997673481', codMunicipio: '2304400' };
const cOk = Object.assign(NF.cfgPadrao(), { emitente: emit });
assert.deepEqual(NF.pendenciasEmitente(cOk), []);
assert.ok(NF.pendenciasEmitente(Object.assign(NF.cfgPadrao(), { emitente: Object.assign({}, emit, { cnpj: '11.222.333/0001-80' }) })).some((p) => /CNPJ/.test(p.msg)));

/* ---- produtos e pedido ---- */
const prods = [
  { id: 'a', nome: 'Filé de Camarão', un: 'kg', preco: 50, ncm: '03061700' },
  { id: 'b', nome: 'Pastel de queijo', un: '24 und', preco: 20 }];
const ped = (o) => Object.assign({ id: 'JP-1', cliente: 'Ana Souza', fone: '(85) 99999-1111', tipo: 'entrega', bairro: 'Aldeota', endereco: 'Rua Silva Jatahy, 233', pagamento: 'Pix', itens: [{ id: 'a', nome: 'Filé de Camarão', un: 'kg', preco: 50, qtd: 1.5 }], taxa: 6, criado: 1761270000000 }, o);

let r = NF.montaNota(ped(), prods, cOk, { nome: 'Ana Souza', doc: '529.982.247-25', cep: '60170-000', numero: '233', logradouro: 'Rua Silva Jatahy' }, { agora: 1761270000000 });
assert.equal(r.ok, true, JSON.stringify(r.pendencias)); assert.deepEqual(r.pendencias, []);
const n = r.payload;
assert.equal(n.natureza_operacao, 'Venda de mercadoria'); assert.equal(n.tipo_documento, 1); assert.equal(n.finalidade_emissao, 1); assert.equal(n.consumidor_final, 1);
assert.equal(n.cnpj_emitente, '11222333000181'); assert.equal(n.cpf_destinatario, '52998224725'); assert.equal(n.nome_destinatario, 'Ana Souza'); assert.equal(n.indicador_inscricao_estadual_destinatario, 9);
assert.equal(n.uf_destinatario, 'CE'); assert.equal(n.municipio_destinatario, 'Fortaleza'); assert.equal(n.cep_destinatario, '60170000');
assert.equal(n.items.length, 1); const it = n.items[0];
assert.deepEqual([it.numero_item, it.codigo_produto, it.codigo_ncm, it.cfop, it.unidade_comercial, it.quantidade_comercial, it.valor_unitario_comercial, it.valor_bruto, it.icms_situacao_tributaria, it.icms_origem], [1, 'a', '03061700', '5102', 'KG', 1.5, 50, 75, '102', 0]);
assert.equal(n.valor_produtos, 75); assert.equal(n.valor_frete, 6); assert.equal(n.valor_total, 81);
assert.deepEqual(n.formas_pagamento, [{ forma_pagamento: '17', valor_pagamento: 81 }]);
assert.equal(n.modalidade_frete, 0);
assert.equal(NF.refDe(ped(), cOk), 'JP-1-1'); // referência estável para o provedor não duplicar a nota

// retirada: sem frete e sem endereço obrigatório
r = NF.montaNota(ped({ tipo: 'retirada', taxa: 0, bairro: '', endereco: '', pagamento: 'Pagar na retirada' }), prods, cOk, { nome: 'Ana Souza', doc: '529.982.247-25' }, {});
assert.equal(r.ok, true, JSON.stringify(r.pendencias)); assert.equal(r.payload.valor_frete, 0); assert.equal(r.payload.modalidade_frete, 9);

// pendências do pedido
r = NF.montaNota(ped({ itens: [{ id: 'b', nome: 'Pastel', un: '24 und', preco: 20, qtd: 2 }] }), prods, cOk, { nome: 'Ana', doc: '123' }, {});
assert.equal(r.ok, false); const msgs = r.pendencias.map((p) => p.campo + ':' + p.msg).join('|');
assert.match(msgs, /ncm/i); assert.match(msgs, /CPF|CNPJ/); assert.match(msgs, /CEP/); assert.match(msgs, /logradouro|endereço/i);
assert.equal(NF.montaNota(ped(), prods, NF.cfgPadrao(), { nome: 'Ana', doc: '529.982.247-25', cep: '60170000', numero: '1', logradouro: 'R' }, {}).ok, false, 'sem dados do emitente não fecha');
assert.equal(NF.montaNota(ped({ itens: [] }), prods, cOk, { nome: 'A', doc: '529.982.247-25' }, {}).ok, false);
// consumidor sem CPF: permitido só abaixo de nada — NF-e exige destinatário
assert.ok(NF.montaNota(ped(), prods, cOk, { nome: 'Ana' }, {}).pendencias.some((p) => /CPF|CNPJ/.test(p.msg)));
// CNPJ de restaurante
r = NF.montaNota(ped({ cliente: 'Cantina' }), prods, cOk, { nome: 'Cantina da Nona Ltda', doc: '11.222.333/0001-81', cep: '60170000', numero: '1', logradouro: 'Rua A', ie: '' }, {});
assert.equal(r.payload.cnpj_destinatario, '11222333000181'); assert.equal(r.payload.cpf_destinatario, undefined);
// Caucaia
r = NF.montaNota(ped({ bairro: 'Caucaia (Centro)' }), prods, cOk, { nome: 'Ana', doc: '529.982.247-25', cep: '61600000', numero: '1', logradouro: 'R' }, {});
assert.equal(r.payload.municipio_destinatario, 'Caucaia'); assert.equal(r.payload.codigo_municipio_destinatario, '2303709');
// pagamento
assert.equal(NF.formaPagamento('Dinheiro'), '01'); assert.equal(NF.formaPagamento('Pix'), '17'); assert.equal(NF.formaPagamento('Cartão na entrega'), '03'); assert.equal(NF.formaPagamento('qualquer'), '99');
// arredondamento em centavos
r = NF.montaNota(ped({ itens: [{ id: 'a', nome: 'Filé', un: 'kg', preco: 33.33, qtd: 1.5 }], taxa: 0 }), prods, cOk, { nome: 'Ana', doc: '529.982.247-25', cep: '60170000', numero: '1', logradouro: 'R' }, {});
assert.equal(r.payload.items[0].valor_bruto, 50); assert.equal(r.payload.valor_total, 50);

/* ---- emissão desligada por padrão ---- */
assert.equal(NF.podeEmitir(c0, { liberado: false, token: '' }).ok, false);
assert.match(NF.podeEmitir(Object.assign(NF.cfgPadrao(), { emitente: emit }), { liberado: false, token: 'x' }).motivo, /liberad/i);
assert.match(NF.podeEmitir(Object.assign(NF.cfgPadrao(), { emitente: emit, provedor: 'focus' }), { liberado: true, token: '' }).motivo, /token|credencial/i);
assert.match(NF.podeEmitir(Object.assign(NF.cfgPadrao(), { emitente: emit, provedor: 'nenhum' }), { liberado: true, token: 'x' }).motivo, /provedor/i);
assert.equal(NF.podeEmitir(Object.assign(NF.cfgPadrao(), { emitente: emit, provedor: 'focus' }), { liberado: true, token: 'x' }).ok, true);
assert.match(NF.podeEmitir(Object.assign(NF.cfgPadrao(), { emitente: Object.assign({}, emit, { cnpj: '' }), provedor: 'focus' }), { liberado: true, token: 'x' }).motivo, /emitente|pendência/i);

console.log('testes nf ok');
