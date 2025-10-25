# orca-wasm-mvp
Orca → WebAssembly minimal slicer prototype

## Quick Start

The PowerShell scripts in this repository are cross-platform (Windows, macOS, Linux via `pwsh`). They stand up the toolchain, apply the Orca patches, and emit the browser-ready slicer bundle.

### Prerequisites
- Git with submodule support (`git 2.30+` recommended)
- PowerShell 7+ (`pwsh`) or Windows PowerShell 5.1
- Node.js 18+ (required for the post-build smoke test CLI)
- CMake 3.22 or later (Emscripten ships one, but native install is handy)
- Ninja or Make (Emscripten provides `emmake make` if neither is available)
- ~10 GB free disk space for the SDK/toolchain caches

### Build Steps

1. **Clone with submodules**
   ```bash
   git clone --recurse-submodules https://github.com/allanwrench28/orca-wasm-mvp.git
   cd orca-wasm-mvp
   ```
   The default `main` branch is the tested, release-quality build. Switch to
   `wasm-wip` when you want the latest experiments:
   ```bash
   git checkout wasm-wip
   ```

2. **Run the setup workflow**
   ```powershell
   # Windows PowerShell 5 / PowerShell 7
   ./setup.ps1

   # macOS / Linux (requires pwsh from https://github.com/PowerShell/PowerShell)
   pwsh ./setup.ps1
   ```
   The script is idempotent: re-running it keeps Emscripten, the Orca submodule, and cached dependencies in sync. Use `-SkipDeps` to skip rebuilding Boost/GMP/MPFR/CGAL and `-CleanBuild` to wipe `build-wasm/` before the next compile. On Windows the math toolchain currently relies on WSL; if WSL is unavailable the script will skip that step and the build will fall back to pre-existing archives.

3. **Build the slicer bridge**
   ```powershell
   ./build.ps1            # release build, reuses previous configuration
   ./build.ps1 -Clean     # wipe build-wasm/ before configuring
   ./build.ps1 -Debug     # emit a -g build for browser debugging
   ./build.ps1 -Jobs 8    # override the default parallelism
   ```
   The build script sources `wasm/toolchain/emsdk.env`, guarantees the Orca patch is applied, and runs Emscripten’s `emcmake`/`emmake` toolchain end-to-end.

4. **Collect the artifacts**
   - `build-wasm/slicer.js`
   - `build-wasm/slicer.wasm`
   - Optional copies are staged by `build.ps1` under `web/public/wasm/` when the directory exists

5. **Run the headless smoke test**
   ```bash
   node scripts/test-slicer.js --out artifacts/cube.gcode
   ```
   This launches the WASM module inside Node.js, slices the bundled `fixtures/cube.stl`,
   and emits a deterministic `.gcode` file for regression tracking. Use
   `--stl path/to/model.stl` to test alternative geometries.

6. **Run the demo web app** (optional)
   ```bash
   cd web
   npm install
   npm run dev   # or use scripts/dev-web.sh on macOS/Linux
   ```

### Script Reference

- `setup.ps1` – installs/updates Emscripten, refreshes the `orca` submodule, writes `wasm/toolchain/emsdk.env`, and (optionally) rebuilds Boost plus the math stack.
- `build.ps1` – wraps configuration/build/link, copies artifacts, and exposes handy toggles such as `-Clean`/`-Debug`/`-Jobs`.
- `scripts/build-wasm.sh` – Linux/macOS shell equivalent used by CI and by `build.ps1` internally for certain post steps.
- `scripts/sanity.sh` – runs a minimal slice against fixture STLs to ensure the WASM binary behaves.
- `scripts/dev-web.sh` – bootstraps the Vite dev server with live reloading while watching `build-wasm/` for fresh artifacts.
- `scripts/test-slicer.js` – Node-based harness that loads the built WASM module, slices a fixture, and writes `.gcode` for verification.
- `scripts/dump-bytes.js` / `scripts/find-bytes.js` – helper utilities for inspecting `.wasm` blobs and searching for raw byte patterns while debugging.

### Troubleshooting

**Setup fails?**
- Run `./setup.ps1 -Help` to see available switches.
- Pass `-SkipDeps` if you have pre-built toolchains or want to iterate quickly.
- Ensure Windows users have WSL enabled for GMP/MPFR/CGAL; alternatively build those archives on a Linux host and copy `deps/toolchain-wasm/install` back.

**Build fails?**
- Run `./build.ps1 -Clean` to drop cached CMake state.
- Inspect `build-wasm/CMakeFiles/CMakeError.log` and `build-wasm/CMakeFiles/CMakeOutput.log` for dependency hints.
- Use `./build.ps1 -Debug` for richer logging and symbols.

**Still stuck?**
- See [Detailed Build Instructions](#detailed-build-instructions) for manual control.
- Check [Common Issues](#common-issues) for frequently hit problems.
- Run `node scripts/test-slicer.js --help` for additional flags (quiet mode, alternate STLs, output directories) when validating builds.

---

## Detailed Build Instructions

If you prefer to control each step manually (or are bringing your own toolchains), follow this checklist.

### Submodule initialization

The Orca slicer sources live in the `orca/` submodule and are pinned to the
latest upstream stable tag (currently `v2.3.1`).

- Refresh the submodule and check out the expected tag:
   ```bash
   git submodule update --init --depth 1 --progress -- orca
   (cd orca && git fetch --tags && git checkout v2.3.1)
   ```
- If the submodule becomes corrupted, reset it:
   ```bash
   git submodule deinit -f -- orca
   rm -rf .git/modules/orca orca
   git submodule add -f https://github.com/SoftFever/OrcaSlicer.git orca
   git submodule update --init --depth 1 --progress -- orca
   (cd orca && git fetch --tags && git checkout v2.3.1)
   ```

### Toolchain provisioning

1. Clone and activate Emscripten (or point `EMSDK` at an existing install):
   ```bash
   git clone https://github.com/emscripten-core/emsdk.git
   cd emsdk
   ./emsdk install latest
   ./emsdk activate latest
   source ./emsdk_env.sh
   ```
   On Windows use `emsdk.bat` from a Developer PowerShell or Command Prompt.

2. Build Boost with Emscripten (Linux/macOS or WSL recommended):
   ```bash
   bash deps/boost-wasm/build_boost.sh
   ```

3. Build math primitives (GMP, MPFR, CGAL headers/libs):
   ```bash
   bash deps/toolchain-wasm/build_math.sh
   ```
   The script honors `wasm/toolchain/emsdk.env` so the above `emsdk` activation is optional once the env file is in place.

### Configure and build

- Apply the Orca WASM patch:
  ```bash
  (cd orca && git apply --check ../patches/orca-wasm.patch && git apply ../patches/orca-wasm.patch)
  ```
  Re-apply whenever upstream Orca updates cause merge conflicts.

- Generate and build with CMake:
  ```bash
  mkdir -p build-wasm
  cd build-wasm
  emcmake cmake .. -G "Ninja" -DCMAKE_BUILD_TYPE=Release
  emmake ninja slicer
  ```

- Artifacts appear under `build-wasm/`; copy `slicer.js` and `slicer.wasm` into `web/public/wasm/` for the frontend to pick them up.
