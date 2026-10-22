# Julia Pescados — demonstração

Demonstração clicável (sem back-end) da loja e do painel da Júlia Pescados.
Todos os dados ficam no navegador (localStorage); pedidos, nota fiscal e rotas são simulados.

- `index.html` — loja do cliente (catálogo, carrinho, entrega/retirada, WhatsApp, acompanhamento em mapa)
- `admin.html` — painel (pedidos e delivery, conversas, funil, campanhas, carteira, nota fiscal, estoque)
- `crm.js`, `campanhas.js`, `crm.css` — CRM completo: conversas no estilo WhatsApp Web, funil kanban e campanhas de disparo simuladas, com as travas de segurança dos disparos reais (chave geral, modo de teste, horário, intervalo aleatório, rodada, limite diário, aquecimento, opt-out, limite por lote, pausa após 3 falhas)
- `conversas.js`, `conversas.css` — área de Conversas (lista com busca e filtros, chat com bolhas, respostas rápidas, atalhos de teclado, painel do cliente, notas internas, transferência, anexos e áudios simulados) e o Atendimento por IA (ligado por padrão; o cliente só liga/desliga no geral e por conversa e assume a conversa, vendo quais respostas foram da IA); tudo simulado, nenhuma IA é chamada
- `config-ia.html`, `config-ia.js`, `config-ia.css`, `ia-config.js` — área restrita da RS Tech (fora do painel do cliente, sem link para ela): prompt do negócio pré-preenchido e editável e ajustes da IA. Acesso por senha de administrador (conferida por hash no navegador, com bloqueio após 5 erros); em produção vira rota no servidor com login e senha em variável de ambiente
- `posvenda-dados.js`, `posvenda.js`, `posvenda.css`, `posvenda-loja.css` — pós-venda: Receitas no WhatsApp (a IA manda uma receita curta do produto comprado depois da entrega; ligar/desligar e editar o texto por produto) e Avaliações (pedido de nota de 1 a 5 e comentário depois da entrega, com convite para indicar amigos; nota média, filtro por nota e destaque das notas baixas para o dono responder). O cliente também avalia na tela de acompanhamento da loja. Tudo simulado nas Conversas, sem envio real
- `shared.js` — dados de exemplo e regras compartilhadas

Marca e número de WhatsApp vêm do perfil @juliapescados. Preços, bairros e taxas são de exemplo.
Fotos: Wikimedia Commons (licenças livres), apenas ilustrativas.
