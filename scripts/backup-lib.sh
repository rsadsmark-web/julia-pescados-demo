#!/bin/sh
# Funções comuns dos scripts de backup. Modo "compose" (padrão, na VPS) usa o banco do docker compose;
# modo "local" (testes) usa JULIA_PG_* e os binários do Postgres da máquina.
DIR_PROJ="${DIR_PROJ:-$(cd "$(dirname "$0")/.." && pwd)}"
PASTA_BKP="${PASTA_BKP:-$DIR_PROJ/backups-locais}"
ESTADO="$PASTA_BKP/ultimo-backup.json"
REMOTO_DRIVE="${REMOTO_DRIVE:-gdrive-julia:}"       # remoto do rclone SÓ da Júlia (nunca usar o de outro cliente)
PASTA_DRIVE="${PASTA_DRIVE:-Julia Pescados/backups}"
GUARDA_DIAS="${GUARDA_DIAS:-30}"
MODO="${JULIA_MODO:-compose}"

pg_dump_() {
  if [ "$MODO" = local ]; then PGHOST="$JULIA_PGHOST" PGPORT="$JULIA_PGPORT" pg_dump -U "$JULIA_PGUSER" -d "$JULIA_PGDB" --no-owner
  else (cd "$DIR_PROJ" && docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner'); fi
}
# psql_ <banco-ou-vazio> : lê o SQL da entrada padrão
psql_() {
  if [ "$MODO" = local ]; then PGHOST="$JULIA_PGHOST" PGPORT="$JULIA_PGPORT" psql -q -v ON_ERROR_STOP=1 -U "$JULIA_PGUSER" -d "${1:-$JULIA_PGDB}"
  else
    _db="${1:-}"; [ -n "$_db" ] || _db='$POSTGRES_DB'
    (cd "$DIR_PROJ" && docker compose exec -T db sh -c "psql -q -v ON_ERROR_STOP=1 -U \"\$POSTGRES_USER\" -d \"$_db\"")
  fi
}
