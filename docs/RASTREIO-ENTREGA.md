# Rastreio de entrega — Júlia Pescados

Custo: **zero**. Nenhuma chave, nenhum cartão, nenhum domínio novo.

## Como funciona
1. A Júlia atribui o entregador ao pedido (como já fazia) e, no painel → Pedidos e delivery, toca em **Rastreio → Gerar links**.
2. Sai um **link do entregador** (`/e/<token>`) e um **link do cliente** (`/r/<token>`). Os dois têm token de 256 bits e valem 12 horas (e 30 minutos depois da entrega). No banco fica só o resumo (hash) do token; por isso os links só aparecem na hora em que são gerados (gerar de novo invalida os antigos).
3. O entregador abre o link no celular (sem app), vê o endereço e toca em **Iniciar entrega** (só libera com o pedido em “Pronto”). O celular pede a localização, o aviso de privacidade é mostrado antes, e a posição vai ao servidor a cada 4 a 15 segundos (parado, manda menos).
4. O cliente abre o link dele e vê o estado, o entregador no mapa, o rastro, a rota e o tempo estimado. Atualiza sozinho a cada 5 segundos.
5. O entregador toca em **Entreguei** (ou **Não consegui entregar**, com o motivo). O painel aplica o status no pedido (saiu → entregue/falhou) e a posição, o rastro e a rota são apagados na hora.
6. O painel mostra no mapa de Pedidos e delivery a posição real de todos os entregadores em rota (aviso vermelho se um ficar mais de 3 minutos sem sinal).

Estados do pedido: novo → confirmado → separando → pronto → saiu → entregue; **falhou** (“Entrega não realizada”, com motivo, permite nova tentativa) e cancelado.

## Escolhas e custo
| Peça | Escolha | Custo |
|---|---|---|
| Mapa | Leaflet + tiles do OpenStreetMap, com atribuição e referer só da origem (política de uso do OSM). Volume de uma loja é baixo. | 0 |
| Rota e tempo | OSRM público, no servidor, no máximo uma vez a cada 45 s por entrega e só se o entregador andou; plano B em linha reta × 1,3 ÷ 22 km/h | 0 |
| Endereço → coordenada | Nominatim, uma consulta por segundo, com cache de 180 dias no banco; plano B: centro do bairro (avisado no painel como “aproximado”) | 0 |
| Google Maps | **Não usado.** Se o volume crescer muito (centenas de entregas por dia), estimativa: Routes + Maps ≈ US$ 5 a 10 por mil entregas, sem plano gratuito estável para uso comercial. Só com aprovação. | — |

Os serviços gratuitos de OpenStreetMap não têm garantia. Se o volume crescer ou algum cair com frequência, troque sem mexer no código: `TILES_URL`, `TILES_ATRIBUICAO`, `OSRM_URL` e `NOMINATIM_URL` no `.env` (ex.: MapTiler, Stadia ou OSRM/Nominatim próprios). Os planos gratuitos de MapTiler e Stadia são para uso não comercial; por isso não foram adotados como padrão.

## Privacidade
- O entregador vê o aviso antes de iniciar; o compartilhamento só começa ao tocar no botão e termina ao concluir, falhar ou cancelar.
- O servidor guarda só a última posição e os últimos 40 pontos (rastro), e **apaga tudo** ao concluir, cancelar, falhar ou vencer o link. Registros sem posição (estado e horários) somem em 30 dias.
- O cliente vê só: primeiro nome, bairro, nome do entregador, posição durante a rota, tempo e distância. Nunca telefone, endereço completo ou observações.
- O endereço do pedido (sem nome nem telefone) é enviado ao Nominatim para achar o ponto no mapa.
- As telas usam `Referrer-Policy: origin`, `noindex` e `no-store`; o token não vai para o servidor de mapas.
- HTTPS é obrigatório para a localização funcionar; a Permissions-Policy libera `geolocation` só para o próprio site.

## Quando falta algo
| Situação | O que acontece |
|---|---|
| GPS negado | A tela explica como liberar (cadeado → localização) e nada é iniciado no servidor |
| Sem internet | Os pontos ficam numa fila no aparelho (até 200) e vão todos de uma vez quando o sinal volta |
| GPS impreciso ou salto de posição | Ponto descartado (precisão pior que 150 m, mais de 162 km/h, fora de Fortaleza/Caucaia) |
| Link expirado ou errado | Mensagem clara (410/404), sem detalhes |
| Pedido cancelado | O painel avisa o servidor; o entregador em rota recebe “pedido cancelado” e a posição é apagada |
| Roteirização ou busca de endereço fora do ar | Tempo em linha reta; destino pelo centro do bairro, com aviso |
| Painel fechado | O rastreio continua; o status do pedido é atualizado quando o painel abrir (vigia a cada 6 s) |

## Monitoramento
- `GET /api/rastreios/metricas` (administrador): entregas em rota, sem sinal, posições recebidas/descartadas, acertos e falhas do OSRM e do Nominatim.
- O servidor registra no log `rastreio sem sinal há mais de 3 min: <pedidos>` (o Argos pode ler com `docker logs`).
- Na tela do painel, um aviso vermelho aparece quando algum entregador fica sem sinal.

## Frete
Segue como estava: taxa do bairro + R$ 1,50 por km acima de 8 km (distância de rua estimada = linha reta × 1,3), configurável em Loja online → Frete e mínimo. **Valores assumidos**: dependem do formulário da Júlia. Não foi trocado por distância de rota para o preço mostrado ao cliente não mudar depois do pedido.

## WhatsApp
Nenhum link é enviado por WhatsApp. O painel só copia os links. O envio do link do cliente entra quando a etapa de WhatsApp estiver liberada.

## Testes
```
node tests/entrega.test.mjs "$PWD"           # regras (distância, filtro de GPS, fila, privacidade, status “falhou”)
node tests/entrega-servidor.test.mjs "$PWD"  # servidor + Postgres temporário + OSRM/Nominatim de mentira
node tests/entrega-e2e.test.mjs "$PWD"       # server.js real, entregador simulado percorrendo a rota, com túnel sem internet
```
Os dois últimos precisam do Postgres local (`createdb`).
