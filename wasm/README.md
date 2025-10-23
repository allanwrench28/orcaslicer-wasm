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
  also replace `boost::optional`/`format` with thin adapters backed by the C++17 STL, and
  short-circuit `BOOST_LOG_TRIVIAL` to a null sink so the link never pulls in Boost.Log.
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

1. **Use the scripted workflow first**
  - `./setup.ps1` provisions Emscripten, refreshes the Orca submodule, writes `wasm/toolchain/emsdk.env`, and optionally builds Boost plus the math stack. On Linux/macOS run it through `pwsh`. Windows users should enable WSL if they want the math libraries built automatically.
  - `./build.ps1` wraps configuration and compilation, exposes `-Clean/-Debug/-Jobs`, and copies artifacts into `web/public/wasm/` when the directory exists.

2. **Manual path (if the scripts are not an option)**
  - Clone with submodules: `git clone --recurse-submodules -b wasm-wip https://github.com/allanwrench28/orca-wasm-mvp.git`.
  - Install/activate Emscripten (`emsdk install/activate latest` → `source emsdk_env.sh`).
  - For Boost: `bash deps/boost-wasm/build_boost.sh`.
  - For GMP/MPFR/CGAL: `bash deps/toolchain-wasm/build_math.sh`.
  - Configure and build: `mkdir build-wasm && cd build-wasm && emcmake cmake .. -G "Ninja" && emmake ninja slicer`.

3. **Collect artifacts**
  - Successful builds emit `build-wasm/slicer.js` and `build-wasm/slicer.wasm`, which the web worker (`web/src/workers/slicer.worker.ts`) expects to load.
  - Wipe `build-wasm/` when switching between Debug/Release or after modifying toolchain paths in `wasm/CMakeLists.txt`.

4. **Troubleshooting tips**
  - If CMake still searches for native TBB/OpenCV, delete `build-wasm/` to clear cached options.
  - The build is single-threaded by design; exporting `EM_BUILD_CORES=1` or passing `-j1` can reduce peak memory in constrained environments.

## Build Automation

`scripts/build-wasm.sh` applies `patches/orca-wasm.patch` to the `orca/` submodule, runs
CMake through `emcmake`, and stages `slicer.js`/`slicer.wasm`. The patch contains all
source-level guards (_e.g._ the OpenVDB stubs, OCCT fallbacks, STL loader tweaks) and is
required before any WASM build succeeds.

## Common Issues

### Build Environment Issues

**Emscripten not found**
- Make sure to run `./setup.ps1` first to install Emscripten
- On Windows, the script sets up Emscripten in the local `emsdk/` directory
- If you have an existing Emscripten install, update `wasm/toolchain/emsdk.env`

**Boost build fails on Windows**
- Boost requires a native compiler for bootstrapping
- Install Visual Studio Build Tools or use WSL
- Alternatively, use pre-built Boost libraries (see CMake options)

**Math libraries (GMP, MPFR) build fails**
- These require autotools and may need WSL on Windows
- Try `./setup.ps1 -SkipDeps` and use system libraries if available
- Some builds work without these dependencies (reduced functionality)

**Submodule initialization hangs**
- Large repository (OrcaSlicer) - be patient or use `--progress` flag
- Check network connectivity and GitHub access
- Try shallow clone: `git submodule update --init --depth 1`

### CMake Configuration Issues

**TBB/OpenCV found despite being disabled**
- Clean build directory: `./build.ps1 -Clean`
- CMake cache may retain old settings

**Missing dependencies**
- Check `build-wasm/CMakeFiles/CMakeError.log` for specific missing libraries
- Some dependencies can be made optional in `wasm/CMakeLists.txt`

**Cross-compilation errors**
- Ensure Emscripten toolchain is properly activated
- Check that `emcc --version` works in your shell

### Runtime Issues

**WASM module fails to load**
- Check browser console for specific errors
- Verify both `.js` and `.wasm` files are served correctly
- Some browsers require HTTPS for SharedArrayBuffer features

**Memory errors in browser**
- WASM builds are single-threaded and memory-constrained
- Reduce model complexity or enable streaming

## Residual Risks

- Any feature that depends on the disabled libraries above will silently disappear from
  the UI. Monitor upstream changes so new dependencies do not regress the WASM build.
- Browser memory limits are lower than desktop builds. Keep printer profiles small and
  avoid massive multi-object slices until we add smarter streaming or tiling.
- The cereal and crypto shims are placeholders; importing/exporting binary caches or
  verifying signatures is not supported in WASM.
