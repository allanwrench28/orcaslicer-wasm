cmake_minimum_required(VERSION 3.22)
project(slicer_wasm)

# Release by default
set(CMAKE_BUILD_TYPE Release CACHE STRING "")

# --- Pthreads (needed by Boost.Thread) ---
add_compile_options(-pthread)
set(EM_PTHREAD_FLAGS "-pthread")  # Emscripten 4.x: don't pass -sPTHREADS=1

# --- Point directly at your locally built Boost for WASM ---
set(BOOST_PREFIX "${CMAKE_SOURCE_DIR}/../deps/boost-wasm/install")
set(BOOST_INC    "${BOOST_PREFIX}/include")
set(BOOST_LIB    "${BOOST_PREFIX}/lib")

# Verify a couple expected libs (optional sanity)
if(NOT EXISTS "${BOOST_INC}/boost/version.hpp")
  message(FATAL_ERROR "Boost headers not found at ${BOOST_INC}")
endif()
if(NOT EXISTS "${BOOST_LIB}/libboost_system.a")
  message(FATAL_ERROR "Boost libs not found at ${BOOST_LIB}")
endif()

# --- Our subprojects ---
add_subdirectory(../bridge ${CMAKE_BINARY_DIR}/bridge-build)
add_subdirectory(../orca   ${CMAKE_BINARY_DIR}/orca-build  EXCLUDE_FROM_ALL)

# --- Executable (we will add Orca libs after we see first link errors) ---
add_executable(slicer ../bridge/wasm_wrap.cpp)

target_include_directories(slicer PRIVATE
  ../bridge
  ${BOOST_INC}
)

# Link Boost static archives explicitly (match what we built)
# Trim/extend this list if your Orca link asks for more/less later.
target_link_libraries(slicer PRIVATE
  "${BOOST_LIB}/libboost_system.a"
  "${BOOST_LIB}/libboost_filesystem.a"
  "${BOOST_LIB}/libboost_thread.a"
  "${BOOST_LIB}/libboost_regex.a"
  "${BOOST_LIB}/libboost_chrono.a"
  "${BOOST_LIB}/libboost_atomic.a"
  "${BOOST_LIB}/libboost_date_time.a"
  "${BOOST_LIB}/libboost_iostreams.a"
  "${BOOST_LIB}/libboost_program_options.a"
  "${BOOST_LIB}/libboost_nowide.a"
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