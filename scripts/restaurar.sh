#!/bin/sh
# Restaura um dump (.sql.gz) no banco. APAGA os dados atuais. Uso: scripts/restaurar.sh arquivo.sql.gz
set -e
[ -f "$1" ] || { echo "Informe o arquivo .sql.gz"; exit 1; }
printf "Isto substitui TODOS os dados atuais. Digite SIM para continuar: "; read r; [ "$r" = "SIM" ] || exit 1
docker compose stop app
docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"'
gunzip -c "$1" | docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1'
docker compose start app
echo "Restaurado."
