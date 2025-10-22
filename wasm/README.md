# WebAssembly Build Notes

This document tracks the features we intentionally disable (or stub) in the WebAssembly
build of Orca Slicer and the dependency shims that replace native libraries. The goal is
to keep the WASM bundle lean and compatible with the single-threaded browser runtime
while documenting the functional gaps compared with full desktop builds.

## Disabled or Degraded Functionality

- **CAD/OCCT toolchain** – `SLIC3R_WITH_OCCT` is forced off. STEP/IGES import and any
  OCCT-powered boolean/model repair features are unavailable; calls throw a runtime
  error instead of doing work.
- **OpenCV integrations** – `SLIC3R_WITH_OPENCV` is disabled. Color-based image
  processing (e.g. embossed image conversion, textured preview helpers) is not bundled.
- **OpenVDB slabs & SLA hollowing** – the build defines `ORCA_DISABLE_OPENVDB`; all
  functions in `OpenVDBUtils` and the SLA hollowing pipeline become no-ops that return
  empty grids/meshes. Resin hollowing, drain-hole carving, and distance queries are not
  available in WASM.
- **TBB-based multithreading** – `SLIC3R_USE_TBB` is off and all TBB entry points map to
  sequential shims. The slicer runs single-threaded inside Emscripten; any code paths
  that rely on real thread pools are serialized.
- **GUI / Desktop integration** – `SLIC3R_GUI`, `SLIC3R_NLS`, and encoding checks are
  disabled. Only the headless slicing core is compiled; no translation catalogs or GUI
  assets are shipped.
- **HID / USB communication** – when targeting Emscripten the hidapi CMake entry returns
  an empty interface library, so printer/USB probing logic is skipped in the browser.
- **Platform detection** – Emscripten builds always report `Platform::Linux` for code
  paths that branch on OS flavour. This keeps POSIX assumptions but hides browser quirks.

## Dependency Shims and Replacements

When a desktop dependency is too heavy (or unsupported) for WASM we ship a light proxy in
`wasm/wasm_shims`. The key replacements are:

- **Threading Building Blocks (TBB)** – headers under `wasm_shims/tbb/**` and
  `wasm_shims/oneapi/tbb/**` provide minimal containers and `parallel_for` wrappers that
  execute sequentially. `find_package(TBB)` is never satisfied with a real library when
  compiling for WASM.
- **Boost subsets** – the shims under `wasm_shims/boost_runtime/boost/**` delegate to the
  real Boost headers but strip runtime threading APIs that browsers cannot support. We
  also replace `boost::optional`/`format` with thin adapters backed by the C++17 STL.
- **OpenSSL MD5** – `wasm_shims/openssl/md5.h` supplies a simple MD5 implementation for
  hashing; it is not intended for cryptographic security.
- **cereal serialization** – the `wasm_shims/cereal/**` directory provides no-op archive
  types so code that expects serialization symbols can link even though persistence is
  disabled.
- **OpenVDB** – `wasm_shims/openvdb/openvdb.h` defines minimal grid types used only to
  satisfy signatures after we disable hollowing. No real voxel operations run in WASM.
- **Expats / libnoise / nlopt / CGAL fragments** – lightweight headers mirror the pieces
  Orca touches so we avoid bundling the full third-party code when it is not needed.

The shim coverage is tracked in `wasm/shim_map.yaml` for quick auditing.

## Toolchain Derived Dependencies

Some math dependencies (GMP, MPFR, CGAL) still need to exist, but we build them once for
Emscripten via `deps/toolchain-wasm/build_math.sh`. The script stages the static
artifacts under `deps/toolchain-wasm/install` and the custom `Find*.cmake` modules point
CMake toward that prefix.

## Build Instructions

1. **Install prerequisites**
  - Clone this repository with submodules: `git clone --recurse-submodules -b wasm-wip https://github.com/allanwrench28/orca-wasm-mvp.git`.
  - Install the Emscripten SDK locally and activate it (`source <emsdk>/emsdk_env.sh`).
  - Ensure standard build tooling is available (`cmake` ≥ 3.22, `ninja` or `make`, and a recent Python if you rely on helper scripts).

2. **Stage third-party toolchains**
  - Boost (static archives tuned for WebAssembly): `bash deps/boost-wasm/build_boost.sh`.
  - Math stack (GMP, MPFR, CGAL): `bash deps/toolchain-wasm/build_math.sh`.

3. **Run the WASM build**
  - From the repo root execute `bash scripts/build-wasm.sh`.
  - The script verifies the Emscripten environment, applies `patches/orca-wasm.patch` to the `orca/` submodule if needed, configures CMake via `emcmake`, and compiles the bridge plus `libslic3r`.

4. **Collect artifacts**
  - On success `web/public/wasm/slicer.js` and `web/public/wasm/slicer.wasm` are produced for use in the web worker frontend (`web/src/workers/slicer.worker.ts`).
  - Intermediate CMake files live under `build-wasm/`; remove this folder to force a clean reconfigure.

5. **Troubleshooting tips**
  - If CMake still searches for native TBB/OpenCV, delete `build-wasm/` to clear cached options.
  - The build is single-threaded by design; exporting `EM_BUILD_CORES=1` or passing `-j1` can reduce peak memory in constrained environments.

## Build Automation

`scripts/build-wasm.sh` applies `patches/orca-wasm.patch` to the `orca/` submodule, runs
CMake through `emcmake`, and stages `slicer.js`/`slicer.wasm`. The patch contains all
source-level guards (_e.g._ the OpenVDB stubs, OCCT fallbacks, STL loader tweaks) and is
required before any WASM build succeeds.

## Residual Risks

- Any feature that depends on the disabled libraries above will silently disappear from
  the UI. Monitor upstream changes so new dependencies do not regress the WASM build.
- Browser memory limits are lower than desktop builds. Keep printer profiles small and
  avoid massive multi-object slices until we add smarter streaming or tiling.
- The cereal and crypto shims are placeholders; importing/exporting binary caches or
  verifying signatures is not supported in WASM.
