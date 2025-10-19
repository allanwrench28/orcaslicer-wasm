cmake_minimum_required(VERSION 3.22)
project(slicer_wasm)

# Release by default
set(CMAKE_BUILD_TYPE Release CACHE STRING "")

# --- Pthreads (Boost.Thread expects it) ---
add_compile_options(-pthread)
set(EM_PTHREAD_FLAGS "-pthread")  # Emscripten 4.x: don't pass -sPTHREADS=1

# --- Boost (built locally for WASM) ---
# Adjust these if you put Boost elsewhere
set(BOOST_ROOT "${CMAKE_SOURCE_DIR}/../deps/boost-wasm/install")
set(BOOST_INCLUDEDIR "${BOOST_ROOT}/include")
set(BOOST_LIBRARYDIR "${BOOST_ROOT}/lib")

set(Boost_NO_SYSTEM_PATHS ON)
set(Boost_USE_STATIC_LIBS ON)
find_package(Boost 1.83.0 REQUIRED COMPONENTS
  system filesystem thread regex chrono atomic date_time iostreams program_options nowide
)

# --- Our subprojects ---
add_subdirectory(../bridge ${CMAKE_BINARY_DIR}/bridge-build)
# We'll add Orca after Boost is confirmed OK; subdir can stay EXCLUDE_FROM_ALL to avoid GUI/host bits.
add_subdirectory(../orca ${CMAKE_BINARY_DIR}/orca-build EXCLUDE_FROM_ALL)

# --- Executable (links the bridge; we'll add Orca libs after the first link error pass) ---
add_executable(slicer ../bridge/wasm_wrap.cpp)

target_include_directories(slicer PRIVATE
  ../bridge
  ${BOOST_INCLUDEDIR}
)

# Link Boost first; Orca core libs will be appended in a follow-up patch
target_link_libraries(slicer PRIVATE
  ${Boost_LIBRARIES}
)

# --- Emscripten link flags ---
set(EM_FLAGS
  "-O3"
  "-sMODULARIZE=1"
  "-sEXPORT_ES6=1"
  "-sWASM_BIGINT=1"
  "-sALLOW_MEMORY_GROWTH=1"
  "-sENVIRONMENT=web,worker"
  "-sDISABLE_EXCEPTION_CATCHING=0"
  "-fexceptions"
  ${EM_PTHREAD_FLAGS}
)

set_target_properties(slicer PROPERTIES
  OUTPUT_NAME "slicer"
  LINK_FLAGS "${EM_FLAGS} -sEXPORTED_FUNCTIONS=['_os_load_mesh','_os_slice_basic','_os_result_gcode','_os_result_preview_layer','_os_free_mesh','_os_free_result'] -sEXPORTED_RUNTIME_METHODS=['cwrap','getValue','setValue','lengthBytesUTF8','stringToUTF8','UTF8ToString']"
)