/* Painel administrativo Julia Pescados — demonstração (dados de exemplo no navegador) */
(function () {
  var S = JP.estado();
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var tela = $('#tela');
  var modulo = 'visao', mapa = null, mapaCam = null, ticker = null;
  var filtroCli = 'todos', buscaCli = '', ordCli = 'total';
  var nfSel = null, parametro = '', abertos = {}, logoPdf = null;
  var CORES = { m1: '#9c2417', m2: '#0b4a5c', m3: '#e0861a' };

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function recarrega() { S = JP.estado(); }
  function toast(msg) { var t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(function () { t.hidden = true; }, 3800); }
  function pedido(id) { return S.pedidos.filter(function (p) { return p.id === id; })[0]; }
  function motoboy(id) { return S.motoboys.filter(function (m) { return m.id === id; })[0]; }
  function dias(ms) { return Math.floor((JP.agora() - ms) / 86400000); }
  function ha(ms) { var d = dias(ms); return d <= 0 ? 'hoje' : d === 1 ? 'ontem' : 'há ' + d + ' dias'; }
  function chipSit(p) {
    var st = JPD.statusDe(p), sit = JP.situacao(p);
    var cls = { novo: 'alerta', confirmado: 'cinza', separando: 'laranja', pronto: 'laranja', saiu: 'laranja', entregue: 'ok', cancelado: 'alerta' }[st];
    var r = JPD.rotulo(p, st) + (st === 'saiu' && sit.prog > 0 ? ' · ' + Math.round(sit.prog * 100) + '%' : '');
    return '<span class="chip ' + cls + '" data-sit="' + p.id + '">' + esc(r) + '</span>';
  }
  function chipPago(p) {
    var pg = JPD.resumoPagamento(p);
    return p.pago ? '<span class="chip ok" title="' + esc(p.comprovante || '') + '">Pago</span>' : p.status === 'cancelado' ? '' : '<span class="chip cinza" title="Cobrar ' + pg.quando + '">A receber</span>';
  }

  /* ---------- categoria automática da carteira ---------- */
  function categoria(c) {
    if (dias(c.ultima) > 45) return { cod: 'inativo', rot: 'Inativo', cls: 'cinza' };
    if (c.total >= 3000 || c.pedidos >= 15) return { cod: 'vip', rot: 'VIP', cls: 'rosa' };
    if (c.pedidos >= 3) return { cod: 'recorrente', rot: 'Recorrente', cls: 'ok' };
    return { cod: 'novo', rot: 'Novo', cls: 'laranja' };
  }

  /* ---------- selos do menu ---------- */
  function selos() {
    var pend = S.pedidos.filter(function (p) { return JPD.statusDe(p) === 'novo'; }).length;
    var al = JPE.alertas(S), baixo = al.baixos.length + al.esgotados.length;
    $('#seloPedidos').textContent = pend || ''; $('#seloEstoque').textContent = baixo || '';
    var nl = window.CRM ? CRM.naoLidas() : 0; $('#seloConversas').textContent = nl || '';
    var av = window.PVA ? PVA.pendentesBaixas() : 0; $('#seloAvaliacoes').textContent = av || '';
    var es = window.EXP ? EXP.inscritosPendentes() : 0; $('#seloEspera').textContent = es || '';
  }

  /* ---------- Visão geral ---------- */
  function visao() {
    var hoje = S.pedidos.filter(function (p) { return dias(p.criado) < 1; });
    var fat = hoje.reduce(function (s, p) { return s + JP.totalPedido(p); }, 0);
    var abertos = S.pedidos.filter(function (p) { return JPD.ativo(p) && JPD.statusDe(p) !== 'novo'; }).length;
    var pend = S.pedidos.filter(function (p) { return JPD.statusDe(p) === 'novo'; }).length;
    var al0 = JPE.alertas(S), baixo = al0.baixos.concat(al0.esgotados);
    tela.innerHTML = '<div class="cab"><div><h1>Bom dia, Júlia</h1><p>Resumo da operação de hoje.</p></div></div>' +
      '<div class="kpis">' +
      kpi('Pedidos hoje', hoje.length, JP.brl(fat) + ' faturados') +
      kpi('Aguardando confirmação', pend, 'confirme para dar baixa no estoque', pend ? 'alerta' : '') +
      kpi('Entregas em andamento', abertos, S.motoboys.filter(function (m) { return m.ativo !== false; }).length + ' entregadores ativos') +
      kpi('Estoque baixo', baixo.length, baixo.length ? 'repor em breve' : 'tudo em dia', baixo.length ? 'alerta' : '') + '</div>' +
      '<div class="duas"><div class="painel"><h2>Últimos pedidos <a class="btn pequeno claro" href="#pedidos">Ver todos</a></h2><div class="rolagem"><table><thead><tr><th>Pedido</th><th>Cliente</th><th class="num">Total</th><th>Situação</th></tr></thead><tbody>' +
      S.pedidos.slice(0, 6).map(function (p) { return '<tr><td><b>' + p.id + '</b></td><td>' + esc(p.cliente) + '</td><td class="num">' + JP.brl(JP.totalPedido(p)) + '</td><td>' + chipSit(p) + '</td></tr>'; }).join('') +
      '</tbody></table></div></div>' +
      '<div class="painel"><h2>Atenção</h2>' +
      (baixo.length ? baixo.map(function (p) { return '<div class="banner alerta"><b>' + esc(p.nome) + '</b> — restam ' + p.estoque + ' ' + p.un + ' (mínimo ' + p.min + ')</div>'; }).join('') : '<p class="vazio">Nenhum alerta de estoque.</p>') +
      (pend ? '<div class="banner info">' + pend + ' pedido(s) esperando confirmação. <a href="#pedidos">Abrir pedidos</a></div>' : '') + '</div></div>';
  }
  function kpi(t, v, s, cls) { return '<div class="kpi ' + (cls || '') + '"><span>' + t + '</span><b>' + v + '</b><small>' + s + '</small></div>'; }

  /* ---------- Pedidos e delivery ---------- */
  var filtroPed = 'abertos';
  var FILTROS_PED = [['abertos', 'Em andamento'], ['novo', 'Novos'], ['saiu', 'Na rua'], ['entregue', 'Entregues'], ['cancelado', 'Cancelados'], ['todos', 'Todos']];
  function pedidosTela() {
    tela.innerHTML = '<div class="cab"><div><h1>Pedidos e delivery</h1><p>Do pedido novo à entrega: confirme, separe, mande para a rua e acompanhe. O estoque baixa ao confirmar e volta se o pedido for cancelado.</p></div></div>' +
      '<div class="mapa-linha"><div class="painel"><h2>Mapa dos entregadores <small>posição estimada na rota</small></h2><div id="mapaAdmin"></div></div>' +
      '<div class="painel"><h2>Entregadores <small>equipe própria</small></h2><div class="rotas" id="rotas"></div><form id="formEntregador" class="form-linha" autocomplete="off"><input name="nome" placeholder="Nome" required maxlength="40" aria-label="Nome do entregador"><input name="fone" placeholder="WhatsApp" maxlength="20" aria-label="WhatsApp do entregador"><input name="moto" placeholder="Veículo" maxlength="30" aria-label="Veículo"><button class="btn pequeno" type="submit">Cadastrar</button></form></div></div>' +
      '<div class="painel" style="margin-top:18px"><h2>Pedidos <small>os feitos pela loja aparecem aqui · clique em “Ver itens” para abrir o pedido</small><button class="btn pequeno claro" id="pdfDia" type="button">Baixar pedidos do dia (PDF)</button></h2>' +
      '<div class="filtros" id="filtrosPed"></div>' +
      '<div class="rolagem"><table><thead><tr><th>Pedido</th><th>Cliente</th><th>Entrega</th><th class="num">Total</th><th>Status</th><th>Entregador</th><th>Ações</th></tr></thead><tbody id="corpoPedidos"></tbody></table></div></div>';
    desenhaPedidos(); montaMapaAdmin(); atualizaMapaAdmin();
  }
  function passaFiltro(p) {
    var st = JPD.statusDe(p);
    return filtroPed === 'todos' || (filtroPed === 'abertos' ? JPD.ativo(p) : st === filtroPed);
  }
  function detalhePedido(p) {
    var ent = p.tipo === 'retirada';
    return '<div class="det-pedido"><div class="det-itens"><table><thead><tr><th>Produto</th><th class="num">Quantidade</th><th class="num">Preço unitário</th><th class="num">Total</th></tr></thead><tbody>' +
      p.itens.map(function (i) { return '<tr><td>' + esc(i.nome) + (i.obs ? '<small>Observação: ' + esc(i.obs) + '</small>' : '') + '</td><td class="num">' + String(i.qtd).replace('.', ',') + ' ' + esc(i.un || '') + '</td><td class="num">' + JP.brl(i.preco) + '</td><td class="num">' + JP.brl(i.preco * i.qtd) + '</td></tr>'; }).join('') +
      '</tbody><tfoot><tr><td colspan="3">Subtotal</td><td class="num">' + JP.brl(JP.subtotal(p)) + '</td></tr><tr><td colspan="3">' + (ent ? 'Retirada' : 'Taxa de entrega' + (p.bairro ? ' (' + esc(p.bairro) + ')' : '')) + '</td><td class="num">' + JP.brl(p.taxa || 0) + '</td></tr><tr class="tot"><td colspan="3">Total do pedido</td><td class="num">' + JP.brl(JP.totalPedido(p)) + '</td></tr></tfoot></table></div>' +
      '<dl class="det-dados"><div><dt>Cliente</dt><dd>' + esc(p.cliente) + '</dd></div><div><dt>WhatsApp</dt><dd>' + esc(p.fone) + '</dd></div>' +
      '<div><dt>' + (ent ? 'Retirada' : 'Endereço de entrega') + '</dt><dd>' + (ent ? 'Retirada no local' : esc(p.endereco) + (p.bairro ? ' — ' + esc(p.bairro) : '')) + '</dd></div>' +
      '<div><dt>Forma de pagamento</dt><dd>' + esc(p.pagamento) + ' · ' + (p.pago ? 'pago' + (p.comprovante ? ' (' + esc(p.comprovante) + ')' : '') : 'a receber ' + JPD.resumoPagamento(p).quando) + '</dd></div>' +
      (p.motivoCancelamento ? '<div class="largo"><dt>Cancelamento</dt><dd>' + esc(p.motivoCancelamento) + '</dd></div>' : '') +
      (p.historico && p.historico.length ? '<div class="largo"><dt>Histórico</dt><dd>' + p.historico.map(function (h) { return esc(JPD.rotulo(p, h.st)) + ' — ' + JP.dataHora(h.em) + (h.por ? ' (' + esc(h.por) + ')' : ''); }).join('<br>') + '</dd></div>' : '') +
      '<div class="largo"><dt>Observações</dt><dd>' + (p.obs ? esc(p.obs) : '<i>Sem observações.</i>') + '</dd></div>' +
      '<div class="largo"><button class="btn pequeno" type="button" data-pdf="' + p.id + '">Baixar pedido em PDF</button> <button class="btn pequeno claro" type="button" data-imprimir="' + p.id + '">Imprimir comanda</button></div></dl></div>';
  }
  function desenhaPedidos() {
    var fl = $('#filtrosPed');
    if (fl) fl.innerHTML = FILTROS_PED.map(function (f) {
      var n = S.pedidos.filter(function (p) { var o = filtroPed; filtroPed = f[0]; var r = passaFiltro(p); filtroPed = o; return r; }).length;
      return '<button type="button" class="filtro' + (filtroPed === f[0] ? ' ativo' : '') + '" data-fped="' + f[0] + '">' + f[1] + ' (' + n + ')</button>';
    }).join('');
    var lista = S.pedidos.filter(passaFiltro);
    $('#corpoPedidos').innerHTML = lista.length ? lista.map(function (p) {
      var st = JPD.statusDe(p), ent = p.tipo === 'retirada' ? 'Retirada' : esc(p.bairro);
      var final = st === 'entregue' || st === 'cancelado';
      var sel = p.tipo === 'retirada' ? '<span class="chip cinza">—</span>' :
        '<select class="peq" data-moto="' + p.id + '" aria-label="Entregador do pedido ' + p.id + '"' + (final || st === 'saiu' ? ' disabled' : '') + '><option value="">Atribuir</option>' +
        S.motoboys.filter(function (m) { return m.ativo !== false || p.motoboy === m.id; }).map(function (m) { return '<option value="' + m.id + '"' + (p.motoboy === m.id ? ' selected' : '') + '>' + esc(m.nome) + '</option>'; }).join('') + '</select>';
      var prox = JPD.proximos(p, st).filter(function (x) { return x !== 'cancelado'; })[0];
      var avancar = prox ? '<button class="btn pequeno" data-avanca="' + p.id + '" data-para="' + prox + '">' + { confirmado: 'Confirmar', separando: 'Começar a separar', pronto: 'Marcar pronto', saiu: 'Saiu para entrega', entregue: p.tipo === 'retirada' ? 'Cliente retirou' : 'Entregue' }[prox] + '</button>' : '';
      var pagar = st === 'cancelado' ? '' : p.pago ? '<button class="btn pequeno claro" data-estorna="' + p.id + '">Estornar</button>' : '<button class="btn pequeno claro" data-pagar="' + p.id + '">Marcar pago</button>';
      var cancelar = !final ? '<button class="btn pequeno claro" data-cancela="' + p.id + '">Cancelar</button>' : '';
      return '<tr><td><b>' + p.id + '</b>' + (p.atacadoId ? ' <span class="chip rosa">Atacado</span>' : '') + (p.recompra ? ' <span class="chip ok">Recompra</span>' : '') + (p.agendado ? ' <span class="chip alerta">' + esc(p.agendado) + '</span>' : '') + '<small>' + JP.dataHora(p.criado) + '</small></td><td>' + esc(p.cliente) + '<small>' + esc(p.pagamento) + '</small></td><td>' + ent + '</td>' +
        '<td class="num">' + JP.brl(JP.totalPedido(p)) + '</td><td>' + chipSit(p) + ' ' + chipPago(p) + '</td><td>' + sel + '</td><td><div class="acoes">' + avancar + '<button class="btn pequeno claro" type="button" data-itens="' + p.id + '" aria-expanded="' + !!abertos[p.id] + '">' + (abertos[p.id] ? 'Ocultar' : 'Itens (' + p.itens.length + ')') + '</button><button class="btn pequeno claro" type="button" data-imprimir="' + p.id + '">Imprimir</button>' + pagar + cancelar + '</div></td></tr>' +
        (abertos[p.id] ? '<tr class="linha-det"><td colspan="7">' + detalhePedido(p) + '</td></tr>' : '');
    }).join('') : '<tr><td colspan="7" style="text-align:center;color:var(--suave);padding:22px">Nenhum pedido nesta lista.</td></tr>';
  }
  function imprimeComanda(p) {
    var w = window.open('', '_blank', 'width=420,height=640'); if (!w) { toast('O navegador bloqueou a janela de impressão. Libere pop-ups para este site.'); return; }
    var cfg = {}; try { cfg = JSON.parse(localStorage.getItem('jp_loja_v1') || 'null') || {}; } catch (e) {}
    w.document.write(JPD.comandaHtml(p, JPL.mescla(cfg))); w.document.close(); w.focus();
    setTimeout(function () { w.print(); }, 250);
  }
  function montaMapaAdmin() {
    if (mapa) { mapa.remove(); mapa = null; }
    mapa = L.map('mapaAdmin', { scrollWheelZoom: false }).setView([JP.BASE.lat, JP.BASE.lng], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(mapa);
    L.marker([JP.BASE.lat, JP.BASE.lng], { icon: L.divIcon({ className: '', html: '<div class="base-pin">Base</div>', iconSize: [0, 0], iconAnchor: [20, 12] }) }).addTo(mapa);
    mapaCam = L.layerGroup().addTo(mapa); mapa._motos = {}; mapa._rotas = '';
    setTimeout(function () { mapa && mapa.invalidateSize(); }, 150);
  }
  function ativasMapa() {
    return S.pedidos.filter(function (p) { return p.tipo === 'entrega' && p.motoboy && JPD.ativo(p) && JPD.statusDe(p) !== 'novo'; });
  }
  function atualizaMapaAdmin() {
    if (!mapa) return;
    var at = ativasMapa(), assinatura = at.map(function (p) { return p.id + p.motoboy; }).join('|');
    if (assinatura !== mapa._rotas) { // redesenha rotas só quando algo mudou
      mapaCam.clearLayers(); mapa._motos = {}; mapa._rotas = assinatura;
      at.forEach(function (p) {
        var b = JP.BAIRROS.filter(function (x) { return x.nome === p.bairro; })[0]; if (!b) return;
        var pts = JP.rota(b), cor = CORES[p.motoboy] || '#0b4a5c';
        p._pts = pts;
        L.polyline(pts, { color: cor, weight: 4, opacity: .7, dashArray: '2 8' }).addTo(mapaCam);
        L.marker([b.lat, b.lng], { icon: L.divIcon({ className: '', html: '<div class="destino-pin" style="background:' + cor + '"></div>', iconSize: [22, 22], iconAnchor: [11, 22] }) }).addTo(mapaCam).bindTooltip(p.id + ' · ' + p.bairro);
        mapa._motos[p.id] = { pts: pts, m: L.marker(pts[0], { icon: L.divIcon({ className: '', html: '<div class="motoboy-pin" style="background:' + cor + '">' + esc((motoboy(p.motoboy) || {}).nome || '?').slice(0, 2) + '</div>', iconSize: [34, 34], iconAnchor: [17, 17] }) }).addTo(mapaCam).bindTooltip((motoboy(p.motoboy) || {}).nome + ' → ' + p.id) };
      });
      if (at.length) { var all = []; at.forEach(function (p) { all = all.concat(mapa._motos[p.id] ? mapa._motos[p.id].pts : []); }); try { mapa.fitBounds(L.latLngBounds(all), { padding: [30, 30] }); } catch (e) {} }
    }
    at.forEach(function (p) { var o = mapa._motos[p.id]; if (o) o.m.setLatLng(JP.pontoNaRota(o.pts, JP.situacao(p).prog)); });
    var r = $('#rotas');
    if (r) {
      var res = JPD.resumoEntregadores(S, new Date(JP.agora()).setHours(0, 0, 0, 0));
      r.innerHTML = S.motoboys.length ? S.motoboys.map(function (m) {
        var ps = at.filter(function (p) { return p.motoboy === m.id; }), ativo = m.ativo !== false, o = res[m.id] || {};
        var info = ps.length ? ps.map(function (p) { var s = JP.situacao(p); return p.id + ' → ' + esc(p.bairro) + ' · ' + (s.cod === 'saiu' ? 'na rua' : 'separando'); }).join('<br>') : (ativo ? 'Livre, aguardando pedido' : 'Desativado');
        return '<div class="rota"><span class="ponto" style="background:' + (CORES[m.id] || '#0b4a5c') + '"></span><div><b>' + esc(m.nome) + '</b> <small style="display:inline">' + esc(m.moto || '') + (m.fone ? ' · ' + esc(m.fone) : '') + '</small><br><span style="color:var(--suave)">' + info + '</span><br><small>Hoje: ' + (o.entregues || 0) + ' entregas · ' + JP.brl(o.taxas || 0) + ' em taxas</small></div><span><span class="chip ' + (!ativo ? 'cinza' : ps.length ? 'laranja' : 'ok') + '">' + (!ativo ? 'Inativo' : ps.length ? 'Em rota' : 'Livre') + '</span> <button type="button" class="btn pequeno claro" data-ent-toggle="' + m.id + '">' + (ativo ? 'Desativar' : 'Reativar') + '</button></span></div>';
      }).join('') : '<p class="vazio">Nenhum entregador cadastrado. Cadastre abaixo para poder mandar pedidos para a rua.</p>';
    }
  }

  /* ---------- Carteira de clientes ---------- */
  function clientes() {
    tela.innerHTML = '<div class="cab"><div><h1>Carteira de clientes</h1><p>Categorias automáticas por frequência, valor e tempo sem comprar.</p></div></div>' +
      '<div class="banner info"><div><b>Regras:</b> Inativo = sem comprar há mais de 45 dias · VIP = R$ 3.000 em compras ou 15 pedidos · Recorrente = 3 pedidos ou mais · Novo = menos de 3 pedidos.</div></div>' +
      '<div class="filtros" id="filtros"></div><div class="painel"><div class="rolagem"><table><thead><tr><th>Cliente</th><th>Bairro</th><th class="num">Pedidos</th><th class="num">Total comprado</th><th class="num">Ticket médio</th><th>Última compra</th><th>Categoria</th></tr></thead><tbody id="corpoCli"></tbody></table></div></div>';
    desenhaClientes();
  }
  function desenhaClientes() {
    var base = S.clientes.map(function (c) { return { c: c, k: categoria(c) }; });
    var cont = { todos: base.length }; base.forEach(function (x) { cont[x.k.cod] = (cont[x.k.cod] || 0) + 1; });
    var fs = [['todos', 'Todos'], ['novo', 'Novos'], ['recorrente', 'Recorrentes'], ['vip', 'VIP'], ['inativo', 'Inativos']];
    $('#filtros').innerHTML = fs.map(function (f) { return '<button class="filtro' + (filtroCli === f[0] ? ' ativo' : '') + '" data-fcli="' + f[0] + '">' + f[1] + '<b>' + (cont[f[0]] || 0) + '</b></button>'; }).join('') +
      '<input type="search" id="buscaCli" placeholder="Buscar cliente ou bairro" value="' + esc(buscaCli) + '" aria-label="Buscar cliente">';
    var lista = base.filter(function (x) { return (filtroCli === 'todos' || x.k.cod === filtroCli) && (!buscaCli || (x.c.nome + ' ' + x.c.bairro).toLowerCase().indexOf(buscaCli.toLowerCase()) >= 0); })
      .sort(function (a, b) { return b.c.total - a.c.total; });
    $('#corpoCli').innerHTML = lista.length ? lista.map(function (x) {
      var c = x.c; return '<tr><td><b>' + esc(c.nome) + '</b><small>' + esc(c.fone) + '</small></td><td>' + esc(c.bairro) + '</td><td class="num">' + c.pedidos + '</td><td class="num">' + JP.brl(c.total) + '</td><td class="num">' + JP.brl(c.total / c.pedidos) + '</td><td>' + ha(c.ultima) + '</td><td><span class="chip ' + x.k.cls + '">' + x.k.rot + '</span></td></tr>';
    }).join('') : '<tr><td colspan="7" class="vazio">Nenhum cliente neste filtro.</td></tr>';
    var b = $('#buscaCli'); if (b && document.activeElement !== b && buscaCli) { /* mantém foco natural */ }
  }

  /* ---------- Nota fiscal ---------- */
  function nf() {
    var elegiveis = S.pedidos.filter(function (p) { return p.confirmado; });
    if (!nfSel || !pedido(nfSel)) nfSel = elegiveis.length ? elegiveis[0].id : null;
    var p = nfSel ? pedido(nfSel) : null;
    tela.innerHTML = '<div class="cab"><div><h1>Nota fiscal</h1><p>Emissão de exemplo a partir de um pedido confirmado.</p></div></div>' +
      '<div class="banner alerta"><b>Demonstração.</b> Esta tela simula a emissão da NF-e. Nenhuma nota é transmitida à SEFAZ e os números gerados não têm valor fiscal.</div>' +
      '<div class="duas"><div class="painel"><h2>Nova nota</h2>' +
      (p ? '<div class="form-grade"><div class="campo largo"><label for="nfPedido">Pedido de origem</label><select id="nfPedido">' + elegiveis.map(function (o) { return '<option value="' + o.id + '"' + (o.id === nfSel ? ' selected' : '') + '>' + o.id + ' — ' + esc(o.cliente) + ' — ' + JP.brl(JP.totalPedido(o)) + '</option>'; }).join('') + '</select></div>' +
        '<div class="campo"><label for="nfDest">Destinatário</label><input id="nfDest" value="' + esc(p.cliente) + '"></div><div class="campo"><label for="nfDoc">CPF/CNPJ</label><input id="nfDoc" placeholder="000.000.000-00"></div>' +
        '<div class="campo"><label>Natureza da operação</label><input value="Venda de mercadoria" readonly></div><div class="campo"><label>CFOP</label><input value="5.102" readonly></div></div>' +
        '<div class="rolagem"><table><thead><tr><th>Produto</th><th>NCM</th><th class="num">Qtd</th><th class="num">Unit.</th><th class="num">Total</th></tr></thead><tbody>' +
        p.itens.map(function (i) { var pr = S.produtos.filter(function (x) { return x.id === i.id; })[0] || {}; return '<tr><td>' + esc(i.nome) + '</td><td>' + (pr.ncm || '—') + '</td><td class="num">' + i.qtd + ' ' + i.un + '</td><td class="num">' + JP.brl(i.preco) + '</td><td class="num">' + JP.brl(i.preco * i.qtd) + '</td></tr>'; }).join('') +
        '</tbody></table></div><p style="text-align:right;font-weight:700;margin:12px 0">Total da nota: ' + JP.brl(JP.subtotal(p)) + ' <small style="font-weight:400;color:var(--suave)">(frete cobrado à parte: ' + JP.brl(p.taxa) + ')</small></p>' +
        '<button class="btn" id="emitirNf">Emitir NF-e (simulação)</button>' : '<p class="vazio">Confirme um pedido primeiro para emitir a nota.</p>') + '</div>' +
      '<div class="painel"><h2>Notas emitidas <small>' + S.notas.length + ' nesta demonstração</small></h2>' +
      (S.notas.length ? S.notas.map(function (n) {
        return '<div class="cartao-nf" style="margin-bottom:14px"><h3>NF-e nº ' + n.numero + ' · série 1</h3><div>' + esc(n.dest) + ' — ' + JP.brl(n.valor) + '</div><div class="chave">Chave de acesso: ' + n.chave + '</div><div style="color:var(--suave)">Protocolo ' + n.protocolo + ' · ' + JP.dataHora(n.quando) + ' · pedido ' + n.pedido + '</div><span class="chip alerta" style="margin-top:8px">Simulada — sem valor fiscal</span></div>';
      }).join('') : '<p class="vazio">Nenhuma nota emitida ainda.</p>') + '</div></div>';
  }
  function emitirNf() {
    var p = pedido(nfSel); if (!p) return;
    var chave = ''; for (var i = 0; i < 44; i++) chave += Math.floor(Math.random() * 10);
    chave = chave.replace(/(.{4})/g, '$1 ').trim();
    S.notas.unshift({ numero: 1200 + S.notas.length + 1, chave: chave, protocolo: '1' + Math.floor(Math.random() * 1e14), dest: $('#nfDest').value || p.cliente, valor: JP.subtotal(p), pedido: p.id, quando: JP.agora() });
    JP.salvar(); toast('NF-e simulada emitida para ' + p.id + '. Sem valor fiscal.'); nf();
  }

  /* ---------- Estoque ---------- */
  var filtroEst = 'todos', buscaEst = '', extratoAberto = {};
  var TIPO_MOV = { venda: ['Venda', 'cinza'], estorno: ['Devolução', 'ok'], entrada: ['Entrada', 'ok'], ajuste: ['Ajuste', 'laranja'], perda: ['Perda', 'alerta'] };
  function qtdMov(b) { var q = Math.abs(b.qtd), sinal = (b.tipo === 'entrada' || b.tipo === 'estorno' || (b.tipo === 'ajuste' && b.qtd > 0)) ? '+' : '−'; if (b.tipo === 'estorno' && b.qtd > 0) sinal = '−'; if (!b.tipo) sinal = b.qtd < 0 ? '+' : '−'; return sinal + String(+q.toFixed(3)).replace('.', ','); }
  function linhaMov(b, comProduto) {
    var t = TIPO_MOV[b.tipo || 'venda'];
    return '<tr><td>' + JP.dataHora(b.quando) + '</td>' + (comProduto ? '<td>' + esc(b.produto) + '</td>' : '') + '<td><span class="chip ' + t[1] + '">' + t[0] + '</span></td><td class="num">' + qtdMov(b) + '</td><td class="num">' + String(+(+b.saldo).toFixed(3)).replace('.', ',') + '</td><td>' + esc(b.pedido || b.motivo || '') + (b.por ? '<small>' + esc(b.por) + '</small>' : '') + '</td></tr>';
  }
  function estoque() {
    var al = JPE.alertas(S), baixos = al.baixos.concat(al.esgotados);
    var lista = S.produtos.filter(function (p) {
      var c = JPE.situacao(p).cod;
      if (filtroEst === 'baixos' && c === 'normal') return false; if (filtroEst === 'esgotados' && c !== 'esgotado') return false;
      return !buscaEst || JPL.semAcento(p.nome + ' ' + p.cat).indexOf(JPL.semAcento(buscaEst)) >= 0;
    });
    var sug = JPE.sugestoes(S, { agora: JP.agora() });
    tela.innerHTML = '<div class="cab"><div><h1>Estoque</h1><p>A baixa é automática quando o pedido é confirmado e volta se ele for cancelado. Entradas, ajustes de contagem e perdas ficam registrados.</p></div><div><button class="btn pequeno claro" type="button" id="estCsv">Baixar planilha (CSV)</button></div></div>' +
      (baixos.length ? '<div class="banner alerta"><div><b>' + baixos.length + ' produto(s) pedem atenção:</b> ' + baixos.slice(0, 12).map(function (p) { return esc(p.nome) + ' (' + String(p.estoque).replace('.', ',') + ' ' + esc(p.un) + ')'; }).join(' · ') + (baixos.length > 12 ? ' …' : '') + '</div></div>' : '') +
      (sug.length ? '<div class="painel"><h2>Sugestão de compra <small>cobre 7 dias de venda, pela média dos últimos 14 dias, e nunca fica abaixo do mínimo</small></h2><div class="rolagem"><table><thead><tr><th>Produto</th><th class="num">Saldo</th><th class="num">Mínimo</th><th class="num">Vende por dia</th><th class="num">Comprar</th><th>Motivo</th></tr></thead><tbody>' + sug.slice(0, 15).map(function (x) { return '<tr><td><b>' + esc(x.nome) + '</b></td><td class="num">' + String(x.saldo).replace('.', ',') + ' ' + esc(x.un) + '</td><td class="num">' + x.min + '</td><td class="num">' + String(x.mediaDia).replace('.', ',') + '</td><td class="num"><b>' + String(x.comprar).replace('.', ',') + '</b></td><td>' + esc(x.motivo) + '</td></tr>'; }).join('') + '</tbody></table></div></div>' : '') +
      '<div class="painel" style="margin-top:18px"><h2>Produtos <small>' + lista.length + ' de ' + S.produtos.length + '</small></h2><div class="filtros">' +
      [['todos', 'Todos'], ['baixos', 'Abaixo do mínimo'], ['esgotados', 'Esgotados']].map(function (f) { return '<button type="button" class="filtro' + (filtroEst === f[0] ? ' ativo' : '') + '" data-fest="' + f[0] + '">' + f[1] + '</button>'; }).join('') +
      '<input class="peq" type="search" id="buscaEst" placeholder="Buscar produto" value="' + esc(buscaEst) + '" aria-label="Buscar produto no estoque" style="margin-left:auto;min-width:200px"></div>' +
      '<div class="rolagem"><table><thead><tr><th>Produto</th><th>Nível</th><th class="num">Saldo</th><th class="num">Mínimo</th><th>Situação</th><th>Movimentar</th></tr></thead><tbody>' +
      lista.map(function (p) {
        var sit = JPE.situacao(p), cr = sit.cod === 'esgotado' ? 'critico' : sit.cod === 'baixo' ? 'baixo' : '', pct = Math.min(100, p.estoque / (Math.max(p.min, 1) * 4) * 100);
        var st = '<span class="chip ' + { esgotado: 'perigo', baixo: 'alerta', normal: 'ok' }[sit.cod] + '">' + sit.rotulo + '</span>';
        return '<tr><td><b>' + esc(p.nome) + '</b><small>' + esc(p.cat) + '</small></td><td><div class="barra ' + cr + '"><i style="width:' + pct + '%"></i></div></td><td class="num"><b>' + String(p.estoque).replace('.', ',') + '</b> ' + esc(p.un) + '</td>' +
          '<td class="num"><input class="peq" style="width:64px" type="number" min="0" step="any" value="' + p.min + '" data-min="' + p.id + '" aria-label="Mínimo de ' + esc(p.nome) + '"></td><td>' + st + '</td>' +
          '<td><div class="acoes"><input class="peq" style="width:64px" type="number" min="0" step="any" placeholder="Qtd" id="ent-' + p.id + '" aria-label="Quantidade de entrada de ' + esc(p.nome) + '"><button class="btn pequeno claro" data-entrada="' + p.id + '">Repor</button><button class="btn pequeno claro" data-ajuste="' + p.id + '">Contar</button><button class="btn pequeno claro" data-perda="' + p.id + '">Perda</button><button class="btn pequeno claro" data-extrato="' + p.id + '">' + (extratoAberto[p.id] ? 'Ocultar' : 'Extrato') + '</button></div></td></tr>' +
          (extratoAberto[p.id] ? '<tr class="linha-det"><td colspan="6">' + (function () { var e = JPE.extrato(S, p.id, 15); return e.length ? '<table><thead><tr><th>Quando</th><th>Tipo</th><th class="num">Qtd</th><th class="num">Saldo</th><th>Origem</th></tr></thead><tbody>' + e.map(function (b) { return linhaMov(b, false); }).join('') + '</tbody></table>' : '<p class="vazio">Sem movimentação registrada.</p>'; })() + '</td></tr>' : '');
      }).join('') + '</tbody></table></div></div>' +
      '<div class="painel" style="margin-top:18px"><h2>Últimas movimentações <small>vendas, devoluções, entradas, contagens e perdas</small></h2>' +
      (S.baixas.length ? '<div class="rolagem"><table><thead><tr><th>Quando</th><th>Produto</th><th>Tipo</th><th class="num">Qtd</th><th class="num">Saldo</th><th>Origem</th></tr></thead><tbody>' + S.baixas.slice(0, 25).map(function (b) { return linhaMov(b, true); }).join('') + '</tbody></table></div>' : '<p class="vazio">Nenhuma movimentação ainda.</p>') + '</div>';
  }
  function movimenta(fn, ok) { var r = fn(); if (!r.ok) { toast(r.erro); return; } JP.salvar(); toast(ok(r)); estoque(); selos(); }

  /* ---------- roteamento ---------- */
  var MODULOS = { visao: visao, pedidos: pedidosTela, whatsapp: function () { WAA.render(tela); }, conversas: crmTela, funil: crmTela, campanhas: crmTela, receitas: posVendaTela, avaliacoes: posVendaTela, entregas: extrasTela, recompra: extrasTela, espera: extrasTela, atacado: extrasTela, clientes: clientes, nf: function () { if (window.JP_VAZIO) NFA.render(tela); else nf(); }, estoque: estoque, loja: lojaTela, frete: lojaTela, combos: lojaTela, produtos: produtosTela, categorias: produtosTela };
  function produtosTela() { PRA.render(tela, modulo); }
  function lojaTela() { LJA.render(tela, modulo); }
  function crmTela() { CRM.render(modulo, parametro, tela); }
  function posVendaTela() { PVA.render(modulo, tela); }
  function extrasTela() { EXP.render(modulo, tela); }
  function ir() {
    var h = (location.hash || '#visao').slice(1).split('/'), param = h[1] || '';
    h = h[0]; if (h === 'crm') h = 'funil'; if (h === 'ia') h = 'conversas'; if (h === 'unidades') h = 'produtos'; if (!MODULOS[h]) h = 'visao';
    modulo = h; parametro = param; recarrega();
    if (mapa && h !== 'pedidos') { mapa.remove(); mapa = null; }
    document.querySelectorAll('#menu a').forEach(function (a) { var on = a.dataset.m === h; a.classList.toggle('ativo', on); if (on) { a.setAttribute('aria-current', 'page'); $('#menuAtual').textContent = a.textContent.replace(/\d+$/, ''); } else a.removeAttribute('aria-current'); });
    fechaMenu();
    MODULOS[h](); selos(); window.scrollTo(0, 0);
  }

  /* ---------- PDF ---------- */
  function carregaLogo() {
    if (logoPdf) return Promise.resolve(logoPdf);
    return new Promise(function (ok) {
      var im = new Image(); im.onload = function () { var c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; c.getContext('2d').drawImage(im, 0, 0); logoPdf = c.toDataURL('image/png'); ok(logoPdf); };
      im.onerror = function () { ok(null); }; im.src = 'img/marca/logo-julia-192.png';
    });
  }
  function sitTexto(p) { var s = JP.situacao(p); return p.tipo === 'retirada' && s.cod === 'chegou' ? 'Pronto para retirada' : s.rotulo; }
  function baixaPdf(qual, id) {
    if (!window.jspdf) { toast('O gerador de PDF não carregou. Verifique a conexão e tente de novo.'); return; }
    recarrega();
    carregaLogo().then(function (logo) {
      var doc, nome;
      if (qual === 'pedido') { var p = pedido(id); if (!p) return; doc = JPPDF.pedido(window.jspdf, p, logo, sitTexto); nome = 'pedido-' + p.id + '-julia-pescados.pdf'; }
      else {
        var hoje = S.pedidos.filter(function (p) { return dias(p.criado) < 1; }), d = new Date(JP.agora());
        if (!hoje.length) { toast('Não há pedidos de hoje para exportar.'); return; }
        var txt = d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
        doc = JPPDF.lista(window.jspdf, hoje, logo, txt, sitTexto); nome = 'pedidos-do-dia-' + d.toISOString().slice(0, 10) + '-julia-pescados.pdf';
      }
      doc.save(nome); toast('PDF gerado: ' + nome);
    });
  }

  function mudaStatus(id, para, op) {
    op = op || {}; op.por = (window.JP_USUARIO || {}).usuario;
    var r = JP.mudarStatus(id, para, op); recarrega();
    if (!r.ok) { toast(r.erro); return; }
    toast(para === 'confirmado' ? 'Pedido ' + id + ' confirmado. Estoque baixado.' : para === 'cancelado' ? 'Pedido ' + id + ' cancelado e estoque devolvido.' : 'Pedido ' + id + ': ' + JPD.rotulo(pedido(id), para).toLowerCase() + '.');
    desenhaPedidos(); atualizaMapaAdmin(); selos();
  }

  /* ---------- eventos ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('button'); if (!t) return;
    if (t.dataset.itens) { abertos[t.dataset.itens] = !abertos[t.dataset.itens]; desenhaPedidos(); }
    else if (t.dataset.pdf) baixaPdf('pedido', t.dataset.pdf);
    else if (t.id === 'pdfDia') baixaPdf('dia');
    else if (t.dataset.avanca) mudaStatus(t.dataset.avanca, t.dataset.para);
    else if (t.dataset.cancela) {
      var mot = window.prompt('Motivo do cancelamento do pedido ' + t.dataset.cancela + ':'); if (mot === null) return;
      mudaStatus(t.dataset.cancela, 'cancelado', { motivo: mot });
    }
    else if (t.dataset.pagar) {
      var pp = pedido(t.dataset.pagar), ref = window.prompt('Pagamento do pedido ' + pp.id + ' (' + JP.brl(JP.totalPedido(pp)) + ', ' + pp.pagamento + ').\nReferência do comprovante (opcional, ex.: código do Pix):', ''); if (ref === null) return;
      var rp = JPD.registraPagamento(pp, { agora: JP.agora(), por: (window.JP_USUARIO || {}).usuario, ref: ref, total: JP.totalPedido(pp) });
      if (rp.ok) { JP.salvar(); toast('Pagamento do ' + pp.id + ' registrado.'); } else toast(rp.erro); desenhaPedidos(); selos();
    }
    else if (t.dataset.estorna) {
      var pe = pedido(t.dataset.estorna), me = window.prompt('Motivo do estorno do pagamento ' + pe.id + ':'); if (me === null) return;
      var re = JPD.estornaPagamento(pe, { agora: JP.agora(), motivo: me });
      if (re.ok) { JP.salvar(); toast('Pagamento estornado.'); } else toast(re.erro); desenhaPedidos();
    }
    else if (t.dataset.imprimir) imprimeComanda(pedido(t.dataset.imprimir));
    else if (t.dataset.fped) { filtroPed = t.dataset.fped; desenhaPedidos(); }
    else if (t.dataset.entToggle) {
      var en = motoboy(t.dataset.entToggle); en.ativo = en.ativo === false; JP.salvar(); toast(en.nome + (en.ativo ? ' reativado.' : ' desativado; não recebe novos pedidos.')); atualizaMapaAdmin(); desenhaPedidos();
    }
    else if (t.dataset.fcli) { filtroCli = t.dataset.fcli; desenhaClientes(); }
    else if (t.dataset.entrada) {
      var inp = $('#ent-' + t.dataset.entrada), pr = S.produtos.filter(function (x) { return x.id === t.dataset.entrada; })[0], q = parseFloat(String(inp.value).replace(',', '.'));
      var mo = (window.prompt('Entrada de ' + (q || '?') + ' ' + pr.un + ' em ' + pr.nome + '.\nOrigem (opcional, ex.: compra do fornecedor):', 'Compra') || '');
      movimenta(function () { return JPE.entrada(S, pr.id, q, { agora: JP.agora(), por: (window.JP_USUARIO || {}).usuario, motivo: mo }); }, function (r) { return 'Entrada registrada. Saldo de ' + pr.nome + ': ' + r.saldo + ' ' + pr.un + '.'; });
    }
    else if (t.dataset.ajuste) {
      var pa = S.produtos.filter(function (x) { return x.id === t.dataset.ajuste; })[0], cont = window.prompt('Contagem física de ' + pa.nome + ' (' + pa.un + ').\nSaldo no sistema: ' + pa.estoque + '. Quanto há de verdade?'); if (cont === null) return;
      var ma = window.prompt('Motivo do ajuste (obrigatório):', 'Contagem do freezer'); if (ma === null) return;
      movimenta(function () { return JPE.ajuste(S, pa.id, parseFloat(String(cont).replace(',', '.')), { agora: JP.agora(), por: (window.JP_USUARIO || {}).usuario, motivo: ma }); }, function (r) { return 'Saldo ajustado (' + (r.diferenca > 0 ? '+' : '') + r.diferenca + ').'; });
    }
    else if (t.dataset.perda) {
      var pp2 = S.produtos.filter(function (x) { return x.id === t.dataset.perda; })[0], qp = window.prompt('Quanto de ' + pp2.nome + ' (' + pp2.un + ') foi perdido?'); if (qp === null) return;
      var mp = window.prompt('Motivo da perda (obrigatório):', 'Descongelou'); if (mp === null) return;
      movimenta(function () { return JPE.perda(S, pp2.id, parseFloat(String(qp).replace(',', '.')), { agora: JP.agora(), por: (window.JP_USUARIO || {}).usuario, motivo: mp }); }, function () { return 'Perda registrada.'; });
    }
    else if (t.dataset.extrato) { extratoAberto[t.dataset.extrato] = !extratoAberto[t.dataset.extrato]; estoque(); }
    else if (t.dataset.fest) { filtroEst = t.dataset.fest; estoque(); }
    else if (t.id === 'estCsv') {
      var blob = new Blob(['\ufeff' + JPE.csv(S)], { type: 'text/csv;charset=utf-8' }), a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'estoque-' + new Date(JP.agora()).toISOString().slice(0, 10) + '.csv'; a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    }
    else if (t.id === 'emitirNf') emitirNf();
  });
  document.addEventListener('change', function (e) {
    if (e.target.dataset.moto !== undefined) {
      var p = pedido(e.target.dataset.moto), ra = JPD.atribui(S, p, e.target.value); if (!ra.ok) { toast(ra.erro); desenhaPedidos(); return; } JP.salvar(); toast(p.motoboy ? 'Entregador ' + motoboy(p.motoboy).nome + ' atribuído ao ' + p.id + '.' : 'Entregador removido do ' + p.id + '.'); atualizaMapaAdmin();
    } else if (e.target.dataset.min !== undefined) {
      var rm = JPE.defineMinimo(S, e.target.dataset.min, e.target.value); if (!rm.ok) { toast(rm.erro); estoque(); return; } JP.salvar(); toast('Mínimo salvo.'); estoque(); selos();
    } else if (e.target.id === 'nfPedido') { nfSel = e.target.value; nf(); }
  });
  document.addEventListener('submit', function (e) {
    if (e.target.id !== 'formEntregador') return; e.preventDefault();
    var f = e.target, nome = f.nome.value.trim(); if (!nome) return;
    S.motoboys.push({ id: 'm' + Date.now().toString(36), nome: nome.slice(0, 40), fone: f.fone.value.trim().slice(0, 20), moto: f.moto.value.trim().slice(0, 30), ativo: true });
    JP.salvar(); toast('Entregador ' + nome + ' cadastrado.'); f.reset(); atualizaMapaAdmin(); desenhaPedidos();
  });
  document.addEventListener('input', function (e) { if (e.target.id === 'buscaEst') { buscaEst = e.target.value; var ps = e.target.selectionStart; estoque(); var be = $('#buscaEst'); be.focus(); be.setSelectionRange(ps, ps); return; } if (e.target.id === 'buscaCli') { buscaCli = e.target.value; var pos = e.target.selectionStart; desenhaClientes(); var b = $('#buscaCli'); b.focus(); b.setSelectionRange(pos, pos); } });

  // pedidos feitos na loja (outra aba) chegam aqui sozinhos
  window.addEventListener('storage', function (e) {
    if (e.key !== 'jp_demo_v1') return;
    recarrega(); selos();
    if (modulo === 'pedidos') { desenhaPedidos(); atualizaMapaAdmin(); } else if (modulo === 'visao') visao();
    else if (modulo === 'estoque') estoque();
    else if (modulo === 'clientes') desenhaClientes();
  });

  // relógio: move os motoboys e atualiza as situações sem recriar a tela
  ticker = setInterval(function () {
    if (modulo === 'pedidos') {
      recarrega();
      document.querySelectorAll('[data-sit]').forEach(function (el) { var p = pedido(el.dataset.sit); if (p) el.outerHTML = chipSit(p); });
      atualizaMapaAdmin();
    }
  }, 1000);

  CRM.init({
    estado: function () { return S; }, salvarEstado: function () { JP.salvar(); }, esc: esc, toast: toast, brl: JP.brl, dataHora: JP.dataHora, ha: ha,
    totalPedido: JP.totalPedido, categoria: categoria, selos: selos, modulo: function () { return modulo; }
  });
  PVA.init({ estado: function () { return S; }, esc: esc, toast: toast, ha: ha, dataHora: JP.dataHora, selos: selos, modulo: function () { return modulo; } });
  EXP.init({ estado: function () { return S; }, recarrega: recarrega, esc: esc, toast: toast, ha: ha, brl: JP.brl, dataHora: JP.dataHora, selos: selos, modulo: function () { return modulo; } });
  WAA.init({ esc: esc, toast: toast });
  NFA.init({ esc: esc, toast: toast, estado: function () { return S; } });
  PRA.init({ estado: function () { return S; }, esc: esc, toast: toast });
  LJA.init({ estado: function () { return S; }, esc: esc, toast: toast });
  // menu no celular: botão abre e fecha a lista agrupada
  function fechaMenu() { var b = $('#menuBotao'); document.body.classList.remove('menu-aberto'); if (b) b.setAttribute('aria-expanded', 'false'); }
  $('#menuBotao').addEventListener('click', function () { var ab = document.body.classList.toggle('menu-aberto'); this.setAttribute('aria-expanded', String(ab)); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && document.body.classList.contains('menu-aberto')) { fechaMenu(); $('#menuBotao').focus(); } });
  window.addEventListener('hashchange', ir);
  ir();
})();
