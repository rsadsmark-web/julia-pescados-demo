#!/bin/sh
# Instala (ou atualiza) os timers de backup na VPS. Rode NA VPS, como root, na pasta /opt/julia-pescados.
set -e
cd /opt/julia-pescados; chmod +x scripts/*.sh
cp deploy/julia-backup.service deploy/julia-backup.timer deploy/julia-restauro.service deploy/julia-restauro.timer /etc/systemd/system/
systemctl daemon-reload; systemctl enable --now julia-backup.timer julia-restauro.timer
systemctl list-timers 'julia-*' --no-pager
