/* Painel da Júlia — "Loja online": o que a loja pública mostra e cobra.
   Produtos (preço, promoção, estoque, destaque, fração, descrição, dica), combos, frete por bairro, pedido mínimo,
   horário de funcionamento e textos. Cada mudança é gravada na hora e a loja pública atualiza em até um minuto. */
(function () {
  var ctx = null, aba = 'produtos';
  var F = { termo: '', cat: '', abertos: {} };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var CHAVE = 'jp_loja_v1';
  var DIAS = [['1', 'Segunda-feira'], ['2', 'Terça-feira'], ['3', 'Quarta-feira'], ['4', 'Quinta-feira'], ['5', 'Sexta-feira'], ['6', 'Sábado'], ['0', 'Domingo']];

  function esc(t) { return ctx.esc(t); }
  function S() { return ctx.estado(); }
  function brl(v) { return JP.brl(v); }
  function cfgLer() { var s = null; try { s = JSON.parse(localStorage.getItem(CHAVE) || 'null'); } catch (e) {} return JPL.mescla(s); }
  var cfg = null;
  function cfgSalvar(msg) { localStorage.setItem(CHAVE, JSON.stringify(cfg)); ctx.toast(msg || 'Salvo. A loja atualiza em até um minuto.'); }
  function salvaProdutos(msg) { JP.salvar(); ctx.toast(msg || 'Salvo. A loja atualiza em até um minuto.'); }
  function prod(id) { return S().produtos.filter(function (p) { return p.id === id; })[0]; }
  function numero(v) { var n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? null : n; }

  var ABAS = [['produtos', 'Produtos'], ['combos', 'Combos'], ['entrega', 'Frete e mínimo'], ['horario', 'Horário'], ['textos', 'Textos e contato']];

  function render(tela) {
    cfg = cfgLer();
    tela.innerHTML = '<div class="cab"><div><h1>Loja online</h1><p>Tudo o que o cliente vê no site: preços, estoque, destaques, combos, frete, pedido mínimo e horário. Cada mudança vale na hora, sem precisar de botão de publicar.</p></div><a class="btn pequeno claro" href="/" target="_blank" rel="noopener">Ver a loja ↗</a></div>' +
      '<div class="filtros" role="tablist" aria-label="Partes da loja">' + ABAS.map(function (a) { return '<button type="button" class="filtro' + (aba === a[0] ? ' ativo' : '') + '" role="tab" aria-selected="' + (aba === a[0]) + '" data-lja-aba="' + a[0] + '">' + a[1] + '</button>'; }).join('') + '</div>' +
      '<div id="ljaCorpo"></div>';
    desenha();
  }
  function desenha() {
    var c = $('#ljaCorpo'); if (!c) return;
    ({ produtos: produtos, combos: combos, entrega: entrega, horario: horario, textos: textos })[aba](c);
  }

  /* ---------- produtos ---------- */
  function cats() { return S().produtos.reduce(function (l, p) { if (p.cat && l.indexOf(p.cat) < 0) l.push(p.cat); return l; }, []); }
  function produtos(c) {
    c.innerHTML = '<div class="painel"><h2>Produtos <small id="ljaConta"></small></h2>' +
      '<div class="lja-filtros"><input class="peq" id="ljaBusca" type="search" placeholder="Buscar produto" aria-label="Buscar produto" value="' + esc(F.termo) + '">' +
      '<select class="peq" id="ljaCat" aria-label="Categoria"><option value="">Todas as categorias</option>' + cats().map(function (k) { return '<option' + (k === F.cat ? ' selected' : '') + '>' + esc(k) + '</option>'; }).join('') + '</select></div>' +
      '<p class="lja-dica">Promoção: deixe vazio para tirar. Estoque em quilos aceita meio quilo (0,5). “Destaque” leva o produto para o topo da loja.</p>' +
      '<div class="rolagem"><table class="lja-tab"><thead><tr><th>Produto</th><th class="num">Preço (R$)</th><th class="num">Promoção (R$)</th><th class="num">Estoque</th><th>Destaque</th><th>Fração</th><th></th></tr></thead><tbody id="ljaLinhas"></tbody></table></div></div>';
    linhas();
  }
  function linhaProd(p) {
    var u = JPL.unidade(p), ab = F.abertos[p.id];
    return '<tr data-pid="' + esc(p.id) + '"><td><b>' + esc(p.nome) + '</b><small>' + esc(p.cat) + ' · ' + esc(u.rotulo) + '</small></td>' +
      '<td class="num"><input class="peq lja-num" inputmode="decimal" data-campo="preco" aria-label="Preço de ' + esc(p.nome) + '" value="' + esc(String(p.preco).replace('.', ',')) + '"></td>' +
      '<td class="num"><input class="peq lja-num" inputmode="decimal" data-campo="promo" aria-label="Promoção de ' + esc(p.nome) + '" placeholder="—" value="' + (p.promo ? esc(String(p.promo).replace('.', ',')) : '') + '"></td>' +
      '<td class="num"><input class="peq lja-num" inputmode="decimal" data-campo="estoque" aria-label="Estoque de ' + esc(p.nome) + '" value="' + esc(String(p.estoque).replace('.', ',')) + '"> <small>' + (u.porQuilo ? 'kg' : esc(u.plural)) + '</small></td>' +
      '<td><label class="lja-chk"><input type="checkbox" data-campo="dest"' + (p.dest ? ' checked' : '') + ' aria-label="Destaque: ' + esc(p.nome) + '"><span>Destaque</span></label></td>' +
      '<td><select class="peq" data-campo="fracionado" aria-label="Fração de ' + esc(p.nome) + '"><option value="auto"' + (p.fracionado == null ? ' selected' : '') + '>Automático</option><option value="sim"' + (p.fracionado === true ? ' selected' : '') + '>Aceita 0,5</option><option value="nao"' + (p.fracionado === false ? ' selected' : '') + '>Só inteiro</option></select></td>' +
      '<td><button type="button" class="btn pequeno claro" data-lja-det="' + esc(p.id) + '" aria-expanded="' + !!ab + '">' + (ab ? 'Fechar' : 'Detalhes') + '</button></td></tr>' +
      (ab ? '<tr class="lja-det" data-pid="' + esc(p.id) + '"><td colspan="7"><div class="lja-det-grade">' +
        '<div class="campo largo"><label for="d-desc-' + esc(p.id) + '">Descrição (opcional)</label><textarea id="d-desc-' + esc(p.id) + '" rows="2" maxlength="300" data-campo="desc">' + esc(p.desc || '') + '</textarea></div>' +
        '<div class="campo largo"><label for="d-dica-' + esc(p.id) + '">Dica de preparo (opcional)</label><textarea id="d-dica-' + esc(p.id) + '" rows="2" maxlength="300" data-campo="dica" placeholder="Ex.: descongele na geladeira e refogue 3 minutos">' + esc(p.dica || '') + '</textarea></div>' +
        (u.porQuilo ? '' : '<div class="campo"><label for="d-peso-' + esc(p.id) + '">Peso aproximado de cada ' + esc(u.curto) + ' (kg, opcional)</label><input id="d-peso-' + esc(p.id) + '" inputmode="decimal" data-campo="pesoAprox" value="' + (p.pesoAprox ? esc(String(p.pesoAprox).replace('.', ',')) : '') + '" placeholder="Ex.: 0,4"></div>') +
        '</div></td></tr>' : '');
  }
  function linhas() {
    var lista = JPL.filtra(S().produtos, { termo: F.termo, cat: F.cat });
    $('#ljaLinhas').innerHTML = lista.length ? lista.map(linhaProd).join('') : '<tr><td colspan="7" class="vazio">Nenhum produto encontrado.</td></tr>';
    $('#ljaConta').textContent = lista.length + ' de ' + S().produtos.length;
  }
  function mudaProduto(el) {
    var id = el.closest('[data-pid]').dataset.pid, p = prod(id), k = el.dataset.campo; if (!p) return;
    var v = el.type === 'checkbox' ? el.checked : el.value;
    if (k === 'preco') { var n = numero(v); if (!(n > 0)) { ctx.toast('O preço precisa ser maior que zero.'); el.value = String(p.preco).replace('.', ','); return; } p.preco = Math.round(n * 100) / 100; if (p.promo && p.promo >= p.preco) delete p.promo; }
    else if (k === 'promo') { if (String(v).trim() === '') delete p.promo; else { var m = numero(v); if (!(m > 0) || m >= p.preco) { ctx.toast('A promoção precisa ser menor que o preço normal.'); el.value = p.promo ? String(p.promo).replace('.', ',') : ''; return; } p.promo = Math.round(m * 100) / 100; } }
    else if (k === 'estoque') { var e = numero(v); if (e === null || e < 0) { ctx.toast('Informe o estoque (0 ou mais).'); el.value = String(p.estoque).replace('.', ','); return; } p.estoque = Math.round(e * 100) / 100; }
    else if (k === 'dest') { if (v) p.dest = true; else delete p.dest; }
    else if (k === 'fracionado') { if (v === 'auto') delete p.fracionado; else p.fracionado = v === 'sim'; }
    else if (k === 'pesoAprox') { var w = numero(v); if (String(v).trim() === '') delete p.pesoAprox; else if (w > 0) p.pesoAprox = w; else { ctx.toast('Informe o peso em quilos, por exemplo 0,4.'); return; } }
    else if (k === 'desc' || k === 'dica') { var t = String(v).trim(); if (t) p[k] = t; else delete p[k]; }
    salvaProdutos('Salvo: ' + p.nome + '.');
    if (k === 'preco' || k === 'promo') { var tr = el.closest('tr'); $$('[data-campo="promo"]', tr).forEach(function (x) { x.value = p.promo ? String(p.promo).replace('.', ',') : ''; }); }
  }

  /* ---------- combos ---------- */
  function combos(c) {
    var ps = S().produtos;
    c.innerHTML = '<div class="painel"><h2>Combos <small>kits que aparecem em destaque na loja</small><button type="button" class="btn pequeno" data-lja-novo-combo>Novo combo</button></h2>' +
      '<p class="lja-dica">Deixe o preço vazio para cobrar a soma dos itens. O combo só aparece na loja se todos os itens tiverem estoque. Ao confirmar o pedido, a baixa é feita item por item.</p>' +
      (cfg.combos.length ? cfg.combos.map(function (cb, i) {
        var soma = JPL.precoSeparado(cb, ps), preco = +cb.preco > 0 ? +cb.preco : soma, ok = JPL.comboDisponivel(cb, ps);
        return '<section class="lja-combo" data-ci="' + i + '"><div class="lja-combo-cab"><label class="lja-chk"><input type="checkbox" data-cc="ativo"' + (cb.ativo !== false ? ' checked' : '') + '><span>Ativo na loja</span></label>' +
          '<span class="chip ' + (ok ? 'ok' : 'alerta') + '">' + (ok ? 'Disponível' : 'Falta estoque ou item') + '</span><button type="button" class="btn pequeno claro" data-lja-del-combo="' + i + '">Remover combo</button></div>' +
          '<div class="lja-grade2"><div class="campo"><label for="cb-nome-' + i + '">Nome</label><input id="cb-nome-' + i + '" data-cc="nome" maxlength="60" value="' + esc(cb.nome) + '"></div>' +
          '<div class="campo"><label for="cb-preco-' + i + '">Preço do combo (R$)</label><input id="cb-preco-' + i + '" data-cc="preco" inputmode="decimal" placeholder="Soma: ' + esc(String(soma).replace('.', ',')) + '" value="' + (+cb.preco > 0 ? esc(String(cb.preco).replace('.', ',')) : '') + '"></div>' +
          '<div class="campo largo"><label for="cb-desc-' + i + '">Descrição</label><input id="cb-desc-' + i + '" data-cc="desc" maxlength="200" value="' + esc(cb.desc || '') + '"></div></div>' +
          '<table class="lja-tab"><thead><tr><th>Item</th><th class="num">Quantidade</th><th class="num">Avulso</th><th></th></tr></thead><tbody>' +
          (cb.itens || []).map(function (it, j) {
            var p = prod(it[0]);
            return '<tr data-cj="' + j + '"><td>' + (p ? esc(p.nome) : '<em>item removido do catálogo</em>') + '</td><td class="num"><input class="peq lja-num" inputmode="decimal" data-ci-q aria-label="Quantidade" value="' + esc(String(it[1]).replace('.', ',')) + '"> ' + (p ? esc(JPL.unidade(p).porQuilo ? 'kg' : JPL.unidade(p).plural) : '') + '</td><td class="num">' + (p ? brl(JPL.precoEfetivo(p) * it[1]) : '—') + '</td><td><button type="button" class="btn pequeno claro" data-lja-del-item="' + i + ':' + j + '" aria-label="Tirar item">Tirar</button></td></tr>';
          }).join('') + '</tbody></table>' +
          '<div class="lja-add"><select class="peq" data-add-sel aria-label="Produto para incluir"><option value="">Incluir produto…</option>' + ps.map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.nome) + '</option>'; }).join('') + '</select><button type="button" class="btn pequeno" data-lja-add-item="' + i + '">Incluir</button></div>' +
          '<p class="lja-soma">Soma dos itens avulsos: <b>' + brl(soma) + '</b> · Preço na loja: <b>' + brl(preco) + '</b>' + (preco < soma ? ' · cliente economiza <b>' + brl(soma - preco) + '</b>' : '') + '</p></section>';
      }).join('') : '<p class="vazio">Nenhum combo ainda. Toque em “Novo combo”.</p>') + '</div>';
  }
  function mudaCombo(el) {
    var sec = el.closest('[data-ci]'), cb = cfg.combos[+sec.dataset.ci], k = el.dataset.cc; if (!cb) return;
    if (k === 'ativo') cb.ativo = el.checked;
    else if (k === 'nome') { if (!el.value.trim()) { ctx.toast('O combo precisa de um nome.'); el.value = cb.nome; return; } cb.nome = el.value.trim(); }
    else if (k === 'desc') cb.desc = el.value.trim();
    else if (k === 'preco') { if (el.value.trim() === '') cb.preco = 0; else { var n = numero(el.value); if (!(n > 0)) { ctx.toast('Informe um preço maior que zero, ou deixe vazio para a soma dos itens.'); return; } cb.preco = Math.round(n * 100) / 100; } }
    cfgSalvar('Combo salvo.'); desenha();
  }

  /* ---------- frete e mínimo ---------- */
  function entrega(c) {
    c.innerHTML = '<div class="painel"><h2>Pedido mínimo</h2><div class="lja-grade2"><div class="campo"><label for="ljaMin">Valor mínimo do pedido (R$, sem contar o frete)</label><input id="ljaMin" inputmode="decimal" value="' + esc(String(cfg.minimo).replace('.', ',')) + '"></div></div><p class="lja-dica">Zero desliga o mínimo. O cliente vê quanto falta antes de preencher qualquer dado, e o servidor também confere.</p></div>' +
      '<div class="painel" style="margin-top:18px"><h2>Distância <small>acréscimo por quilômetro</small></h2><div class="lja-grade2"><div class="campo"><label for="ljaFranquia">Até quantos km vale só o frete do bairro</label><input id="ljaFranquia" inputmode="decimal" value="' + esc(String(cfg.frete.franquiaKm).replace('.', ',')) + '"></div><div class="campo"><label for="ljaPorKm">Valor por km que passar (R$)</label><input id="ljaPorKm" inputmode="decimal" value="' + esc(String(cfg.frete.porKm).replace('.', ',')) + '"></div></div><p class="lja-dica">Frete final = frete do bairro + valor por km acima da franquia (distância de rua estimada a partir da base; o acréscimo é arredondado para cima em R$ 0,50). Bairros novos, sem posição no mapa, cobram só o valor do bairro. Zero no valor por km desliga o acréscimo.</p></div>' +
      '<div class="painel" style="margin-top:18px"><h2>Frete por bairro <small>valor do bairro, sem o acréscimo por km</small></h2>' +
      '<div class="rolagem"><table class="lja-tab"><thead><tr><th>Bairro</th><th class="num">Frete (R$)</th><th></th></tr></thead><tbody>' +
      cfg.bairros.map(function (b, i) { return '<tr data-bi="' + i + '"><td><input class="peq lja-nome" data-bc="nome" aria-label="Nome do bairro" value="' + esc(b.nome) + '"></td><td class="num"><input class="peq lja-num" inputmode="decimal" data-bc="taxa" aria-label="Frete de ' + esc(b.nome) + '" value="' + esc(String(b.taxa).replace('.', ',')) + '"></td><td><button type="button" class="btn pequeno claro" data-lja-del-bairro="' + i + '">Remover</button></td></tr>'; }).join('') +
      '</tbody></table></div><div class="lja-add"><input class="peq lja-nome" id="nbNome" placeholder="Novo bairro" aria-label="Novo bairro"><input class="peq lja-num" id="nbTaxa" inputmode="decimal" placeholder="Frete" aria-label="Frete do novo bairro"><button type="button" class="btn pequeno" data-lja-add-bairro>Adicionar bairro</button></div>' +
      '<p class="lja-dica">Atenção: os bairros e valores iniciais são de exemplo. Revise antes de divulgar a loja.</p></div>';
  }

  /* ---------- horário ---------- */
  function horario(c) {
    c.innerHTML = '<div class="painel"><h2>Horário de funcionamento</h2><p class="lja-dica">Fora do horário a loja avisa que está fechada e o cliente agenda a entrega ou a retirada para o próximo horário disponível.</p>' +
      '<table class="lja-tab"><thead><tr><th>Dia</th><th>Abre</th><th>Fecha</th><th>Funciona?</th></tr></thead><tbody>' +
      DIAS.map(function (d) { var h = cfg.horario[d[0]]; return '<tr data-dia="' + d[0] + '"><td><b>' + d[1] + '</b></td><td><input type="time" class="peq" data-hc="de" aria-label="Abre, ' + d[1] + '" value="' + (h ? h[0] : '08:00') + '"' + (h ? '' : ' disabled') + '></td><td><input type="time" class="peq" data-hc="ate" aria-label="Fecha, ' + d[1] + '" value="' + (h ? h[1] : '17:30') + '"' + (h ? '' : ' disabled') + '></td><td><label class="lja-chk"><input type="checkbox" data-hc="abre"' + (h ? ' checked' : '') + ' aria-label="Funciona ' + d[1] + '"><span>' + (h ? 'Aberto' : 'Fechado') + '</span></label></td></tr>'; }).join('') + '</tbody></table>' +
      '<p class="lja-soma">Na loja: <b>' + esc(JPL.resumoHorario(cfg)) + '</b></p></div>';
  }
  function mudaHorario(el) {
    var tr = el.closest('[data-dia]'), d = tr.dataset.dia, k = el.dataset.hc, h = cfg.horario[d];
    if (k === 'abre') cfg.horario[d] = el.checked ? ['08:00', '17:30'] : null;
    else { if (!h) return; if (k === 'de') h[0] = el.value; else h[1] = el.value; if (!(h[0] < h[1])) { ctx.toast('O horário de fechar precisa ser depois do de abrir.'); desenha(); return; } }
    cfgSalvar('Horário salvo.'); desenha();
  }

  /* ---------- textos e contato ---------- */
  function textos(c) {
    var b = cfg.banner, k = cfg.contato;
    c.innerHTML = '<div class="painel"><h2>Banner e apresentação</h2><div class="lja-grade2">' +
      '<div class="campo largo"><label for="tb-titulo">Título do banner</label><input id="tb-titulo" data-tc="banner.titulo" maxlength="120" value="' + esc(b.titulo) + '"></div>' +
      '<div class="campo largo"><label for="tb-texto">Texto do banner</label><textarea id="tb-texto" rows="3" maxlength="300" data-tc="banner.texto">' + esc(b.texto) + '</textarea></div>' +
      '<div class="campo"><label for="tb-selo">Selo (vazio esconde)</label><input id="tb-selo" data-tc="banner.selo" maxlength="40" value="' + esc(b.selo) + '"></div>' +
      '<div class="campo largo"><label for="tb-apres">Texto de apresentação (“Quem somos”)</label><textarea id="tb-apres" rows="4" maxlength="600" data-tc="apresentacao">' + esc(cfg.apresentacao) + '</textarea></div></div></div>' +
      '<div class="painel" style="margin-top:18px"><h2>Contato</h2><div class="lja-grade2">' +
      '<div class="campo"><label for="tc-tel">Telefone exibido</label><input id="tc-tel" data-tc="contato.telefone" value="' + esc(k.telefone) + '"></div>' +
      '<div class="campo"><label for="tc-whats">WhatsApp (só números, com 55)</label><input id="tc-whats" inputmode="numeric" data-tc="contato.whats" value="' + esc(k.whats) + '"></div>' +
      '<div class="campo largo"><label for="tc-end">Endereço da loja (retirada)</label><input id="tc-end" data-tc="contato.endereco" value="' + esc(k.endereco) + '"></div>' +
      '<div class="campo"><label for="tc-ig">Instagram (sem @)</label><input id="tc-ig" data-tc="contato.instagram" value="' + esc(k.instagram) + '"></div></div></div>';
  }
  function mudaTexto(el) {
    var cam = el.dataset.tc.split('.'), v = el.value.trim();
    if (cam[0] === 'contato' && cam[1] === 'whats') v = v.replace(/\D/g, '');
    if (cam.length === 2) cfg[cam[0]][cam[1]] = v; else cfg[cam[0]] = v;
    cfgSalvar('Texto salvo.');
  }

  /* ---------- eventos ---------- */
  function init(c) {
    ctx = c;
    document.addEventListener('click', function (e) {
      var t = e.target.closest('button'); if (!t) return;
      var d = t.dataset;
      if (d.ljaAba) { aba = d.ljaAba; render($('#tela')); }
      else if (d.ljaDet) { F.abertos[d.ljaDet] = !F.abertos[d.ljaDet]; linhas(); }
      else if (t.hasAttribute('data-lja-novo-combo')) { cfg.combos.push({ id: 'cb-' + Date.now().toString(36), nome: 'Novo combo', ativo: false, desc: '', itens: [], preco: 0 }); cfgSalvar('Combo criado (inativo até você incluir os itens e ativar).'); desenha(); }
      else if (d.ljaDelCombo !== undefined) { var cb = cfg.combos[+d.ljaDelCombo]; if (cb && confirm('Remover o combo “' + cb.nome + '”?')) { cfg.combos.splice(+d.ljaDelCombo, 1); cfgSalvar('Combo removido.'); desenha(); } }
      else if (d.ljaDelItem) { var ij = d.ljaDelItem.split(':'); cfg.combos[+ij[0]].itens.splice(+ij[1], 1); cfgSalvar('Item tirado do combo.'); desenha(); }
      else if (d.ljaAddItem !== undefined) {
        var sec = t.closest('[data-ci]'), sel = $('[data-add-sel]', sec), cb2 = cfg.combos[+d.ljaAddItem];
        if (!sel.value) { ctx.toast('Escolha o produto a incluir.'); return; }
        var ja = cb2.itens.filter(function (x) { return x[0] === sel.value; })[0];
        if (ja) ja[1] = JPL.unidade(prod(sel.value)).passo + ja[1]; else cb2.itens.push([sel.value, JPL.unidade(prod(sel.value)).min]);
        cfgSalvar('Item incluído.'); desenha();
      }
      else if (d.ljaDelBairro !== undefined) { cfg.bairros.splice(+d.ljaDelBairro, 1); cfgSalvar('Bairro removido.'); desenha(); }
      else if (t.hasAttribute('data-lja-add-bairro')) {
        var nome = $('#nbNome').value.trim(), taxa = numero($('#nbTaxa').value);
        if (!nome || taxa === null || taxa < 0) { ctx.toast('Informe o nome do bairro e o valor do frete.'); return; }
        if (cfg.bairros.some(function (b) { return JPL.semAcento(b.nome) === JPL.semAcento(nome); })) { ctx.toast('Esse bairro já está na lista.'); return; }
        cfg.bairros.push({ nome: nome, taxa: Math.round(taxa * 100) / 100, lat: JP.BASE.lat, lng: JP.BASE.lng }); cfgSalvar('Bairro adicionado.'); desenha();
      }
    });
    document.addEventListener('change', function (e) {
      var el = e.target; if (!$('#ljaCorpo')) return;
      if (el.id === 'ljaCat') { F.cat = el.value; linhas(); }
      else if (el.closest('[data-pid]') && el.dataset.campo) mudaProduto(el);
      else if (el.dataset.cc) mudaCombo(el);
      else if (el.hasAttribute('data-ci-q')) {
        var tr = el.closest('[data-cj]'), sec = el.closest('[data-ci]'), it = cfg.combos[+sec.dataset.ci].itens[+tr.dataset.cj], q = numero(el.value);
        if (!(q > 0)) { ctx.toast('A quantidade precisa ser maior que zero.'); el.value = String(it[1]).replace('.', ','); return; }
        it[1] = q; cfgSalvar('Quantidade salva.'); desenha();
      }
      else if (el.id === 'ljaFranquia' || el.id === 'ljaPorKm') {
        var vk = numero(el.value), campo = el.id === 'ljaFranquia' ? 'franquiaKm' : 'porKm';
        if (vk === null || vk < 0) { ctx.toast('Informe um valor de 0 ou mais.'); el.value = String(cfg.frete[campo]).replace('.', ','); return; }
        cfg.frete[campo] = Math.round(vk * 100) / 100; cfgSalvar('Cálculo de frete salvo.');
      }
      else if (el.id === 'ljaMin') { var m = numero(el.value); if (m === null || m < 0) { ctx.toast('Informe um valor de 0 ou mais.'); el.value = String(cfg.minimo).replace('.', ','); return; } cfg.minimo = Math.round(m * 100) / 100; cfgSalvar('Pedido mínimo salvo.'); }
      else if (el.dataset.bc) {
        var b = cfg.bairros[+el.closest('[data-bi]').dataset.bi];
        if (el.dataset.bc === 'nome') { if (!el.value.trim()) { el.value = b.nome; return; } b.nome = el.value.trim(); }
        else { var tx = numero(el.value); if (tx === null || tx < 0) { ctx.toast('Informe o valor do frete.'); el.value = String(b.taxa).replace('.', ','); return; } b.taxa = Math.round(tx * 100) / 100; }
        cfgSalvar('Frete salvo.');
      }
      else if (el.dataset.hc) mudaHorario(el);
      else if (el.dataset.tc) mudaTexto(el);
    });
    document.addEventListener('input', function (e) { if (e.target.id === 'ljaBusca') { F.termo = e.target.value; linhas(); } });
  }

  window.LJA = { init: init, render: render };
})();
