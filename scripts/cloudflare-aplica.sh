#!/bin/sh
# Mostra (modo padrão) ou aplica (--aplicar) as regras de cache da Cloudflare para a loja. NÃO mexe em DNS nem em domínio.
# Precisa de CF_API_TOKEN (permissão "Zone > Cache Rules > Edit") e CF_ZONE_ID no ambiente. Sem --aplicar só imprime o que faria.
# ATENÇÃO: o formato foi escrito pela documentação da Cloudflare e NÃO foi testado contra a API real; conferir no painel depois.
set -eu
APLICAR=0; [ "${1:-}" = "--aplicar" ] && APLICAR=1
corpo='{"rules":[
 {"description":"Julia: areas privadas nunca em cache","enabled":true,"action":"set_cache_settings","action_parameters":{"cache":false},
  "expression":"starts_with(http.request.uri.path, \"/api/\") or starts_with(http.request.uri.path, \"/admin\") or starts_with(http.request.uri.path, \"/login\") or starts_with(http.request.uri.path, \"/usuarios\") or starts_with(http.request.uri.path, \"/config-ia\") or starts_with(http.request.uri.path, \"/trocar-senha\")"},
 {"description":"Julia: catalogo, fotos e arquivos versionados respeitam a origem","enabled":true,"action":"set_cache_settings","action_parameters":{"cache":true,"edge_ttl":{"mode":"respect_origin"},"browser_ttl":{"mode":"respect_origin"}},
  "expression":"http.request.uri.path eq \"/estado-publico.json\" or starts_with(http.request.uri.path, \"/img/\") or http.request.uri.query contains \"v=\""}
]}'
echo "Regras de cache (fase http_request_cache_settings):"; echo "$corpo"
if [ "$APLICAR" = 1 ]; then
  : "${CF_API_TOKEN:?defina CF_API_TOKEN}" "${CF_ZONE_ID:?defina CF_ZONE_ID}"
  curl -sS -X PUT "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/rulesets/phases/http_request_cache_settings/entrypoint" \
    -H "Authorization: Bearer $CF_API_TOKEN" -H 'Content-Type: application/json' --data "$corpo" | head -c 600; echo
else echo "(simulação: nada foi enviado. Use --aplicar com CF_API_TOKEN e CF_ZONE_ID para enviar.)"; fi
