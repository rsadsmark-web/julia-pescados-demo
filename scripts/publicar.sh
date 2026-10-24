#!/bin/sh
# Publica na VPS: monta a parte pública (estática, comprimida), envia o projeto e sobe o Node/Postgres.
# Uso: scripts/publicar.sh [host-ssh]   (padrão: erp-sukira-vps)
set -e
HOST="${1:-erp-sukira-vps}"; DEST=/opt/julia-pescados
cd "$(dirname "$0")/.."
node scripts/build-publico.mjs
ssh "$HOST" "mkdir -p $DEST/publico $DEST/dinamico && chown 1000:1000 $DEST/dinamico"
rsync -az --delete dist/publico/ "$HOST:$DEST/publico/"
rsync -az --exclude .git --exclude dist --exclude node_modules --exclude .env --exclude dinamico --exclude backups-locais --exclude publico --exclude docs-capturas --exclude docs-pdf --exclude tests ./ "$HOST:$DEST/"
ssh "$HOST" "cd $DEST && docker compose up -d --build && docker compose ps"
echo "No ar. Se o Caddyfile mudou: scripts/publicar.sh não mexe nele (deploy/Caddyfile.vps)."
