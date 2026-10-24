/* Novidades no painel da Julia Pescados: entregas do dia (rota e aviso de saída), recompra automática,
   lote fresco (lista de espera) e atacado para restaurantes.
   Demonstração: os avisos aparecem só nas Conversas deste navegador; nada é enviado. */
(function () {
  var ctx = null, mapa = null;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var DIA = 86400000;
  var F = { moto: '', espera: {}, atacadoSel: 'a1' };

  function esc(t) { return ctx.esc(t); }
  function S() { return ctx.estado(); }
  function primeiro(n) { return /^(Restaurante|Bar|Cantina|Hotel)\b/.test(n) ? String(n) : String(n || '').split(' ')[0]; }
  function prod(id) { return S().produtos.filter(function (p) { return p.id === id; })[0]; }
  function pedido(id) { return S().pedidos.filter(function (p) { return p.id === id; })[0]; }
  function motoboy(id) { return S().motoboys.filter(function (m) { return m.id === id; })[0]; }
  function diasDesde(ms) { return Math.floor((Date.now() - ms) / DIA); }
  function link(arq, params) {
    var u = new URL(arq, location.href); Object.keys(params || {}).forEach(function (k) { u.searchParams.set(k, params[k]); }); return u.href;
  }
  function itensTxt(its) {
    var l = (its || []).map(function (i) { var p = prod(i[0] || i.id); return p ? (p.un === 'kit' ? (i[1] || i.qtd) + ' ' : (i[1] || i.qtd) + ' ' + p.un + ' de ') + p.nome : ''; }).filter(Boolean);
    return l.join(', ').replace(/, ([^,]*)$/, ' e $1');
  }
  function chave(ativa, rotulo, id) {
    return '<button type="button" class="pv-chave" role="switch" aria-checked="' + ativa + '" id="' + id + '"><i aria-hidden="true"></i><span>' + rotulo + '</span></button>';
  }
  function kpi(t, v, sub, cls) { return '<div class="kpi ' + (cls || '') + '"><span>' + t + '</span><b>' + v + '</b><small>' + sub + '</small></div>'; }
  function fmtDia(ms) { return new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }); }
  function hhmm(h) { var m = Math.round((h % 1) * 60); return Math.floor(h) + 'h' + (m ? ('0' + m).slice(-2) : ''); }

  /* ================= Entregas do dia ================= */
  function bairroDe(nome) { return JP.BAIRROS.filter(function (b) { return b.nome === nome; })[0]; }
  function entregasHoje() {
    return S().pedidos.filter(function (p) { return p.tipo === 'entrega' && !p.agendado && JPD.ativo(p) && JP.situacao(p).cod !== 'chegou' && (!F.moto || p.motoboy === F.moto); });
  }
  // Ordena pelo vizinho mais próximo a partir da base, uma volta para Fortaleza e outra para Caucaia.
  function ordenaRota(lista) {
    var grupos = [['Fortaleza', []], ['Caucaia', []]];
    lista.forEach(function (p) { grupos[/^Caucaia/.test(p.bairro) ? 1 : 0][1].push(p); });
    return grupos.filter(function (g) { return g[1].length; }).map(function (g) {
      var resto = g[1].slice(), atual = [JP.BASE.lat, JP.BASE.lng], paradas = [], acum = 0;
      while (resto.length) {
        var melhor = 0, dm = Infinity;
        resto.forEach(function (p, i) { var b = bairroDe(p.bairro) || JP.BASE, d = JP.km(atual[0], atual[1], b.lat, b.lng) * 1.3; if (d < dm) { dm = d; melhor = i; } });
        var p = resto.splice(melhor, 1)[0], b = bairroDe(p.bairro) || JP.BASE;
        acum += dm; paradas.push({ p: p, trecho: dm, acum: acum, lat: b.lat, lng: b.lng }); atual = [b.lat, b.lng];
      }
      return { nome: g[0], paradas: paradas, total: acum };
    });
  }
  function entregas(tela) {
    var e = EX.ler().entrega, hoje = entregasHoje(), rotas = ordenaRota(hoje);
    var amanha = S().pedidos.filter(function (p) { return p.tipo === 'entrega' && p.agendado && p.fixo !== 'entregue'; });
    var h = EX.hora(), depois = EX.aposCorte(), pd = EX.proxDia();
    var n = 0;
    tela.innerHTML = '<div class="cab"><div><h1>Entregas do dia</h1><p>As entregas de hoje ordenadas por proximidade, primeiro Fortaleza e depois Caucaia. Ao sair, o cliente recebe o aviso no WhatsApp.</p></div></div>' +
      '<div class="kpis">' + kpi('Entregas na rota', hoje.length, rotas.length ? rotas.map(function (r) { return r.nome + ': ' + r.paradas.length; }).join(' · ') : 'nenhuma pendente') +
      kpi('Distância estimada', rotas.reduce(function (t, r) { return t + r.total; }, 0).toFixed(1).replace('.', ',') + ' km', 'ida pela rota sugerida') +
      kpi('Já saíram', hoje.filter(function (p) { return JP.situacao(p).cod === 'saiu'; }).length, 'em rota agora') +
      kpi('Para ' + pd.texto.split(',')[0], amanha.length, 'feitos depois do corte', amanha.length ? 'alerta' : '') + '</div>' +
      '<div class="painel ex-corte"><div><h2>Horário de corte <small>agora são ' + hhmm(h) + (depois ? ' · pedidos novos já entram para ' + esc(pd.texto) : ' · pedidos novos saem hoje') + '</small></h2>' +
      '<div class="ex-linha"><div class="campo"><label for="exCorte">Aceita pedidos para hoje até as</label><input id="exCorte" type="number" min="6" max="20" step="1" value="' + e.corte + '"> <span class="ex-un">h</span></div>' +
      '<div class="campo"><label for="exSim">Horário da demonstração</label><select id="exSim"><option value="real"' + (e.simulacao === 'real' ? ' selected' : '') + '>Horário real</option><option value="antes"' + (e.simulacao === 'antes' ? ' selected' : '') + '>Simular manhã (antes do corte)</option><option value="depois"' + (e.simulacao === 'depois' ? ' selected' : '') + '>Simular tarde (depois do corte)</option></select></div>' +
      '<div class="campo"><label for="exMoto">Entregador</label><select id="exMoto"><option value="">Todos</option>' + S().motoboys.map(function (m) { return '<option value="' + m.id + '"' + (F.moto === m.id ? ' selected' : '') + '>' + esc(m.nome) + '</option>'; }).join('') + '</select></div>' +
      '<button class="btn pequeno" id="exCorteSalvar">Salvar</button></div>' +
      '<p class="pv-nota">Depois do corte a loja continua aceitando o pedido, mas avisa no carrinho, na confirmação e no WhatsApp que a entrega é no próximo dia útil. A simulação de horário só vale para a demonstração.</p></div>' +
      '<div>' + chave(e.avisoSaiu, e.avisoSaiu ? 'Aviso “saiu para entrega” ligado' : 'Aviso “saiu para entrega” desligado', 'exAvisoSaiu') +
      '<p class="pv-nota">A IA avisa o cliente na conversa assim que o pedido sai, pelo botão desta tela ou automaticamente.</p></div></div>' +
      '<div class="mapa-linha"><div class="painel"><h2>Mapa da rota <small>paradas na ordem sugerida</small></h2><div id="mapaRota"></div></div>' +
      '<div class="painel"><h2>Resumo por entregador</h2><div class="rotas">' + S().motoboys.map(function (m) {
        var ps = hoje.filter(function (p) { return p.motoboy === m.id; });
        return '<div class="rota"><span class="ponto" style="background:' + ({ m1: '#9c2417', m2: '#0b4a5c', m3: '#e0861a' }[m.id] || '#0b4a5c') + '"></span><div><b>' + esc(m.nome) + '</b> <small style="display:inline">' + esc(m.moto) + '</small><br><span style="color:var(--suave)">' + (ps.length ? ps.map(function (p) { return esc(p.bairro); }).join(' · ') : 'Sem entregas atribuídas') + '</span></div></div>';
      }).join('') + (hoje.some(function (p) { return !p.motoboy; }) ? '<div class="banner alerta">Há entregas sem entregador: confirme o pedido em “Pedidos e delivery” para atribuir.</div>' : '') + '</div></div></div>' +
      (rotas.length ? rotas.map(function (r, ri) {
        return '<div class="painel" style="margin-top:18px"><h2>Rota ' + (ri + 1) + ' — ' + r.nome + ' <small>' + r.paradas.length + ' parada(s) · ' + r.total.toFixed(1).replace('.', ',') + ' km</small>' +
          '<button class="btn pequeno" data-ex-saiu-rota="' + ri + '">Saiu para entrega — rota inteira</button></h2>' +
          '<div class="rolagem"><table><thead><tr><th>#</th><th>Bairro</th><th>Pedido</th><th>Endereço</th><th class="num">Trecho</th><th class="num">Acumulado</th><th>Entregador</th><th>Situação</th><th></th></tr></thead><tbody>' +
          r.paradas.map(function (x) {
            n++; var p = x.p, s = JP.situacao(p), saiu = s.cod === 'saiu';
            return '<tr><td><span class="ex-num">' + n + '</span></td><td><b>' + esc(p.bairro) + '</b></td><td>' + p.id + '<small>' + esc(p.cliente) + '</small></td><td>' + esc(p.endereco) + '</td>' +
              '<td class="num">' + x.trecho.toFixed(1).replace('.', ',') + ' km</td><td class="num">' + x.acum.toFixed(1).replace('.', ',') + ' km</td><td>' + (p.motoboy ? esc(motoboy(p.motoboy).nome) : '<span class="chip cinza">—</span>') + '</td>' +
              '<td>' + (saiu ? '<span class="chip laranja">Em rota</span>' : p.confirmado ? '<span class="chip cinza">Separando</span>' : '<span class="chip alerta">Aguardando confirmação</span>') + '</td>' +
              '<td><button class="btn pequeno' + (saiu ? ' claro' : '') + '" data-ex-saiu="' + p.id + '"' + (saiu ? ' disabled' : '') + '>' + (saiu ? 'Aviso enviado' : 'Saiu para entrega') + '</button></td></tr>';
          }).join('') + '</tbody></table></div></div>';
      }).join('') : '<div class="painel" style="margin-top:18px"><p class="vazio">Nenhuma entrega pendente hoje' + (F.moto ? ' para este entregador' : '') + '.</p></div>') +
      '<div class="painel" style="margin-top:18px"><h2>Programadas para ' + esc(pd.texto) + ' <small>pedidos feitos depois das ' + e.corte + 'h</small></h2>' +
      (amanha.length ? '<div class="rolagem"><table><thead><tr><th>Pedido</th><th>Cliente</th><th>Bairro</th><th class="num">Total</th><th>Entrega</th></tr></thead><tbody>' +
        amanha.map(function (p) { return '<tr><td><b>' + p.id + '</b><small>' + ctx.dataHora(p.criado) + '</small></td><td>' + esc(p.cliente) + '</td><td>' + esc(p.bairro) + '</td><td class="num">' + ctx.brl(JP.totalPedido(p)) + '</td><td><span class="chip alerta">' + esc(p.agendado) + '</span></td></tr>'; }).join('') + '</tbody></table></div>'
        : '<p class="vazio">Nenhum pedido programado. Para ver o aviso, escolha “Simular tarde” acima e faça um pedido na loja.</p>') + '</div>';
    montaMapa(rotas);
  }
  function montaMapa(rotas) {
    if (mapa) { mapa.remove(); mapa = null; }
    var el = $('#mapaRota'); if (!el || !window.L) return;
    mapa = L.map(el, { scrollWheelZoom: false }).setView([JP.BASE.lat, JP.BASE.lng], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(mapa);
    L.marker([JP.BASE.lat, JP.BASE.lng], { icon: L.divIcon({ className: '', html: '<div class="base-pin">Base</div>', iconSize: [0, 0], iconAnchor: [20, 12] }) }).addTo(mapa);
    var todos = [[JP.BASE.lat, JP.BASE.lng]], cores = ['#9c2417', '#0b4a5c'], n = 0;
    rotas.forEach(function (r, ri) {
      var pts = [[JP.BASE.lat, JP.BASE.lng]];
      r.paradas.forEach(function (x) {
        n++; pts.push([x.lat, x.lng]); todos.push([x.lat, x.lng]);
        L.marker([x.lat, x.lng], { icon: L.divIcon({ className: '', html: '<div class="ex-pino" style="background:' + cores[ri] + '">' + n + '</div>', iconSize: [28, 28], iconAnchor: [14, 14] }) }).addTo(mapa).bindTooltip(x.p.id + ' · ' + x.p.bairro);
      });
      L.polyline(pts, { color: cores[ri], weight: 3, opacity: .7, dashArray: '4 8' }).addTo(mapa);
    });
    if (todos.length > 1) { try { mapa.fitBounds(L.latLngBounds(todos), { padding: [30, 30] }); } catch (e) {} }
    setTimeout(function () { mapa && mapa.invalidateSize(); }, 150);
  }
  // Marca "saiu para entrega" (confirma o pedido, se preciso) e avisa o cliente no WhatsApp.
  function saiu(ids) {
    var feitos = 0;
    ids.forEach(function (id) {
      var p = pedido(id); if (!p || p.fixo === 'entregue' || p.saiuEm) return;
      var etapas = ['confirmado', 'separando', 'pronto', 'saiu'], erro = null;
      for (var k = 0; k < etapas.length && !erro; k++) { // "saiu" na tela de entregas passa pelas etapas que faltam
        var atual = JPD.statusDe(pedido(id));
        if (atual === 'saiu') break;
        if (etapas.indexOf(atual) >= k) continue;
        var r = JP.mudarStatus(id, etapas[k], { por: 'entregas do dia' }); ctx.recarrega();
        if (!r.ok) erro = r.erro;
      }
      if (erro) { ctx.toast(erro); return; }
      feitos++;
    });
    if (feitos) { vigia(); ctx.toast(feitos === 1 ? 'Saiu para entrega. O cliente foi avisado no WhatsApp (simulado).' : feitos + ' entregas saíram. Os clientes foram avisados no WhatsApp (simulado).'); }
    entregas($('#tela'));
  }
  function avisaSaida(p) {
    var e = EX.ler().entrega, m = motoboy(p.motoboy);
    var txt = e.textoSaiu.replace(/\{nome\}/g, primeiro(p.cliente)).replace(/\{pedido\}/g, p.id).replace(/\{motoboy\}/g, m ? m.nome : 'nosso entregador');
    PVA.avisar({ nome: p.cliente, fone: p.fone, bairro: p.bairro }, txt, 'Site — pedido ' + p.id);
  }
  function avisaAgendado(p) {
    var e = EX.ler().entrega;
    var txt = e.textoAgendado.replace(/\{nome\}/g, primeiro(p.cliente)).replace(/\{pedido\}/g, p.id).replace(/\{corte\}/g, e.corte).replace(/\{quando\}/g, p.agendado);
    PVA.avisar({ nome: p.cliente, fone: p.fone, bairro: p.bairro }, txt, 'Site — pedido ' + p.id);
  }

  /* ================= Recompra automática ================= */
  function situacaoRecompra(c) {
    var r = EX.ler().recompra, d = diasDesde(c.ultima);
    if (d >= r.min && d <= r.max) return { cod: 'janela', rot: 'Na janela de aviso', cls: 'ok', dias: d };
    if (d < r.min) return { cod: 'espera', rot: 'Faltam ' + (r.min - d) + ' dia(s)', cls: 'cinza', dias: d };
    return { cod: 'passou', rot: 'Passou da janela', cls: 'alerta', dias: d };
  }
  function enviarRecompra(c) {
    var r = EX.ler().recompra, dias = diasDesde(c.ultima);
    var url = link('/', { repetir: c.id, ref: 'recompra' });
    var txt = r.texto.replace(/\{nome\}/g, primeiro(c.nome)).replace(/\{dias\}/g, dias).replace(/\{itens\}/g, itensTxt(c.itens)).replace(/\{link\}/g, url);
    var l = PVA.avisar(c, txt, 'Recompra automática');
    r.enviados[c.id] = c.ultima;
    r.historico.unshift({ quando: Date.now(), clienteId: c.id, cliente: c.nome, dias: dias, status: 'enviado' });
    EX.salvar();
    return l;
  }
  function elegiveis() {
    return S().clientes.filter(function (c) { return situacaoRecompra(c).cod === 'janela' && EX.ler().recompra.enviados[c.id] !== c.ultima; });
  }
  function recompra(tela) {
    var r = EX.ler().recompra, cs = S().clientes.map(function (c) { return { c: c, s: situacaoRecompra(c) }; });
    var ordem = { janela: 0, espera: 1, passou: 2 };
    cs.sort(function (a, b) { return ordem[a.s.cod] - ordem[b.s.cod] || a.s.dias - b.s.dias; });
    var h30 = r.historico.filter(function (x) { return Date.now() - x.quando < 30 * DIA; });
    var rep = h30.filter(function (x) { return x.status === 'repetiu'; }).length;
    var pend = elegiveis().length;
    tela.innerHTML = '<div class="cab"><div><h1>Recompra automática</h1><p>Entre ' + r.min + ' e ' + r.max + ' dias depois do último pedido, a IA lembra o cliente e oferece um botão para repetir o pedido.</p></div></div>' +
      '<div class="kpis">' + kpi('Na janela agora', cs.filter(function (x) { return x.s.cod === 'janela'; }).length, pend ? pend + ' ainda sem aviso' : 'todos já avisados', pend ? 'alerta' : '') +
      kpi('Avisos em 30 dias', h30.length, 'enviados pela IA') + kpi('Pedidos repetidos', rep, 'pelo botão do aviso') +
      kpi('Taxa de repetição', h30.length ? Math.round(rep / h30.length * 100) + '%' : '—', 'repetiu ÷ avisados') + '</div>' +
      '<div class="duas"><div class="painel"><h2>Regra</h2>' + chave(r.ativa, r.ativa ? 'Recompra automática ligada' : 'Recompra automática desligada', 'exRecAtiva') +
      '<div class="ex-linha" style="margin-top:14px"><div class="campo"><label for="exRecMin">Avisar a partir de</label><input id="exRecMin" type="number" min="3" max="60" value="' + r.min + '"> <span class="ex-un">dias</span></div>' +
      '<div class="campo"><label for="exRecMax">até</label><input id="exRecMax" type="number" min="4" max="90" value="' + r.max + '"> <span class="ex-un">dias</span></div></div>' +
      '<p class="pv-nota">Quem passa do prazo sem comprar deixa de receber o aviso e segue para as campanhas de reativação.</p>' +
      '<label for="exRecTexto" style="display:block;margin-top:10px">Mensagem <small class="pv-mudo">use {nome}, {dias}, {itens} e {link}</small></label><textarea id="exRecTexto" rows="4">' + esc(r.texto) + '</textarea>' +
      '<div class="acoes"><button class="btn pequeno" id="exRecSalvar">Salvar regra</button><button class="btn pequeno claro" id="exRecPadrao">Voltar ao padrão</button></div></div>' +
      '<div class="painel"><h2>O que o cliente recebe</h2><div class="pv-ex"><small>Conversa no WhatsApp</small><p class="pv-prev">' + esc(r.texto.replace(/\{nome\}/g, 'Tereza').replace(/\{dias\}/g, 11).replace(/\{itens\}/g, '2 kg de Camarão descascado e 1 kg de Filé de salmão').replace(/\{link\}/g, link('/', { repetir: 'c14' }))).replace(/\n/g, '<br>') + '</p></div>' +
      '<p class="pv-nota">O link abre a loja com o carrinho já montado com o último pedido: o cliente só confere o endereço e finaliza.</p>' +
      '<div class="acoes"><button class="btn pequeno" id="exRecRodar"' + (!r.ativa || !pend ? ' disabled' : '') + '>Enviar agora para ' + pend + ' cliente(s)</button></div></div></div>' +
      '<div class="painel" style="margin-top:18px"><h2>Clientes <small>por tempo desde o último pedido</small></h2><div class="rolagem"><table><thead><tr><th>Cliente</th><th>Último pedido</th><th>Itens</th><th>Situação</th><th>Aviso</th><th></th></tr></thead><tbody>' +
      cs.map(function (x) {
        var c = x.c, env = r.enviados[c.id] === c.ultima, prog = x.s.cod === 'espera' ? 'Previsto para ' + fmtDia(c.ultima + r.min * DIA) : x.s.cod === 'janela' ? (env ? '' : 'Hoje') : '';
        return '<tr><td><b>' + esc(c.nome) + '</b><small>' + esc(c.bairro) + '</small></td><td>' + fmtDia(c.ultima) + '<small>há ' + x.s.dias + ' dia(s)</small></td><td>' + esc(itensTxt(c.itens)) + '</td>' +
          '<td><span class="chip ' + x.s.cls + '">' + x.s.rot + '</span></td><td>' + (env ? '<span class="chip ok">Enviado</span>' : prog ? '<span class="chip cinza">' + prog + '</span>' : '—') + '</td>' +
          '<td><button class="btn pequeno claro" data-ex-rec="' + c.id + '"' + (r.ativa ? '' : ' disabled') + '>' + (env ? 'Reenviar' : 'Enviar agora') + '</button></td></tr>';
      }).join('') + '</tbody></table></div></div>' +
      '<div class="painel" style="margin-top:18px"><h2>Histórico <small>avisos e pedidos repetidos</small></h2>' + (r.historico.length ? '<div class="rolagem"><table><thead><tr><th>Quando</th><th>Cliente</th><th>Dias desde o pedido</th><th>Resultado</th></tr></thead><tbody>' +
      r.historico.slice(0, 10).map(function (x) { return '<tr><td>' + ctx.dataHora(x.quando) + '</td><td>' + esc(x.cliente) + '</td><td>' + x.dias + '</td><td>' + (x.status === 'repetiu' ? '<span class="chip ok">Repetiu o pedido ' + esc(x.pedido) + '</span>' : '<span class="chip cinza">Aviso enviado</span>') + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="vazio">Nenhum aviso enviado ainda.</p>') + '</div>';
  }
  function rodarRecompra() {
    var r = EX.ler().recompra; if (!r.ativa) return 0;
    var l = elegiveis(); l.forEach(enviarRecompra); return l.length;
  }

  /* ================= Lote fresco (lista de espera) ================= */
  function espera(tela) {
    var e = EX.ler().espera, frescos = S().produtos.filter(function (p) { return p.fresco; });
    var total = e.inscritos.filter(function (x) { return !x.avisado; }).length;
    tela.innerHTML = '<div class="cab"><div><h1>Lote fresco</h1><p>Clientes que pediram aviso quando chegar lote novo de um produto. Registre a chegada e dispare o aviso.</p></div></div>' +
      '<div class="kpis">' + kpi('Inscritos esperando', total, 'em ' + frescos.filter(function (p) { return EX.pendentes(p.id).length; }).length + ' produtos') +
      kpi('Avisos disparados', e.avisos.length, 'nesta demonstração') + kpi('Produtos com estoque baixo', frescos.filter(function (p) { return p.estoque <= p.min; }).length, 'onde a lista mais cresce', 'alerta') + '</div>' +
      '<div class="ex-grade">' + frescos.map(function (p) {
        var pend = EX.pendentes(p.id), baixo = p.estoque <= p.min;
        return '<div class="painel ex-esp"><h3><span>' + esc(p.nome) + '</span><span class="chip ' + (baixo ? 'alerta' : 'ok') + '">' + p.estoque + ' ' + p.un + ' no estoque</span></h3>' +
          '<p class="ex-cont"><b>' + pend.length + '</b> inscrito(s) esperando</p>' +
          (pend.length ? '<ul class="ex-insc">' + pend.slice(0, 5).map(function (x) { return '<li>' + esc(x.nome) + '<small>' + esc(x.fone) + ' · ' + ctx.ha(x.quando) + '</small></li>'; }).join('') + (pend.length > 5 ? '<li class="pv-mudo">+ ' + (pend.length - 5) + ' outros</li>' : '') + '</ul>' : '<p class="pv-nota">Ninguém na fila.</p>') +
          '<div class="ex-linha"><div class="campo"><label for="exLote-' + p.id + '">Chegou lote de</label><input id="exLote-' + p.id + '" type="number" min="0" step="1" placeholder="Qtd (' + p.un + ')" value="' + (F.espera[p.id] || '') + '"></div>' +
          '<button class="btn pequeno" data-ex-lote="' + p.id + '"' + (pend.length ? '' : ' disabled') + '>Avisar ' + pend.length + '</button></div></div>';
      }).join('') + '</div>' +
      '<div class="duas" style="margin-top:18px"><div class="painel"><h2>Mensagem do aviso</h2><label class="sr" for="exEspTexto">Texto do aviso</label><textarea id="exEspTexto" rows="4">' + esc(e.texto) + '</textarea>' +
      '<p class="pv-nota">Use {nome}, {produto} e {link}. O link abre a loja com o produto já no carrinho.</p><div class="acoes"><button class="btn pequeno" id="exEspSalvar">Salvar mensagem</button><button class="btn pequeno claro" id="exEspPadrao">Voltar ao padrão</button></div></div>' +
      '<div class="painel"><h2>Avisos disparados</h2>' + (e.avisos.length ? '<div class="rolagem"><table><thead><tr><th>Quando</th><th>Produto</th><th class="num">Avisados</th><th class="num">Lote</th></tr></thead><tbody>' +
      e.avisos.slice(0, 8).map(function (a) { return '<tr><td>' + ctx.dataHora(a.quando) + '</td><td>' + esc(a.nome) + '</td><td class="num">' + a.n + '</td><td class="num">' + (a.qtd ? a.qtd + ' ' + a.un : '—') + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="vazio">Nenhum aviso disparado ainda.</p>') + '</div></div>';
  }
  function dispararLote(id) {
    var p = prod(id), e = EX.ler().espera, pend = EX.pendentes(id), inp = $('#exLote-' + id), q = inp ? parseFloat(inp.value) : 0;
    if (!p || !pend.length) return;
    if (q > 0) { p.estoque = +(p.estoque + q).toFixed(1); JP.salvar(); }
    var url = link('/', { add: p.id, ref: 'lote' });
    pend.forEach(function (x) {
      var txt = e.texto.replace(/\{nome\}/g, primeiro(x.nome)).replace(/\{produto\}/g, p.nome).replace(/\{link\}/g, url);
      PVA.avisar({ nome: x.nome, fone: x.fone }, txt, 'Lista de espera — ' + p.nome);
      x.avisado = Date.now();
    });
    e.avisos.unshift({ quando: Date.now(), prod: p.id, nome: p.nome, n: pend.length, qtd: q > 0 ? q : 0, un: p.un });
    EX.salvar(); delete F.espera[id]; ctx.selos();
    ctx.toast(pend.length + ' cliente(s) avisados no WhatsApp (simulado)' + (q > 0 ? '; ' + q + ' ' + p.un + ' somados ao estoque.' : '.'));
    espera($('#tela'));
  }

  /* ================= Atacado ================= */
  function totalRecorrente(r) { return r.itens.reduce(function (t, i) { var p = prod(i.id); return t + (p ? EX.precoAtacado(p) * i.qtd : 0); }, 0); }
  function atacado(tela) {
    var a = EX.ler().atacado, rs = a.restaurantes, sel = EX.restaurante(F.atacadoSel) || rs[0]; if (sel) F.atacadoSel = sel.id;
    var pedidosA = S().pedidos.filter(function (p) { return p.atacadoId; });
    tela.innerHTML = '<div class="cab"><div><h1>Atacado para restaurantes</h1><p>Tabela de preço fixo e pedido recorrente em um toque. Cada restaurante entra na loja pelo seu link e vê o preço de atacado.</p></div></div>' +
      '<div class="kpis">' + kpi('Restaurantes', rs.length, 'com acesso ao atacado') + kpi('Pedidos recorrentes feitos', pedidosA.length, 'em um toque, nesta demonstração') +
      kpi('Valor por pedido recorrente', ctx.brl(rs.length ? rs.reduce(function (t, r) { return t + totalRecorrente(r); }, 0) / rs.length : 0), 'média, a preço de atacado') + '</div>' +
      '<div class="painel"><h2>Restaurantes <small>cada um com o seu link</small></h2><div class="rolagem"><table><thead><tr><th>Restaurante</th><th>Entrega</th><th>Pedido recorrente</th><th class="num">Valor</th><th></th></tr></thead><tbody>' +
      rs.map(function (r) {
        return '<tr' + (sel && r.id === sel.id ? ' class="ex-sel"' : '') + '><td><b>' + esc(r.nome) + '</b><small>' + esc(r.fone) + ' · código ' + esc(r.codigo) + '</small></td><td>' + esc(r.bairro) + '<small>' + esc(r.endereco) + '</small></td>' +
          '<td>' + (r.itens.length ? esc(itensTxt(r.itens.map(function (i) { return [i.id, i.qtd]; }))) : '<span class="pv-mudo">Sem pedido definido</span>') + '<small>' + esc(r.dias || '') + '</small></td><td class="num">' + ctx.brl(totalRecorrente(r)) + '</td>' +
          '<td><div class="acoes"><button class="btn pequeno claro" data-ex-at-sel="' + r.id + '">Editar</button><a class="btn pequeno" href="' + link('/', { atacado: r.codigo }) + '" target="_blank" rel="noopener">Abrir loja ↗</a></div></td></tr>';
      }).join('') + '</tbody></table></div></div>' +
      (sel ? '<div class="duas" style="margin-top:18px"><div class="painel"><h2>Pedido recorrente — ' + esc(sel.nome) + '</h2>' +
        '<div class="ex-linha"><div class="campo"><label for="exAtDias">Dias de entrega</label><input id="exAtDias" value="' + esc(sel.dias || '') + '" placeholder="Ex.: terça e sexta"></div></div>' +
        '<div class="ex-qtds">' + S().produtos.map(function (p) {
          var it = sel.itens.filter(function (i) { return i.id === p.id; })[0];
          return '<label class="ex-qtd" for="exQ-' + p.id + '"><span>' + esc(p.nome) + '<small>' + ctx.brl(EX.precoAtacado(p)) + ' / ' + p.un + '</small></span><input id="exQ-' + p.id + '" data-ex-q="' + p.id + '" type="number" min="0" step="1" value="' + (it ? it.qtd : '') + '" placeholder="0"></label>';
        }).join('') + '</div><div class="acoes"><button class="btn pequeno" id="exAtSalvar">Salvar pedido recorrente</button></div></div>' +
        '<div class="painel"><h2>Tabela de preços de atacado <small>preço fixo por produto</small></h2><div class="rolagem"><table><thead><tr><th>Produto</th><th class="num">Varejo</th><th class="num">Atacado</th><th class="num">Desconto</th></tr></thead><tbody>' +
        S().produtos.map(function (p) {
          var v = EX.precoAtacado(p);
          return '<tr><td>' + esc(p.nome) + '</td><td class="num">' + ctx.brl(p.preco) + '</td><td class="num"><input class="peq" style="width:84px" type="number" min="1" step="0.1" data-ex-preco="' + p.id + '" value="' + v.toFixed(2) + '" aria-label="Preço de atacado de ' + esc(p.nome) + '"></td><td class="num">' + Math.round((1 - v / p.preco) * 100) + '%</td></tr>';
        }).join('') + '</tbody></table></div><div class="acoes"><button class="btn pequeno" id="exPrecoSalvar">Salvar tabela</button><button class="btn pequeno claro" id="exPrecoPadrao">Voltar aos preços padrão</button></div></div></div>' : '') +
      '<div class="painel" style="margin-top:18px"><h2>Novo restaurante</h2><div class="form-grade">' +
      '<div class="campo"><label for="exNNome">Nome</label><input id="exNNome" placeholder="Nome do restaurante"></div><div class="campo"><label for="exNFone">WhatsApp</label><input id="exNFone" placeholder="(85) 9 0000-0000"></div>' +
      '<div class="campo"><label for="exNBairro">Bairro</label><select id="exNBairro">' + JP.BAIRROS.map(function (b) { return '<option>' + esc(b.nome) + '</option>'; }).join('') + '</select></div><div class="campo"><label for="exNEnd">Endereço</label><input id="exNEnd" placeholder="Rua, número"></div></div>' +
      '<div class="acoes"><button class="btn pequeno" id="exNovoRest">Cadastrar restaurante</button></div></div>' +
      '<div class="painel" style="margin-top:18px"><h2>Pedidos recorrentes feitos pela loja</h2>' + (pedidosA.length ? '<div class="rolagem"><table><thead><tr><th>Pedido</th><th>Restaurante</th><th class="num">Total</th><th>Situação</th></tr></thead><tbody>' +
      pedidosA.slice(0, 8).map(function (p) { return '<tr><td><b>' + p.id + '</b><small>' + ctx.dataHora(p.criado) + '</small></td><td>' + esc(p.cliente) + '</td><td class="num">' + ctx.brl(JP.totalPedido(p)) + '</td><td>' + (p.agendado ? '<span class="chip alerta">' + esc(p.agendado) + '</span>' : p.confirmado ? '<span class="chip ok">Confirmado</span>' : '<span class="chip alerta">Aguardando confirmação</span>') + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="vazio">Nenhum pedido ainda. Abra a loja de um restaurante e toque em “Pedir de novo”.</p>') + '</div>';
  }

  /* ================= vigia (a cada 2 s) e eventos ================= */
  function vigia() {
    var e = EX.ler().entrega, S0 = S(), mudou = false;
    S0.pedidos.forEach(function (p) {
      if (p.tipo !== 'entrega') return;
      if (p.agendado && !e.processados['a' + p.id]) { e.processados['a' + p.id] = 1; mudou = true; avisaAgendado(p); }
      if (p.confirmado && JP.situacao(p).cod === 'saiu' && !e.processados['s' + p.id]) { e.processados['s' + p.id] = 1; mudou = true; if (e.avisoSaiu) avisaSaida(p); }
    });
    if (mudou) EX.salvar();
    if (EX.ler().recompra.ativa && EX.ler().recompra.auto) { var n = rodarRecompra(); if (n && ctx.modulo() === 'recompra') recompra($('#tela')); }
  }
  function semear() {
    var e = EX.ler();
    if (e.entrega.semeado) return;
    S().pedidos.forEach(function (p) { if (p.confirmado && JP.situacao(p).cod !== 'recebido' && JP.situacao(p).cod !== 'preparando') e.entrega.processados['s' + p.id] = 1; });
    var bia = S().clientes.filter(function (c) { return c.nome === 'Beatriz Fontenele'; })[0];
    if (bia) e.recompra.enviados[bia.id] = bia.ultima;
    e.entrega.semeado = true; EX.salvar();
  }

  function render(m, tela) {
    EX.recarregar();
    if (m !== 'entregas' && mapa) { mapa.remove(); mapa = null; }
    ({ entregas: entregas, recompra: recompra, espera: espera, atacado: atacado })[m](tela);
  }
  function atualiza() { var m = ctx.modulo(); if (m === 'entregas' || m === 'recompra' || m === 'espera' || m === 'atacado') { var y = window.scrollY; render(m, $('#tela')); window.scrollTo(0, y); } }
  function inscritosPendentes() { return EX.ler().espera.inscritos.filter(function (x) { return !x.avisado; }).length; }

  document.addEventListener('click', function (ev) {
    var m = ctx && ctx.modulo(); if (['entregas', 'recompra', 'espera', 'atacado'].indexOf(m) < 0) return;
    var t = ev.target.closest('button'); if (!t) return;
    var E = EX.ler();
    if (t.id === 'exCorteSalvar') {
      var h = parseInt($('#exCorte').value, 10); if (!(h >= 6 && h <= 20)) { ctx.toast('Escolha um horário de corte entre 6h e 20h.'); return; }
      E.entrega.corte = h; E.entrega.simulacao = $('#exSim').value; EX.salvar(); atualiza(); ctx.toast('Horário de corte salvo: ' + h + 'h.');
    }
    else if (t.id === 'exAvisoSaiu') { E.entrega.avisoSaiu = !E.entrega.avisoSaiu; EX.salvar(); atualiza(); }
    else if (t.dataset.exSaiu) saiu([t.dataset.exSaiu]);
    else if (t.dataset.exSaiuRota !== undefined) { var rs = ordenaRota(entregasHoje()); saiu(rs[+t.dataset.exSaiuRota].paradas.map(function (x) { return x.p.id; })); }
    else if (t.id === 'exRecAtiva') { E.recompra.ativa = !E.recompra.ativa; EX.salvar(); atualiza(); ctx.toast(E.recompra.ativa ? 'Recompra automática ligada.' : 'Recompra automática desligada. Nenhum aviso sai até religar.'); }
    else if (t.id === 'exRecSalvar') {
      var mi = parseInt($('#exRecMin').value, 10), ma = parseInt($('#exRecMax').value, 10), tx = $('#exRecTexto').value.trim();
      if (!(mi >= 1) || !(ma > mi)) { ctx.toast('O prazo final precisa ser maior que o inicial.'); return; }
      if (tx.indexOf('{link}') < 0) { ctx.toast('A mensagem precisa ter o {link} do botão de repetir o pedido.'); return; }
      E.recompra.min = mi; E.recompra.max = ma; E.recompra.texto = tx; EX.salvar(); atualiza(); ctx.toast('Regra salva: aviso de ' + mi + ' a ' + ma + ' dias.');
    }
    else if (t.id === 'exRecPadrao') { E.recompra.texto = EX.TXT_RECOMPRA; EX.salvar(); atualiza(); ctx.toast('Mensagem padrão restaurada.'); }
    else if (t.id === 'exRecRodar') { var n = rodarRecompra(); atualiza(); ctx.selos(); ctx.toast(n + ' aviso(s) de recompra enviados no WhatsApp (simulado).'); }
    else if (t.dataset.exRec) { var c = S().clientes.filter(function (x) { return x.id === t.dataset.exRec; })[0]; if (c) { enviarRecompra(c); atualiza(); ctx.toast('Aviso de recompra enviado a ' + c.nome + ' (simulado).'); } }
    else if (t.dataset.exLote) dispararLote(t.dataset.exLote);
    else if (t.id === 'exEspSalvar') { var te = $('#exEspTexto').value.trim(); if (te.indexOf('{link}') < 0) { ctx.toast('A mensagem precisa ter o {link} da loja.'); return; } E.espera.texto = te; EX.salvar(); ctx.toast('Mensagem do aviso salva.'); }
    else if (t.id === 'exEspPadrao') { E.espera.texto = EX.TXT_ESPERA; EX.salvar(); atualiza(); ctx.toast('Mensagem padrão restaurada.'); }
    else if (t.dataset.exAtSel) { F.atacadoSel = t.dataset.exAtSel; atualiza(); }
    else if (t.id === 'exAtSalvar') {
      var r = EX.restaurante(F.atacadoSel); if (!r) return;
      r.dias = $('#exAtDias').value.trim();
      r.itens = Array.prototype.map.call(document.querySelectorAll('[data-ex-q]'), function (i) { return { id: i.dataset.exQ, qtd: parseFloat(i.value) || 0 }; }).filter(function (i) { return i.qtd > 0; });
      EX.salvar(); atualiza(); ctx.toast('Pedido recorrente de ' + r.nome + ' salvo.');
    }
    else if (t.id === 'exPrecoSalvar') {
      var ok = true;
      document.querySelectorAll('[data-ex-preco]').forEach(function (i) { var v = parseFloat(i.value); if (!(v > 0)) ok = false; else E.atacado.precos[i.dataset.exPreco] = +v.toFixed(2); });
      if (!ok) { ctx.toast('Todos os preços precisam ser maiores que zero.'); return; }
      EX.salvar(); atualiza(); ctx.toast('Tabela de atacado salva.');
    }
    else if (t.id === 'exPrecoPadrao') { E.atacado.precos = {}; EX.salvar(); atualiza(); ctx.toast('Preços padrão restaurados (12% abaixo do varejo).'); }
    else if (t.id === 'exNovoRest') {
      var nome = $('#exNNome').value.trim(), fone = $('#exNFone').value.trim(), end = $('#exNEnd').value.trim();
      if (!nome || fone.replace(/\D/g, '').length < 10 || !end) { ctx.toast('Informe nome, WhatsApp com DDD e endereço.'); return; }
      var id = 'a' + Date.now(), cod = nome.toUpperCase().normalize('NFD').replace(/[^A-Z]/g, '').slice(0, 4) + Math.floor(Math.random() * 90 + 10);
      E.atacado.restaurantes.push({ id: id, nome: nome, codigo: cod, fone: fone, bairro: $('#exNBairro').value, endereco: end, dias: '', itens: [] });
      F.atacadoSel = id; EX.salvar(); atualiza(); ctx.toast(nome + ' cadastrado. Defina o pedido recorrente abaixo.');
    }
  });
  document.addEventListener('change', function (ev) {
    var m = ctx && ctx.modulo();
    if (ev.target.id === 'exMoto' && m === 'entregas') { F.moto = ev.target.value; atualiza(); }
    else if (ev.target.id && ev.target.id.indexOf('exLote-') === 0) F.espera[ev.target.id.slice(7)] = ev.target.value;
  });

  window.EXP = {
    init: function (c) {
      ctx = c; EX.recarregar(); semear(); vigia();
      setInterval(function () { EX.recarregar(); vigia(); }, 2000);
      window.addEventListener('storage', function (e) {
        if (e.key !== EX.CHAVE) return;
        EX.recarregar(); ctx.selos(); var m = ctx.modulo(); if (m === 'espera' || m === 'recompra' || m === 'atacado') atualiza();
      });
    },
    render: render, inscritosPendentes: inscritosPendentes,
    reset: function () { EX.reset(); EX.recarregar(); semear(); }
  };
})();
