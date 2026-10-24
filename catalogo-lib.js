/* Júlia Pescados — regras do catálogo, sem tela: categorias (ordem, ativa, renomear, mover produtos) e produtos
   (ativo, duplicar, excluir com trava, ações em lote). Roda no navegador (window.JPC) e no Node (testes e servidor).
   Mexe no estado do painel (jp_demo_v1): as categorias moram em estado.categorias = [{ nome, ativa }]. */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(); else raiz.JPC = fabrica();
})(this, function () {
  var semAcento = function (t) { return String(t == null ? '' : t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); };
  var limpa = function (v, n) { return String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n); };
  var cents = function (v) { return Math.round(+v * 100) / 100; };

  /* ---------- categorias ---------- */
  function achaCat(S, nome) { return (S.categorias || []).filter(function (c) { return c.nome === nome; })[0]; }
  function existe(S, nome, exceto) {
    return (S.categorias || []).some(function (c) { return c.nome !== exceto && semAcento(c.nome) === semAcento(nome); });
  }
  // Garante a lista de categorias: cria a partir dos produtos (na ordem em que aparecem) e acrescenta as que faltam.
  function garante(S) {
    if (!Array.isArray(S.categorias)) S.categorias = [];
    S.categorias = S.categorias.filter(function (c) { return c && c.nome; }).map(function (c) { return { nome: c.nome, ativa: c.ativa !== false }; });
    S.produtos.forEach(function (p) { if (p.cat && !achaCat(S, p.cat)) S.categorias.push({ nome: p.cat, ativa: true }); });
    return S.categorias;
  }
  function contagem(S, nome) {
    var t = 0, a = 0; S.produtos.forEach(function (p) { if (p.cat === nome) { t++; if (p.ativo !== false) a++; } });
    return { total: t, ativos: a };
  }
  function criaCategoria(S, nome) {
    garante(S); nome = limpa(nome, 40);
    if (!nome) return { ok: false, erro: 'Escreva o nome da categoria.' };
    if (existe(S, nome)) return { ok: false, erro: 'Já existe uma categoria com esse nome.' };
    S.categorias.push({ nome: nome, ativa: true }); return { ok: true, nome: nome };
  }
  function renomeiaCategoria(S, de, para) {
    garante(S); para = limpa(para, 40); var c = achaCat(S, de);
    if (!c) return { ok: false, erro: 'Categoria não encontrada.' };
    if (!para) return { ok: false, erro: 'Escreva o nome da categoria.' };
    if (existe(S, para, de)) return { ok: false, erro: 'Já existe uma categoria com esse nome.' };
    c.nome = para; S.produtos.forEach(function (p) { if (p.cat === de) p.cat = para; });
    return { ok: true, nome: para };
  }
  function moveCategoria(S, nome, delta) {
    garante(S); var l = S.categorias, i = l.indexOf(achaCat(S, nome)), j = i + delta;
    if (i < 0 || j < 0 || j >= l.length) return { ok: false };
    var t = l[i]; l[i] = l[j]; l[j] = t; return { ok: true };
  }
  function ativaCategoria(S, nome, ativa) {
    garante(S); var c = achaCat(S, nome); if (!c) return { ok: false, erro: 'Categoria não encontrada.' };
    c.ativa = !!ativa; return { ok: true };
  }
  function excluiCategoria(S, nome) {
    garante(S); var n = contagem(S, nome).total;
    if (!achaCat(S, nome)) return { ok: false, erro: 'Categoria não encontrada.' };
    if (n) return { ok: false, erro: 'Esta categoria tem ' + n + (n === 1 ? ' produto' : ' produtos') + '. Mova-os para outra categoria antes de excluir.' };
    S.categorias = S.categorias.filter(function (c) { return c.nome !== nome; }); return { ok: true };
  }
  // Move produtos (por id) para uma categoria que já existe; cria a categoria se for um nome novo e permitido.
  function moveProdutos(S, ids, nome) {
    garante(S); nome = limpa(nome, 40);
    if (!nome) return { ok: false, erro: 'Escolha a categoria de destino.' };
    if (!achaCat(S, nome)) S.categorias.push({ nome: nome, ativa: true });
    var n = 0; S.produtos.forEach(function (p) { if (ids.indexOf(p.id) >= 0 && p.cat !== nome) { p.cat = nome; n++; } });
    return { ok: true, n: n };
  }

  /* ---------- produtos ---------- */
  function achaProd(S, id) { return S.produtos.filter(function (p) { return p.id === id; })[0]; }
  function proximoId(S) {
    var usados = {}; S.produtos.forEach(function (p) { usados[p.id] = 1; });
    var n = Date.now().toString(36), id = 'n' + n, k = 0;
    while (usados[id]) id = 'n' + n + (++k);
    return id;
  }
  function criaProduto(S, d) {
    garante(S); d = d || {};
    var nome = limpa(d.nome, 80), preco = cents(d.preco), est = d.estoque == null || d.estoque === '' ? 0 : cents(d.estoque);
    if (!nome) return { ok: false, erro: 'Escreva o nome do produto.' };
    if (!(preco > 0)) return { ok: false, erro: 'O preço precisa ser maior que zero.' };
    if (!(est >= 0)) return { ok: false, erro: 'O estoque precisa ser zero ou mais.' };
    var cat = limpa(d.cat, 40); if (!cat) return { ok: false, erro: 'Escolha a categoria.' };
    if (!achaCat(S, cat)) S.categorias.push({ nome: cat, ativa: true });
    var p = { id: proximoId(S), nome: nome, cat: cat, un: limpa(d.un, 20) || 'kg', preco: preco, estoque: est, min: d.min == null || d.min === '' ? 1 : Math.max(0, cents(d.min)), img: d.img || '', desc: limpa(d.desc, 300) };
    S.produtos.push(p); return { ok: true, produto: p };
  }
  function duplicaProduto(S, id) {
    var o = achaProd(S, id); if (!o) return { ok: false, erro: 'Produto não encontrado.' };
    var c = JSON.parse(JSON.stringify(o)); c.id = proximoId(S); delete c.codigo; c.nome = limpa(o.nome, 70) + ' (cópia)'; c.ativo = false; delete c.dest;
    S.produtos.splice(S.produtos.indexOf(o) + 1, 0, c); return { ok: true, produto: c };
  }
  // Onde o produto é usado: kits (inclui), combos da loja e pedidos ainda abertos.
  function usoDoProduto(S, cfg, id) {
    var l = [];
    S.produtos.forEach(function (p) { if ((p.inclui || []).some(function (i) { return i[0] === id; })) l.push('kit “' + p.nome + '”'); });
    ((cfg && cfg.combos) || []).forEach(function (c) { if ((c.itens || []).some(function (i) { return i[0] === id; })) l.push('combo “' + c.nome + '”'); });
    var ab = (S.pedidos || []).filter(function (pd) { return !pd.fixo && pd.status !== 'entregue' && pd.status !== 'cancelado' && (pd.itens || []).some(function (i) { return i.id === id; }); }).length;
    if (ab) l.push(ab + (ab === 1 ? ' pedido em andamento' : ' pedidos em andamento'));
    return l;
  }
  function excluiProduto(S, cfg, id) {
    var p = achaProd(S, id); if (!p) return { ok: false, erro: 'Produto não encontrado.' };
    var uso = usoDoProduto(S, cfg, id);
    if (uso.length) return { ok: false, erro: 'Não dá para excluir: ' + p.nome + ' está em ' + uso.join(', ') + '. Desative o produto para tirá-lo da loja.', uso: uso };
    S.produtos = S.produtos.filter(function (x) { return x.id !== id; }); return { ok: true };
  }
  function ativaProduto(S, id, ativo) {
    var p = achaProd(S, id); if (!p) return { ok: false, erro: 'Produto não encontrado.' };
    if (ativo) delete p.ativo; else p.ativo = false; return { ok: true };
  }
  function ajustaPreco(p, modo, valor) {
    var v = +valor, novo = modo === 'percentual' ? p.preco * (1 + v / 100) : modo === 'somar' ? p.preco + v : v;
    novo = cents(novo); if (!(novo > 0)) return false;
    p.preco = novo; if (p.promo && p.promo >= p.preco) delete p.promo; return true;
  }
  // Ações em lote. acao: ativar | desativar | categoria | preco | destaque | semdestaque | excluir
  function emLote(S, cfg, ids, acao, op) {
    op = op || {}; var n = 0, recusados = [];
    ids.forEach(function (id) {
      var p = achaProd(S, id); if (!p) return;
      if (acao === 'ativar') { delete p.ativo; n++; }
      else if (acao === 'desativar') { p.ativo = false; n++; }
      else if (acao === 'destaque') { p.dest = true; n++; }
      else if (acao === 'semdestaque') { delete p.dest; n++; }
      else if (acao === 'preco') { if (ajustaPreco(p, op.modo, op.valor)) n++; else recusados.push(p.nome); }
      else if (acao === 'excluir') { var r = excluiProduto(S, cfg, id); if (r.ok) n++; else recusados.push(p.nome); }
    });
    if (acao === 'categoria') { var r2 = moveProdutos(S, ids, op.cat); if (!r2.ok) return r2; n = r2.n; }
    return { ok: true, n: n, recusados: recusados };
  }

  /* ---------- o que a loja mostra ---------- */
  // Produtos ativos de categorias ativas, na ordem das categorias (a loja monta as abas pela ordem em que aparecem).
  function publicos(S) {
    garante(S); var ordem = {}, off = {};
    S.categorias.forEach(function (c, i) { ordem[c.nome] = i; if (!c.ativa) off[c.nome] = 1; });
    return S.produtos.map(function (p, i) { return [p, i]; })
      .filter(function (x) { return x[0].ativo !== false && !off[x[0].cat]; })
      .sort(function (a, b) { var oa = ordem[a[0].cat] == null ? 1e6 : ordem[a[0].cat], ob = ordem[b[0].cat] == null ? 1e6 : ordem[b[0].cat]; return oa - ob || a[1] - b[1]; })
      .map(function (x) { return x[0]; });
  }

  return { garante: garante, contagem: contagem, criaCategoria: criaCategoria, renomeiaCategoria: renomeiaCategoria, moveCategoria: moveCategoria,
    ativaCategoria: ativaCategoria, excluiCategoria: excluiCategoria, moveProdutos: moveProdutos, criaProduto: criaProduto, duplicaProduto: duplicaProduto,
    usoDoProduto: usoDoProduto, excluiProduto: excluiProduto, ativaProduto: ativaProduto, ajustaPreco: ajustaPreco, emLote: emLote, publicos: publicos, achaProd: achaProd };
});
