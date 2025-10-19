add_library(orca_wasm_bridge STATIC wasm_wrap.cpp)
target_include_directories(orca_wasm_bridge PUBLIC ${CMAKE_CURRENT_LIST_DIR})
