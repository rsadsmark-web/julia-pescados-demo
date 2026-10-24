#!/bin/sh
# Confere (só leitura, nada é alterado) se um domínio está pronto para a loja da Júlia: DNS, certificado, redirecionamentos,
# cabeçalhos de segurança, cache e rotas protegidas. Uso: scripts/confere-dominio.sh julia.rstechmarketing.com.br
# Sai com 0 se tudo passou; 1 se alguma verificação falhou. Pode ser rodado antes e depois da troca de domínio.
set -u
D="${1:?informe o dominio, ex.: julia.rstechmarketing.com.br}"; B="https://$D"; falhas=0
ok() { echo "ok    - $1"; }; ruim() { echo "FALHA - $1"; falhas=$((falhas+1)); }; aviso() { echo "aviso - $1"; }
cab() { curl -sSI --max-time 15 "$@" 2>/dev/null | tr -d '\r'; }
status() { curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$@" 2>/dev/null; }

ips=$(dig +short "$D" A 2>/dev/null | tr '\n' ' ')
[ -n "$ips" ] && ok "DNS resolve: $ips" || ruim "o domÃ­nio nÃ£o resolve (DNS ainda nÃ£o aponta)"
case "$ips" in *104.1[6-9].*|*104.2[0-9].*|*172.6[4-7].*|*188.114.*|*162.159.*) ok "atrÃ¡s da Cloudflare (IP da Cloudflare)";; *) aviso "IP nÃ£o Ã© da Cloudflare: conferir se o proxy laranja esta ligado";; esac
[ "$(status "$B/")" = 200 ] && ok "loja abre (200)" || ruim "a loja nÃ£o abriu com 200"
[ "$(status "http://$D/")" = 301 ] || [ "$(status "http://$D/")" = 308 ] && ok "http redireciona para https" || aviso "http nÃ£o redireciona para https (Cloudflare: Always Use HTTPS)"
h=$(cab "$B/")
echo "$h" | grep -qi '^strict-transport-security:' && ok "HSTS ligado" || ruim "sem Strict-Transport-Security"
echo "$h" | grep -qi '^x-content-type-options: *nosniff' && ok "nosniff" || ruim "sem X-Content-Type-Options"
echo "$h" | grep -qi '^x-frame-options:' && ok "X-Frame-Options" || ruim "sem X-Frame-Options"
echo "$h" | grep -qi '^server: *caddy' && aviso "cabeÃ§alho Server expÃµe o Caddy" || ok "cabeÃ§alho Server nÃ£o expÃµe o servidor"
[ "$(status "$B/index.html")" = 301 ] && ok "/index.html redireciona (301)" || ruim "/index.html nÃ£o redireciona com 301"
[ "$(status "$B/receitas")" = 200 ] && ok "/receitas abre sem .html" || ruim "/receitas nÃ£o abre"
st=$(status "$B/admin"); case "$st" in 302|301|303|307) ok "/admin sem login redireciona ($st)";; *) ruim "/admin sem login respondeu $st (deveria mandar para o login)";; esac
[ "$(status "$B/api/kv")" = 401 ] && ok "/api/kv exige login (401)" || ruim "/api/kv nÃ£o devolveu 401 sem login"
[ "$(status "$B/api/uazapi/webhook/segredo-errado" -X POST -H 'content-type: application/json' -d '{}')" = 404 ] && ok "webhook sem segredo correto responde 404" || ruim "webhook nÃ£o fechou para segredo errado"
echo "$(cab "$B/api/whatsapp/estado")" | grep -qi '^cache-control:.*no-store' && ok "API com Cache-Control: no-store" || ruim "API sem no-store (a Cloudflare poderia guardar resposta privada)"
j=$(cab "$B/estado-publico.json"); echo "$j" | grep -qi '^cache-control:.*max-age' && ok "catÃ¡logo pÃºblico com cache curto" || ruim "catÃ¡logo pÃºblico sem Cache-Control"
im=$(curl -s --max-time 15 "$B/" | grep -o '/img/produtos/[^"]*\.webp' | head -1)
[ -n "$im" ] && { cab "$B$im" | grep -qi '^cache-control:.*max-age=[0-9]\{6,\}' && ok "fotos com cache longo" || aviso "fotos sem cache longo"; } || aviso "nÃ£o achei foto de produto na pagina para testar o cache"
cert=$(echo | openssl s_client -servername "$D" -connect "$D:443" 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
[ -n "$cert" ] && ok "certificado vÃ¡lido atÃ© $cert" || ruim "nÃ£o consegui ler o certificado"
for rota in /.env /.git/config /servidor/server.js /docker-compose.yml /backups-locais/; do
  c=$(status "$B$rota"); case "$c" in 404|401|403|302|301) ;; 200) ruim "$rota estÃ¡ PÃBLICO (200)";; *) aviso "$rota respondeu $c";; esac
done
[ "$falhas" = 0 ] && { echo "TUDO CERTO em $D"; exit 0; } || { echo "$falhas verificaÃ§Ã£o(Ãµes) falharam em $D"; exit 1; }
