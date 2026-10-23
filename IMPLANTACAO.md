# Júlia Pescados — implantação (Docker Compose)

Estrutura portátil: o mesmo conjunto roda em qualquer máquina com Docker.

- `app` — Node (login, usuários, API do estado) e os arquivos do site. Memória limitada (`LIMITE_APP`).
- `db` — Postgres 16, volume `pgdata`, sem porta aberta para fora (só a rede interna do compose). Memória limitada (`LIMITE_BANCO`).
- `backup` — dump diário às 03h30 (Brasília) no volume `backups`, mantém 14 dias.
- `caddy` — proxy reverso com certificado automático (perfil `proxy`; só use se a máquina não tiver outro proxy).

## Subir do zero
```
cp .env.example .env      # preencher senha do banco (openssl rand -hex 24) e DOMINIO
docker compose up -d --build            # com proxy já existente na máquina (aponte-o para 127.0.0.1:APP_PORTA)
docker compose --profile proxy up -d --build   # com o Caddy do compose (portas 80 e 443)
docker compose exec app node servidor/criar-usuario.js admin "Administrador" admin   # gera senha forte, mostrada uma vez
```
A senha gerada é provisória: o sistema pede a troca no primeiro acesso. Outros usuários: tela "Usuários" do painel (administrador) ou o mesmo comando acima.

## Backup e restauração
- Automático: volume `backups` (`docker run --rm -v julia-pescados_backups:/b alpine ls -la /b`).
- Na hora: `scripts/backup-agora.sh [pasta]`. Para migrar de máquina: faça o backup, copie o `.sql.gz` e rode `scripts/restaurar.sh arquivo.sql.gz` na nova.
- Copie os dumps para fora da máquina (o volume está no mesmo disco).

## Como funciona o armazenamento
O código original da demonstração guardava tudo no `localStorage`. O `servidor-kv.js` troca isso, sem mexer no resto do código: as cinco chaves de estado (`jp_demo_v1`, `jp_crm_v1`, `jp_ex_v1`, `jp_pv_v1`, `jp_rs_ia_v1`) vão para a tabela `kv` do Postgres, com controle de versão (se duas sessões editarem ao mesmo tempo, a segunda recebe aviso e recarrega). Carrinho e dados do aparelho continuam no navegador. `window.JP_VAZIO` (definido pelo `/config.js` do servidor) faz o sistema nascer sem dados de exemplo.

## Pendências conhecidas
Atacado (entrada do restaurante por código) e acompanhamento do pedido na loja pública ainda são locais ao aparelho; falta rota própria para cada um. Integração real de WhatsApp, IA e NF-e, área da RS Tech com senha no servidor, fontes e mapas ainda vêm de CDN.

## Página pública e pico de visitas
A loja e as receitas **não passam pelo Node nem pelo banco** ao navegar. O Caddy entrega do disco (`dist/publico`, gerado por `scripts/build-publico.mjs`):
- arquivos já comprimidos em brotli e gzip (sem custo de processador por visita); css/js com `?v=<hash do conteúdo>` e cache de 1 ano (`immutable`); imagens WebP (até 800 px) com 30 dias; páginas com 60 s no navegador e 300 s na Cloudflare, com `stale-while-revalidate`/`stale-if-error` (se o servidor cair, a Cloudflare segue mostrando a última cópia);
- o catálogo (preço e estoque) é o arquivo `/estado-publico.json`, que o Node reescreve quando o painel salva (cache de 15 s no navegador e 30 s na Cloudflare). Se o Node cair, a loja continua abrindo.
- só `POST /api/pedidos` e `POST /api/espera` chamam o Node (12 por IP a cada 10 minutos, 40 por segundo por IP, 120 por minuto no total para proteger o banco). O servidor refaz o preço pelo catálogo e valida tudo. Login: 20 por minuto por IP e bloqueio de 15 min após 5 erros. Painel: 600 por minuto por IP.
- os pedidos entram numa fila (tabela `entradas`) e vão para o estado do painel quando alguém abre ou atualiza o painel; o painel avisa "novo pedido" a cada 30 s.
- publicar: `scripts/publicar.sh` (build, envio, `docker compose up`). Bloco do Caddy em `deploy/Caddyfile.vps` (com as opções para ficar atrás da Cloudflare e ver o IP real do visitante).
- memória: Node 256 MB (heap 160 MB), Postgres 384 MB, backup 64 MB; o Caddy da máquina serve o estático.

Medido na VPS (cliente na própria máquina, 400 conexões simultâneas com TLS): página inicial ~3.400 req/s, JS ~2.300 req/s, catálogo ~7.200 req/s, com o Node e o banco parados (18 MB de memória) e latência mediana de 40 a 150 ms. Sob 200 conexões martelando `/api/pedidos`, o Node ficou em 29 MB e a loja seguiu no ar.
