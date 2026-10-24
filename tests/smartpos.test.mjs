import { createRequire } from 'module'; import assert from 'assert'; import fs from 'fs';
const require = createRequire(import.meta.url);
const { normaliza, titulo } = require(process.argv[2] + '/servidor/smartpos.js');
const origem = JSON.parse(fs.readFileSync(process.argv[2] + '/docs/catalogo-smartpos-2026-10-23.json', 'utf8'));
const n = origem.produtos.map(normaliza), por = (c) => n.find((x) => x.codigo === c);

assert.equal(n.length, 54);
assert.equal(new Set(n.map((x) => x.codigo)).size, 54, 'códigos únicos');
assert.equal(por('0101010').codigo, '0101010', 'zeros à esquerda preservados');
// estoque negativo vira zero e fica marcado para o relatório
['218', '2005', '117', '119'].forEach((c) => { assert.equal(por(c).estoque, 0); assert(por(c).negativo); });
assert.equal(n.filter((x) => x.negativo).length, 4);
assert.equal(por('1002').estoque, 57);
// unidade extraída e nome sem ela
assert.deepEqual([por('1002').nome, por('1002').un], ['Filé de Camarão M 51/60 - IQF', 'kg']);
assert.equal(por('244').un, 'bandeja 24 und'); assert.equal(por('246').un, 'bandeja 12 und');
assert.equal(por('167').un, '500 g'); assert.equal(por('134').un, '200 g'); assert.equal(por('221').un, '700 g');
assert.equal(por('116').un, 'unidade'); assert.equal(por('241').un, '24 und');
// correções de nome
assert.equal(por('145').nome, 'Filé de Camarão XG 26/30 - Eviscerado');
assert.equal(por('124').nome, 'Camarão Empanado c/ Cream Cheese - Fritura');
assert.equal(por('167').nome, 'Carne do Sol Cozida e Desfiada');
assert.equal(titulo('Filé De Pargo C/ Pele'), 'Filé de Pargo c/ Pele');
// nenhum nome ficou com unidade, parêntese solto ou espaço duplo; todo produto tem unidade, preço e categoria
n.forEach((x) => { assert(!/[()]|\s{2,}|\bund\b|\(kg\)/i.test(x.nome), x.nome); assert(x.un && x.preco > 0 && x.cat, x.codigo); });
console.log('testes smartpos ok');
