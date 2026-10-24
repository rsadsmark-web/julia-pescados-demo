#!/bin/sh
# Backup diário do banco: dump comprimido e conferido, cópia local (30 dias) e, se o Drive da Júlia estiver configurado,
# cópia no Drive. Grava o resultado em backups-locais/ultimo-backup.json (o Argos lê isso). Sai com erro se o dump falhar.
set -u
. "$(dirname "$0")/backup-lib.sh"
mkdir -p "$PASTA_BKP"; agora=$(date +%Y%m%d-%H%M); arq="$PASTA_BKP/julia-$agora.sql.gz"
grava() { # drive, mensagem
  printf '{"quando":"%s","arquivo":"%s","bytes":%s,"drive":"%s","mensagem":"%s"}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$(basename "$arq")" "$(wc -c < "$arq" 2>/dev/null | tr -d ' ' || echo 0)" "$1" "$2" > "$ESTADO.tmp" && mv "$ESTADO.tmp" "$ESTADO"
}
if ! pg_dump_ | gzip > "$arq.tmp"; then rm -f "$arq.tmp"; printf '{"quando":"%s","arquivo":"","bytes":0,"drive":"falhou","mensagem":"pg_dump falhou"}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$ESTADO"; echo "backup FALHOU (pg_dump)"; exit 1; fi
# conferência: gzip íntegro, tamanho mínimo e as tabelas essenciais dentro do dump
if ! gzip -t "$arq.tmp" || [ "$(wc -c < "$arq.tmp")" -lt 2000 ] || ! gunzip -c "$arq.tmp" | grep -q 'CREATE TABLE public.usuarios'; then rm -f "$arq.tmp"; printf '{"quando":"%s","arquivo":"","bytes":0,"drive":"falhou","mensagem":"dump invalido"}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$ESTADO"; echo "backup FALHOU (dump inválido)"; exit 1; fi
mv "$arq.tmp" "$arq"; chmod 600 "$arq"
find "$PASTA_BKP" -name 'julia-*.sql.gz' -mtime +"$GUARDA_DIAS" -delete
drive=pendente; msg="Drive da Julia ainda nao configurado: copia so local"
if command -v rclone >/dev/null 2>&1 && rclone listremotes 2>/dev/null | grep -qx "$REMOTO_DRIVE"; then
  if rclone copy "$arq" "$REMOTO_DRIVE$PASTA_DRIVE/" --retries 3 --low-level-retries 5 >/dev/null 2>&1; then
    drive=ok; msg="copia no Drive conferida"
    # o primeiro backup do mês fica para sempre numa subpasta; os diários do Drive passam 30 dias e saem
    [ "$(date +%d)" = 01 ] && rclone copy "$arq" "$REMOTO_DRIVE$PASTA_DRIVE/mensais/" >/dev/null 2>&1
    rclone delete "$REMOTO_DRIVE$PASTA_DRIVE/" --min-age "${GUARDA_DIAS}d" --include 'julia-*.sql.gz' >/dev/null 2>&1
    rclone lsf "$REMOTO_DRIVE$PASTA_DRIVE/" --include "$(basename "$arq")" 2>/dev/null | grep -q . || { drive=falhou; msg="arquivo nao apareceu no Drive"; }
  else drive=falhou; msg="envio ao Drive falhou"; fi
fi
grava "$drive" "$msg"; echo "backup ok: $arq (drive: $drive)"
[ "$drive" = falhou ] && exit 2
exit 0
