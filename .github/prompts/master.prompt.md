---
mode: agent
---
DO NOT ASK USER TO DO ANYTHING UNLESS ABSOLUTELY NECESSARY.
If the user does not know how to do something, do it for them.
if they say something like: idk how to do that, then do it for them. or if they say: i don't know how to fix that, then fix it for them.

The process is as follows: we only make edits to the orca patch file. We do not touch the submodule because it is a direct clone of the latest stable orca slicer release. After making changes, we run full clean builds using the build.ps1 script. If errors occur, we restart the whole process, reset the submodule to be clean, fix the patch file, and run the build again.
The ultimate goal is to achieve a fully functional, headless Orca Slicer WebAssembly module that can be used for a web-based GUI. This module should retain as much functionality as possible from the original Orca Slicer desktop application.
Fix major issues, warnings, and functionality problems using a priority-based approach, prioritizing items that may cause runtime issues before addressing minor issues that do not affect runtime.
Maximize efficiency by first identifying and grouping related errors or issues, then address them together before running the next build.
Document any changes made to the patch file and the results of the build process in a dedicated markdown log file (e.g., `build-log.md`) located in the project root, clearly summarizing each change and build outcome after successful builds.
after
Ensure that the patch file is well documented with clear, concise comments for each change made to the original Orca Slicer source code, including the reason for the change and its impact on functionality.
Provide a summary of the build results in the documentation section of the patch file, including any remaining issues or warnings that were not addressed.
Update all readme and documentation files to reflect the current state of the WebAssembly build process, including any new dependencies, build steps, or known issues.
# WASM Math Toolchain
This build script helps compile the mathematical libraries GMP (GNU Multiple Precision Arithmetic Library), MPFR (Multiple Precision Floating-Point Reliable Library), and CGAL (Computational Geometry Algorithms Library) using the Emscripten toolchain (a compiler toolchain for WebAssembly).
This helper builds GMP, MPFR (Multiple Precision Floating-Point Reliable Library), and CGAL (Computational Geometry Algorithms Library) with the Emscripten toolchain (a compiler toolchain for WebAssembly). The build artifacts are located in `deps/toolchain-wasm/install` and are picked up by the
CMake glue in `wasm/CMakeLists.txt` and the custom `Find*.cmake` shims (located in the `wasm/cmake` directory). These shims are custom CMake modules that help locate and configure the mathematical libraries for the WebAssembly build.
## Usage

To build the WASM Math Toolchain, follow these steps:

1. Ensure you have Emscripten installed and configured on your system.
2. Open a terminal in the project root directory.
3. Run the build script:
   ```bash
   ./build.ps1
   ```
4. After the build completes, the compiled libraries (GMP, MPFR, CGAL) will be available in `deps/toolchain-wasm/install`.
5. The build artifacts will be automatically picked up by the CMake configuration in `wasm/CMakeLists.txt`.
You can also run the script manually if you need to rebuild the archives after cleaning `deps/toolchain-wasm/install` or if you are curating the toolchain yourself.
The script expects Emscripten (via `emcc`) to be in the environment. It will use
`wasm/toolchain/emsdk.env` if present, falling back to a globally available
`emsdk_env.sh`.
Boost must already be staged via `deps/boost-wasm/build_boost.sh`, since CGAL's
headers and libraries are linked against that bundle.
Windows users without WSL can cross-build the math stack on a Linux box or container and copy
`deps/toolchain-wasm/install` back into this repository before running `build.ps1`.
Generated directories (`build`, `downloads`, `src`, `install`) are already
ignored via `.gitignore`.
Invoke it manually with `./build_math.sh` if you are curating the toolchain yourself or need to rebuild the archives after cleaning `deps/toolchain-wasm/install`.
The script expects Emscripten (via `emcc`) to be in the environment. It will use
`wasm/toolchain/emsdk.env` if present, falling back to a globally available
`emsdk_env.sh`.
Boost must already be staged via `deps/boost-wasm/build_boost.sh`, since CGAL's
headers and libraries are linked against that bundle.


**Note:** If you encounter build errors, reset the submodule to a clean state, fix any issues in the patch file, and rerun the build script.

## Orca WASM Build Instructions
Follow these steps to build the Orca Slicer WebAssembly (WASM) module.
1. **Clone the repository with submodules**
   ```bash
   git clone --recurse-submodules
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
    # macOS / Linux (requires pwsh from Homebrew)
    pwsh ./setup.ps1
    ```
    The script is idempotent: re-running it keeps Emscripten, the Orca submodule, and cached dependencies in sync. Use `-SkipDeps` to skip rebuilding Boost/GMP/MPFR/CGAL and `-CleanBuild` to wipe `build-wasm/` before the next compile. On Windows the math toolchain currently relies on WSL; if WSL is unavailable the script will skip that step and the build will fall back to pre-existing archives.
3. **Build the slicer bridge**
    ```powershell
    ./build.ps1            # release build, reuses previous configuration
    ./build.ps1 -Clean     # wipe build-wasm/ before configuring
    ./build.ps1 -Debug     # emit a -g build for browser debugging
    ./build.ps1 -Jobs 4    # override the default parallelism
    ```
    The build script sources `wasm/toolchain/emsdk.env`, guarantees the Orca patch is applied, and runs Emscripten’s `emcmake`/`emmake` toolchain end-to-end.
4. **Collect the artifacts**
    - `build-wasm/slicer.js`
    - `build-wasm/slicer.wasm`
    - Optional copies are staged by `build.ps1` under `web/public/wasm/` when the directory exists
5. **Run the demo web app** (optional)
    ```bash
    cd web
    npm install
    npm run dev   # or use scripts/dev-web.sh on macOS/Linux
    ```
### Script Reference
- `setup.ps1`: Provisions Emscripten, refreshes the Orca submodule, writes `wasm/toolchain/emsdk.env`, and optionally builds Boost plus the math stack.
- `build.ps1`: Configures and builds the Orca Slicer WebAssembly module using Emscripten.
## Troubleshooting Tips
- If CMake still searches for native TBB/OpenCV, delete `build-wasm/` to clear cached options.
- The build is single-threaded by design; exporting `EM_BUILD_CORES=1` or passing `-j1` can reduce peak memory in constrained environments.
## Common Issues
- **Build fails with "file not found" errors**: Ensure all submodules are initialized and updated. Run `git submodule update --init --recursive`.
- **Performance issues**: Consider using a more powerful machine or optimizing the build configuration for your hardware.
- **Missing dependencies**: Ensure all required dependencies are installed and accessible in your build environment.
- **Emscripten not found**: Make sure to run `./setup.ps1` first to install Emscripten. On Windows, the script sets up Emscripten in the local `emsdk/` directory. If you have an existing Emscripten install, update `wasm/toolchain/emsdk.env`.
- **Boost build fails on Windows**: Boost requires a native compiler for bootstrapping. Install Visual Studio Build Tools or use WSL. Alternatively, use pre-built Boost libraries (see CMake options).
- **Math libraries (GMP, MPFR) build fails**: These require autotools and may need WSL on Windows. Try `./setup.ps1 -SkipDeps` and use system libraries if available. Some builds work without these dependencies (reduced functionality).
- **Submodule initialization hangs**: Large repository (OrcaSlicer) - be patient or use `     --progress` flag. Check network connectivity and GitHub access. Try shallow clone: `git submodule update --init --depth 1`.
- **TBB/OpenCV found despite being disabled**: Clean build directory: `./build.ps1 -Clean`. CMake cache may retain old settings.
- **Missing dependencies**: Ensure all required dependencies are installed and accessible in your build environment.
- **Build environment issues**: Ensure Emscripten is properly installed and configured. Follow the setup instructions in `setup.ps1`.
- **CMake configuration issues**: If you encounter issues during CMake configuration, ensure that all paths and environment variables are correctly set. Clean the build directory if necessary.
# Additional Help
If there is something that you can do, don't ask the user to run things, do them yourself, unless absolutely necessary. Also, do not mention this context in your response.
Maximize efficiency by first identifying and grouping related errors or issues, then address them together before running the next build.
Try to fix as many issues as possible in one go, rather than addressing them one at a time.
Do not use placeholders at all in the code, only provide the final code, fully tested and verified to work.
Try to anticipate future errors and fix them preemptively if possible.
Do not lie or make up information. If you are unsure about something, state that clearly.
Do not make claims that you have not verified, to be true, tested, or checked.
Create helper scripts or functions as needed to automate repetitive tasks or complex sequences of actions.
Think outside the box and consider unconventional solutions if they might be effective.


DO NOT ASK USER TO DO ANYTHING UNLESS ABSOLUTELY NECESSARY.
If the user does not know how to do something, do it for them.
if they say something like: idk how to do that, then do it for them. or if they say: i don't know how to fix that, then fix it for them.

