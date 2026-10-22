# Julia Pescados — demonstração

Demonstração clicável (sem back-end) da loja e do painel da Júlia Pescados.
Todos os dados ficam no navegador (localStorage); pedidos, nota fiscal e rotas são simulados.

- `index.html` — loja do cliente (catálogo, carrinho, entrega/retirada, WhatsApp, acompanhamento em mapa)
- `admin.html` — painel (pedidos e delivery, conversas, funil, campanhas, carteira, nota fiscal, estoque)
- `crm.js`, `campanhas.js`, `crm.css` — CRM completo: conversas no estilo WhatsApp Web, funil kanban e campanhas de disparo simuladas, com as travas de segurança dos disparos reais (chave geral, modo de teste, horário, intervalo aleatório, rodada, limite diário, aquecimento, opt-out, limite por lote, pausa após 3 falhas)
- `conversas.js`, `conversas.css` — área de Conversas (lista com busca e filtros, chat com bolhas, respostas rápidas, atalhos de teclado, painel do cliente, notas internas, transferência, anexos e áudios simulados) e o módulo opcional de Atendimento por IA (interruptor geral e por conversa, sugestão aprovada com um clique, IA responde sozinha com passagem para humano, tela de configuração); tudo simulado, nenhuma IA é chamada
- `shared.js` — dados de exemplo e regras compartilhadas

Marca e número de WhatsApp vêm do perfil @juliapescados. Preços, bairros e taxas são de exemplo.
Fotos: Wikimedia Commons (licenças livres), apenas ilustrativas.
