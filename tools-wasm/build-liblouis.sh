#!/usr/bin/env bash
# Build liblouis to WebAssembly for the in-browser braille engine (decision D-24).
#
# Reproducible: pinned source tarball (sha256-checked) + pinned Emscripten image
# (by digest). Output goes to web/public/wasm/liblouis/:
#   liblouis.mjs   ES module factory (createLiblouis)
#   liblouis.wasm  code + the embedded tables (no separate .data file)
#   LICENSE        LGPL-2.1 text shipped with the source
#   SOURCE.md      where the exact source lives (LGPL compliance)
#
# Requires: docker, curl, sha256sum, python3.
# usage: tools-wasm/build-liblouis.sh
set -euo pipefail

LOUIS_VERSION=3.39.0
LOUIS_URL="https://github.com/liblouis/liblouis/releases/download/v${LOUIS_VERSION}/liblouis-${LOUIS_VERSION}.tar.gz"
LOUIS_SHA256=629fa8cb0dfd9ad457c5bf47a42f0953b673e62c8ad6b1d03ddc4e2bd20008f1
EMSDK_TAG=6.0.13
EMSDK_IMAGE="emscripten/emsdk:${EMSDK_TAG}@sha256:fb7864e398acfda863dfcea78b8bc8adad359fa60c6a0bbeb845931de64aa68a"

# Tables the app uses. Everything they #include is embedded too.
ROOT_TABLES=(unicode.dis en-ueb-g1.ctb en-ueb-g2.ctb hi-in-g1.utb)

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(dirname "$HERE")"
WORK="$HERE/.build"
OUT="$REPO/web/public/wasm/liblouis"
TARBALL="$WORK/liblouis-${LOUIS_VERSION}.tar.gz"
SRC="$WORK/liblouis-${LOUIS_VERSION}"

mkdir -p "$WORK" "$OUT"

if [[ ! -f "$TARBALL" ]]; then
  echo "downloading $LOUIS_URL"
  curl -fsSL -o "$TARBALL.part" "$LOUIS_URL"
  mv "$TARBALL.part" "$TARBALL"
fi
echo "$LOUIS_SHA256  $TARBALL" | sha256sum -c -

rm -rf "$SRC"
tar -xzf "$TARBALL" -C "$WORK"

# Stage only the needed tables at the path liblouis looks in by default
# (TABLESDIR = $prefix/share/liblouis/tables with --prefix=/usr).
STAGE="$WORK/tables-stage"
rm -rf "$STAGE"
mkdir -p "$STAGE"
mapfile -t TABLES < <(python3 -I "$HERE/table-closure.py" "$SRC/tables" "${ROOT_TABLES[@]}")
for t in "${TABLES[@]}"; do cp "$SRC/tables/$t" "$STAGE/$t"; done
echo "embedding ${#TABLES[@]} tables: ${TABLES[*]}"

EXPORTS='_lou_translateString,_lou_backTranslateString,_lou_version,_lou_setDataPath,_lou_checkTable,_lou_charSize,_lou_free,_malloc,_free'
RUNTIME='HEAPU8,HEAP32,HEAPU32,UTF8ToString,stringToUTF8,lengthBytesUTF8'

# Runs as root inside the container (the image's prebuilt system-library cache
# is root-owned); ownership is handed back to the caller afterwards.
docker run --rm \
  -v "$WORK:/work" \
  -w "/work/liblouis-${LOUIS_VERSION}" \
  -e HOST_UID="$(id -u)" -e HOST_GID="$(id -g)" \
  "$EMSDK_IMAGE" bash -euo pipefail -c "
    emconfigure ./configure --prefix=/usr --disable-shared --enable-static \
      --enable-ucs4 --without-yaml --disable-dependency-tracking >/work/configure.log
    emmake make -j\$(nproc) -C gnulib >/work/make-gnulib.log
    emmake make -j\$(nproc) -C liblouis liblouis.la >/work/make-liblouis.log
    mkdir -p /work/dist
    emcc -O3 liblouis/.libs/liblouis.a gnulib/.libs/libgnu.a \
      -o /work/dist/liblouis.mjs \
      -sMODULARIZE=1 -sEXPORT_ES6=1 -sEXPORT_NAME=createLiblouis \
      -sENVIRONMENT=web,worker,node \
      -sALLOW_MEMORY_GROWTH=1 -sSTACK_SIZE=1048576 \
      -sEXPORTED_FUNCTIONS=$EXPORTS \
      -sEXPORTED_RUNTIME_METHODS=$RUNTIME \
      --embed-file /work/tables-stage@/usr/share/liblouis/tables
    chown -R \"\$HOST_UID:\$HOST_GID\" /work
  "

install -m 0644 "$WORK/dist/liblouis.mjs" "$WORK/dist/liblouis.wasm" "$OUT/"
install -m 0644 "$SRC/COPYING.LESSER" "$OUT/LICENSE"

cat >"$OUT/SOURCE.md" <<EOF
# liblouis ${LOUIS_VERSION} (WebAssembly build)

liblouis is free software under the GNU Lesser General Public License,
version 2.1 or (at your option) any later version. The full licence text is in
\`LICENSE\` next to this file.

- Source tarball: ${LOUIS_URL}
- sha256: ${LOUIS_SHA256}
- Project: https://liblouis.io

The files here were built, unmodified, from that tarball with Emscripten
${EMSDK_TAG} (\`${EMSDK_IMAGE}\`) by \`tools-wasm/build-liblouis.sh\` in this
repository: \`./configure --prefix=/usr --disable-shared --enable-static
--enable-ucs4 --without-yaml\`, then \`emcc -O3\`. Run that script to rebuild or
to relink against a modified liblouis.

Embedded tables (\`/usr/share/liblouis/tables\`): ${TABLES[*]}
EOF

echo
for f in liblouis.mjs liblouis.wasm; do
  raw=$(stat -c %s "$OUT/$f")
  gz=$(gzip -9c "$OUT/$f" | wc -c)
  printf '%-14s raw %8d B  gzip %8d B\n' "$f" "$raw" "$gz"
done
