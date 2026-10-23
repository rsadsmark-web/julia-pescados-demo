#!/bin/sh
# Backup imediato do banco. Uso: scripts/backup-agora.sh [pasta-de-destino]  (padrão: ./backups-locais)
set -e
destino="${1:-./backups-locais}"; mkdir -p "$destino"
arq="$destino/julia-$(date +%Y%m%d-%H%M%S).sql.gz"
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner' | gzip > "$arq"
echo "Backup gravado em $arq"
