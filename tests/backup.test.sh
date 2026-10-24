#!/bin/sh
# Teste dos scripts de backup contra um Postgres local. Uso: tests/backup.test.sh <host-socket> <porta> <usuario> <banco>
# (o banco precisa ter as tabelas do sistema: suba o servidor uma vez). Não toca no banco: só lê e restaura num temporário.
set -eu
raiz="$(cd "$(dirname "$0")/.." && pwd)"
export JULIA_MODO=local JULIA_PGHOST="$1" JULIA_PGPORT="$2" JULIA_PGUSER="$3" JULIA_PGDB="$4"
export PASTA_BKP="$(mktemp -d)" REMOTO_DRIVE="remoto-que-nao-existe:"
export PATH="$PATH"
ok() { echo "ok - $1"; }
sh "$raiz/scripts/backup-diario.sh" >/dev/null; code=$?
[ "$code" = 0 ] && ls "$PASTA_BKP"/julia-*.sql.gz >/dev/null && ok "backup gera dump conferido"
grep -q '"drive":"pendente"' "$PASTA_BKP/ultimo-backup.json" && ok "sem Drive configurado fica pendente (nao falha)"
sh "$raiz/scripts/testa-restauracao.sh" >/dev/null && grep -q '"ok":true' "$PASTA_BKP/restauro-testado.json" && ok "restauracao em banco temporario confere"
# nenhum banco temporario sobra
PGHOST="$JULIA_PGHOST" PGPORT="$JULIA_PGPORT" psql -U "$JULIA_PGUSER" -d postgres -Atc "select count(*) from pg_database where datname like 'restauro_teste_%'" | grep -qx 0 && ok "banco temporario removido"
set +e; sh "$raiz/scripts/verifica-backup.sh" >/dev/null; v=$?; set -e
[ "$v" = 2 ] && ok "verificacao avisa Drive pendente (codigo 2)"
# dump corrompido nao restaura e é reportado
bom=$(ls "$PASTA_BKP"/julia-*.sql.gz | head -1); printf 'lixo' | gzip > "$PASTA_BKP/julia-corrompido.sql.gz"
set +e; sh "$raiz/scripts/testa-restauracao.sh" "$PASTA_BKP/julia-corrompido.sql.gz" >/dev/null 2>&1; c=$?; set -e
[ "$c" = 1 ] && grep -q '"ok":false' "$PASTA_BKP/restauro-testado.json" && ok "dump corrompido e reprovado"
set +e; sh "$raiz/scripts/verifica-backup.sh" >/dev/null; v=$?; set -e
[ "$v" = 1 ] && ok "verificacao alerta quando o restauro falhou (codigo 1)"
# backup velho
touch -t 202001010000 "$PASTA_BKP/ultimo-backup.json"; rm -f "$PASTA_BKP/restauro-testado.json"
set +e; sh "$raiz/scripts/verifica-backup.sh" >/dev/null; v=$?; set -e
[ "$v" = 1 ] && ok "verificacao alerta backup com mais de 26h"
echo "testes backup ok"
