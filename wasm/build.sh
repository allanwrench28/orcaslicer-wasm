#!/bin/bash
set -euo pipefail

source ./toolchain/emsdk.env || source /opt/emsdk/emsdk_env.sh || true

emcmake cmake -S wasm -B build-wasm -DCMAKE_BUILD_TYPE=Release -DCMAKE_DISABLE_FIND_PACKAGE_TBB=TRUE

cmake --build build-wasm -j

mkdir -p web/public/wasm && cp build-wasm/slicer.js build-wasm/slicer.wasm web/public/wasm/

echo "WASM build complete."
