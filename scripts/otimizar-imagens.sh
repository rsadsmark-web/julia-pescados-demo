#!/bin/sh
# Converte as fotos de produto para WebP (até 800 px de lado maior, qualidade 78). Rode uma vez ao trocar uma foto em img/.
# Requer cwebp (brew install webp). Os .jpg originais não ficam no repositório: a loja usa só os .webp.
set -e
cd "$(dirname "$0")/../img"
for f in *.jpg; do
  [ -e "$f" ] || continue
  cwebp -quiet -q 78 -resize 800 0 -metadata none "$f" -o "${f%.jpg}.webp"
  echo "$f -> ${f%.jpg}.webp"
done
