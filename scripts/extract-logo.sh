#!/usr/bin/env bash
# Schneidet das echte M&M-Logo aus dem Scan des Papierformulars (docs/vorlage-scan.pdf) aus
# und erzeugt Logo + App-Icons. Benötigt poppler-utils (pdfimages) und ImageMagick 6 (convert).
# Wird nur gebraucht, wenn die Bilder neu erzeugt werden sollen – die Ergebnisse liegen in public/.
set -euo pipefail
cd "$(dirname "$0")/.."
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
GOLD="#b8995e" # = brandColors.gold (src/config/brand.ts)
S=768; R=$((S / 2))

pdfimages -j docs/vorlage-scan.pdf "$TMP/scan"
# Logo-Bereich in Originalauflösung (Scan 2112×3008 px)
convert "$TMP/scan-000.jpg" -crop 430x430+1630+160 +repage "$TMP/native.png"
# Hochskalieren, Scan-Rauschen glätten, Farben auf Schwarz / Weiß / Markengold bereinigen, herunterrechnen
convert "$TMP/native.png" -filter Mitchell -resize 400% -selective-blur 0x4+12% \
  -fuzz 26% -fill black -opaque black \
  -fuzz 16% -fill white -opaque white \
  -fuzz 13% -fill "$GOLD" -opaque "#c8a868" \
  -blur 0x1.5 -filter Lanczos -resize ${S}x${S} "$TMP/clean.png"
# Innenbereich weich maskieren und auf einen exakt runden schwarzen Kreis setzen (Rand transparent)
convert -size ${S}x${S} xc:none -fill white -draw "circle $R,$R $R,$((R - 300))" -blur 0x8 "$TMP/mask.png"
convert "$TMP/clean.png" "$TMP/mask.png" -alpha off -compose CopyOpacity -composite "$TMP/inner.png"
convert -size ${S}x${S} xc:none -fill black -draw "circle $((R - 1)).5,$((R - 1)).5 $((R - 1)).5,2" \
  "$TMP/inner.png" -compose over -composite -strip public/brand/mm-logo.png

L=public/brand/mm-logo.png
convert "$L" -filter Lanczos -resize 192x192 -strip public/icons/icon-192.png
convert "$L" -filter Lanczos -resize 512x512 -strip public/icons/icon-512.png
convert -size 512x512 xc:black \( "$L" -resize 400x400 \) -gravity center -compose over -composite -strip public/icons/icon-maskable-512.png
convert -size 180x180 xc:black \( "$L" -resize 172x172 \) -gravity center -compose over -composite -strip public/icons/apple-touch-icon.png
convert "$L" -resize 64x64 -strip src/app/icon.png
convert "$L" -define icon:auto-resize=48,32,16 src/app/favicon.ico
echo "Logo und Icons aktualisiert."
