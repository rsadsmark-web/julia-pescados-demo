# Domínio definitivo e Cloudflare — roteiro

Estado de hoje: a loja roda em `julia.rstechmarketing.com.br` (VPS atual, Caddy + Node + Postgres). **Nada neste roteiro foi executado**: DNS e domínio só mudam com ordem expressa. Tudo abaixo está pronto para ser seguido na ordem.

## O que o dono precisa decidir (pendências)
1. **Qual domínio**: ex. `juliapescados.com.br`. Registrar em registro.br (ou outro) no nome da Júlia/empresa.
2. **Conta Cloudflare** (plano gratuito basta) em nome da Júlia ou da RS Tech, com acesso para quem opera.
3. Se a loja deve ficar na raiz (`juliapescados.com.br`) ou em `loja.juliapescados.com.br`. O roteiro usa a raiz e redireciona `www`.

## Passo a passo (dia da troca)
Tempo previsto: 30 min de trabalho + até 24 h de propagação do DNS. Fazer de manhã, em dia de pouco movimento.

**0. Antes de mexer**
- `scripts/backup-diario.sh` na VPS e conferir `scripts/verifica-backup.sh` (deve dar OK).
- Rodar `scripts/confere-dominio.sh julia.rstechmarketing.com.br` e guardar a saída (é a linha de base).
- Anotar o IP da VPS atual (hoje `157.173.206.42`).

**1. Cloudflare: adicionar o site**
- Cloudflare → Add a site → domínio novo → plano Free. Ela importa os registros DNS existentes; conferir.
- No registro.br, trocar os servidores DNS pelos dois que a Cloudflare indicar. (Só aqui o domínio passa a ser da Cloudflare.)

**2. DNS na Cloudflare** (proxy laranja LIGADO em todos)
| Tipo | Nome | Valor |
|---|---|---|
| A | `@` | IP da VPS |
| CNAME | `www` | `@` |
(Se houver e-mail no domínio, os registros MX/TXT ficam com proxy desligado/cinza.)

**3. SSL/TLS na Cloudflare**
- Modo **Full (strict)**; Always Use HTTPS ligado; Minimum TLS 1.2; HSTS opcional (o Caddy já manda o cabeçalho).
- Certificado de origem: o Caddy emite o próprio (Let's Encrypt). Se a validação falhar com o proxy ligado, desligar o proxy por 5 minutos só para emitir e religar, ou usar um Origin Certificate da Cloudflare.

**4. Caddy na VPS** (`/etc/caddy/Caddyfile`)
- Fazer cópia de segurança do arquivo.
- Usar `deploy/Caddyfile.dominio-definitivo.exemplo`: troca o domínio, mantém o antigo como **redirecionamento 301** para o novo e registra os IPs da Cloudflare como proxies confiáveis (o limite por IP precisa enxergar o visitante real, não a Cloudflare).
- `caddy validate --config /etc/caddy/Caddyfile` e só depois `systemctl reload caddy`.
- No `.env` do projeto: `DOMINIO=<novo>`; recriar o app (`docker compose up -d`).

**5. Regras da Cloudflare** (`deploy/cloudflare/regras.md`, ou `scripts/cloudflare-aplica.sh` em modo simulação)
- Cache: nunca guardar `/api/*`, `/admin*`, `/login*`, `/usuarios*`, `/config-ia*`, `/trocar-senha*`; guardar `/img/*` e arquivos com `?v=`.
- Limite de requisições para `/api/pedidos` e `/api/espera` (a API já limita por IP, isto é a segunda camada).
- Bot Fight Mode ligado; “Security Level” médio.

**6. Integrações que usam o endereço**
- Webhook da uazapi: `https://<novo>/api/uazapi/webhook/<segredo>`.
- Link da loja no Instagram, no Google Meu Negócio e nas mensagens da IA (o prompt cita `julia.rstechmarketing.com.br`; atualizar em `servidor/ia-lib.js` e no `DOMINIOS` permitido).
- Pixel/Meta e Search Console: adicionar a propriedade nova; manter a antiga por 30 dias.
- QR Codes e materiais impressos: só imprimir depois da troca.

**7. Conferência**
- `scripts/confere-dominio.sh <novo>` deve terminar com “TUDO CERTO”.
- Fazer um pedido de teste na loja nova e confirmar no painel; testar login do painel e a tela WhatsApp.
- `scripts/verifica-backup.sh` e um backup manual novo.

## Volta atrás (rollback)
- Caddy: restaurar a cópia do `Caddyfile` e `systemctl reload caddy` (o domínio antigo continua respondendo).
- DNS: se algo der errado antes da propagação, devolver os servidores DNS no registro.br para os anteriores. O domínio antigo (`julia.rstechmarketing.com.br`) fica ativo por 30 dias e não é desligado na troca.
- Nunca apagar o banco nem o volume na troca de domínio: só o endereço muda.

## Segurança que já está pronta
HTTPS com HSTS, cookie de sessão `HttpOnly` + `Secure` + `SameSite=Lax`, painel e API com `Cache-Control: no-store`, limite por IP nas rotas públicas e no login, login com bloqueio após 5 erros, auditoria das ações, backup diário e restauração testada.
