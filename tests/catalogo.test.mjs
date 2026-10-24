// Teste das regras do catálogo (categorias e produtos). Uso: node tests/catalogo.test.mjs <raiz-do-projeto>
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const C = require(process.argv[2] + '/catalogo-lib.js');
const base = () => ({ produtos: [
  { id: 'a', nome: 'Camarão A', cat: 'Camarões', un: 'kg', preco: 50, estoque: 5, min: 1, img: 'produtos/a.webp' },
  { id: 'b', nome: 'Tilápia', cat: 'Peixes', un: 'kg', preco: 30, estoque: 0, min: 1, img: 'produtos/b.webp' },
  { id: 'c', nome: 'Camarão C', cat: 'Camarões', un: 'kg', preco: 60, estoque: 2, min: 1, promo: 55, img: 'produtos/c.webp' },
  { id: 'k', nome: 'Kit', cat: 'Kits', un: 'kit', preco: 90, estoque: 3, min: 1, inclui: [['a', 1]], img: 'produtos/k.webp' }
], pedidos: [] });

// categorias nascem dos produtos, na ordem em que aparecem
let S = base(); C.garante(S);
assert.deepEqual(S.categorias.map((c) => c.nome), ['Camarões', 'Peixes', 'Kits']);
assert.deepEqual(C.contagem(S, 'Camarões'), { total: 2, ativos: 2 });

// criar, nome repetido (sem acento/caixa) e vazio
assert.equal(C.criaCategoria(S, '  Molhos ').ok, true);
assert.equal(C.criaCategoria(S, 'camaroes').ok, false, 'nome repetido');
assert.equal(C.criaCategoria(S, '   ').ok, false);

// renomear atualiza os produtos
assert.equal(C.renomeiaCategoria(S, 'Peixes', 'Peixes e filés').ok, true);
assert.equal(S.produtos.find((p) => p.id === 'b').cat, 'Peixes e filés');
assert.equal(C.renomeiaCategoria(S, 'Kits', 'Camarões').ok, false);

// reordenar
assert.equal(C.moveCategoria(S, 'Kits', -1).ok, true);
assert.deepEqual(S.categorias.map((c) => c.nome), ['Camarões', 'Kits', 'Peixes e filés', 'Molhos']);
assert.equal(C.moveCategoria(S, 'Camarões', -1).ok, false, 'já é a primeira');

// excluir: só vazia
assert.equal(C.excluiCategoria(S, 'Kits').ok, false);
assert.equal(C.excluiCategoria(S, 'Molhos').ok, true);

// mover produtos entre categorias
assert.equal(C.moveProdutos(S, ['c'], 'Peixes e filés').n, 1);
assert.equal(C.contagem(S, 'Camarões').total, 1);

// o que a loja mostra: sem inativos, sem categoria desligada, na ordem das categorias
C.ativaProduto(S, 'b', false);
assert.deepEqual(C.publicos(S).map((p) => p.id), ['a', 'k', 'c']);
C.ativaCategoria(S, 'Kits', false);
assert.deepEqual(C.publicos(S).map((p) => p.id), ['a', 'c']);
C.ativaProduto(S, 'b', true); assert.equal('ativo' in S.produtos.find((p) => p.id === 'b'), false);

// duplicar: nasce desativado, sem destaque, id novo, no fim do original
S = base(); C.garante(S); S.produtos[0].dest = true;
const d = C.duplicaProduto(S, 'a');
assert.equal(d.ok, true); assert.notEqual(d.produto.id, 'a'); assert.equal(d.produto.ativo, false); assert.equal(d.produto.dest, undefined);
assert.match(d.produto.nome, /\(cópia\)$/); assert.equal(S.produtos[1].id, d.produto.id); assert.equal(S.produtos.length, 5);

// excluir trava produto usado em kit, combo e pedido aberto
const cfg = { combos: [{ nome: 'Combo X', itens: [['b', 1]] }] };
assert.equal(C.excluiProduto(S, cfg, 'a').ok, false, 'está no kit');
assert.equal(C.excluiProduto(S, cfg, 'b').ok, false, 'está no combo');
S.pedidos.push({ id: 'JP-1', status: 'novo', itens: [{ id: 'c' }] });
assert.match(C.excluiProduto(S, cfg, 'c').erro, /pedido em andamento/);
assert.equal(C.excluiProduto(S, cfg, d.produto.id).ok, true);
assert.equal(S.produtos.length, 4);

// criar produto: validações
assert.equal(C.criaProduto(S, { nome: 'X', preco: 0, cat: 'Kits' }).ok, false);
assert.equal(C.criaProduto(S, { nome: '', preco: 5, cat: 'Kits' }).ok, false);
const n = C.criaProduto(S, { nome: 'Novo', preco: '12,5'.replace(',', '.'), cat: 'Molhos', estoque: 3 });
assert.equal(n.ok, true); assert.ok(S.categorias.some((c) => c.nome === 'Molhos'), 'categoria nova entra na lista');

// lote: preço percentual com promoção que deixa de valer, ativar/desativar, categoria, excluir com recusa
S = base(); C.garante(S);
let r = C.emLote(S, {}, ['a', 'c'], 'preco', { modo: 'percentual', valor: -10 });
assert.equal(r.n, 2); assert.equal(S.produtos[0].preco, 45); assert.equal(S.produtos[2].preco, 54); assert.equal(S.produtos[2].promo, undefined, 'promoção maior que o preço some');
r = C.emLote(S, {}, ['a', 'b'], 'preco', { modo: 'fixo', valor: 0 }); assert.equal(r.n, 0); assert.equal(r.recusados.length, 2);
assert.equal(C.emLote(S, {}, ['a', 'b'], 'desativar').n, 2); assert.equal(S.produtos[0].ativo, false);
assert.equal(C.emLote(S, {}, ['a', 'b'], 'ativar').n, 2); assert.equal(S.produtos[0].ativo, undefined);
assert.equal(C.emLote(S, {}, ['a', 'b'], 'categoria', { cat: 'Camarões' }).n, 1);
r = C.emLote(S, {}, ['a', 'c'], 'excluir'); assert.equal(r.n, 1); assert.deepEqual(r.recusados, ['Camarão A'], 'a está no kit');

// nada some: as operações de categoria não perdem produto
S = base(); C.garante(S); C.renomeiaCategoria(S, 'Camarões', 'Camarão'); C.moveCategoria(S, 'Kits', -2);
assert.equal(S.produtos.length, 4);
console.log('catalogo.test: ok');

// foto: só JPG, PNG e WebP verdadeiros passam (confere os primeiros bytes, não o nome)
const { formato } = require(process.argv[2] + '/servidor/fotos.js');
assert.equal(formato(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 ')])), 'webp');
assert.equal(formato(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0])), 'jpg');
assert.equal(formato(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])), 'png');
assert.equal(formato(Buffer.from('<svg onload=alert(1)>')), null, 'SVG e HTML são recusados');
assert.equal(formato(Buffer.from('GIF89a......')), null);
console.log('fotos.test: ok');
