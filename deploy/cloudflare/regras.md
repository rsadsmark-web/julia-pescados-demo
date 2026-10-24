# Regras da Cloudflare para a loja da Júlia (plano gratuito)

Criar em **Rules → Cache Rules** (ordem importa; a primeira que casar vale):

1. **Nunca guardar áreas privadas** — Se `starts_with(http.request.uri.path, "/api/")` ou `starts_with(http.request.uri.path, "/admin")` ou `starts_with(http.request.uri.path, "/login")` ou `starts_with(http.request.uri.path, "/usuarios")` ou `starts_with(http.request.uri.path, "/config-ia")` ou `starts_with(http.request.uri.path, "/trocar-senha")` → **Bypass cache**.
2. **Catálogo público** — Se `http.request.uri.path eq "/estado-publico.json"` → Eligible for cache, **respeitar o Cache-Control da origem** (15 s no navegador, 30 s na borda).
3. **Fotos e arquivos versionados** — Se `starts_with(http.request.uri.path, "/img/")` ou `http.request.uri.query contains "v="` → Eligible for cache, respeitar a origem.
4. **Páginas da loja** (`/`, `/receitas`) → respeitar a origem (5 min na borda).

**Rules → Rate limiting** (o plano gratuito permite 1 regra):
- Se `http.request.uri.path in {"/api/pedidos" "/api/espera"}` e método `POST` → por IP, 10 requisições em 10 segundos → bloquear por 10 segundos.

**Security**
- Bot Fight Mode: ligado. Security Level: médio.
- WAF → Managed rules (plano gratuito): ligado.
- Não ativar “Rocket Loader” nem “Auto Minify” (podem quebrar os scripts versionados do painel).
- Page Rule/Redirect: `www` → raiz já é feito no Caddy.

**Conferir depois**: `scripts/confere-dominio.sh <dominio>`.
