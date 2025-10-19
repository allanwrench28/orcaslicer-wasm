#!/usr/bin/env bash
set -euo pipefail
# Load emscripten env if available
source wasm/toolchain/emsdk.env 2>/dev/null || source /opt/emsdk/emsdk_env.sh 2>/dev/null || true

# Ensure submodule present
git submodule update --init --recursive

# Configure + build
emcmake cmake -S wasm -B build-wasm -DCMAKE_BUILD_TYPE=Release
cmake --build build-wasm -j

# Stage artifacts for the web app
mkdir -p web/public/wasm
cp build-wasm/slicer.js build-wasm/slicer.wasm web/public/wasm/ 2>/dev/null || true

echo "✅ WASM build complete"
