#!/usr/bin/env bash
# Build GMP, MPFR, and CGAL for the Emscripten toolchain used by the WASM slicer.
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
REPO_DIR=$(cd "${ROOT_DIR}/.." && pwd)
PREFIX="${ROOT_DIR}/toolchain-wasm/install"
BUILD_DIR="${ROOT_DIR}/toolchain-wasm/build"
SRC_DIR="${ROOT_DIR}/toolchain-wasm/src"
DL_DIR="${ROOT_DIR}/toolchain-wasm/downloads"
BOOST_PREFIX="${ROOT_DIR}/boost-wasm/install"

mkdir -p "${PREFIX}" "${BUILD_DIR}" "${SRC_DIR}" "${DL_DIR}"

# Load Emscripten environment (try repo-local env file first).
if [[ -f "${REPO_DIR}/wasm/toolchain/emsdk.env" ]]; then
  # shellcheck disable=SC1090
  source "${REPO_DIR}/wasm/toolchain/emsdk.env"
elif command -v emsdk_env.sh >/dev/null 2>&1; then
  # shellcheck disable=SC1091
  source "$(command -v emsdk_env.sh)"
fi

if ! command -v emcc >/dev/null 2>&1; then
  echo "ERROR: Emscripten environment not found (missing emcc)" >&2
  exit 1
fi

NPROC=${NPROC:-$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4)}

fetch() {
  local name="$1"
  shift
  local dest="${DL_DIR}/${name}"
  if [[ -f "${dest}" ]]; then
    return
  fi

  mkdir -p "${DL_DIR}"
  local url success=0
  for url in "$@"; do
    if [[ -z "${url}" ]]; then
      continue
    fi
  echo "Downloading ${name} from ${url}"
    if curl -L --fail --retry 3 --connect-timeout 20 --retry-connrefused \
        --output "${dest}.partial" "${url}"; then
      mv "${dest}.partial" "${dest}"
      success=1
      break
    else
  echo "WARN: Failed to download ${name} from ${url}" >&2
      rm -f "${dest}.partial"
    fi
  done

  if [[ ${success} -ne 1 ]]; then
  echo "ERROR: Unable to download ${name} from provided mirrors" >&2
    exit 1
  fi
}

extract() {
  local archive="$1" target="$2"
  if [[ ! -d "${target}" ]]; then
  echo "Extracting $(basename "${archive}")"
    tar xf "${archive}" -C "${SRC_DIR}"
  fi
}

build_gmp() {
  local version="6.2.1"
  local tarball="gmp-${version}.tar.xz"
  local src="${SRC_DIR}/gmp-${version}"
  fetch "${tarball}" \
    "https://gmplib.org/download/gmp/${tarball}" \
    "https://ftp.gnu.org/gnu/gmp/${tarball}" \
    "https://mirrors.kernel.org/gnu/gmp/${tarball}"
  extract "${DL_DIR}/${tarball}" "${src}"
  if [[ ! -f "${PREFIX}/lib/libgmp.a" || ! -f "${PREFIX}/lib/libgmpxx.a" ]]; then
    pushd "${src}" >/dev/null
    emmake make distclean >/dev/null 2>&1 || true
    emconfigure ./configure \
      --host=wasm32-unknown-emscripten \
      --disable-shared \
      --disable-assembly \
      --with-pic \
      --enable-cxx \
      --prefix="${PREFIX}"
    emmake make -j "${NPROC}"
    emmake make install
    popd >/dev/null
  fi
}

build_mpfr() {
  local version="4.2.1"
  local tarball="mpfr-${version}.tar.xz"
  local src="${SRC_DIR}/mpfr-${version}"
  fetch "${tarball}" \
    "https://www.mpfr.org/mpfr-${version}/${tarball}" \
    "https://ftp.gnu.org/gnu/mpfr/${tarball}" \
    "https://mirrors.kernel.org/gnu/mpfr/${tarball}"
  extract "${DL_DIR}/${tarball}" "${src}"
  if [[ ! -f "${PREFIX}/lib/libmpfr.a" ]]; then
    pushd "${src}" >/dev/null
    CPPFLAGS="-I${PREFIX}/include" LDFLAGS="-L${PREFIX}/lib" \
    emconfigure ./configure \
      --host=wasm32-unknown-emscripten \
      --disable-shared \
      --with-gmp="${PREFIX}" \
      --prefix="${PREFIX}"
    emmake make -j "${NPROC}"
    emmake make install
    popd >/dev/null
  fi
}

build_cgal() {
  local version="5.4"
  local tarball="CGAL-${version}.tar.xz"
  local src="${SRC_DIR}/CGAL-${version}"
  fetch "${tarball}" \
    "https://github.com/CGAL/cgal/releases/download/v${version}/${tarball}" \
    "https://github.com/CGAL/cgal/archive/refs/tags/v${version}.tar.gz"
  extract "${DL_DIR}/${tarball}" "${src}"
  local build_path="${BUILD_DIR}/cgal"
  if [[ ! -f "${PREFIX}/lib/libCGAL.a" ]]; then
    rm -rf "${build_path}"
    emcmake cmake -S "${src}" -B "${build_path}" \
      -DCMAKE_INSTALL_PREFIX="${PREFIX}" \
      -DCMAKE_BUILD_TYPE=Release \
      -DBUILD_SHARED_LIBS=OFF \
      -DWITH_CGAL_ImageIO=OFF \
      -DWITH_CGAL_Qt5=OFF \
      -DGMP_INCLUDE_DIR="${PREFIX}/include" \
      -DGMP_LIBRARIES="${PREFIX}/lib/libgmp.a" \
      -DMPFR_INCLUDE_DIR="${PREFIX}/include" \
      -DMPFR_LIBRARIES="${PREFIX}/lib/libmpfr.a" \
      -DBoost_NO_SYSTEM_PATHS=ON \
      -DBOOST_ROOT="${BOOST_PREFIX}" \
      -DBoost_USE_STATIC_LIBS=ON
    cmake --build "${build_path}" -j "${NPROC}"
    cmake --install "${build_path}"
  fi
}

build_gmp
build_mpfr
build_cgal

echo "DONE: GMP/MPFR/CGAL staged under ${PREFIX}"
