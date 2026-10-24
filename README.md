# Julia Pescados — demonstração

Demonstração clicável (sem back-end) da loja e do painel da Júlia Pescados.
Todos os dados ficam no navegador (localStorage); pedidos, nota fiscal e rotas são simulados.

- `index.html` (endereço `/`) — loja do cliente (catálogo, carrinho, entrega/retirada, WhatsApp, acompanhamento em mapa)
- `admin.html` (endereço `/admin`) — painel (pedidos e delivery, conversas, funil, campanhas, carteira, nota fiscal, estoque)
- `crm.js`, `campanhas.js`, `crm.css` — CRM completo: conversas no estilo WhatsApp Web, funil kanban e campanhas de disparo simuladas, com as travas de segurança dos disparos reais (chave geral, modo de teste, horário, intervalo aleatório, rodada, limite diário, aquecimento, opt-out, limite por lote, pausa após 3 falhas)
- `conversas.js`, `conversas.css` — área de Conversas (lista com busca e filtros, chat com bolhas, respostas rápidas, atalhos de teclado, painel do cliente, notas internas, transferência, anexos e áudios simulados) e o Atendimento por IA (ligado por padrão; o cliente só liga/desliga no geral e por conversa e assume a conversa, vendo quais respostas foram da IA); tudo simulado, nenhuma IA é chamada
- `config-ia.html`, `config-ia.js`, `config-ia.css`, `ia-config.js` — área restrita da RS Tech (fora do painel do cliente, sem link para ela): prompt do negócio pré-preenchido e editável e ajustes da IA. Acesso por senha de administrador (conferida por hash no navegador, com bloqueio após 5 erros); em produção vira rota no servidor com login e senha em variável de ambiente
- `posvenda-dados.js`, `posvenda.js`, `posvenda.css`, `posvenda-loja.css` — pós-venda: Receitas no WhatsApp (a IA manda uma receita curta do produto comprado depois da entrega; ligar/desligar e editar o texto por produto) e Avaliações (pedido de nota de 1 a 5 e comentário depois da entrega, com convite para indicar amigos; nota média, filtro por nota e destaque das notas baixas para o dono responder). O cliente também avalia na tela de acompanhamento da loja. Tudo simulado nas Conversas, sem envio real
- `receitas.html`, `receitas.js`, `receitas.css`, `receitas-dados.js` — página pública de receitas (32 receitas, de 2 a 3 por produto, no mesmo visual da loja). Depois da entrega a IA manda no WhatsApp só o link, com os produtos do pedido em destaque; o painel liga/desliga o envio e edita a mensagem e cada receita
- `extras-dados.js`, `extras.js`, `extras.css`, `loja-extras.css` — novidades: entregas do dia (rota por proximidade, Fortaleza e depois Caucaia, e aviso "saiu para entrega"), horário de corte às 14h (pedido aceito, mas com aviso de entrega no dia seguinte no carrinho, na confirmação e no WhatsApp; o painel simula o horário), recompra automática (aviso de 10 a 15 dias com link que remonta o último pedido), lote fresco (lista de espera por produto e disparo do aviso), atacado para restaurantes (tabela de preço fixo e pedido recorrente em um toque; entrada pelo código, ex.: `?atacado=MARE`) e kits (Churrasco de Camarão, Família, Moqueca e Semana, com o que vem e a economia)
- `shared.js` — dados de exemplo e regras compartilhadas

Marca e número de WhatsApp vêm do perfil @juliapescados. Preços, bairros e taxas são de exemplo.
Fotos: Wikimedia Commons (licenças livres), apenas ilustrativas.

Teste do PDF: `npm i jspdf@2.5.1 --no-save && node tests/pedido-pdf.test.mjs . docs-pdf` (gera os PDFs de exemplo em docs-pdf).

## Endereços (sem .html)
As telas respondem sem extensão: `/` (loja), `/receitas`, `/login`, `/trocar-senha`, `/admin` (painel; as abas são `#pedidos`, `#conversas` etc.), `/usuarios` e `/config-ia`. O endereço antigo com `.html` (e `/index`) redireciona com 301 para o limpo, mantendo a consulta. No Node isso está em `servidor/server.js` (redirecionamento + `express.static` com `extensions: ['html']`); no Caddy, em `deploy/Caddyfile.vps` (`redir` + `try_files {path}.html`). Os links dentro das páginas são absolutos (`/receitas`, `/admin`).

## Loja pública (etapa 2)
- `loja-lib.js`: regras puras (unidade e fração, preço/promoção, horário, agendamento, frete, mínimo, busca, combos, recompra), usadas pela loja no navegador e pelo servidor.
- `loja.js`, `loja-v2.css`, `index.html`: loja mobile primeiro, pedido sem cadastro, carrinho com subtotal, mínimo e frete antes dos dados.
- `servidor/pedido.js`: o servidor refaz preço, frete, mínimo e estoque do pedido; `/api/ultimo-pedido` serve a recompra por WhatsApp (limite por IP, sem endereço).
- `loja-admin.js` (menu "Loja online" do painel): preço, promoção, estoque, destaque, fração, descrição e dica, combos, frete por bairro, mínimo, horário, banner e contato. Fica na chave `jp_loja_v1` e vai para `/estado-publico.json`.
- Testes: `node tests/loja.test.mjs "$PWD"` e `node tests/smartpos.test.mjs "$PWD"`.
