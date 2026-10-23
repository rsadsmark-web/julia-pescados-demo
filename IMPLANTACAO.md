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
Loja pública sem login (precisa de rota própria de pedido e catálogo), integração real de WhatsApp, IA e NF-e, área da RS Tech com senha no servidor, fontes e mapas ainda vêm de CDN.
