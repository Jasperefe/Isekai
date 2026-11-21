#!/bin/bash
# Builds the Playgama upload: dist/ISEKAI_playgama.zip with index.html at the root.
# Usage: bash tools/build_playgama.sh
set -e
cd "$(dirname "$0")/.."
rm -rf dist/playgama && mkdir -p dist/playgama
cp -r index.html src lib assets dist/playgama/
rm -f dist/ISEKAI_playgama.zip
(cd dist/playgama && zip -qr -9 ../ISEKAI_playgama.zip .)
echo "Built dist/ISEKAI_playgama.zip ($(du -h dist/ISEKAI_playgama.zip | cut -f1))"
