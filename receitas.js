/* Página pública de receitas da Julia Pescados. Lê as receitas (com as edições feitas no painel) deste navegador. */
(function () {
  var S = JP.estado();
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var q = new URLSearchParams(location.search);
  var destaque = (q.get('p') || '').split(',').filter(Boolean);
  var filtro = 'todos', termo = '';

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function prod(id) { return S.produtos.filter(function (p) { return p.id === id; })[0]; }
  function norm(t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

  function cartao(r, aberta) {
    var p = prod(r.prod); if (!p) return '';
    return '<article class="rec-card" id="' + r.id + '">' +
      '<div class="rec-foto" style="background-image:url(img/' + p.img + ')"><span class="chip">' + esc(p.nome) + '</span></div>' +
      '<div class="rec-corpo"><h3>' + esc(r.titulo) + '</h3>' +
      '<p class="rec-meta"><span>' + esc(r.tempo) + '</span><span>Serve ' + r.porcoes + '</span></p>' +
      '<details' + (aberta ? ' open' : '') + '><summary>Ver ingredientes e preparo</summary>' +
      '<h4>Ingredientes</h4><ul>' + r.ingr.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul>' +
      '<h4>Modo de preparo</h4><ol>' + r.prep.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ol>' +
      (r.dica ? '<p class="rec-dica"><b>Dica:</b> ' + esc(r.dica) + '</p>' : '') + '</details>' +
      '<a class="btn pequeno claro" href="index.html?add=' + p.id + '">Comprar ' + esc(p.nome) + '</a></div></article>';
  }

  function desenha() {
    var todas = PV.receitas();
    var prods = S.produtos.filter(function (p) { return todas.some(function (r) { return r.prod === p.id; }); });
    var lista = todas.filter(function (r) {
      var p = prod(r.prod);
      return (filtro === 'todos' || r.prod === filtro) && (!termo || norm(r.titulo + ' ' + (p ? p.nome : '') + ' ' + r.ingr.join(' ')).indexOf(termo) >= 0);
    });
    $('#recCats').innerHTML = ['todos'].concat(prods.map(function (p) { return p.id; })).map(function (id) {
      var nome = id === 'todos' ? 'Todas' : prod(id).nome;
      return '<button type="button" class="cat' + (id === filtro ? ' ativa' : '') + '" data-f="' + id + '" aria-pressed="' + (id === filtro) + '">' + esc(nome) + '</button>';
    }).join('');
    $('#recContagem').textContent = lista.length + (lista.length === 1 ? ' receita' : ' receitas') + ' · ' + prods.length + ' produtos';
    $('#recGrade').innerHTML = lista.length ? lista.map(function (r) { return cartao(r, false); }).join('') : '<p class="vazio">Nenhuma receita encontrada.</p>';
  }

  function desenhaSeu() {
    var ids = destaque.filter(function (id) { return prod(id); });
    if (!ids.length) return;
    var rs = PV.receitas().filter(function (r) { return ids.indexOf(r.prod) >= 0; });
    if (!rs.length) return;
    $('#recSeu').hidden = false;
    var nomes = ids.map(function (id) { return prod(id).nome; });
    $('#recSeuP').textContent = (q.get('pedido') ? 'Pedido ' + q.get('pedido') + ': ' : '') + nomes.join(' e ') + '.';
    $('#recSub').textContent = 'Separamos as receitas do que você comprou. Mais abaixo, todas as outras.';
    $('#recSeuGrade').innerHTML = rs.map(function (r, i) { return cartao(r, i === 0); }).join('');
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-f]'); if (!b) return;
    filtro = b.dataset.f; desenha();
  });
  $('#recBusca').addEventListener('input', function (e) { termo = norm(e.target.value.trim()); desenha(); });
  window.addEventListener('storage', function () { S = JP.estado(); PV.recarregar(); desenha(); });
  desenhaSeu(); desenha();
})();
