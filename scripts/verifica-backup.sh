#!/bin/sh
# Para o Argos (monitoramento): 0 = tudo certo; 1 = backup velho ou falho (alerta); 2 = só falta o Drive (aviso).
# Uso: scripts/verifica-backup.sh   (na pasta do projeto, na VPS)
. "$(dirname "$0")/backup-lib.sh"
[ -f "$ESTADO" ] || { echo "ALERTA: nenhum backup registrado"; exit 1; }
idade_h=$(( ( $(date +%s) - $(stat -c %Y "$ESTADO" 2>/dev/null || stat -f %m "$ESTADO") ) / 3600 ))
drive=$(sed -n 's/.*"drive":"\([^"]*\)".*/\1/p' "$ESTADO")
[ "$idade_h" -gt 26 ] && { echo "ALERTA: ultimo backup tem ${idade_h}h (mais de 26h)"; exit 1; }
[ "$drive" = falhou ] && { echo "ALERTA: backup do dia nao foi para o Drive"; exit 1; }
if [ -f "$PASTA_BKP/restauro-testado.json" ]; then
  r_h=$(( ( $(date +%s) - $(stat -c %Y "$PASTA_BKP/restauro-testado.json" 2>/dev/null || stat -f %m "$PASTA_BKP/restauro-testado.json") ) / 3600 ))
  grep -q '"ok":false' "$PASTA_BKP/restauro-testado.json" && { echo "ALERTA: ultimo teste de restauracao FALHOU"; exit 1; }
  [ "$r_h" -gt 200 ] && { echo "AVISO: teste de restauracao tem ${r_h}h (semanal esperado)"; exit 2; }
fi
[ "$drive" = pendente ] && { echo "AVISO: backup local ok (${idade_h}h), Drive da Julia pendente"; exit 2; }
echo "OK: backup de ${idade_h}h, Drive ok"; exit 0
