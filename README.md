# orca-wasm-mvp
Orca → WebAssembly minimal slicer prototype

## Quick Start

The easiest way to build the WASM module:

### Prerequisites
- Git (with submodule support)
- CMake 3.22 or later
- PowerShell (Windows) or Bash (Linux/macOS)
- At least 4GB free disk space

### Build Steps

1. **Clone with submodules**:
   ```bash
   git clone --recurse-submodules -b wasm-wip https://github.com/allanwrench28/orca-wasm-mvp.git
   cd orca-wasm-mvp
   ```

2. **Setup environment** (automatically installs Emscripten, initializes submodules, builds dependencies):
   ```powershell
   # Windows (PowerShell)
   ./setup.ps1

   # Linux/macOS
   pwsh setup.ps1
   # or if pwsh not available:
   bash scripts/setup.sh  # fallback script
   ```

3. **Build WASM module**:
   ```powershell
   # Windows (PowerShell)
   ./build.ps1

   # Linux/macOS
   pwsh build.ps1
   # or if pwsh not available:
   bash scripts/build-wasm.sh  # fallback script
   ```

4. **Artifacts** will be available at:
   - `web/public/wasm/slicer.js`
   - `web/public/wasm/slicer.wasm`

### Troubleshooting

**Setup fails?**
- Run `./setup.ps1 -Help` for options
- Try `./setup.ps1 -SkipDeps` to skip dependency building
- On Windows, some dependencies may require WSL

**Build fails?**
- Run `./build.ps1 -Clean` to clean and rebuild
- Check `build-wasm/CMakeFiles/CMakeError.log` for details
- Try `./build.ps1 -Debug` for debug build

**Still having issues?**
- See [Detailed Build Instructions](#detailed-build-instructions) below
- Check [Common Issues](#common-issues) section

---

## Detailed Build Instructions

If the automated scripts don't work for your system, here's the manual process:

### Submodule (OrcaSlicer) initialization

This repo vendors OrcaSlicer as a submodule at `./orca`, tracking the upstream `main` branch.

- To initialize or refresh to the latest upstream commit (shallow):
   ```bash
   git submodule update --init --remote --depth 1 --progress -- orca
   ```
- If you run into a stale submodule ref, re-add it cleanly:
   ```bash
   git submodule deinit -f -- orca
   rm -rf .git/modules/orca orca
   git submodule add -f -b main https://github.com/SoftFever/OrcaSlicer.git orca
   git submodule update --init --depth 1 --progress -- orca
   ```

The `.gitmodules` is configured with `branch = main` and `shallow = true` so the provided scripts will prefer shallow, up-to-date checkouts.
