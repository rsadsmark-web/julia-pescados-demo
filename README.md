# Julia Pescados — demonstração

Demonstração clicável (sem back-end) da loja e do painel da Júlia Pescados.
Todos os dados ficam no navegador (localStorage); pedidos, nota fiscal e rotas são simulados.

- `index.html` — loja do cliente (catálogo, carrinho, entrega/retirada, WhatsApp, acompanhamento em mapa)
- `admin.html` — painel (pedidos e delivery, conversas, funil, campanhas, carteira, nota fiscal, estoque)
- `crm.js`, `campanhas.js`, `crm.css` — CRM completo: conversas no estilo WhatsApp Web, funil kanban e campanhas de disparo simuladas, com as travas de segurança dos disparos reais (chave geral, modo de teste, horário, intervalo aleatório, rodada, limite diário, aquecimento, opt-out, limite por lote, pausa após 3 falhas)
- `shared.js` — dados de exemplo e regras compartilhadas

Marca e número de WhatsApp vêm do perfil @juliapescados. Preços, bairros e taxas são de exemplo.
Fotos: Wikimedia Commons (licenças livres), apenas ilustrativas.
