/* Nota fiscal pronta para o provedor (sem emitir): dados do emitente, dados fiscais dos produtos e rascunhos validados. */
(function () {
  var ctx = null, tela = null, est = null, prodBusca = '', soSemNcm = true, ultimo = null, pedSel = '';
  var esc = function (t) { return ctx.esc(t); };
  var H = { 'Content-Type': 'application/json', 'x-jp': '1' };
  function admin() { return !window.JP_USUARIO || window.JP_USUARIO.papel === 'admin'; }
  function api(url, o) { return fetch(url, o).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { j._ok = r.ok; return j; }); }); }
  function campo(id, rot, v, extra) { return '<div class="campo"><label for="' + id + '">' + rot + '</label><input id="' + id + '" value="' + esc(v || '') + '"' + (admin() ? '' : ' disabled') + (extra || '') + '></div>'; }
  function S() { return ctx.estado(); }

  function render(t) { tela = t; tela.innerHTML = '<div class="cab"><div><h1>Nota fiscal</h1><p>Prepare e valide a NF-e. Nada é enviado à SEFAZ enquanto a emissão estiver desligada.</p></div></div><div id="nfCorpo"><p class="vazio">Carregando…</p></div>'; carrega(); }
  function carrega() { api('/api/nf/estado').then(function (e) { est = e; desenha(); }); }

  function desenha() {
    var c = document.getElementById('nfCorpo'); if (!c || !est.cfg) return;
    var cfg = est.cfg, e = cfg.emitente, prods = S().produtos, semNcm = prods.filter(function (p) { return !JPNF.ncmValido(p.ncm); }).length;
    var pedidos = S().pedidos.filter(function (p) { return JPD.statusDe(p) !== 'cancelado' && JPD.statusDe(p) !== 'novo'; });
    if (!pedSel || !pedidos.some(function (p) { return p.id === pedSel; })) pedSel = pedidos.length ? pedidos[0].id : '';
    c.innerHTML =
      '<div class="banner alerta"><div><b>Emissão desligada.</b> ' + esc(est.podeEmitir.ok ? 'Tudo pronto no servidor: a emissão depende só de ordem expressa.' : est.podeEmitir.motivo) + ' Pendências para ligar: certificado digital e escolha do provedor (RS Tech e contador).</div></div>' +
      '<div class="painel"><h2>Dados do emitente <small>' + (est.emitenteOk ? 'completos' : est.pendenciasEmitente.length + ' pendência(s)') + '</small></h2>' +
      '<div class="lja-grade2">' + campo('nfRazao', 'Razão social', e.razao) + campo('nfCnpj', 'CNPJ', e.cnpj) + campo('nfIe', 'Inscrição estadual', e.ie) +
      '<div class="campo"><label for="nfReg">Regime tributário</label><select id="nfReg"' + (admin() ? '' : ' disabled') + '>' + [[1, 'Simples Nacional'], [2, 'Simples (excesso de sublimite)'], [3, 'Regime normal']].map(function (r) { return '<option value="' + r[0] + '"' + (+e.regime === r[0] ? ' selected' : '') + '>' + r[1] + '</option>'; }).join('') + '</select></div>' +
      campo('nfLog', 'Rua', e.logradouro) + campo('nfNum', 'Número', e.numero) + campo('nfBai', 'Bairro', e.bairro) + campo('nfMun', 'Município', e.municipio) + campo('nfUf', 'UF', e.uf, ' maxlength="2"') + campo('nfCep', 'CEP', e.cep) + campo('nfIbge', 'Código IBGE do município', e.codMunicipio) + campo('nfFone', 'Telefone', e.fone) + campo('nfSerie', 'Série', cfg.serie) +
      '<div class="campo"><label for="nfAmb">Ambiente</label><select id="nfAmb"' + (admin() ? '' : ' disabled') + '><option value="homologacao"' + (cfg.ambiente === 'homologacao' ? ' selected' : '') + '>Homologação (teste)</option><option value="producao"' + (cfg.ambiente === 'producao' ? ' selected' : '') + '>Produção</option></select></div>' +
      '<div class="campo"><label for="nfProv">Provedor</label><select id="nfProv"' + (admin() ? '' : ' disabled') + '><option value="nenhum"' + (cfg.provedor === 'nenhum' ? ' selected' : '') + '>Nenhum escolhido</option><option value="focus"' + (cfg.provedor === 'focus' ? ' selected' : '') + '>Focus NFe</option></select></div></div>' +
      (est.pendenciasEmitente.length ? '<ul class="lja-dica">' + est.pendenciasEmitente.map(function (p) { return '<li>' + esc(p.msg) + '</li>'; }).join('') + '</ul>' : '') +
      (admin() ? '<button class="btn" type="button" id="nfSalvaCfg">Salvar dados fiscais</button>' : '') + '</div>' +

      '<div class="painel" style="margin-top:18px"><h2>Dados fiscais dos produtos <small>' + semNcm + ' sem NCM de ' + prods.length + '</small></h2>' +
      '<p class="lja-dica">O NCM é obrigatório em cada item da nota. Confirme com o contador antes de preencher (camarão, peixe fresco ou congelado e petiscos têm códigos diferentes). CFOP e CSOSN em branco usam o padrão (' + esc(cfg.cfopPadrao) + ' e ' + esc(cfg.csosnPadrao) + ').</p>' +
      '<div class="filtros"><label class="chk"><input type="checkbox" id="nfSoSem"' + (soSemNcm ? ' checked' : '') + '> só os sem NCM</label><input class="peq" type="search" id="nfBusca" placeholder="Buscar produto" value="' + esc(prodBusca) + '" style="margin-left:auto"></div>' +
      '<div class="rolagem"><table><thead><tr><th>Produto</th><th>NCM (8 dígitos)</th><th>CFOP</th><th>CSOSN</th></tr></thead><tbody>' + prods.filter(function (p) { return (!soSemNcm || !JPNF.ncmValido(p.ncm)) && (!prodBusca || JPL.semAcento(p.nome).indexOf(JPL.semAcento(prodBusca)) >= 0); }).slice(0, 60).map(function (p) {
        return '<tr><td>' + esc(p.nome) + '<small>' + esc(p.cat) + ' · ' + esc(p.un) + '</small></td>' + ['ncm', 'cfop', 'csosn'].map(function (k) { return '<td><input class="peq" style="width:' + (k === 'ncm' ? 110 : 64) + 'px" data-fisc="' + k + '" data-id="' + p.id + '" value="' + esc(p[k] || '') + '" inputmode="numeric" maxlength="' + (k === 'ncm' ? 10 : k === 'cfop' ? 4 : 3) + '" aria-label="' + k.toUpperCase() + ' de ' + esc(p.nome) + '"></td>'; }).join('') + '</tr>';
      }).join('') + '</tbody></table></div></div>' +

      '<div class="painel" style="margin-top:18px"><h2>Nova nota (rascunho)</h2>' + (pedidos.length ?
      '<div class="lja-grade2"><div class="campo"><label for="nfPed">Pedido</label><select id="nfPed">' + pedidos.map(function (p) { return '<option value="' + p.id + '"' + (p.id === pedSel ? ' selected' : '') + '>' + p.id + ' — ' + esc(p.cliente) + ' — ' + JP.brl(JPD.total(p)) + '</option>'; }).join('') + '</select></div>' +
      campo('nfDNome', 'Nome / razão social do destinatário', (S().pedidos.filter(function (p) { return p.id === pedSel; })[0] || {}).cliente) + campo('nfDDoc', 'CPF ou CNPJ', '') + campo('nfDCep', 'CEP da entrega', '') + campo('nfDLog', 'Rua da entrega', '') + campo('nfDNum', 'Número', '') + campo('nfDBai', 'Bairro', '') + '</div>' +
      '<button class="btn" type="button" id="nfRascunho">Validar e salvar rascunho</button>' + (ultimo ? resultado(ultimo) : '') : '<p class="vazio">Confirme um pedido primeiro.</p>') + '</div>' +

      '<div class="painel" style="margin-top:18px"><h2>Rascunhos e notas <small>' + est.rascunhos.length + '</small></h2>' + (est.rascunhos.length ? '<div class="rolagem"><table><thead><tr><th>Pedido</th><th>Referência</th><th>Situação</th><th>Pendências</th><th></th></tr></thead><tbody>' + est.rascunhos.map(function (r) {
        return '<tr><td>' + esc(r.pedido) + '</td><td>' + esc(r.ref) + '</td><td><span class="chip ' + (r.estado === 'rascunho' ? 'cinza' : r.estado === 'erro' ? 'alerta' : 'ok') + '">' + esc(r.estado) + '</span></td><td>' + r.pendencias + '</td><td>' + (admin() && r.estado === 'rascunho' && !r.pendencias ? '<button class="btn pequeno claro" type="button" data-nf-emitir="' + esc(r.ref) + '"' + (est.podeEmitir.ok ? '' : ' disabled title="' + esc(est.podeEmitir.motivo) + '"') + '>Emitir</button>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div>' : '<p class="vazio">Nenhum rascunho ainda.</p>') + '</div>';
  }
  function resultado(r) {
    return '<div style="margin-top:14px">' + (r.ok ? '<div class="banner info"><div><b>Nota pronta para o provedor.</b> Nenhuma pendência. Total ' + JP.brl(r.payload.valor_total) + '.</div></div>' :
      '<div class="banner alerta"><div><b>Faltam dados:</b><ul>' + r.pendencias.map(function (p) { return '<li>' + esc(p.msg) + '</li>'; }).join('') + '</ul></div></div>') +
      '<details><summary>Ver o corpo da nota (JSON)</summary><pre style="white-space:pre-wrap;font-size:12px;max-height:320px;overflow:auto">' + esc(JSON.stringify(r.payload, null, 2)) + '</pre></details></div>';
  }
  function val(id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; }
  function salvaCfg() {
    var corpo = { serie: +val('nfSerie') || 1, ambiente: val('nfAmb'), provedor: val('nfProv'), emitente: { razao: val('nfRazao'), cnpj: val('nfCnpj'), ie: val('nfIe'), regime: +val('nfReg'), logradouro: val('nfLog'), numero: val('nfNum'), bairro: val('nfBai'), municipio: val('nfMun'), uf: val('nfUf'), cep: val('nfCep'), codMunicipio: val('nfIbge'), fone: val('nfFone') } };
    api('/api/nf/config', { method: 'PUT', headers: H, body: JSON.stringify(corpo) }).then(function (j) { ctx.toast(j._ok ? 'Dados fiscais salvos.' : (j.erro || 'Não foi possível salvar.')); carrega(); });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b || !document.getElementById('nfCorpo')) return;
    if (b.id === 'nfSalvaCfg') salvaCfg();
    else if (b.id === 'nfRascunho') {
      var corpo = { pedido: val('nfPed'), destinatario: { nome: val('nfDNome'), doc: val('nfDDoc'), cep: val('nfDCep'), logradouro: val('nfDLog'), numero: val('nfDNum'), bairro: val('nfDBai') } };
      api('/api/nf/rascunho', { method: 'POST', headers: H, body: JSON.stringify(corpo) }).then(function (j) { if (!j.payload) { ctx.toast(j.erro || 'Não foi possível validar.'); return; } ultimo = j; ctx.toast(j.ok ? 'Rascunho salvo: pronto para o provedor.' : 'Rascunho salvo com pendências.'); carrega(); });
    } else if (b.dataset.nfEmitir) {
      if (!window.confirm('Emitir a nota ' + b.dataset.nfEmitir + ' no provedor? Isso gera uma nota fiscal de verdade.')) return;
      api('/api/nf/emitir', { method: 'POST', headers: H, body: JSON.stringify({ ref: b.dataset.nfEmitir }) }).then(function (j) { ctx.toast(j.ok ? 'Nota enviada ao provedor.' : (j.motivo || j.erro || 'Não foi possível emitir.')); carrega(); });
    }
  });
  document.addEventListener('change', function (e) {
    var t = e.target; if (!document.getElementById('nfCorpo')) return;
    if (t.dataset.fisc) {
      var p = S().produtos.filter(function (x) { return x.id === t.dataset.id; })[0]; if (!p) return;
      var v = t.value.replace(/\D/g, ''); if (t.dataset.fisc === 'ncm' && v && v.length !== 8) { ctx.toast('O NCM tem 8 dígitos.'); t.value = p.ncm || ''; return; }
      p[t.dataset.fisc] = v; JP.salvar(); ctx.toast('Salvo.'); desenha();
    } else if (t.id === 'nfSoSem') { soSemNcm = t.checked; desenha(); } else if (t.id === 'nfPed') { pedSel = t.value; ultimo = null; desenha(); }
  });
  document.addEventListener('input', function (e) { if (e.target.id === 'nfBusca') { prodBusca = e.target.value; var p = e.target.selectionStart; desenha(); var b = document.getElementById('nfBusca'); b.focus(); b.setSelectionRange(p, p); } });
  window.NFA = { init: function (c) { ctx = c; }, render: render };
})();
