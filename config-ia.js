/* Configuração da IA da Julia Pescados — área restrita da RS Tech (fora do painel do cliente).
   Demonstração estática: o acesso é uma senha conferida por hash no navegador. Em produção a rota fica no servidor, atrás de login de
   administrador (senha só em variável de ambiente, sessão assinada, limite de tentativas e registro de acesso). */
(function () {
  var HASH = 'd32520d57c4351822453d34d06a78683c348b9b0ec46496a50afc0d1f2850723';
  var SESSAO = 'jp_rs_admin_ok', LIMITE = 5, BLOQUEIO_MS = 60000;
  var raiz = document.getElementById('raiz'), C = null, tFalha = 0, bloqueadoAte = 0, tSalvar = null;
  var $ = function (s) { return document.querySelector(s); };
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function toast(m) { var t = document.getElementById('toast'); t.textContent = m; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(function () { t.hidden = true; }, 2600); }
  function sha256(txt) {
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt)).then(function (b) {
      return Array.prototype.map.call(new Uint8Array(b), function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
    });
  }
  function iguais(a, b) { if (a.length !== b.length) return false; var r = 0; for (var i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }
  function logado() { try { return sessionStorage.getItem(SESSAO) === HASH.slice(0, 16); } catch (e) { return false; } }

  function login(erro) {
    raiz.innerHTML = '<form class="rs-login" id="rsForm" autocomplete="off"><img class="rs-logo" src="img/marca/logo-julia-192.png" width="96" height="96" alt="Julia Pescados"><br><span class="rs-selo">RS Tech</span><h1 style="margin-top:12px">Área restrita</h1><p>Configuração do atendimento por IA. Acesso só da equipe da RS Tech.</p>' +
      '<div class="campo"><label for="rsSenha">Senha de administrador</label><input type="password" id="rsSenha" autocomplete="current-password" required></div>' +
      '<p class="rs-erro" id="rsErro" role="alert">' + esc(erro || '') + '</p><button class="btn" type="submit">Entrar</button></form>';
    $('#rsSenha').focus();
  }
  document.addEventListener('submit', function (e) {
    if (e.target.id !== 'rsForm') return; e.preventDefault();
    var erro = $('#rsErro'), campo = $('#rsSenha');
    if (Date.now() < bloqueadoAte) { erro.textContent = 'Muitas tentativas. Aguarde ' + Math.ceil((bloqueadoAte - Date.now()) / 1000) + ' s.'; return; }
    sha256(campo.value).then(function (h) {
      if (iguais(h, HASH)) { try { sessionStorage.setItem(SESSAO, HASH.slice(0, 16)); } catch (x) {} tFalha = 0; painel(); return; }
      tFalha++; campo.value = '';
      if (tFalha >= LIMITE) { bloqueadoAte = Date.now() + BLOQUEIO_MS; tFalha = 0; erro.textContent = 'Muitas tentativas. Aguarde 60 s.'; } else erro.textContent = 'Senha incorreta.';
    });
  });

  function sw(id, on, rot, desc) { return '<label class="xsw"><input type="checkbox" id="' + id + '"' + (on ? ' checked' : '') + '><span class="xsw-t" aria-hidden="true"><i></i></span><span class="xsw-x"><b>' + rot + '</b>' + (desc ? '<small>' + desc + '</small>' : '') + '</span></label>'; }
  function radio(nome, val, atual, rot, desc) { return '<label class="xrad' + (val === atual ? ' on' : '') + '"><input type="radio" name="' + nome + '" value="' + val + '"' + (val === atual ? ' checked' : '') + '><span><b>' + rot + '</b><small>' + desc + '</small></span></label>'; }
  var ASSUNTOS = [['preco', 'Preços e catálogo'], ['entrega', 'Entrega, taxas e prazos'], ['horario', 'Horário de funcionamento'], ['pagamento', 'Formas de pagamento'], ['pedido', 'Andamento do pedido'], ['orcamento', 'Orçamentos']];
  var TONS = [['cordial', 'Cordial', 'Olá, Sabrina! O Kit Churrasco do Mar está R$ 84,90. Fico à disposição.'], ['objetivo', 'Objetivo', 'O Kit Churrasco do Mar está R$ 84,90.'], ['descontraido', 'Descontraído', 'Oi, Sabrina, tudo bem? O Kit Churrasco do Mar está R$ 84,90. Qualquer coisa é só chamar!']];

  function painel() {
    C = window.JPIA.ler();
    function opt(v, rot) { return '<option value="' + v + '"' + (C.quando === v ? ' selected' : '') + '>' + rot + '</option>'; }
    raiz.innerHTML = '<div class="rs-topo"><div class="rs-marca"><img class="rs-logo-topo" src="img/marca/logo-julia-96.png" width="44" height="44" alt="Julia Pescados"><span class="rs-selo">RS Tech</span><h1>Atendimento por IA · Júlia Pescados</h1></div><div class="rs-acoes" style="display:flex;gap:10px"><a class="btn pequeno linha" href="/admin#conversas" target="_blank" rel="noopener">Ver conversas do cliente ↗</a><button class="btn pequeno linha" id="rsSair" type="button">Sair</button></div></div>' +
      '<div class="rs-aviso">Esta tela é da RS Tech: o cliente não vê nem edita nada daqui. No painel dele só existe o interruptor de ligar e desligar a IA (geral e por conversa) e a opção de assumir a conversa. Demonstração: a IA é simulada e as alterações valem só neste navegador.</div>' +
      '<div class="xia-grade"><div class="xia-col">' +
      '<section class="painel xcfg"><h2>Prompt do negócio <small>instruções fixas da IA da Júlia Pescados</small></h2><div class="campo"><label for="cfgPrompt" class="sr">Prompt do negócio</label><textarea id="cfgPrompt" spellcheck="false">' + esc(C.prompt) + '</textarea></div>' +
      '<div class="rs-acoes"><button class="btn" id="rsSalvar" type="button">Salvar prompt</button><button class="btn linha" id="rsRestaurar" type="button">Restaurar o prompt padrão</button><span class="rs-estado" id="rsEstado">' + (C.atualizadoEm ? 'Salvo em ' + new Date(C.atualizadoEm).toLocaleString('pt-BR') + '.' : 'Prompt padrão carregado.') + '</span></div></section>' +
      '<section class="painel xcfg"><h2>Tom das respostas</h2><div class="xtons">' + TONS.map(function (t) { return radio('iaTom', t[0], C.tom, t[1], '“' + t[2] + '”'); }).join('') + '</div></section></div>' +
      '<div class="xia-col lado">' +
      '<section class="painel xcfg"><h2>Como a IA atua</h2>' + radio('iaModo', 'auto', C.modo, 'Responder sozinha', 'A IA responde na hora e passa para uma pessoa em reclamação ou pedido grande. É o padrão da demonstração.') + radio('iaModo', 'sugerir', C.modo, 'Sugerir respostas', 'A IA escreve e o atendente aprova com um clique.') + '</section>' +
      '<section class="painel xcfg"><h2>Horário de atuação</h2><div class="campo"><label for="iaQuando">Quando a IA atende</label><select id="iaQuando">' + opt('sempre', 'O tempo todo') + opt('fora', 'Só fora do expediente (antes das 6h, depois das 14h e aos domingos)') + opt('faixa', 'Em uma faixa de horário') + '</select></div>' +
      '<div class="xfaixa" id="iaFaixa"' + (C.quando === 'faixa' ? '' : ' hidden') + '><div class="campo"><label for="iaDe">Das</label><input type="time" id="iaDe" value="' + esc(C.de) + '"></div><div class="campo"><label for="iaAte">Até</label><input type="time" id="iaAte" value="' + esc(C.ate) + '"></div></div></section>' +
      '<section class="painel xcfg"><h2>Assuntos permitidos</h2><div class="xassuntos">' + ASSUNTOS.map(function (a) { return sw('iaAs-' + a[0], !!C.assuntos[a[0]], a[1], ''); }).join('') + '</div><p class="xmut">Fora desta lista a IA não responde e chama uma pessoa.</p></section>' +
      '<section class="painel xcfg"><h2>Quando passar para uma pessoa</h2>' + sw('iaRecl', C.humanoReclamacao, 'Reclamação ou insatisfação', 'Atraso, produto errado, devolução ou cancelamento.') + sw('iaGrande', C.humanoGrande, 'Pedido grande', 'Acima de qualquer um dos limites abaixo.') +
      '<div class="xfaixa"><div class="campo"><label for="iaKg">A partir de (kg)</label><input type="number" id="iaKg" min="1" step="1" value="' + (+C.limiteKg || 20) + '"></div><div class="campo"><label for="iaVal">A partir de (R$)</label><input type="number" id="iaVal" min="1" step="50" value="' + (+C.limiteValor || 1500) + '"></div></div></section></div></div>' +
      '<p class="rs-rodape">Na demonstração o texto do prompt fica guardado e visível aqui; as respostas simuladas seguem os ajustes ao lado. Na versão real o prompt é enviado ao modelo de IA a cada conversa.</p>';
  }

  function grava(msg) { window.JPIA.salvar(C); var el = $('#rsEstado'); if (el) el.textContent = 'Salvo agora.'; if (msg) toast(msg); }
  document.addEventListener('click', function (e) {
    var t = e.target.closest('button'); if (!t || !C) return;
    if (t.id === 'rsSair') { try { sessionStorage.removeItem(SESSAO); } catch (x) {} C = null; login(); }
    else if (t.id === 'rsSalvar') { C.prompt = $('#cfgPrompt').value; grava('Prompt salvo.'); }
    else if (t.id === 'rsRestaurar') { C = window.JPIA.restaurar(); painel(); toast('Prompt e ajustes restaurados para o padrão.'); }
  });
  document.addEventListener('change', function (e) {
    if (!C) return; var id = e.target.id || '', v = e.target.value;
    if (e.target.name === 'iaModo') { C.modo = v === 'sugerir' ? 'sugerir' : 'auto'; document.querySelectorAll('input[name=iaModo]').forEach(function (r) { r.closest('.xrad').classList.toggle('on', r.checked); }); }
    else if (e.target.name === 'iaTom') { C.tom = v; document.querySelectorAll('input[name=iaTom]').forEach(function (r) { r.closest('.xrad').classList.toggle('on', r.checked); }); }
    else if (id === 'iaQuando') { C.quando = v; $('#iaFaixa').hidden = v !== 'faixa'; }
    else if ((id === 'iaDe' || id === 'iaAte') && v) C[id === 'iaDe' ? 'de' : 'ate'] = v;
    else if (id.indexOf('iaAs-') === 0) C.assuntos[id.slice(5)] = e.target.checked ? 1 : 0;
    else if (id === 'iaRecl') C.humanoReclamacao = e.target.checked;
    else if (id === 'iaGrande') C.humanoGrande = e.target.checked;
    else if (id === 'iaKg') C.limiteKg = Math.max(1, +v || 20);
    else if (id === 'iaVal') C.limiteValor = Math.max(1, +v || 1500);
    else return;
    grava('Ajuste salvo.');
  });
  document.addEventListener('input', function (e) {
    if (!C || e.target.id !== 'cfgPrompt') return; var el = $('#rsEstado'); if (el) el.textContent = 'Alterações não salvas…';
    clearTimeout(tSalvar); tSalvar = setTimeout(function () { if (C) { C.prompt = e.target.value; grava(); } }, 900);
  });

  if (logado()) painel(); else login();
})();
