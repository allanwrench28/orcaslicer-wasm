#!/bin/bash
set -euo pipefail

BUILD_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${BUILD_SCRIPT_DIR}/.." && pwd)"

if ! source "${BUILD_SCRIPT_DIR}/toolchain/emsdk.env"; then
	source /opt/emsdk/emsdk_env.sh || true
fi

emcmake cmake -S "${BUILD_SCRIPT_DIR}" -B "${PROJECT_ROOT}/build-wasm" -DCMAKE_BUILD_TYPE=Release

cmake --build "${PROJECT_ROOT}/build-wasm" -j

mkdir -p "${PROJECT_ROOT}/web/public/wasm"
cp "${PROJECT_ROOT}/build-wasm/slicer.js" \
	"${PROJECT_ROOT}/build-wasm/slicer.wasm" \
	"${PROJECT_ROOT}/build-wasm/slicer.data" \
	"${PROJECT_ROOT}/web/public/wasm/"

echo "WASM build complete."
