cmake_minimum_required(VERSION 3.22)
project(slicer_wasm)

# Release by default
set(CMAKE_BUILD_TYPE Release CACHE STRING "")

# --- Pthreads (Boost.Thread expects it) ---
add_compile_options(-pthread)
set(EM_PTHREAD_FLAGS "-pthread")  # Emscripten 4.x: don't pass -sPTHREADS=1

# --- Boost (built locally for WASM) ---
# We use the Boost *config* package that got installed by b2 under lib/cmake/Boost-1.83.0
set(BOOST_ROOT "${CMAKE_SOURCE_DIR}/../deps/boost-wasm/install")
set(Boost_ROOT "${BOOST_ROOT}")  # CMP0144 prefers CamelCase
# Help CMake find the config package
list(PREPEND CMAKE_PREFIX_PATH
  "${BOOST_ROOT}"
  "${BOOST_ROOT}/lib/cmake"
  "${BOOST_ROOT}/lib/cmake/Boost-1.83.0"
)

# Use the CONFIG mode so CMake reads BoostConfig.cmake from our install
set(Boost_USE_STATIC_LIBS ON)
set(Boost_NO_SYSTEM_PATHS ON)
set(Boost_NO_BOOST_CMAKE OFF)

find_package(Boost 1.83.0 REQUIRED CONFIG COMPONENTS
  system filesystem thread regex chrono atomic date_time iostreams program_options nowide
)

# --- Our subprojects ---
add_subdirectory(../bridge ${CMAKE_BINARY_DIR}/bridge-build)
# Orca added EXCLUDE_FROM_ALL to avoid building any host/GUI bits by default
add_subdirectory(../orca ${CMAKE_BINARY_DIR}/orca-build EXCLUDE_FROM_ALL)

# --- Executable (links the bridge; we'll add Orca libs after we see first link errors) ---
add_executable(slicer ../bridge/wasm_wrap.cpp)

target_include_directories(slicer PRIVATE
  ../bridge
  ${Boost_INCLUDE_DIRS}
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