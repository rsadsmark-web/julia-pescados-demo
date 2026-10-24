/* Painel da Júlia — áreas "Produtos" e "Categorias".
   Produtos: lista com busca, filtro por categoria e situação, foto, preço e estoque editáveis na linha, criar, editar, duplicar,
   ativar/desativar, excluir com confirmação e ações em lote. Categorias: criar, renomear, reordenar, ativar/desativar e mover produtos.
   Cada mudança é gravada na hora; a loja pública atualiza em até um minuto. As regras estão em catalogo-lib.js (testadas). */
(function () {
  var ctx = null, modo = 'produtos';
  var F = { termo: '', cat: '', sit: 'todos', sel: {} };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(t) { return ctx.esc(t); }
  function S() { return ctx.estado(); }
  function vir(v) { return String(v).replace('.', ','); }
  function numero(v) { var n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? null : n; }
  function salva(msg) { JP.salvar(); ctx.toast(msg); }
  function cfgLoja() { var s = null; try { s = JSON.parse(localStorage.getItem('jp_loja_v1') || 'null'); } catch (e) {} return JPL.mescla(s); }
  function prod(id) { return JPC.achaProd(S(), id); }
  function foto(p) { return JPL.fotoUrl(p.img); }
  function plural(n, a, b) { return n + ' ' + (n === 1 ? a : b); }
  var ICONES = {
    mais: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    cima: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>',
    baixo: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>'
  };

  /* ---------- diálogos ---------- */
  var dlg = null;
  function dialogo() {
    if (dlg) return dlg;
    dlg = document.createElement('dialog'); dlg.className = 'pra-dlg'; document.body.appendChild(dlg);
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    return dlg;
  }
  function abre(html, aoFechar) {
    var d = dialogo(); d.innerHTML = html; d.onclose = aoFechar || null;
    if (!d.open) d.showModal();
    var f = $('[autofocus], input, select, textarea', d); if (f && !/mobi/i.test(navigator.userAgent)) f.focus();
    return d;
  }
  function fecha() { if (dlg && dlg.open) dlg.close(); }
  function confirma(titulo, texto, ok, perigo) {
    return new Promise(function (res) {
      var feito = false;
      var d = abre('<form method="dialog" class="pra-form"><h2>' + esc(titulo) + '</h2><p>' + texto + '</p><div class="pra-botoes">' +
        '<button type="button" class="btn claro" data-pra-nao>Cancelar</button><button type="button" class="btn' + (perigo ? ' perigo' : ' mar') + '" data-pra-sim autofocus>' + esc(ok) + '</button></div></form>', function () { if (!feito) res(false); });
      $('[data-pra-nao]', d).onclick = function () { feito = true; res(false); fecha(); };
      $('[data-pra-sim]', d).onclick = function () { feito = true; res(true); fecha(); };
    });
  }

  /* ---------- tela: produtos ---------- */
  function render(tela, qual) {
    modo = qual || 'produtos'; JPC.garante(S());
    if (modo === 'categorias') return telaCategorias(tela);
    var tot = S().produtos.length;
    tela.innerHTML = '<div id="praRaiz"><div class="cab"><div><h1>Produtos</h1><p>Tudo o que a loja vende. Mude preço e estoque direto na linha; use o botão “Na loja” para esconder um produto sem apagar.</p></div>' +
      '<button type="button" class="btn" data-pra-novo>' + ICONES.mais + ' Novo produto</button></div>' +
      '<div class="pra-resumo" id="praResumo"></div>' +
      '<div class="painel pra-painel"><div class="pra-filtros"><div class="pra-busca"><label for="praBusca">Buscar produto</label><input id="praBusca" type="search" placeholder="Digite o nome" autocomplete="off" value="' + esc(F.termo) + '"></div>' +
      '<div><label for="praCat">Categoria</label><select id="praCat"></select></div></div>' +
      '<div class="filtros" id="praSit" role="group" aria-label="Situação"></div>' +
      '<div class="pra-lote" id="praLote" hidden></div>' +
      '<div class="pra-cabecalho"><label class="pra-todos"><input type="checkbox" id="praTodos"> <span>Marcar todos da lista</span></label><span id="praConta" role="status" aria-live="polite"></span></div>' +
      '<div class="pra-lista" id="praLista"></div></div></div>';
    desenha(); void tot;
  }
  function filtrados() {
    var s = S(), ordem = {}; s.categorias.forEach(function (c, i) { ordem[c.nome] = i; });
    var l = JPL.filtra(s.produtos, { termo: F.termo, cat: F.cat });
    l = l.filter(function (p) {
      if (F.sit === 'ativos') return p.ativo !== false;
      if (F.sit === 'inativos') return p.ativo === false;
      if (F.sit === 'sem') return !(p.estoque > 0);
      if (F.sit === 'baixo') return p.estoque > 0 && p.estoque <= (p.min || 0);
      return true;
    });
    return l.map(function (p, i) { return [p, i]; }).sort(function (a, b) { return (ordem[a[0].cat] - ordem[b[0].cat]) || a[1] - b[1]; }).map(function (x) { return x[0]; });
  }
  function desenha() {
    var s = S(); if (!$('#praRaiz')) return;
    var ps = s.produtos, n = { todos: ps.length, ativos: 0, inativos: 0, sem: 0, baixo: 0 };
    ps.forEach(function (p) { if (p.ativo === false) n.inativos++; else n.ativos++; if (!(p.estoque > 0)) n.sem++; else if (p.estoque <= (p.min || 0)) n.baixo++; });
    $('#praResumo').innerHTML = '<div><b>' + n.todos + '</b><span>produtos</span></div><div><b>' + n.ativos + '</b><span>na loja</span></div><div><b>' + n.inativos + '</b><span>escondidos</span></div><div class="' + (n.sem ? 'alerta' : '') + '"><b>' + n.sem + '</b><span>sem estoque</span></div>';
    $('#praCat').innerHTML = '<option value="">Todas as categorias</option>' + s.categorias.map(function (c) { return '<option' + (c.nome === F.cat ? ' selected' : '') + ' value="' + esc(c.nome) + '">' + esc(c.nome) + '</option>'; }).join('');
    $('#praSit').innerHTML = [['todos', 'Todos'], ['ativos', 'Na loja'], ['inativos', 'Escondidos'], ['sem', 'Sem estoque'], ['baixo', 'Estoque baixo']].map(function (f) {
      return '<button type="button" class="filtro' + (F.sit === f[0] ? ' ativo' : '') + '" aria-pressed="' + (F.sit === f[0]) + '" data-pra-sit="' + f[0] + '">' + f[1] + ' (' + n[f[0]] + ')</button>';
    }).join('');
    linhas();
  }
  function chips(p) {
    var c = [];
    if (p.ativo === false) c.push('<span class="chip cinza">Escondido da loja</span>');
    if (!(p.estoque > 0)) c.push('<span class="chip alerta">Sem estoque</span>'); else if (p.estoque <= (p.min || 0)) c.push('<span class="chip laranja">Estoque baixo</span>');
    if (JPL.emPromocao(p)) c.push('<span class="chip ok">Promoção</span>');
    if (p.dest) c.push('<span class="chip rosa">Destaque</span>');
    return c.join('');
  }
  function linhaHtml(p) {
    var u = JPL.unidade(p), sel = !!F.sel[p.id], off = p.ativo === false;
    return '<article class="prd' + (off ? ' off' : '') + (sel ? ' marcado' : '') + '" data-pid="' + esc(p.id) + '">' +
      '<label class="prd-sel"><input type="checkbox" data-pra-sel="' + esc(p.id) + '"' + (sel ? ' checked' : '') + ' aria-label="Marcar ' + esc(p.nome) + '"></label>' +
      '<button type="button" class="prd-foto" data-pra-foto="' + esc(p.id) + '" aria-label="Trocar a foto de ' + esc(p.nome) + '"><img src="' + esc(foto(p)) + '" alt="" loading="lazy" width="64" height="64"><span>Trocar</span></button>' +
      '<div class="prd-nome"><b>' + esc(p.nome) + '</b><small>' + esc(p.cat || 'Sem categoria') + ' · ' + esc(u.rotulo) + '</small><div class="prd-chips">' + chips(p) + '</div></div>' +
      '<label class="prd-campo prd-preco"><span>Preço (R$)</span><input class="peq" inputmode="decimal" data-pra-campo="preco" value="' + esc(vir(p.preco)) + '"></label>' +
      '<label class="prd-campo prd-estoque"><span>Estoque (' + esc(u.porQuilo ? 'kg' : u.plural) + ')</span><input class="peq" inputmode="decimal" data-pra-campo="estoque" value="' + esc(vir(p.estoque)) + '"></label>' +
      '<label class="prd-onoff"><input type="checkbox" data-pra-ativo="' + esc(p.id) + '"' + (off ? '' : ' checked') + '><span class="trilho" aria-hidden="true"></span><span>Na loja</span></label>' +
      '<div class="prd-acoes"><button type="button" class="btn pequeno" data-pra-edita="' + esc(p.id) + '">Editar</button><button type="button" class="btn pequeno claro" data-pra-dup="' + esc(p.id) + '">Duplicar</button><button type="button" class="btn pequeno claro" data-pra-exclui="' + esc(p.id) + '">Excluir</button></div></article>';
  }
  function linhas() {
    var l = filtrados();
    $('#praLista').innerHTML = l.length ? l.map(linhaHtml).join('') : '<p class="vazio">Nenhum produto encontrado. Mude a busca ou os filtros.</p>';
    $('#praConta').textContent = l.length + ' de ' + S().produtos.length;
    var todos = $('#praTodos'); if (todos) todos.checked = l.length > 0 && l.every(function (p) { return F.sel[p.id]; });
    barraLote();
  }
  function selecionados() { return Object.keys(F.sel).filter(function (id) { return F.sel[id] && prod(id); }); }
  function barraLote() {
    var b = $('#praLote'); if (!b) return; var ids = selecionados();
    b.hidden = !ids.length; if (!ids.length) { b.innerHTML = ''; return; }
    b.innerHTML = '<b>' + plural(ids.length, 'produto marcado', 'produtos marcados') + '</b>' +
      '<button type="button" class="btn pequeno" data-pra-lote="ativar">Mostrar na loja</button><button type="button" class="btn pequeno claro" data-pra-lote="desativar">Esconder da loja</button>' +
      '<button type="button" class="btn pequeno claro" data-pra-lote="categoria">Mudar categoria</button><button type="button" class="btn pequeno claro" data-pra-lote="preco">Ajustar preço</button>' +
      '<button type="button" class="btn pequeno claro" data-pra-lote="excluir">Excluir</button><button type="button" class="btn pequeno linha" data-pra-lote="limpar">Desmarcar</button>';
  }

  /* ---------- editar linha ---------- */
  function mudaCampo(el) {
    var id = el.closest('[data-pid]').dataset.pid, p = prod(id), k = el.dataset.praCampo; if (!p) return;
    var n = numero(el.value);
    if (k === 'preco') {
      if (!(n > 0)) { ctx.toast('O preço precisa ser maior que zero.'); el.value = vir(p.preco); return; }
      p.preco = Math.round(n * 100) / 100; if (p.promo && p.promo >= p.preco) delete p.promo;
      salva('Preço de ' + p.nome + ': ' + JP.brl(p.preco) + '.');
    } else {
      if (n === null || n < 0) { ctx.toast('Informe o estoque (0 ou mais).'); el.value = vir(p.estoque); return; }
      var r = window.JPE ? JPE.ajuste(S(), id, Math.round(n * 100) / 100, { agora: JP.agora(), por: (window.JP_USUARIO || {}).usuario, motivo: 'Ajuste rápido na tela Produtos' }) : { ok: true };
      if (!r.ok && !/igual|mesmo/i.test(r.erro || '')) { ctx.toast(r.erro); el.value = vir(p.estoque); return; }
      if (!window.JPE) p.estoque = Math.round(n * 100) / 100;
      salva('Estoque de ' + p.nome + ': ' + vir(p.estoque) + '.');
    }
    var art = el.closest('.prd'); $('.prd-chips', art).innerHTML = chips(p); el.value = vir(k === 'preco' ? p.preco : p.estoque); resumoSo();
  }
  function resumoSo() { var o = F.sit; desenhaResumoSo(); F.sit = o; }
  function desenhaResumoSo() { /* mantém a lista como está (sem pular a tela) e só refaz os contadores */
    var ps = S().produtos, n = { todos: ps.length, ativos: 0, inativos: 0, sem: 0, baixo: 0 };
    ps.forEach(function (p) { if (p.ativo === false) n.inativos++; else n.ativos++; if (!(p.estoque > 0)) n.sem++; else if (p.estoque <= (p.min || 0)) n.baixo++; });
    $$('#praSit [data-pra-sit]').forEach(function (b) { b.textContent = b.textContent.replace(/\(\d+\)$/, '(' + n[b.dataset.praSit] + ')'); });
    var cx = $$('#praResumo > div'); if (cx.length === 4) { [n.todos, n.ativos, n.inativos, n.sem].forEach(function (v, i) { $('b', cx[i]).textContent = v; }); cx[3].classList.toggle('alerta', n.sem > 0); }
  }

  /* ---------- foto ---------- */
  var alvoFoto = null, entrada = null;
  function escolheFoto(id) {
    alvoFoto = id;
    if (!entrada) { entrada = document.createElement('input'); entrada.type = 'file'; entrada.accept = 'image/*'; entrada.hidden = true; document.body.appendChild(entrada); entrada.addEventListener('change', recebeFoto); }
    entrada.value = ''; entrada.click();
  }
  function reduz(arq) { // até 900 px no maior lado, em WebP (ou JPEG): foto leve para a loja abrir rápido no celular
    return new Promise(function (ok, erro) {
      var url = URL.createObjectURL(arq), im = new Image();
      im.onload = function () {
        var m = 900, r = Math.min(1, m / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(im.naturalWidth * r)); c.height = Math.max(1, Math.round(im.naturalHeight * r));
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        c.toBlob(function (b) { if (b && b.type === 'image/webp') return ok(b); c.toBlob(function (j) { j ? ok(j) : erro(new Error('falhou')); }, 'image/jpeg', .85); }, 'image/webp', .82);
      };
      im.onerror = function () { URL.revokeObjectURL(url); erro(new Error('formato')); }; im.src = url;
    });
  }
  function recebeFoto() {
    var arq = entrada.files && entrada.files[0], id = alvoFoto; if (!arq) return;
    ctx.toast('Enviando a foto…');
    reduz(arq).then(function (b) {
      return fetch('/api/foto-produto', { method: 'POST', headers: { 'Content-Type': b.type, 'X-JP': '1' }, body: b }).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.erro || 'Não foi possível enviar.'); return j; }); });
    }).then(function (j) {
      if (id === '__dialogo') { var im = $('#pdFotoImg'); if (im) { im.src = j.img; im.dataset.novo = j.img; } ctx.toast('Foto pronta. Toque em Salvar para valer.'); return; }
      var p = prod(id); if (!p) return; p.img = j.img; salva('Foto de ' + p.nome + ' trocada.');
      var art = $('.prd[data-pid="' + id.replace(/"/g, '') + '"] img'); if (art) art.src = j.img;
    }).catch(function (e) { ctx.toast(e.message === 'formato' ? 'Não consegui abrir essa imagem. Use JPG, PNG ou WebP.' : e.message || 'Não foi possível enviar a foto.'); });
  }

  /* ---------- criar / editar ---------- */
  var UNIDADES = ['kg', 'unidade', 'pacote', 'bandeja', 'kit', 'caixa'];
  function formProduto(p) {
    var novo = !p, s = S(); p = p || { nome: '', cat: F.cat || (s.categorias[0] || {}).nome || '', un: 'kg', preco: '', estoque: 0, min: 1, img: '' };
    var campo = function (id, rot, extra, valor, dica) { return '<div class="campo"><label for="' + id + '">' + rot + '</label><input id="' + id + '" ' + extra + ' value="' + esc(valor) + '">' + (dica ? '<small>' + dica + '</small>' : '') + '</div>'; };
    var h = '<form class="pra-form pra-edicao" id="praForm" novalidate><h2>' + (novo ? 'Novo produto' : 'Editar produto') + '</h2>' +
      '<div class="pra-fotobox"><img id="pdFotoImg" src="' + esc(p.img ? foto(p) : 'img/marca/logo-julia-96.png') + '" alt="Foto do produto" width="96" height="96"><div><button type="button" class="btn pequeno claro" data-pra-foto="__dialogo">' + (p.img ? 'Trocar foto' : 'Escolher foto') + '</button><small>JPG, PNG ou WebP. A foto é reduzida sozinha.</small></div></div>' +
      '<div class="pra-grade">' + campo('pdNome', 'Nome', 'maxlength="80" required autocomplete="off"', p.nome) +
      '<div class="campo"><label for="pdCat">Categoria</label><select id="pdCat">' + s.categorias.map(function (c) { return '<option' + (c.nome === p.cat ? ' selected' : '') + '>' + esc(c.nome) + '</option>'; }).join('') + '<option value="__nova">+ Criar nova categoria…</option></select></div>' +
      '<div class="campo" id="pdCatNovaBox" hidden><label for="pdCatNova">Nome da nova categoria</label><input id="pdCatNova" maxlength="40" autocomplete="off"></div>' +
      '<div class="campo"><label for="pdUn">Vendido por</label><input id="pdUn" list="pdUns" maxlength="20" value="' + esc(p.un) + '"><datalist id="pdUns">' + UNIDADES.map(function (u) { return '<option value="' + u + '">'; }).join('') + '</datalist></div>' +
      campo('pdPreco', 'Preço (R$)', 'inputmode="decimal" required', p.preco === '' ? '' : vir(p.preco)) +
      campo('pdPromo', 'Promoção (R$)', 'inputmode="decimal" placeholder="Sem promoção"', p.promo ? vir(p.promo) : '', 'Vazio tira a promoção.') +
      campo('pdEstoque', 'Estoque', 'inputmode="decimal"', vir(p.estoque || 0)) +
      campo('pdMin', 'Avisar quando restar até', 'inputmode="decimal"', vir(p.min == null ? 1 : p.min)) + '</div>' +
      '<div class="pra-marcas"><label class="lja-chk"><input type="checkbox" id="pdAtivo"' + (p.ativo === false ? '' : ' checked') + '><span>Aparece na loja</span></label>' +
      '<label class="lja-chk"><input type="checkbox" id="pdDest"' + (p.dest ? ' checked' : '') + '><span>Destaque (vai para o topo)</span></label></div>' +
      '<div class="campo"><label for="pdDesc">Descrição (opcional)</label><textarea id="pdDesc" rows="2" maxlength="300">' + esc(p.desc || '') + '</textarea></div>' +
      '<details class="pra-mais"><summary>Mais opções</summary><div class="pra-grade">' +
      '<div class="campo largo"><label for="pdDica">Dica de preparo</label><textarea id="pdDica" rows="2" maxlength="300">' + esc(p.dica || '') + '</textarea></div>' +
      '<div class="campo"><label for="pdFracao">Venda fracionada</label><select id="pdFracao"><option value="auto"' + (p.fracionado == null ? ' selected' : '') + '>Automático</option><option value="sim"' + (p.fracionado === true ? ' selected' : '') + '>Aceita meio quilo</option><option value="nao"' + (p.fracionado === false ? ' selected' : '') + '>Só inteiro</option></select></div>' +
      campo('pdPeso', 'Peso aproximado da unidade (kg)', 'inputmode="decimal"', p.pesoAprox ? vir(p.pesoAprox) : '') + '</div></details>' +
      '<p class="pra-erro" id="pdErro" role="alert" hidden></p>' +
      '<div class="pra-botoes"><button type="button" class="btn claro" data-pra-fecha>Cancelar</button><button type="submit" class="btn mar">' + (novo ? 'Criar produto' : 'Salvar') + '</button></div></form>';
    var d = abre(h);
    $('#pdCat', d).addEventListener('change', function () { $('#pdCatNovaBox', d).hidden = this.value !== '__nova'; if (this.value === '__nova') $('#pdCatNova', d).focus(); });
    $('#praForm', d).addEventListener('submit', function (e) { e.preventDefault(); salvaForm(d, novo ? null : p.id); });
  }
  function salvaForm(d, id) {
    var v = function (s) { return $(s, d).value; }, erro = function (m) { var e = $('#pdErro', d); e.textContent = m; e.hidden = false; e.scrollIntoView({ block: 'nearest' }); return false; };
    var cat = v('#pdCat') === '__nova' ? v('#pdCatNova') : v('#pdCat');
    var preco = numero(v('#pdPreco')), est = numero(v('#pdEstoque')), min = numero(v('#pdMin')), promo = v('#pdPromo').trim() === '' ? null : numero(v('#pdPromo')), peso = v('#pdPeso').trim() === '' ? null : numero(v('#pdPeso'));
    if (!v('#pdNome').trim()) return erro('Escreva o nome do produto.');
    if (!(preco > 0)) return erro('O preço precisa ser maior que zero.');
    if (promo !== null && !(promo > 0 && promo < preco)) return erro('A promoção precisa ser menor que o preço normal.');
    if (est === null || est < 0) return erro('Informe o estoque (0 ou mais).');
    if (peso !== null && !(peso > 0)) return erro('Informe o peso em quilos, por exemplo 0,4.');
    if (!cat.trim()) return erro('Escreva o nome da nova categoria.');
    var img = $('#pdFotoImg', d).dataset.novo || '', s = S(), p;
    if (!id) {
      var r = JPC.criaProduto(s, { nome: v('#pdNome'), cat: cat, un: v('#pdUn'), preco: preco, estoque: est, min: min, desc: v('#pdDesc'), img: img }); if (!r.ok) return erro(r.erro);
      p = r.produto;
    } else {
      p = prod(id); var r0 = Math.round(est * 100) / 100;
      if (p.estoque !== r0 && window.JPE) { var ra = JPE.ajuste(s, id, r0, { agora: JP.agora(), por: (window.JP_USUARIO || {}).usuario, motivo: 'Ajuste ao editar o produto' }); if (!ra.ok) return erro(ra.erro); } else p.estoque = r0;
      p.nome = v('#pdNome').trim().slice(0, 80); p.un = v('#pdUn').trim().slice(0, 20) || p.un; p.preco = Math.round(preco * 100) / 100; p.min = min == null ? p.min : min;
      var mv = JPC.moveProdutos(s, [id], cat); if (!mv.ok) return erro(mv.erro);
      if (img) p.img = img;
    }
    if (promo === null) delete p.promo; else p.promo = Math.round(promo * 100) / 100;
    if ($('#pdAtivo', d).checked) delete p.ativo; else p.ativo = false;
    if ($('#pdDest', d).checked) p.dest = true; else delete p.dest;
    ['desc', 'dica'].forEach(function (k) { var t = v(k === 'desc' ? '#pdDesc' : '#pdDica').trim(); if (t) p[k] = t; else delete p[k]; });
    var fr = v('#pdFracao'); if (fr === 'auto') delete p.fracionado; else p.fracionado = fr === 'sim';
    if (peso === null) delete p.pesoAprox; else p.pesoAprox = peso;
    fecha(); salva(id ? 'Salvo: ' + p.nome + '.' : 'Produto criado: ' + p.nome + '.'); JPC.garante(s); desenha();
  }

  /* ---------- lote, duplicar, excluir ---------- */
  function lote(acao) {
    var ids = selecionados(), s = S(); if (!ids.length) return;
    if (acao === 'limpar') { F.sel = {}; linhas(); return; }
    if (acao === 'ativar' || acao === 'desativar') { var r = JPC.emLote(s, cfgLoja(), ids, acao); salva(plural(r.n, 'produto', 'produtos') + (acao === 'ativar' ? ' na loja.' : ' escondido(s) da loja.')); desenha(); return; }
    if (acao === 'excluir') {
      confirma('Excluir ' + plural(ids.length, 'produto', 'produtos') + '?', 'Isso apaga os produtos marcados e não tem volta. Os que estão em kit, combo ou pedido em andamento são mantidos. Para só tirar da loja, use “Esconder da loja”.', 'Excluir', true).then(function (ok) {
        if (!ok) return; var r2 = JPC.emLote(s, cfgLoja(), ids, 'excluir'); r2 && ids.forEach(function (id) { if (!prod(id)) delete F.sel[id]; });
        salva(plural(r2.n, 'produto excluído', 'produtos excluídos') + '.' + (r2.recusados.length ? ' Mantidos por estarem em uso: ' + r2.recusados.join(', ') + '.' : '')); JPC.garante(s); desenha();
      }); return;
    }
    if (acao === 'categoria') {
      var d = abre('<form class="pra-form" id="praForm2"><h2>Mudar categoria</h2><p>' + plural(ids.length, 'produto marcado vai', 'produtos marcados vão') + ' para:</p><div class="campo"><label for="lcCat">Categoria</label><select id="lcCat">' +
        s.categorias.map(function (c) { return '<option>' + esc(c.nome) + '</option>'; }).join('') + '</select></div><div class="pra-botoes"><button type="button" class="btn claro" data-pra-fecha>Cancelar</button><button type="submit" class="btn mar">Mudar</button></div></form>');
      $('#praForm2', d).addEventListener('submit', function (e) { e.preventDefault(); var r3 = JPC.emLote(s, cfgLoja(), ids, 'categoria', { cat: $('#lcCat', d).value }); fecha(); salva(plural(r3.n, 'produto movido', 'produtos movidos') + '.'); desenha(); });
      return;
    }
    if (acao === 'preco') {
      var d2 = abre('<form class="pra-form" id="praForm3"><h2>Ajustar preço</h2><p>Vale para ' + plural(ids.length, 'produto marcado', 'produtos marcados') + '. Promoções que ficarem acima do novo preço são retiradas.</p>' +
        '<div class="campo"><label for="lpModo">Como ajustar</label><select id="lpModo"><option value="percentual">Aumentar ou diminuir em %</option><option value="somar">Somar ou tirar um valor em R$</option><option value="fixo">Definir o mesmo preço para todos</option></select></div>' +
        '<div class="campo"><label for="lpValor" id="lpRot">Percentual (use sinal de menos para baixar)</label><input id="lpValor" inputmode="decimal" placeholder="Ex.: 5 ou -10" autocomplete="off"></div>' +
        '<p class="pra-previa" id="lpPrevia" aria-live="polite"></p><p class="pra-erro" id="lpErro" role="alert" hidden></p>' +
        '<div class="pra-botoes"><button type="button" class="btn claro" data-pra-fecha>Cancelar</button><button type="submit" class="btn mar">Aplicar</button></div></form>');
      var previa = function () {
        var m = $('#lpModo', d2).value, n = numero($('#lpValor', d2).value), p0 = prod(ids[0]); $('#lpRot', d2).textContent = m === 'percentual' ? 'Percentual (use sinal de menos para baixar)' : m === 'somar' ? 'Valor em R$ (use sinal de menos para baixar)' : 'Novo preço em R$';
        if (n === null || !p0) { $('#lpPrevia', d2).textContent = ''; return; } var c = { preco: p0.preco }; $('#lpPrevia', d2).textContent = JPC.ajustaPreco(c, m, n) ? 'Exemplo: ' + p0.nome + ' vai de ' + JP.brl(p0.preco) + ' para ' + JP.brl(c.preco) + '.' : 'Esse valor deixaria o preço zerado.';
      };
      $('#lpModo', d2).addEventListener('change', previa); $('#lpValor', d2).addEventListener('input', previa);
      $('#praForm3', d2).addEventListener('submit', function (e) {
        e.preventDefault(); var n = numero($('#lpValor', d2).value); if (n === null) { var er = $('#lpErro', d2); er.textContent = 'Informe o valor.'; er.hidden = false; return; }
        var r4 = JPC.emLote(s, cfgLoja(), ids, 'preco', { modo: $('#lpModo', d2).value, valor: n }); fecha();
        salva(plural(r4.n, 'preço ajustado', 'preços ajustados') + '.' + (r4.recusados.length ? ' Ignorados (ficariam zerados): ' + r4.recusados.join(', ') + '.' : '')); desenha();
      });
    }
  }
  function duplica(id) { var r = JPC.duplicaProduto(S(), id); if (!r.ok) { ctx.toast(r.erro); return; } salva('Cópia criada, escondida da loja. Ajuste o nome e mostre quando estiver pronta.'); F.termo = ''; desenha(); formProduto(r.produto); }
  function exclui(id) {
    var p = prod(id); if (!p) return; var uso = JPC.usoDoProduto(S(), cfgLoja(), id);
    if (uso.length) { abre('<div class="pra-form"><h2>Não dá para excluir</h2><p><b>' + esc(p.nome) + '</b> está em ' + esc(uso.join(', ')) + '. Tire-o de lá primeiro, ou apenas esconda o produto da loja.</p><div class="pra-botoes"><button type="button" class="btn claro" data-pra-fecha>Entendi</button><button type="button" class="btn mar" data-pra-esconde="' + esc(id) + '">Esconder da loja</button></div></div>'); return; }
    confirma('Excluir ' + p.nome + '?', 'O produto sai do catálogo e não tem volta. Pedidos antigos continuam com o nome dele. Se só quer tirar da loja por um tempo, use “Na loja”.', 'Excluir produto', true).then(function (ok) {
      if (!ok) return; var r = JPC.excluiProduto(S(), cfgLoja(), id); if (!r.ok) { ctx.toast(r.erro); return; } delete F.sel[id]; salva('Produto excluído: ' + p.nome + '.'); desenha();
    });
  }

  /* ---------- tela: categorias ---------- */
  function telaCategorias(tela) {
    var s = S();
    tela.innerHTML = '<div id="praRaiz"><div class="cab"><div><h1>Categorias</h1><p>Os grupos da loja, na ordem em que o cliente vê. Uma categoria desligada some da loja com todos os produtos dela.</p></div></div>' +
      '<div class="painel pra-painel"><form class="pra-nova" id="praNovaCat" autocomplete="off"><div class="campo"><label for="ncNome">Nova categoria</label><input id="ncNome" maxlength="40" placeholder="Ex.: Molhos e temperos"></div><button type="submit" class="btn">' + ICONES.mais + ' Adicionar</button></form>' +
      '<p class="pra-erro" id="ncErro" role="alert" hidden></p><ol class="pra-cats" id="praCats"></ol></div></div>';
    void s; desenhaCats();
  }
  function desenhaCats() {
    var s = S(), l = $('#praCats'); if (!l) return;
    l.innerHTML = s.categorias.map(function (c, i) {
      var n = JPC.contagem(s, c.nome), q = n.total ? plural(n.total, 'produto', 'produtos') + (n.ativos !== n.total ? ' (' + n.ativos + ' na loja)' : '') : 'Nenhum produto';
      return '<li class="cat' + (c.ativa ? '' : ' off') + '" data-cat="' + esc(c.nome) + '"><div class="cat-ordem"><button type="button" class="btn pequeno claro" data-pra-sobe="' + esc(c.nome) + '" aria-label="Subir ' + esc(c.nome) + '"' + (i === 0 ? ' disabled' : '') + '>' + ICONES.cima + '</button><button type="button" class="btn pequeno claro" data-pra-desce="' + esc(c.nome) + '" aria-label="Descer ' + esc(c.nome) + '"' + (i === s.categorias.length - 1 ? ' disabled' : '') + '>' + ICONES.baixo + '</button></div>' +
        '<div class="cat-nome"><b>' + esc(c.nome) + '</b><small>' + q + (c.ativa ? '' : ' · escondida da loja') + '</small></div>' +
        '<label class="prd-onoff"><input type="checkbox" data-pra-cat-ativa="' + esc(c.nome) + '"' + (c.ativa ? ' checked' : '') + '><span class="trilho" aria-hidden="true"></span><span>Na loja</span></label>' +
        '<div class="prd-acoes"><a class="btn pequeno" href="#produtos" data-pra-ver="' + esc(c.nome) + '">Ver produtos</a><button type="button" class="btn pequeno claro" data-pra-renomeia="' + esc(c.nome) + '">Renomear</button><button type="button" class="btn pequeno claro" data-pra-move="' + esc(c.nome) + '"' + (n.total ? '' : ' disabled') + '>Mover produtos</button><button type="button" class="btn pequeno claro" data-pra-cat-exclui="' + esc(c.nome) + '">Excluir</button></div></li>';
    }).join('') || '<li class="vazio">Nenhuma categoria ainda. Crie a primeira acima.</li>';
  }
  function renomeia(nome) {
    var d = abre('<form class="pra-form" id="praForm4"><h2>Renomear categoria</h2><div class="campo"><label for="rnNome">Novo nome</label><input id="rnNome" maxlength="40" value="' + esc(nome) + '" autocomplete="off"></div><p class="pra-erro" id="rnErro" role="alert" hidden></p><div class="pra-botoes"><button type="button" class="btn claro" data-pra-fecha>Cancelar</button><button type="submit" class="btn mar">Salvar</button></div></form>');
    $('#rnNome', d).select();
    $('#praForm4', d).addEventListener('submit', function (e) { e.preventDefault(); var r = JPC.renomeiaCategoria(S(), nome, $('#rnNome', d).value); if (!r.ok) { var er = $('#rnErro', d); er.textContent = r.erro; er.hidden = false; return; } fecha(); salva('Categoria renomeada para ' + r.nome + '.'); desenhaCats(); });
  }
  function movePcat(nome) {
    var s = S(), ps = s.produtos.filter(function (p) { return p.cat === nome; }), outras = s.categorias.filter(function (c) { return c.nome !== nome; });
    var d = abre('<form class="pra-form" id="praForm5"><h2>Mover produtos de ' + esc(nome) + '</h2><div class="campo"><label for="mpDest">Mover para</label><select id="mpDest">' + outras.map(function (c) { return '<option>' + esc(c.nome) + '</option>'; }).join('') + '<option value="__nova">+ Criar nova categoria…</option></select></div>' +
      '<div class="campo" id="mpNovaBox" hidden><label for="mpNova">Nome da nova categoria</label><input id="mpNova" maxlength="40" autocomplete="off"></div>' +
      '<fieldset class="pra-escolha"><legend>Quais produtos</legend><label class="lja-chk"><input type="checkbox" id="mpTodos" checked><span><b>Todos</b></span></label>' +
      ps.map(function (p) { return '<label class="lja-chk"><input type="checkbox" data-mp="' + esc(p.id) + '" checked><span>' + esc(p.nome) + '</span></label>'; }).join('') + '</fieldset>' +
      '<p class="pra-erro" id="mpErro" role="alert" hidden></p><div class="pra-botoes"><button type="button" class="btn claro" data-pra-fecha>Cancelar</button><button type="submit" class="btn mar">Mover</button></div></form>');
    $('#mpDest', d).addEventListener('change', function () { $('#mpNovaBox', d).hidden = this.value !== '__nova'; });
    $('#mpTodos', d).addEventListener('change', function () { var v = this.checked; $$('[data-mp]', d).forEach(function (x) { x.checked = v; }); });
    $('#praForm5', d).addEventListener('submit', function (e) {
      e.preventDefault(); var ids = $$('[data-mp]', d).filter(function (x) { return x.checked; }).map(function (x) { return x.dataset.mp; }), dest = $('#mpDest', d).value === '__nova' ? $('#mpNova', d).value : $('#mpDest', d).value;
      var er = $('#mpErro', d); if (!ids.length) { er.textContent = 'Marque pelo menos um produto.'; er.hidden = false; return; }
      var r = JPC.moveProdutos(S(), ids, dest); if (!r.ok) { er.textContent = r.erro; er.hidden = false; return; } fecha(); salva(plural(r.n, 'produto movido', 'produtos movidos') + ' para ' + dest + '.'); desenhaCats();
    });
  }

  /* ---------- eventos ---------- */
  function init(c) {
    ctx = c;
    document.addEventListener('click', function (e) {
      var t = e.target.closest('button, a[data-pra-ver]'); if (!t || !$('#praRaiz') && !t.closest('dialog')) return; var d = t.dataset;
      if (t.hasAttribute('data-pra-fecha')) fecha();
      else if (t.hasAttribute('data-pra-novo')) formProduto(null);
      else if (d.praEdita) formProduto(prod(d.praEdita));
      else if (d.praDup) duplica(d.praDup);
      else if (d.praExclui) exclui(d.praExclui);
      else if (d.praFoto) escolheFoto(d.praFoto);
      else if (d.praSit) { F.sit = d.praSit; desenha(); }
      else if (d.praLote) lote(d.praLote);
      else if (d.praEsconde) { JPC.ativaProduto(S(), d.praEsconde, false); fecha(); salva('Produto escondido da loja.'); desenha(); }
      else if (d.praSobe || d.praDesce) { var r = JPC.moveCategoria(S(), d.praSobe || d.praDesce, d.praSobe ? -1 : 1); if (r.ok) { JP.salvar(); desenhaCats(); var again = $('[data-pra-' + (d.praSobe ? 'sobe' : 'desce') + '="' + (d.praSobe || d.praDesce).replace(/"/g, '\\"') + '"]'); if (again && !again.disabled) again.focus(); } }
      else if (d.praRenomeia) renomeia(d.praRenomeia);
      else if (d.praMove) movePcat(d.praMove);
      else if (d.praCatExclui) {
        var n = JPC.contagem(S(), d.praCatExclui).total;
        if (n) { ctx.toast('Esta categoria tem ' + plural(n, 'produto', 'produtos') + '. Mova-os para outra antes de excluir.'); return; }
        confirma('Excluir a categoria ' + d.praCatExclui + '?', 'Ela está vazia. A exclusão não tem volta.', 'Excluir categoria', true).then(function (ok) { if (!ok) return; var r2 = JPC.excluiCategoria(S(), d.praCatExclui); if (r2.ok) { salva('Categoria excluída.'); desenhaCats(); } else ctx.toast(r2.erro); });
      }
      else if (d.praVer) { F.cat = d.praVer; F.sit = 'todos'; F.termo = ''; }
    });
    document.addEventListener('change', function (e) {
      var el = e.target; if (!$('#praRaiz')) return;
      if (el.id === 'praCat') { F.cat = el.value; linhas(); }
      else if (el.id === 'praTodos') { filtrados().forEach(function (p) { if (el.checked) F.sel[p.id] = true; else delete F.sel[p.id]; }); linhas(); }
      else if (el.dataset.praSel) { if (el.checked) F.sel[el.dataset.praSel] = true; else delete F.sel[el.dataset.praSel]; el.closest('.prd').classList.toggle('marcado', el.checked); barraLote(); var l = filtrados(); $('#praTodos').checked = l.length > 0 && l.every(function (p) { return F.sel[p.id]; }); }
      else if (el.dataset.praCampo) mudaCampo(el);
      else if (el.dataset.praAtivo) { JPC.ativaProduto(S(), el.dataset.praAtivo, el.checked); var p = prod(el.dataset.praAtivo); salva(p.nome + (el.checked ? ' aparece na loja.' : ' escondido da loja.')); var art = el.closest('.prd'); art.classList.toggle('off', !el.checked); $('.prd-chips', art).innerHTML = chips(p); resumoSo(); if (F.sit === 'ativos' || F.sit === 'inativos') setTimeout(desenha, 350); }
      else if (el.dataset.praCatAtiva) { JPC.ativaCategoria(S(), el.dataset.praCatAtiva, el.checked); salva(el.dataset.praCatAtiva + (el.checked ? ' aparece na loja.' : ' escondida da loja, com os produtos.')); desenhaCats(); }
    });
    document.addEventListener('input', function (e) { if (e.target.id === 'praBusca') { F.termo = e.target.value; linhas(); } });
    document.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.dataset && e.target.dataset.praCampo) e.target.blur(); });
    document.addEventListener('submit', function (e) {
      if (e.target.id !== 'praNovaCat') return; e.preventDefault();
      var r = JPC.criaCategoria(S(), $('#ncNome').value), er = $('#ncErro');
      if (!r.ok) { er.textContent = r.erro; er.hidden = false; $('#ncNome').focus(); return; }
      er.hidden = true; salva('Categoria criada: ' + r.nome + '.'); $('#ncNome').value = ''; desenhaCats();
    });
  }

  window.PRA = { init: init, render: render };
})();
