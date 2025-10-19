cmake_minimum_required(VERSION 3.22)
project(slicer_wasm)

add_subdirectory(../orca ${CMAKE_BINARY_DIR}/orca-build EXCLUDE_FROM_ALL)
add_subdirectory(../bridge ${CMAKE_BINARY_DIR}/bridge-build)

add_executable(slicer ../bridge/wasm_wrap.cpp)
target_include_directories(slicer PRIVATE ../bridge ../orca)

# Link the minimal Orca core libs (mesh import + slice + gcode emit). Do NOT link any GUI.
set_target_properties(slicer PROPERTIES
    OUTPUT_NAME "slicer"
    LINK_FLAGS "-O3 -sMODULARIZE=1 -sEXPORT_ES6=1 -sWASM_BIGINT=1 -sALLOW_MEMORY_GROWTH=1 -sENVIRONMENT=web,worker -sDISABLE_EXCEPTION_CATCHING=0 -fexceptions -sEXPORTED_FUNCTIONS=['_os_load_mesh','_os_slice_basic','_os_result_gcode','_os_result_preview_layer','_os_free_mesh','_os_free_result'] -sEXPORTED_RUNTIME_METHODS=['cwrap','getValue','setValue','lengthBytesUTF8','stringToUTF8','UTF8ToString']"
)

set(CMAKE_BUILD_TYPE Release CACHE STRING "")
