# Análise do catálogo atual da Júlia (SmartPOS) — 23/10/2026

Fonte: https://juliapescados.smartpos.app/ (leitura pelo Chrome + API pública de catálogo do SmartPOS). Nenhum pedido feito, nenhum cadastro. Dados extraídos em `smartpos-catalogo/` (produtos.json, produtos.csv, categorias, cores, 54 fotos).

## Números
- 54 produtos, 6 categorias: Peixes & Mariscos (18), Camarões (10), Produtos Regionais (9), Petiscos - Fritura (8), Petiscos - Farinha Pan (6), Temperos e Alhos (3).
- Preços de R$ 3,50 (tempero) a R$ 94,00 (filé de salmão/kg). Camarão filé de R$ 55,50 (M 51/60) a R$ 88,00 (XXG 16/20). Petiscos em bandeja de 12 ou 24 unidades, R$ 19 a R$ 27.
- Nenhum produto em promoção, nenhuma variação, nenhum adicional; estoque numérico exposto na API (ex.: 57 kg).
- Unidade vem só no nome ("(Kg)", "(Bandeja c/ 24 Und)", "(500g)"); não há campo de unidade. Vários nomes cortados em 40 caracteres na origem (ex.: "Bolinha De Camarão - Fritura (Bandeja C/"), e dois produtos com nome quase igual (bolinha de camarão em duas categorias).
- Fotos: uma por produto (cdn.smartpos.app/product/<id>), 1 produto sem foto (só letras "Fil" em laranja).

## Como funciona o pedido
- Grade de cards com foto, nome e preço; ordenar por maior/menor preço e A-Z/Z-A; filtro por categoria; paginação (2 páginas). Sem busca por texto.
- Botão adiciona ao carrinho; carrinho em painel lateral (quantidade +/-, subtotal). Quantidade inteira (não aceita 0,5 kg).
- Checkout em 4 etapas: Resumo, Identifique-se (login/cadastro), Endereço, Pagamento, Conclusão. Opção "Entregar no endereço" (há retirada provavelmente). Campo "adicionar observação" por item. Pagamento: o código carrega PagSeguro (cartão online); não vi as etapas finais por exigirem cadastro.
- Não há exibição de taxa de entrega, pedido mínimo ou prazo antes do login.
- Contato: telefone (85) 99767-3481, e-mail, botão WhatsApp "Iniciar conversa", endereço Rua Ceci 1129, Fortaleza-CE, redes sociais.
- Horário: seg-sex 08:00-17:30, sáb 08:00-12:00, domingo fechado (só informativo no rodapé; não bloqueia pedido).

## Identidade visual
Cabeçalho laranja (#ffa40e), botões laranja (#f28A00), fundo azul-claro (#cae2ee), rodapé branco. Logo é a imagem da loja (cdn.smartpos.app/store/1297331). Visual genérico de template, sem banner (lista de banners vazia), sem marca forte, sem texto de apresentação.

## Pontos fortes
Pedido simples e conhecido, catálogo completo e atualizado (sincroniza com o PDV, estoque e preço mudam em tempo real), foto em todos os produtos, observação por item, pagamento online e cadastro de cliente.

## Pontos fracos
Sem busca; quantidade só inteira (ruim para peixe vendido por kg); unidade e peso estimado escondidos no nome; nomes cortados; sem banner/promoção/destaques/combos; sem descrição, origem ou dica de preparo; sem frete/prazo/mínimo visíveis; cadastro obrigatório antes de ver frete e pagamento (fricção alta); sem pedido pelo WhatsApp com mensagem pronta; sem recompra; cookie banner e visual de template; título da página só "Smartpos".

## O que o nosso sistema precisa para igualar
Catálogo de 54 itens em 6 categorias com foto e preço; carrinho; checkout com endereço, pagamento e entrega ou retirada; observação por item; filtro por categoria e ordenação; horário de funcionamento e contatos; estoque por produto; painel para a Júlia editar preço e estoque.

## Onde superar
Busca e filtros rápidos; unidade explícita e quantidade fracionada (0,5 kg, 1,5 kg) com peso aproximado e ajuste na pesagem; pedido sem cadastro (nome + WhatsApp); frete por bairro, mínimo e janela de entrega visíveis no carrinho; pedido que também chega pelo WhatsApp já formatado; aviso quando fechado e agendamento; destaques, combos (kit moqueca, kit petiscos), promoções; recompra com um toque do último pedido; descrição e dica de preparo; identidade própria da Júlia; e a etapa 2 (CRM, pós-venda, IA) que o SmartPOS não tem.
