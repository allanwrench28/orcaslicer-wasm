#!/usr/bin/env bash
# Build the Orca→WASM module and stage artifacts for the web app.
# Usage: bash scripts/build-wasm.sh
set -euo pipefail

# 1) Load Emscripten env if available (repo-local hint first, then system install)
source wasm/toolchain/emsdk.env 2>/dev/null || source /opt/emsdk/emsdk_env.sh 2>/dev/null || true

# 2) Ensure Emscripten is actually available
if ! command -v emcc >/dev/null 2>&1; then
  echo "❌ Emscripten (emcc) not found. Run: source /opt/emsdk/emsdk_env.sh" >&2
  exit 1
fi

# 3) Ensure Orca submodule is present and patched for WASM
git submodule update --init --recursive

PATCH_FILE="patches/orca-wasm.patch"
if [[ -f ${PATCH_FILE} ]]; then
  pushd orca >/dev/null
  if git apply --reverse --check "../${PATCH_FILE}" >/dev/null 2>&1; then
    echo "INFO: Orca WASM patch already applied"
  else
    if git apply --check "../${PATCH_FILE}" >/dev/null 2>&1; then
      git apply "../${PATCH_FILE}"
      echo "INFO: Applied Orca WASM patch"
    else
      echo "WARN: Orca WASM patch did not apply cleanly; continuing with current workspace" >&2
    fi
  fi
  popd >/dev/null
fi

# 4) Configure and build with Emscripten
emcmake cmake -S wasm -B build-wasm -DCMAKE_BUILD_TYPE=Release -DCMAKE_DISABLE_FIND_PACKAGE_TBB=TRUE
cmake --build build-wasm -j

# 5) Validate artifacts and stage for the web app
mkdir -p web/public/wasm
if [[ -f build-wasm/slicer.js && -f build-wasm/slicer.wasm ]]; then
  cp build-wasm/slicer.js build-wasm/slicer.wasm web/public/wasm/
  echo "✅ WASM build complete"
else
  echo "❌ WASM build failed: build-wasm/slicer.js or build-wasm/slicer.wasm not found" >&2
  # Optional: show recent CMake output for quick debugging
  (tail -n 100 build-wasm/CMakeFiles/CMakeOutput.log 2>/dev/null || true)
  exit 1
fi
