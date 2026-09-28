#!/usr/bin/env bash
# Tạo .icns cho macOS từ assets/icon.svg (không cần phụ thuộc ngoài; sips và iconutil có sẵn trên macOS).
# Cách dùng: scripts/make-icons.sh
# Đầu ra: assets/icons/icon.icns (được tham chiếu trong packagerConfig.icon của forge.config.ts và lưu trong Git).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/assets/icon.svg"
OUT_DIR="$ROOT/assets/icons"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

[ -f "$SRC" ] || { echo "Thiếu tệp nguồn: $SRC" >&2; exit 1; }
mkdir -p "$OUT_DIR"

# SVG → PNG 1024 px (sips dùng CoreSVG để raster hóa và giữ kênh trong suốt).
sips -s format png -z 1024 1024 "$SRC" --out "$TMP/icon-1024.png" >/dev/null

# Bộ iconset gồm 10 kích thước theo quy định của Apple (5 mức × @1x/@2x).
ICONSET="$TMP/icon.iconset"
mkdir "$ICONSET"
for size in 16 32 128 256 512; do
  sips -z "$size" "$size" "$TMP/icon-1024.png" --out "$ICONSET/icon_${size}x${size}.png" >/dev/null
  double=$((size * 2))
  sips -z "$double" "$double" "$TMP/icon-1024.png" --out "$ICONSET/icon_${size}x${size}@2x.png" >/dev/null
done

iconutil -c icns "$ICONSET" -o "$OUT_DIR/icon.icns"
echo "Đã tạo: $OUT_DIR/icon.icns"
