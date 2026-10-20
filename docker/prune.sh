#!/bin/sh
# Remove files the deployed CLI never loads on this image's platform: other platforms'
# native packages and prebuilds, type declarations, source maps, and package docs.
set -eu
root="$1"
modules="$root/node_modules"

case "$(uname -m)" in
  x86_64) arch=x64 ;;
  aarch64) arch=arm64 ;;
  *) echo "prune: unsupported architecture $(uname -m)" >&2; exit 1 ;;
esac
keep="linux-$arch"

for dir in "$modules"/@onprem-ai/node-addon-system-*; do
  case "$dir" in */node-addon-system-$keep) ;; *) rm -rf "$dir" ;; esac
done
for dir in "$modules"/node-pty/prebuilds/*; do
  case "$dir" in */$keep) ;; *) rm -rf "$dir" ;; esac
done
rm -rf "$modules"/node-pty/third_party

# Keep assets/ untouched: some packages serve files from it verbatim.
find "$modules" -type f \
  \( -name '*.d.ts' -o -name '*.d.mts' -o -name '*.d.cts' -o -name '*.map' \
     -o -name 'README*.md' -o -name 'CHANGELOG*.md' -o -name 'HISTORY*.md' \
     -o -name 'README*.i18n.yaml' -o -name '*.tsbuildinfo' \) \
  -not -path '*/assets/*' -delete
find "$modules" -depth -type d -empty -delete

test -x "$modules/@onprem-ai/node-addon-system-$keep/bin/landlock-run" \
  || { echo "prune: Landlock launcher missing from the deployed tree" >&2; exit 1; }
