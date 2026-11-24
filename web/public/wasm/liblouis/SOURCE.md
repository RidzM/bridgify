# liblouis 3.39.0 (WebAssembly build)

liblouis is free software under the GNU Lesser General Public License,
version 2.1 or (at your option) any later version. The full licence text is in
`LICENSE` next to this file.

- Source tarball: https://github.com/liblouis/liblouis/releases/download/v3.39.0/liblouis-3.39.0.tar.gz
- sha256: 629fa8cb0dfd9ad457c5bf47a42f0953b673e62c8ad6b1d03ddc4e2bd20008f1
- Project: https://liblouis.io

The files here were built, unmodified, from that tarball with Emscripten
6.0.13 (`emscripten/emsdk:6.0.13@sha256:fb7864e398acfda863dfcea78b8bc8adad359fa60c6a0bbeb845931de64aa68a`) by `tools-wasm/build-liblouis.sh` in this
repository: `./configure --prefix=/usr --disable-shared --enable-static
--enable-ucs4 --without-yaml`, then `emcc -O3`. Run that script to rebuild or
to relink against a modified liblouis.

Embedded tables (`/usr/share/liblouis/tables`): braille-patterns.cti devanagari.cti en-chardefs.cti en-in-g1.ctb en-ueb-chardefs.uti en-ueb-g1.ctb en-ueb-g2.ctb en-ueb-math.ctb en-us-emphasis.uti hi-in-g1.utb latinLetterDef6Dots.uti latinUppercaseComp6.uti litdigits6Dots.uti loweredDigits6Dots.uti spaces.uti text_nabcc.dis unicode.dis
