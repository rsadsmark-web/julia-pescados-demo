/* Loja Júlia Pescados — lado do cliente. Pedido sem cadastro, quantidade fracionada, frete e mínimo antes de pedir,
   horário com agendamento, combos e recompra. As contas vêm de loja-lib.js (as mesmas que o servidor refaz). */
(function () {
  var S = JP.estado(), L = JPL;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var CFG = L.mescla(window.JP_LOJA_CFG);
  var combosProd = [];                                          // combos ativos, no formato de produto (id cb-…)

  var carrinho = {}, notas = {}, form = { nome: '', fone: '', bairro: '', endereco: '', troco: '', obs: '' };
  var tipo = 'entrega', pagamento = 'Pix', quando = { modo: 'agora', dia: '', janela: '' };
  var filtro = { termo: '', cat: 'Todos', ordem: '', so: '' };
  var enviando = false, ultimo = null, recompraDe = null, notasAbertas = {};
  var atacadoId = localStorage.getItem('jp_atacado') || '';
  var naFila = [];
  function le(k, padrao) { try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? padrao : v; } catch (e) { return padrao; } }
  carrinho = le('jp_carrinho', {}); notas = le('jp_carrinho_obs', {}); naFila = le('jp_espera', []); ultimo = le('jp_ultimo', null);
  form = Object.assign(form, le('jp_form', {}));
  Object.keys(notas).forEach(function (k) { if (notas[k]) notasAbertas[k] = 1; });

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function brl(v) { return JP.brl(v); }
  function salva() { localStorage.setItem('jp_carrinho', JSON.stringify(carrinho)); localStorage.setItem('jp_carrinho_obs', JSON.stringify(notas)); localStorage.setItem('jp_form', JSON.stringify(form)); }
  function atac() { return atacadoId ? EX.restaurante(atacadoId) : null; }

  /* ---------- catálogo em memória ---------- */
  function monta() {
    S = JP.estado();
    combosProd = L.combosAtivos(CFG, S.produtos).map(function (c) { return L.comboComoProduto(c, S.produtos); });
  }
  function todos() { return S.produtos.concat(combosProd); }
  function prod(id) { return todos().filter(function (p) { return p.id === id; })[0]; }
  function precoDe(p) { var a = atac(); return a && !p.combo ? Math.min(EX.precoAtacado(p), L.precoEfetivo(p)) : L.precoEfetivo(p); }
  function limpaCarrinho() { Object.keys(carrinho).forEach(function (id) { if (!prod(id)) { delete carrinho[id]; delete notas[id]; } }); }

  /* ---------- horário ---------- */
  function sit() { return L.situacaoLoja(CFG, L.agora()); }
  function desenhaStatus() {
    var s = sit(), b = $('#statusLoja');
    b.className = 'lj-status ' + (s.aberto ? 'aberto' : 'fechado');
    $('span', b).textContent = s.aberto ? 'Aberto até ' + s.ate.replace(':', 'h').replace(/h00$/, 'h') : 'Fechado agora';
    b.title = s.texto;
    var av = $('#avisoFechada');
    if (s.aberto) av.hidden = true;
    else { av.hidden = false; av.innerHTML = '<b>' + esc(s.texto) + '.</b> Você pode montar o pedido agora e <b>agendar</b> a entrega ou a retirada para quando abrirmos.'; }
  }

  /* ---------- topo, banner e rodapé ---------- */
  function desenhaFixos() {
    var b = CFG.banner;
    $('#bannerTitulo').textContent = b.titulo; $('#bannerTexto').textContent = b.texto; $('#bannerSelo').textContent = b.selo; $('#bannerSelo').hidden = !b.selo;
    $('#apresentacao').textContent = CFG.apresentacao;
    $('#fatoMinimo').textContent = CFG.minimo > 0 ? 'Pedido mínimo ' + brl(CFG.minimo) : 'Sem pedido mínimo';
    $('#fatoHorario').textContent = L.resumoHorario(CFG).split(' · ')[0];
    $('#minimoTxt').textContent = CFG.minimo > 0 ? 'Pedido mínimo de ' + brl(CFG.minimo) + ', sem contar o frete.' : 'Sem pedido mínimo.';
    $('#horarios').innerHTML = L.resumoHorario(CFG).split(' · ').map(function (l) { var i = l.indexOf(', '); return '<div><dt>' + esc(l.slice(0, i)) + '</dt><dd>' + esc(l.slice(i + 2)) + '</dd></div>'; }).join('');
    $('#tabelaTaxas').innerHTML = CFG.bairros.map(function (x) { return '<div class="lj-taxa"><span>' + esc(x.nome) + '</span><b>' + brl(x.taxa) + '</b></div>'; }).join('');
    var c = CFG.contato;
    $('#contato').innerHTML = '<a href="https://wa.me/' + esc(c.whats) + '" target="_blank" rel="noopener">WhatsApp ' + esc(c.telefone) + '</a>' + (c.endereco ? '<span>' + esc(c.endereco) + '</span>' : '') +
      (c.instagram ? '<a href="https://www.instagram.com/' + esc(c.instagram) + '/" target="_blank" rel="noopener">@' + esc(c.instagram) + '</a>' : '');
  }

  /* ---------- cartões de produto ---------- */
  function ctrlHtml(p) {
    var q = carrinho[p.id] || 0, u = L.unidade(p), sem = p.estoque <= 0;
    if (sem) return p.fresco ? '<button type="button" class="lj-btn linha pequeno" data-espera="' + p.id + '">' + (naFila.indexOf(p.id) >= 0 ? '✓ Na fila do próximo lote' : 'Avise-me do próximo lote') + '</button>' : '<span class="lj-esgotado">Esgotado</span>';
    if (!q) return '<button type="button" class="lj-btn" data-add="' + p.id + '">Adicionar</button>';
    return '<div class="lj-qtd" role="group" aria-label="Quantidade de ' + esc(p.nome) + '"><button type="button" data-d="-1" data-id="' + p.id + '" aria-label="Diminuir ' + (u.fracionado ? 'meio quilo' : 'uma unidade') + '">−</button><output aria-live="polite">' + esc(L.fmtQtd(p, q)) + '</output><button type="button" data-d="1" data-id="' + p.id + '" aria-label="Aumentar ' + (u.fracionado ? 'meio quilo' : 'uma unidade') + '">+</button></div>';
  }
  function cardHtml(p) {
    var u = L.unidade(p), promo = !p.combo && L.emPromocao(p), pe = precoDe(p), sem = p.estoque <= 0;
    var econ = p.combo ? L.precoSeparado(p, S.produtos) - p.preco : 0;
    var det = '';
    if (p.combo) det = '<ul class="lj-inclui">' + p.itens.map(function (c) { var q = S.produtos.filter(function (x) { return x.id === c[0]; })[0]; return q ? '<li>' + esc(L.fmtQtd(q, c[1])) + ' de ' + esc(q.nome) + '</li>' : ''; }).join('') + '</ul>';
    if (p.desc && !p.combo) det += '<p>' + esc(p.desc) + '</p>';
    if (p.dica) det += '<p class="lj-dica"><b>Dica de preparo:</b> ' + esc(p.dica) + '</p>';
    if (u.fracionado && u.porQuilo) det += '<p class="lj-peso">Vendido por peso: o valor é ajustado na pesagem.</p>';
    if (!u.porQuilo && +p.pesoAprox > 0) det += '<p class="lj-peso">Cada ' + u.curto + ' pesa cerca de ' + L.num(p.pesoAprox) + ' kg.</p>';
    return '<article class="lj-card' + (sem ? ' esgotado' : '') + '" id="prod-' + esc(p.id) + '">' +
      '<div class="lj-foto" style="background-image:url(' + esc(L.fotoUrl(p.img)) + ')">' + (promo ? '<span class="lj-tag promo">Promoção</span>' : p.dest && !p.combo ? '<span class="lj-tag">Destaque</span>' : '') + (econ > 0.5 ? '<span class="lj-tag verde">Economize ' + brl(econ) + '</span>' : '') + '</div>' +
      '<div class="lj-card-corpo"><h3>' + esc(p.nome) + '</h3><p class="lj-un">' + esc(u.rotulo) + '</p>' +
      (det ? '<details class="lj-det"><summary>Ver detalhes</summary>' + det + '</details>' : '') +
      '<div class="lj-card-rodape"><div class="lj-preco">' + (promo || atac() && !p.combo && pe < p.preco ? '<s>' + brl(p.preco) + '</s>' : '') + '<b>' + brl(pe) + '</b><small>' + (u.porQuilo ? '/ kg' : p.combo ? '/ kit' : '') + '</small></div>' +
      '<div class="lj-ctrl" data-ctrl="' + esc(p.id) + '">' + ctrlHtml(p) + '</div></div></div></article>';
  }
  function atualizaCards(id) {
    var p = prod(id); if (!p) return;
    $$('[data-ctrl="' + id + '"]').forEach(function (el) { el.innerHTML = ctrlHtml(p); });
  }

  function desenhaCats() {
    var cats = ['Todos'].concat(S.produtos.reduce(function (l, p) { if (p.cat && l.indexOf(p.cat) < 0) l.push(p.cat); return l; }, []));
    var h = cats.map(function (c) { return '<button type="button" class="lj-cat' + (c === filtro.cat && !filtro.so ? ' ativa' : '') + '" data-c="' + esc(c) + '" aria-pressed="' + (c === filtro.cat && !filtro.so) + '">' + esc(c) + '</button>'; }).join('');
    h += '<button type="button" class="lj-cat promo' + (filtro.so === 'promo' ? ' ativa' : '') + '" data-so="promo" aria-pressed="' + (filtro.so === 'promo') + '">Promoções</button>';
    $('#cats').innerHTML = h;
  }
  function desenhaGrade() {
    var lista = L.filtra(S.produtos, { termo: filtro.termo, cat: filtro.cat, ordem: filtro.ordem, so: filtro.so });
    $('#grade').innerHTML = lista.length ? lista.map(cardHtml).join('') : '<p class="lj-vazio">Nenhum produto encontrado' + (filtro.termo ? ' para “' + esc(filtro.termo) + '”' : '') + '. <button type="button" class="lj-link" data-limpa>Limpar busca e filtros</button></p>';
    $('#contagem').textContent = lista.length + (lista.length === 1 ? ' produto' : ' produtos');
  }
  function desenhaVitrines() {
    var dest = S.produtos.filter(function (p) { return (p.dest || L.emPromocao(p)) && p.estoque > 0; }).sort(function (a, b) { return (L.emPromocao(b) ? 1 : 0) - (L.emPromocao(a) ? 1 : 0); }).slice(0, 12);
    $('#vitrineDestaques').hidden = !dest.length; $('#trilhoDestaques').innerHTML = dest.map(cardHtml).join('');
    $('#vitrineCombos').hidden = !combosProd.length; $('#trilhoCombos').innerHTML = combosProd.map(cardHtml).join('');
  }

  /* ---------- carrinho ---------- */
  function itens() {
    return Object.keys(carrinho).filter(function (id) { return carrinho[id] > 0 && prod(id); }).map(function (id) {
      var p = prod(id); return { id: id, p: p, qtd: carrinho[id], preco: precoDe(p), total: Math.round(precoDe(p) * 100 * carrinho[id]) / 100 };
    });
  }
  function calc() {
    var its = itens(), sub = its.reduce(function (s, i) { return s + i.total; }, 0);
    var f = tipo === 'entrega' && form.bairro ? L.frete(CFG, form.bairro) : null, taxa = f ? f.taxa : 0;
    return { its: its, sub: Math.round(sub * 100) / 100, f: f, taxa: taxa, total: Math.round((sub + taxa) * 100) / 100, min: atac() ? { ok: true, falta: 0, minimo: 0 } : L.minimo(CFG, sub) };
  }
  function desenhaBarra() {
    var c = calc(), n = c.its.length;
    $('#qtdCarrinho').textContent = n; $('#qtdCarrinho').hidden = !n;
    var bar = $('#barraCarrinho'); bar.hidden = !n;
    $('#barraQtd').textContent = n + (n === 1 ? ' item' : ' itens'); $('#barraTotal').textContent = brl(c.sub);
    document.body.classList.toggle('com-barra', n > 0);
  }
  function muda(id, d) {
    var p = prod(id); if (!p) return '';
    var u = L.unidade(p), atual = carrinho[id] || 0, aviso = '';
    var novo = Math.round((atual + d * u.passo) * 100) / 100;
    if (novo < u.min - 1e-9) novo = 0;
    if (novo > p.estoque) { novo = L.arredondaBaixo(p, p.estoque); aviso = 'Temos só ' + L.fmtQtd(p, novo) + ' de ' + p.nome + ' no momento.'; }
    if (novo <= 0) { delete carrinho[id]; delete notas[id]; } else carrinho[id] = novo;
    salva(); atualizaCards(id); desenhaBarra();
    var b = $('#abrirCarrinho'); b.classList.remove('pulso'); void b.offsetWidth; b.classList.add('pulso');
    if (aviso) aviso = anuncia(aviso);
    return aviso;
  }
  function anuncia(t) { var a = $('#anuncio'); if (!a) { a = document.createElement('div'); a.id = 'anuncio'; a.className = 'lj-toast'; a.setAttribute('role', 'status'); document.body.appendChild(a); } a.textContent = t; a.hidden = false; clearTimeout(anuncia.h); anuncia.h = setTimeout(function () { a.hidden = true; }, 3800); return t; }

  function pgtos() { return tipo === 'entrega' ? ['Pix', 'Cartão na entrega', 'Dinheiro'] : ['Pix', 'Cartão na retirada', 'Dinheiro']; }
  function quandoValido() {
    var s = sit(), now = L.agora();
    if (!s.aberto) quando.modo = 'agendar';
    if (quando.modo !== 'agendar') return;
    var dias = L.diasAgendaveis(CFG, now, 7);
    if (!dias.some(function (d) { return d.iso === quando.dia; })) quando.dia = dias[0] ? dias[0].iso : '';
    var js = quando.dia ? L.janelas(CFG, quando.dia, now) : [];
    if (!js.some(function (j) { return j.de === quando.janela; })) quando.janela = js[0] ? js[0].de : '';
  }
  function textoQuando() {
    if (quando.modo !== 'agendar') return '';
    var js = L.janelas(CFG, quando.dia, L.agora()), j = js.filter(function (x) { return x.de === quando.janela; })[0];
    return j ? L.textoAgendado(quando.dia, j) : '';
  }

  function desenhaCarrinho(foco) {
    var el = $('#corpoCarrinho'), topo = el.scrollTop, c = calc();
    if (!c.its.length) { el.innerHTML = '<div class="lj-vazio-carrinho"><p>Seu carrinho está vazio.</p><button type="button" class="lj-btn" id="irCatalogo">Escolher produtos</button></div>'; return; }
    if (pgtos().indexOf(pagamento) < 0) pagamento = 'Pix';
    quandoValido();
    var h = '';
    if (recompraDe) h += '<div class="lj-aviso ok"><b>Seu pedido de ' + esc(recompraDe) + ' já está aqui.</b> Confira e finalize.</div>';
    if (atac()) h += '<div class="lj-aviso rosa"><b>Atacado, ' + esc(atac().nome) + '.</b> Preço da tabela de restaurantes.</div>';
    h += '<ul class="lj-itens">' + c.its.map(function (i) {
      var u = L.unidade(i.p), aviso = i.p.combo ? '' : L.avisoPeso(i.p, i.qtd), aberto = !!notasAbertas[i.id];
      return '<li class="lj-item"><div class="lj-mini" style="background-image:url(' + esc(L.fotoUrl(i.p.img)) + ')"></div>' +
        '<div class="lj-item-info"><b>' + esc(i.p.nome) + '</b><small>' + brl(i.preco) + ' ' + (u.porQuilo ? 'por kg' : i.p.combo ? 'por kit' : '· ' + esc(u.rotulo)) + '</small>' +
        '<div class="lj-qtd" role="group" aria-label="Quantidade de ' + esc(i.p.nome) + '"><button type="button" data-d="-1" data-id="' + esc(i.id) + '" aria-label="Diminuir">−</button><output>' + esc(L.fmtQtd(i.p, i.qtd)) + '</output><button type="button" data-d="1" data-id="' + esc(i.id) + '" aria-label="Aumentar">+</button></div></div>' +
        '<div class="lj-item-total"><b>' + brl(i.total) + '</b><button type="button" class="lj-link peq" data-nota="' + esc(i.id) + '">' + (aberto ? 'Ocultar observação' : notas[i.id] ? 'Ver observação' : 'Observação') + '</button></div>' +
        (aviso ? '<p class="lj-peso-aviso">' + esc(aviso) + '</p>' : '') +
        (aberto ? '<div class="lj-nota"><label class="sr" for="nota-' + esc(i.id) + '">Observação para ' + esc(i.p.nome) + '</label><input id="nota-' + esc(i.id) + '" data-nota-in="' + esc(i.id) + '" maxlength="120" value="' + esc(notas[i.id]) + '" placeholder="Ex.: limpo, sem casca, em postas finas"></div>' : '') + '</li>';
    }).join('') + '</ul>';

    h += '<div class="lj-bloco"><h3>Receber ou retirar</h3><div class="lj-opcoes">' +
      '<button type="button" class="lj-opcao' + (tipo === 'entrega' ? ' ativa' : '') + '" data-tipo="entrega" aria-pressed="' + (tipo === 'entrega') + '">Entrega</button>' +
      '<button type="button" class="lj-opcao' + (tipo === 'retirada' ? ' ativa' : '') + '" data-tipo="retirada" aria-pressed="' + (tipo === 'retirada') + '">Retirada</button></div>';
    if (tipo === 'entrega') {
      h += '<div class="lj-campo"><label for="fBairro">Bairro</label><select id="fBairro"><option value="">Escolha o bairro para ver o frete</option>' +
        CFG.bairros.map(function (b) { return '<option value="' + esc(b.nome) + '"' + (b.nome === form.bairro ? ' selected' : '') + '>' + esc(b.nome) + ' · ' + brl(b.taxa) + '</option>'; }).join('') + '</select></div>';
    } else {
      h += '<p class="lj-dica">Retirada na loja' + (CFG.contato.endereco ? ': ' + esc(CFG.contato.endereco) : '') + '. Sem frete. Atendemos ' + esc(L.resumoHorario(CFG)) + '.</p>';
    }
    h += '</div>';

    h += '<div class="lj-resumo" aria-label="Resumo do pedido"><div><span>Subtotal</span><b>' + brl(c.sub) + '</b></div>' +
      '<div><span>' + (tipo === 'retirada' ? 'Retirada' : 'Frete' + (c.f ? ' · ' + esc(c.f.bairro.nome) : '')) + '</span><b>' + (tipo === 'retirada' ? 'Grátis' : c.f ? brl(c.taxa) : 'Escolha o bairro') + '</b></div>' +
      '<div class="total"><span>Total</span><b>' + brl(c.total) + '</b></div></div>';
    if (CFG.minimo > 0 && !atac()) {
      var pct = Math.min(100, Math.round(c.sub / CFG.minimo * 100));
      h += '<div class="lj-minimo ' + (c.min.ok ? 'ok' : '') + '"><div class="lj-minimo-txt">' + (c.min.ok ? '✓ Pedido mínimo de ' + brl(CFG.minimo) + ' atingido' : 'Faltam <b>' + brl(c.min.falta) + '</b> para o pedido mínimo de ' + brl(CFG.minimo)) + '</div><div class="lj-barra-min" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '"><i style="width:' + pct + '%"></i></div>' +
        (c.min.ok ? '' : '<button type="button" class="lj-link" id="maisProdutos">Escolher mais produtos</button>') + '</div>';
    }

    h += '<div class="lj-bloco"><h3>Seus dados</h3>' +
      '<div class="lj-campo"><label for="fNome">Nome</label><input id="fNome" autocomplete="name" value="' + esc(form.nome) + '" placeholder="Como podemos chamar você?"></div>' +
      '<div class="lj-campo"><label for="fFone">WhatsApp</label><input id="fFone" type="tel" inputmode="tel" autocomplete="tel" value="' + esc(form.fone) + '" placeholder="(85) 9 0000-0000"></div>' +
      (tipo === 'entrega' ? '<div class="lj-campo"><label for="fEnd">Endereço de entrega</label><input id="fEnd" autocomplete="street-address" value="' + esc(form.endereco) + '" placeholder="Rua, número, complemento"></div>' : '') + '</div>';

    var s = sit();
    h += '<div class="lj-bloco"><h3>Quando</h3>';
    if (s.aberto) h += '<div class="lj-opcoes"><button type="button" class="lj-opcao' + (quando.modo !== 'agendar' ? ' ativa' : '') + '" data-quando="agora" aria-pressed="' + (quando.modo !== 'agendar') + '">O quanto antes</button><button type="button" class="lj-opcao' + (quando.modo === 'agendar' ? ' ativa' : '') + '" data-quando="agendar" aria-pressed="' + (quando.modo === 'agendar') + '">Agendar</button></div>';
    else h += '<p class="lj-aviso alerta"><b>' + esc(s.texto) + '.</b> Escolha abaixo o dia e o horário em que prefere receber ou retirar.</p>';
    if (quando.modo === 'agendar') {
      var dias = L.diasAgendaveis(CFG, L.agora(), 7), js = quando.dia ? L.janelas(CFG, quando.dia, L.agora()) : [];
      h += '<div class="lj-duas"><div class="lj-campo"><label for="fDia">Dia</label><select id="fDia">' + dias.map(function (d) { return '<option value="' + d.iso + '"' + (d.iso === quando.dia ? ' selected' : '') + '>' + esc(d.rotulo) + (d.hoje ? ' (hoje)' : '') + '</option>'; }).join('') + '</select></div>' +
        '<div class="lj-campo"><label for="fJanela">Horário</label><select id="fJanela">' + js.map(function (j) { return '<option value="' + j.de + '"' + (j.de === quando.janela ? ' selected' : '') + '>' + esc(j.rotulo) + '</option>'; }).join('') + '</select></div></div>';
    } else h += '<p class="lj-dica">Separamos e ' + (tipo === 'retirada' ? 'deixamos pronto' : 'enviamos') + ' assim que o pedido for confirmado.</p>';
    h += '</div>';

    h += '<div class="lj-bloco"><h3>Pagamento na ' + (tipo === 'entrega' ? 'entrega' : 'retirada') + '</h3><div class="lj-opcoes tres">' + pgtos().map(function (p) {
      return '<button type="button" class="lj-opcao' + (p === pagamento ? ' ativa' : '') + '" data-pg="' + p + '" aria-pressed="' + (p === pagamento) + '">' + p + '</button>';
    }).join('') + '</div>' +
      (pagamento === 'Dinheiro' ? '<div class="lj-campo"><label for="fTroco">Troco para quanto? (opcional)</label><input id="fTroco" inputmode="decimal" value="' + esc(form.troco) + '" placeholder="Ex.: 200"></div>' : '') +
      (pagamento === 'Pix' ? '<p class="lj-dica">A chave Pix é enviada pelo WhatsApp quando a Júlia confirmar o pedido.</p>' : '') + '</div>' +
      '<div class="lj-bloco"><div class="lj-campo"><label for="fObs">Recado para a Júlia (opcional)</label><textarea id="fObs" rows="2" maxlength="200" placeholder="Ex.: ligar ao chegar, deixar com o porteiro">' + esc(form.obs) + '</textarea></div></div>';

    var bloqueio = !c.min.ok ? 'Faltam ' + brl(c.min.falta) + ' para o mínimo' : '';
    h += '<div id="erroForm" class="lj-erro" role="alert"></div>' +
      '<button type="button" class="lj-btn grande bloco" id="finalizar"' + (bloqueio || enviando ? ' disabled' : '') + '>' + (enviando ? 'Enviando…' : bloqueio || 'Enviar pedido · ' + brl(c.total)) + '</button>' +
      '<p class="lj-dica centro">Sem cadastro e sem pagamento agora. A Júlia confirma o pedido pelo WhatsApp.</p>';
    el.innerHTML = h; el.scrollTop = topo;
    if (foco) { var f = $(foco, el); if (f) f.focus(); }
  }
  var ultimoFoco = null;
  function abreGaveta() { desenhaCarrinho(); $('#gaveta').classList.add('aberta'); $('#gaveta').setAttribute('aria-hidden', 'false'); $('#veu').hidden = false; document.body.classList.add('trava'); ultimoFoco = document.activeElement; $('#fecharCarrinho').focus(); }
  function fechaGaveta() { $('#gaveta').classList.remove('aberta'); $('#gaveta').setAttribute('aria-hidden', 'true'); $('#veu').hidden = true; document.body.classList.remove('trava'); if (ultimoFoco && ultimoFoco.focus) ultimoFoco.focus(); }

  /* ---------- envio do pedido ---------- */
  function codigoPedido() { return 'JP-' + JP_PUBLICO.codigo(); }
  function validar(c) {
    if (!c.its.length) return 'Seu carrinho está vazio.';
    if (!c.min.ok) return 'O pedido mínimo é ' + brl(c.min.minimo) + '. Faltam ' + brl(c.min.falta) + '.';
    if (tipo === 'entrega' && !form.bairro) return 'Escolha o bairro para calcular o frete.';
    if (!form.nome.trim()) return 'Informe seu nome.';
    if (form.fone.replace(/\D/g, '').length < 10) return 'Informe um WhatsApp válido com DDD.';
    if (tipo === 'entrega' && !form.endereco.trim()) return 'Informe o endereço de entrega.';
    if (quando.modo === 'agendar' && !textoQuando()) return 'Escolha o dia e o horário do agendamento.';
    return '';
  }
  function mensagem(p, c) {
    var l = ['Olá, Júlia Pescados! Fiz o pedido ' + p.id + ' pelo site:', ''];
    p.itens.forEach(function (i) { var pr = prod(i.id); l.push('• ' + (pr ? L.fmtQtd(pr, i.qtd) : i.qtd) + ' de ' + i.nome + ' — ' + brl(i.preco * i.qtd) + (i.obs ? ' (' + i.obs + ')' : '')); });
    l.push('', 'Subtotal: ' + brl(c.sub));
    if (p.tipo === 'entrega') { l.push('Entrega em ' + p.bairro + ': ' + brl(p.taxa), 'Endereço: ' + p.endereco); } else l.push('Retirada na loja');
    if (p.agendado) l.push('Agendado: ' + p.agendado);
    l.push('Total: ' + brl(c.total), 'Pagamento: ' + p.pagamento);
    if (p.obs) l.push('Recado: ' + p.obs);
    l.push('', 'Nome: ' + p.cliente);
    return l.join('\n');
  }
  function finalizar() {
    if (enviando) return;
    var c = calc(), erro = validar(c), er = $('#erroForm');
    if (erro) { er.textContent = erro; return; }
    var obs = form.obs.trim();
    if (pagamento === 'Dinheiro' && form.troco.trim()) obs = (obs ? obs + ' | ' : '') + 'Troco para R$ ' + form.troco.trim();
    var corpo = {
      id: codigoPedido(), cliente: form.nome.trim(), fone: form.fone.trim(), tipo: tipo, bairro: tipo === 'entrega' ? form.bairro : '', endereco: tipo === 'entrega' ? form.endereco.trim() : '',
      pagamento: pagamento, obs: obs, agendado: textoQuando() || undefined,
      itens: c.its.map(function (i) { var o = { id: i.id, qtd: i.qtd }; if (notas[i.id]) o.obs = notas[i.id]; if (atac() && !i.p.combo) o.preco = i.preco; return o; })
    };
    if (atac()) corpo.atacadoId = atac().id;
    if (recompraDe) corpo.recompra = true;
    enviando = true; desenhaCarrinho();
    fetch('/api/pedidos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, status: r.status, j: j }; }); })
      .then(function (r) {
        enviando = false;
        if (!r.ok) { desenhaCarrinho(); var e2 = $('#erroForm'); if (e2) e2.textContent = r.j.erro || 'Não foi possível enviar agora. Tente de novo ou chame a Júlia no WhatsApp.'; return; }
        ultimo = { id: corpo.id, quando: Date.now(), nome: corpo.cliente, itens: c.its.map(function (i) { return [i.id, i.qtd]; }), total: c.total, tipo: tipo, agendado: corpo.agendado || '', resumo: c.its.map(function (i) { return { nome: i.p.nome, qtd: L.fmtQtd(i.p, i.qtd), obs: notas[i.id] || '', total: i.total }; }), taxa: c.taxa, sub: c.sub, bairro: corpo.bairro, pagamento: pagamento, msg: mensagem(corpo, c) };
        localStorage.setItem('jp_ultimo', JSON.stringify(ultimo)); localStorage.setItem('jp_ultimo_pedido', corpo.id);
        carrinho = {}; notas = {}; form.obs = ''; recompraDe = null; salva(); desenhaBarra(); desenhaVitrines(); desenhaGrade(); desenhaRecompra();
        mostraSucesso(ultimo);
      })
      .catch(function () { enviando = false; desenhaCarrinho(); var e3 = $('#erroForm'); if (e3) e3.textContent = 'Sem conexão. O pedido NÃO foi enviado e o carrinho foi mantido. Tente de novo ou chame a Júlia no WhatsApp.'; });
  }
  function mostraSucesso(u) {
    fechaGaveta();
    abreEx('Pedido enviado', '<div class="lj-ex-corpo"><div class="lj-aviso ok"><b>Pedido ' + esc(u.id) + ' recebido, ' + esc(String(u.nome).split(' ')[0]) + '!</b><br>A Júlia vai confirmar pelo seu WhatsApp' + (u.agendado ? '. ' + (u.tipo === 'retirada' ? 'Retirada' : 'Entrega') + ' agendada: ' + esc(u.agendado) : '') + '.</div>' +
      '<ul class="lj-resumo-lista">' + u.resumo.map(function (i) { return '<li><span>' + esc(i.qtd) + ' · ' + esc(i.nome) + (i.obs ? '<small>' + esc(i.obs) + '</small>' : '') + '</span><b>' + brl(i.total) + '</b></li>'; }).join('') + '</ul>' +
      '<div class="lj-resumo"><div><span>' + (u.tipo === 'retirada' ? 'Retirada' : 'Frete · ' + esc(u.bairro)) + '</span><b>' + brl(u.taxa) + '</b></div><div class="total"><span>Total · ' + esc(u.pagamento) + '</span><b>' + brl(u.total) + '</b></div></div>' +
      '<p class="lj-dica">Itens vendidos por peso têm o valor ajustado na pesagem.</p>' +
      '<a class="lj-btn linha bloco" target="_blank" rel="noopener" href="https://wa.me/' + esc(CFG.contato.whats) + '?text=' + encodeURIComponent(u.msg) + '">Também mandar este pedido no WhatsApp</a>' +
      '<button type="button" class="lj-btn bloco" data-fecha-ex>Fazer outro pedido</button></div>');
  }

  /* ---------- recompra ---------- */
  function resolveItens(its) { return its.map(function (i) { var p = prod(i[0]); return p ? { p: p, qtd: i[1] } : null; }).filter(Boolean); }
  function desenhaRecompra() {
    var res = $('#recompraResultado'), h = '';
    if (ultimo && ultimo.itens && ultimo.itens.length && !res.dataset.busca) {
      var data = new Date(ultimo.quando).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      h = recompraHtml('Seu último pedido neste aparelho (' + data + ')', ultimo.itens, data);
    } else if (res.dataset.busca) return;
    res.innerHTML = h;
    var f = $('#recFone'); if (f && !f.value && form.fone) f.value = form.fone;
  }
  function recompraHtml(titulo, its, data) {
    var rs = resolveItens(its);
    if (!rs.length) return '<p class="lj-dica">Os produtos desse pedido não estão mais no catálogo.</p>';
    return '<div class="lj-recompra-card"><b>' + esc(titulo) + '</b><ul>' + rs.map(function (i) { return '<li>' + esc(L.fmtQtd(i.p, i.qtd)) + ' · ' + esc(i.p.nome) + (i.p.estoque <= 0 ? ' <em>(esgotado)</em>' : '') + '</li>'; }).join('') + '</ul>' +
      '<button type="button" class="lj-btn" data-refaz="' + esc(JSON.stringify(its)) + '" data-data="' + esc(data) + '">Pedir de novo</button></div>';
  }
  function buscaRecompra(e) {
    e.preventDefault();
    var fone = $('#recFone').value.trim(), res = $('#recompraResultado');
    if (fone.replace(/\D/g, '').length < 10) { res.dataset.busca = '1'; res.innerHTML = '<p class="lj-erro" role="alert">Informe um WhatsApp válido com DDD.</p>'; return; }
    res.dataset.busca = '1'; res.innerHTML = '<p class="lj-dica">Buscando…</p>';
    fetch('/api/ultimo-pedido', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fone: fone }) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (r) {
        if (!r.ok) { res.innerHTML = '<p class="lj-dica" role="alert">' + esc(r.j.erro || 'Não foi possível buscar agora.') + '</p>'; return; }
        form.fone = form.fone || fone; if (!form.nome) form.nome = r.j.nome || ''; salva();
        var data = new Date(r.j.quando).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        res.innerHTML = recompraHtml('Olá, ' + (r.j.nome || 'cliente') + '! Seu último pedido (' + data + ')', r.j.itens, data);
      })
      .catch(function () { res.innerHTML = '<p class="lj-dica" role="alert">Sem conexão. Tente de novo.</p>'; });
  }
  function refaz(its, data) {
    monta();
    var r = L.refazPedido(its, todos());
    carrinho = {}; notas = {}; r.itens.forEach(function (i) { carrinho[i[0]] = i[1]; });
    recompraDe = data; salva(); desenhaBarra(); desenhaGrade(); desenhaVitrines();
    abreGaveta();
    if (r.faltou.length) {
      var nomes = r.faltou.map(function (id) { var p = prod(id); return p ? p.nome : 'um produto que saiu do catálogo'; });
      anuncia('Ajustamos o pedido: ' + nomes.join(', ') + ' está indisponível ou com menos estoque.');
    }
    if (!r.itens.length) { recompraDe = null; desenhaCarrinho(); }
  }

  /* ---------- lista de espera de lote fresco e atacado (mantidos) ---------- */
  var exProd = '';
  function abreEx(titulo, html) { $('#exTitulo').textContent = titulo; $('#exConteudo').innerHTML = html; $('#modalEx').hidden = false; document.body.classList.add('trava'); var i = $('#exConteudo input'); if (i) i.focus(); }
  function fechaEx() { $('#modalEx').hidden = true; if ($('#gaveta').getAttribute('aria-hidden') !== 'false') document.body.classList.remove('trava'); }
  function abreEspera(id) {
    var p = prod(id); if (!p) return; exProd = id;
    if (naFila.indexOf(id) >= 0) { abreEx('Você já está na fila', '<div class="lj-ex-corpo"><p>Assim que chegar lote fresco de <b>' + esc(p.nome) + '</b>, avisamos no seu WhatsApp.</p><button class="lj-btn" data-fecha-ex>Fechar</button></div>'); return; }
    abreEx('Avise-me do próximo lote', '<div class="lj-ex-corpo"><p>Quando chegar lote fresco de <b>' + esc(p.nome) + '</b>, mandamos um aviso no seu WhatsApp.</p>' +
      '<div class="lj-campo"><label for="exNome">Nome</label><input id="exNome" autocomplete="name" value="' + esc(form.nome) + '"></div>' +
      '<div class="lj-campo"><label for="exFone">WhatsApp</label><input id="exFone" type="tel" inputmode="tel" autocomplete="tel" value="' + esc(form.fone) + '" placeholder="(85) 9 0000-0000"></div>' +
      '<div id="exErro" class="lj-erro" role="alert"></div><button class="lj-btn" id="enviarEspera">Quero ser avisado</button></div>');
  }
  function enviaEspera() {
    var nome = $('#exNome').value.trim(), fone = $('#exFone').value.trim();
    if (!nome) { $('#exErro').textContent = 'Informe seu nome.'; return; }
    if (fone.replace(/\D/g, '').length < 10) { $('#exErro').textContent = 'Informe um WhatsApp válido com DDD.'; return; }
    form.nome = form.nome || nome; form.fone = form.fone || fone; salva();
    EX.recarregar(); EX.inscrever({ prod: exProd, nome: nome, fone: fone });
    if (naFila.indexOf(exProd) < 0) naFila.push(exProd); localStorage.setItem('jp_espera', JSON.stringify(naFila));
    var p = prod(exProd);
    $('#exTitulo').textContent = 'Você está na fila';
    $('#exConteudo').innerHTML = '<div class="lj-ex-corpo"><div class="lj-aviso ok"><b>Pronto, ' + esc(nome.split(' ')[0]) + '!</b> Avisaremos no seu WhatsApp assim que chegar lote fresco de <b>' + esc(p.nome) + '</b>.</div><button class="lj-btn" data-fecha-ex>Fechar</button></div>';
    atualizaCards(exProd);
  }
  function abreAtacadoModal() {
    abreEx('Sou restaurante', '<div class="lj-ex-corpo"><p>Digite o código do seu restaurante para ver os preços de atacado.</p>' +
      '<div class="lj-campo"><label for="atCodigo">Código do restaurante</label><input id="atCodigo" autocomplete="off" maxlength="12"></div><div id="exErro" class="lj-erro" role="alert"></div>' +
      '<button class="lj-btn" id="entrarAtacado">Entrar</button></div>');
  }
  function entraAtacado(cod) {
    var c = String(cod || '').trim().toUpperCase();
    var r = EX.ler().atacado.restaurantes.filter(function (x) { return x.codigo.toUpperCase() === c; })[0];
    if (!r) { var er = $('#exErro'); if (er) er.textContent = 'Código não encontrado.'; return; }
    atacadoId = r.id; localStorage.setItem('jp_atacado', r.id);
    Object.assign(form, { nome: r.nome, fone: r.fone, bairro: r.bairro, endereco: r.endereco }); salva();
    fechaEx(); desenhaTudo();
  }
  function desenhaAtacado() {
    var el = $('#atacadoPainel'), r = atac();
    $('#abrirAtacado').textContent = r ? 'Atacado: ' + r.nome.replace(/^(Restaurante|Bar|Cantina) /, '') : 'Sou restaurante';
    if (!r) { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false;
    el.innerHTML = '<div class="lj-atacado-cab"><div><span class="lj-selo">Atacado</span><h2>' + esc(r.nome) + '</h2><p>Preço da tabela de restaurantes, em todos os produtos da loja.</p></div><button type="button" class="lj-link claro" id="sairAtacado">Sair do atacado</button></div>';
  }

  function desenhaTudo() { monta(); limpaCarrinho(); desenhaStatus(); desenhaCats(); desenhaGrade(); desenhaVitrines(); desenhaAtacado(); desenhaBarra(); desenhaRecompra(); if ($('#gaveta').classList.contains('aberta')) desenhaCarrinho(); }

  /* ---------- eventos ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('button, a'); if (!t) return;
    var d = t.dataset;
    if (d.c) { filtro.cat = d.c; filtro.so = ''; desenhaCats(); desenhaGrade(); }
    else if (d.so) { filtro.so = filtro.so === d.so ? '' : d.so; if (filtro.so) filtro.cat = 'Todos'; desenhaCats(); desenhaGrade(); }
    else if (t.hasAttribute('data-limpa')) { filtro = { termo: '', cat: 'Todos', ordem: '', so: '' }; $('#busca').value = ''; $('#ordem').value = ''; desenhaCats(); desenhaGrade(); }
    else if (d.add) { muda(d.add, 1); var f = $('[data-ctrl="' + d.add + '"] [data-d="1"]'); if (f) f.focus(); }
    else if (d.d) {
      var dentro = !!t.closest('#corpoCarrinho'); muda(d.id, +d.d);
      if (dentro) desenhaCarrinho('[data-d="' + d.d + '"][data-id="' + d.id + '"]'); else { var f2 = $('[data-ctrl="' + d.id + '"] [data-d="' + d.d + '"]') || $('[data-ctrl="' + d.id + '"] [data-add]'); if (f2) f2.focus(); }
    }
    else if (d.nota) { if (notasAbertas[d.nota]) delete notasAbertas[d.nota]; else notasAbertas[d.nota] = 1; desenhaCarrinho(notasAbertas[d.nota] ? '[data-nota-in="' + d.nota + '"]' : null); }
    else if (d.tipo) { tipo = d.tipo; desenhaCarrinho(); }
    else if (d.pg) { pagamento = d.pg; desenhaCarrinho(); }
    else if (d.quando) { quando.modo = d.quando; desenhaCarrinho(); }
    else if (d.refaz) refaz(JSON.parse(d.refaz), d.data);
    else if (t.id === 'abrirCarrinho' || t.id === 'barraAbrir') abreGaveta();
    else if (t.id === 'fecharCarrinho') fechaGaveta();
    else if (t.id === 'irCatalogo' || t.id === 'maisProdutos') { fechaGaveta(); $('#catalogo').scrollIntoView(); }
    else if (t.id === 'finalizar') finalizar();
    else if (t.id === 'statusLoja') { $('#entrega').scrollIntoView(); }
    else if (d.espera) abreEspera(d.espera);
    else if (t.id === 'enviarEspera') enviaEspera();
    else if (t.id === 'fecharEx' || t.hasAttribute('data-fecha-ex')) fechaEx();
    else if (t.id === 'abrirAtacado') abreAtacadoModal();
    else if (t.id === 'entrarAtacado') entraAtacado($('#atCodigo').value);
    else if (t.id === 'sairAtacado') { atacadoId = ''; localStorage.removeItem('jp_atacado'); desenhaTudo(); }
  });
  $('#veu').addEventListener('click', fechaGaveta);
  $('#modalEx').addEventListener('click', function (e) { if (e.target.id === 'modalEx') fechaEx(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { if (!$('#modalEx').hidden) fechaEx(); else if ($('#gaveta').classList.contains('aberta')) fechaGaveta(); } });
  $('#formRecompra').addEventListener('submit', buscaRecompra);
  $('#busca').addEventListener('input', function (e) { filtro.termo = e.target.value; desenhaGrade(); });
  $('#ordem').addEventListener('change', function (e) { filtro.ordem = e.target.value; desenhaGrade(); });
  $('#corpoCarrinho').addEventListener('input', function (e) {
    var id = e.target.id, m = { fNome: 'nome', fFone: 'fone', fEnd: 'endereco', fTroco: 'troco', fObs: 'obs' }[id];
    if (m) { form[m] = e.target.value; salva(); }
    else if (e.target.dataset.notaIn) { notas[e.target.dataset.notaIn] = e.target.value; salva(); }
  });
  $('#corpoCarrinho').addEventListener('change', function (e) {
    if (e.target.id === 'fBairro') { form.bairro = e.target.value; salva(); desenhaCarrinho('#fBairro'); }
    else if (e.target.id === 'fDia') { quando.dia = e.target.value; quando.janela = ''; desenhaCarrinho('#fDia'); }
    else if (e.target.id === 'fJanela') { quando.janela = e.target.value; }
  });
  window.addEventListener('storage', function (e) { if (e.key === EX.CHAVE) { EX.recarregar(); desenhaAtacado(); } });

  desenhaFixos(); desenhaTudo();
  setInterval(desenhaStatus, 60000);

  // Links dos avisos: ?add=<produto> (lote fresco, receitas) e ?atacado=<código>
  (function () {
    var q = new URLSearchParams(location.search), mudou = false;
    if (q.get('atacado')) { var r = EX.ler().atacado.restaurantes.filter(function (x) { return x.codigo.toUpperCase() === q.get('atacado').toUpperCase(); })[0]; if (r) { atacadoId = r.id; localStorage.setItem('jp_atacado', r.id); Object.assign(form, { nome: r.nome, fone: r.fone, bairro: r.bairro, endereco: r.endereco }); salva(); desenhaTudo(); mudou = true; } }
    if (q.get('add')) {
      var p0 = prod(q.get('add'));
      if (p0 && p0.estoque > 0) { muda(p0.id, 1); abreGaveta(); }
      var alvo = $('#prod-' + q.get('add')); if (alvo) setTimeout(function () { alvo.scrollIntoView({ block: 'center' }); }, 300);
      mudou = true;
    }
    if (mudou && history.replaceState) history.replaceState(null, '', location.pathname);
  })();
})();
