---
mode: agent
---
# Helpful files for project
files:
  - scripts/build-wasm.sh
  - patches/orca-wasm.patch
  - wasm/CMakeLists.txt
  - wasm/toolchain/emsdk.env
  - web/public/wasm/slicer.js
  - web/public/wasm/slicer.wasm
  - deps/toolchain-wasm/build_math.sh
  - deps/boost-wasm/build_boost.sh
  - .github/prompts/master.prompt.md
  - wasm/README.md
  - README.md
  - deps/toolchain-wasm/README.md
  - wasm2wat
  - scripts/test-slicer.js
  - wasm/toolchain/emsdk/emsdk_env.sh
  - scripts/setup.ps1
  - build.ps1
  - wasm/toolchain/emsdk/emsdk.bat
  - wasm/toolchain/emsdk/emsdk.py
  - wasm/toolchain/emsdk/emsdk_installation.bat
  - wasm/toolchain/emsdk/emsdk_list.txt
  - wasm/toolchain/emsdk/emscripten-releases-tags.txt
  - wasm/toolchain/emsdk/emscripten-fastcomp-releases-tags.txt
  - wasm/toolchain/emsdk/emscripten-versions.txt
  - wasm/toolchain/emsdk/node/README.md
  - wasm/toolchain/emsdk/python/README.md
  - wasm/toolchain/emsdk/git/README.md
  - wasm/toolchain/emsdk/clang/README.md
  - wasm/toolchain/emsdk/emscripten/README.md
  - wasm/toolchain/emsdk/llvm/README.md
  - wasm/toolchain/emsdk/cmake/README.md
  - wasm/toolchain/emsdk/ninja/README.md
  - wasm/toolchain/emsdk/closure-compiler/README.md
  - wasm/toolchain/emsdk/yasm/README.md
  - wasm/toolchain/emsdk/binaryen/README.md
  - wasm/toolchain/emsdk/icu/README.md
  - wasm/toolchain/emsdk/svn/README.md
  - wasm/toolchain/emsdk/7z/README.md
  - wasm/toolchain/emsdk/zlib/README.md
  - wasm/toolchain/emsdk/libpng/README.md
  - wasm/toolchain/emsdk/libjpeg-turbo/README.md
  - wasm/toolchain/emsdk/libwebp/README.md
  - wasm/toolchain/emsdk/libogg/README.md
  - wasm/toolchain/emsdk/libvorbis/README.md
  - wasm/toolchain/emsdk/libtheora/README.md
  - wasm/toolchain/emsdk/freetype/README.md
  - wasm/toolchain/emsdk/sdl2/README.md
  - wasm/toolchain/emsdk/sdl2_image/README.md
  - wasm/toolchain/emsdk/sdl2_mixer/README.md
  - wasm/toolchain/emsdk/sdl2_ttf/README.md
  - wasm/toolchain/emsdk/boost/README.md
  - wasm/toolchain/emsdk/bullet/README.md
  - wasm/toolchain/emsdk/portaudio/README.md
  - wasm/toolchain/emsdk/ffmpeg/README.md
  - wasm/toolchain/emsdk/libass/README.md
  - wasm/toolchain/emsdk/libopus/README.md
  - wasm/toolchain/emsdk/libsamplerate/README.md
  - wasm/toolchain/emsdk/speex/README.md
  - wasm/toolchain/emsdk/tremor/README.md
  - wasm/toolchain/emsdk/vorbis-tools/README.md
  - wasm/toolchain/emsdk/wabt/README.md
  - wasm/toolchain/emsdk/utf8proc/README.md
  - wasm/toolchain/emsdk/libffi/README.md
  - wasm/toolchain/emsdk/mesa/README.md
  - wasm/toolchain/emsdk/libepoxy/README.md
  - wasm/toolchain/emsdk/glslang/README.md
  - wasm/toolchain/emsdk/spirv-tools/README.md
  - wasm/toolchain/emsdk/spirv-headers/README.md
  - wasm/toolchain/emsdk/wasm-ld/README.md
  - wasm/toolchain/emsdk/lld/README.md
  - wasm/toolchain/emsdk/pthreadpool/README.md
  - wasm/toolchain/emsdk/libcxx/README.md
  - wasm/toolchain/emsdk/libcxxabi/README.md
  - wasm/toolchain/emsdk/libunwind/README.md
  - wasm/toolchain/emsdk/compiler-rt/README.md
  - wasm/toolchain/emsdk/libdlmalloc/README.md
  - wasm/toolchain/emsdk/libc/README.md
  - wasm/toolchain/emsdk/libpthread/README.md
  - wasm/toolchain/emsdk/libm/README.md
  - wasm/toolchain/emsdk/libc++abi/README.md
  - wasm/toolchain/emsdk/libc++/README.md
  - wasm/toolchain/emsdk/libc++experimental/README.md
  - wasm/toolchain/emsdk/libc++fs/README.md
  - wasm/toolchain/emsdk/libc++parallel/README.md
  - wasm/toolchain/emsdk/libc++abi/README.md
  - wasm/toolchain/emsdk/libc++experimental/README.md
  - wasm/toolchain/emsdk/libc++fs/README.md
  - wasm/toolchain/emsdk/libc++parallel/README.md
  - wasm deconstruction tools
  - wasm deconstruction tools/README.md
  - wasm deconstruction tools/wasm2wat
  - wasm deconstruction tools/wasm2wat/README.md
  - wasm deconstruction tools/wasm-objdump
  - wasm deconstruction tools/wasm-objdump/README.md
  - wasm deconstruction tools/wasm-strip
  - wasm deconstruction tools/wasm-strip/README.md
  - wasm deconstruction tools/wasm-validate
  - wasm deconstruction tools/wasm-validate/README.md
  - wasm deconstruction tools/wasm-interp
  - wasm deconstruction tools/wasm-interp/README.md
  - wasm deconstruction tools/wasm-opt
  - wasm deconstruction tools/wasm-opt/README.md
 wasm exported functions:
  - _orc_init
  - _orc_slice
  - _malloc
  - _free
  - _orc_free
 wasm exported funtion runtime methods:
  - ccall
  - cwrap
  - getValue
  - setValue
  - UTF8ToString
  - stringToUTF8
  - lengthBytesUTF8
  - HEAP8
  - HEAPU8
  - HEAP32
  - HEAPU32
  wasm function naming and calls mapping helpful tools:
  - wasm deconstruction tools/wasm2wat
  - wasm deconstruction tools/wasm-objdump
  - wasm deconstruction tools/wasm-strip
  - wasm deconstruction tools/wasm-validate
  - wasm deconstruction tools/wasm-interp
  - wasm deconstruction tools/wasm-opt
easy way to find wasm obj dump:
  - scripts/wasm2wat
  - scripts/wasm-objdump
  - scripts/wasm-strip
  - scripts/wasm-validate
  - scripts/wasm-interp
  - scripts/wasm-opt

    helpful ways to fix an example like this :

  [test-slicer] Failed: RuntimeError: null function or function signature mismatch
    at wasm://wasm/01726fd2:wasm-function[3064]:0x331406
    at wasm://wasm/01726fd2:wasm-function[3996]:0x44e381
    at main (C:\Users\allan\orca-wasm-mvp\scripts\test-slicer.js:214:21)

    or this:

    [test-slicer] wasm table guard active (size=3665)
    [test-slicer] table[3064] -> [function 3872]
    [orc_slice] start len=1421
    [orc_slice] applying config
    [test-slicer] Failed: RuntimeError: null function or function signature mismatch
    at wasm://wasm/01726fd2:wasm-function[3064]:0x331406
    at wasm://wasm/01726fd2:wasm-function[3996]:0x44e381

  -
  - Use the stack trace logged by the `missingWasmTableEntry` function to determine where the indirect call was attempted in your JavaScript code.
  - Cross-reference the missing index with the exported functions in your WASM module to identify the missing function.
  - Check the implementation of the missing function to ensure it matches the expected signature.
  - Review the build configuration and ensure all necessary functions are included in the WASM module.
  - Use wasm deconstruction tools to inspect the wasm binary and identify function signatures.
  - Check the JavaScript code to ensure that the correct function signatures are being used when calling into the WASM module.
  - Verify that the build configuration for the WASM module includes all necessary functions and that they are exported correctly.
  - Look for any discrepancies between the expected and actual function signatures in the WASM module.
  - Rebuild the WASM module with the correct function signatures and test again.
  - If the issue persists, consider adding logging or debugging statements to trace the problem.

trying to find what function is missing from the wasm table:
  - scripts/test-slicer.js
  - Look for the console warning `[wasm-table] get(${idx}) yielded ${fn}` to identify the missing function index.
  - Use the stack trace logged by the `missingWasmTableEntry` function to determine where the indirect call was attempted in your JavaScript code.
  - Cross-reference the missing index with the exported functions in your WASM module to identify the missing function.
  - Check the implementation of the missing function to ensure it matches the expected signature.
  - Review the build configuration and ensure all necessary functions are included in the WASM module.
  - Rebuild the WASM module and test again.

mapping tools:
which2wat: scripts/wasm2wat
whichwasm-objdump: scripts/wasm-objdump
whichwasm-strip: scripts/wasm-strip
whichwasm-validate: scripts/wasm-validate
whichwasm-interp: scripts/wasm-interp
whichwasm-opt: scripts/wasm-opt

grep for function index in wasm2wat output:
  - Look for the function index in the output of `wasm2wat` to find the corresponding function name and signature.
  - Use the function index to identify the missing function in your JavaScript code and ensure it is being called correctly.

function declaration example:
  - (type $FUNCTYPE$iii (func (param i32 i32) (result i32)))
  - (type $FUNCTYPE$iii (func (param i32 i32 i32) (result i32)))
  - (type $FUNCTYPE$vii (func (param i32 i32)))
  - (type $FUNCTYPE$viii (func (param i32 i32 i32)))
  - (type $FUNCTYPE$vi (func (param i32) (result i32)))
  - (type $FUNCTYPE$vv (func ))
  - (type $FUNCTYPE$iiiifff (func (param i32 i32 i32 i32 f32 f32 f32) (result i32)))
  - (type $FUNCTYPE$iiiiifff (func (param i32 i32 i32 i32 i32 f32 f32 f32) (result i32)))
  - (type $FUNCTYPE$iiiiii (func (param i32 i32 i32 i32 i32 i32) (result i32)))
  - (type $FUNCTYPE$iiiiiii (func (param i32 i32 i32 i32 i32 i32 i32) (result i32)))
  - (type $FUNCTYPE$iiiiiiii (func (param i32 i32 i32 i32 i32 i32 i32 i32) (result i32)))
  - (type $FUNCTYPE$iiiiiiiii (func (param i32 i32 i32 i32 i32 i32 i32 i32 i32) (result i32)))
  - (type $FUNCTYPE$iiiiiiiiii (func (param i32 i32 i32 i32 i32 i32 i32 i32 i32 i32) (result i32)))
  - (type $FUNCTYPE$iiiiiiiiiii (func (param i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32) (result i32)))
  - (type $FUNCTYPE$iiiiiiiiiiii (func (param i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32) (result i32)))
  - (type $FUNCTYPE$iiiiiiiiiiiii (func (param i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32) (result i32)))
  - (type $FUNCTYPE$iiiiiiiiiiiiii (func (param i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32) (result i32)))
  - (type $FUNCTYPE$iiiiiiiiiiiiiii (func (param i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32) (result i32)))
  - (type $FUNCTYPE$iiiiiiiiiiiiiiii (func (param i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32) (result i32)))
  - (type $FUNCTYPE$iiiiiiiiiiiiiiiii (func (param i32 i32 i32 i32 i32 i32 i32 i32 i32 i32) (result i32)))
  - (type $FUNCTYPE$iiiiiiiiiiiiiiiiii (func (param i32 i32 i32 i32 i32 i32 i32 i32 i32) (result i32)))
  - (type $FUNCTYPE$iiiiiiiiiiiiiiiiiii (func (param i32 i32 i32 i32 i32 i32 i32) (result i32)))
    - how to decode function signatures from wasm2wat output
      - i = i32
      - f = f32
      - v = void
      - Example: FUNCTYPE$iii = function taking 2 i32 parameters and returning an i32
    - Use this mapping to identify the expected function signatures in your JavaScript code and ensure they match the WASM module.



# Additional Helpful wasm debugging tools and techniques

problem example:
 wasm-opt --extract-function-index=3064 streamed the entire section (including embedded strings) to stdout, so the relevant lines were drowned out. Nothing actionable surfaced.
  solution:
    - Use `wasm-objdump -d slicer.wasm > slicer_disassembly.txt` to disassemble the WASM binary and search for the function index.
    - Look for the function index in the disassembly output to find the corresponding function name and signature.
    - Use the function index to identify the missing function in your JavaScript code and ensure it is being called correctly.


DO NOT ASK USER TO DO ANYTHING UNLESS ABSOLUTELY NECESSARY.
If the user does not know how to do something, do it for them.
if they say something like: idk how to do that, then do it for them. or if they say: i don't know how to fix that, then fix it for them.

Avoid function signature mismatch issues when calling wasm functions indirectly through the table by ensuring that all function pointers are cast correctly and consistently throughout the codebase.
Use the `-sEMULATE_FUNCTION_POINTER_CASTS=1` Emscripten linker flag to help mitigate function signature mismatch issues when calling functions indirectly through the wasm table.
This flag enables emulation of function pointer casts, allowing for more flexible handling of function signatures and reducing the likelihood of runtime errors due to signature mismatches.
Also, ensure that the function signatures in the JavaScript code match those defined in the wasm module.
- How to add the Emscripten linker flag:
  - In the `wasm/CMakeLists.txt` file, locate the section where the Emscripten linker flags are defined.
  - Add the `-sEMULATE_FUNCTION_POINTER_CASTS=1` flag to the list of linker flags.
  - Rebuild the wasm module to apply the changes.
- After adding the flag, test the wasm module to ensure that the function signature mismatch issues are resolved.
 Function

 to avoid signature mismatches when using WSL
  - Ensure that the Emscripten toolchain is properly set up and activated in your WSL environment.
  - Verify that the correct versions of Emscripten and its dependencies are installed.
  - Use the `wasm/CMakeLists.txt` file to configure the build process, ensuring that all necessary flags and options are set correctly.
 - When building the wasm module, use the WSL terminal to run the build commands, ensuring that the environment is consistent with the Emscripten toolchain.
 -Always test the built wasm module in the WSL environment to confirm that it functions correctly and that there are no signature mismatch issues.
 Steps to avoid function signature mismatch issues when using WSL:
  - Set up and activate the Emscripten toolchain in your WSL environment.
  - Configure the build process using the `wasm/CMakeLists.txt` file, ensuring that all necessary flags and options are set correctly.
  - Build the wasm module using the WSL
  - Rebuild the wasm module in the WSL environment to ensure compatibility.
  - Test the wasm module to confirm that function signature mismatches are resolved.

