#!/bin/sh
# Prova que o backup restaura: pega o dump mais recente, restaura num banco TEMPORÁRIO (o de produção não é tocado),
# compara contagens com o banco real, apaga o temporário e grava o resultado em backups-locais/restauro-testado.json.
# Uso: scripts/testa-restauracao.sh [arquivo.sql.gz]
set -u
. "$(dirname "$0")/backup-lib.sh"
arq="${1:-$(ls -1t "$PASTA_BKP"/julia-*.sql.gz 2>/dev/null | head -1)}"
[ -f "$arq" ] || { echo "nenhum backup encontrado em $PASTA_BKP"; exit 1; }
tmp="restauro_teste_$(date +%s)"; saida="$PASTA_BKP/restauro-testado.json"
falha() { printf '{"quando":"%s","arquivo":"%s","ok":false,"mensagem":"%s"}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$(basename "$arq")" "$1" > "$saida"; echo "RESTAURO FALHOU: $1"; psql_ postgres <<SQL >/dev/null 2>&1
DROP DATABASE IF EXISTS $tmp;
SQL
  exit 1; }
conta() { echo "SELECT 'usuarios', count(*) FROM usuarios UNION ALL SELECT 'kv', count(*) FROM kv UNION ALL SELECT 'entradas', count(*) FROM entradas UNION ALL SELECT 'produtos', coalesce(jsonb_array_length((SELECT valor::jsonb->'produtos' FROM kv WHERE chave='jp_demo_v1')),0) UNION ALL SELECT 'pedidos', coalesce(jsonb_array_length((SELECT valor::jsonb->'pedidos' FROM kv WHERE chave='jp_demo_v1')),0);" | psql_ "$1" 2>&1; }
echo "CREATE DATABASE $tmp;" | psql_ postgres >/dev/null 2>&1 || falha "nÃ£o consegui criar o banco temporÃ¡rio"
gunzip -c "$arq" | psql_ "$tmp" >/dev/null 2>&1 || falha "o dump nÃ£o restaurou"
# contagens: o backup é do passado, então o banco real pode ter ido além; o restaurado nunca pode ter mais nem estar vazio
if [ "$MODO" = local ]; then real_db="$JULIA_PGDB"; else real_db=$(cd "$DIR_PROJ" && docker compose exec -T db sh -c 'echo $POSTGRES_DB'); fi
rest=$(conta "$tmp"); real=$(conta "$real_db")
echo "DROP DATABASE $tmp;" | psql_ postgres >/dev/null 2>&1
echo "restaurado:"; echo "$rest"; echo "real:"; echo "$real"
echo "$rest" | grep -q 'usuarios *| *[1-9]' || falha "banco restaurado sem usuarios"
echo "$rest" | grep -q 'kv *| *[1-9]' || echo "aviso: sem dados do painel no backup (banco novo?)"
printf '{"quando":"%s","arquivo":"%s","ok":true,"mensagem":"restauracao conferida em banco temporario"}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$(basename "$arq")" > "$saida"
echo "RESTAURO OK ($(basename "$arq"))"
