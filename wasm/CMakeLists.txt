cmake_minimum_required(VERSION 3.22)
project(slicer_wasm)

# Release by default
set(CMAKE_BUILD_TYPE Release CACHE STRING "")

# --- Pthreads (needed by Boost.Thread) ---
add_compile_options(-pthread)
set(EM_PTHREAD_FLAGS "-pthread")  # Emscripten 4.x: do not pass -sPTHREADS=1

# --- Point to locally built Boost (headers + static libs) ---
set(BOOST_PREFIX "${CMAKE_SOURCE_DIR}/../deps/boost-wasm/install")
set(BOOST_INC    "${BOOST_PREFIX}/include")
set(BOOST_LIB    "${BOOST_PREFIX}/lib")

# Make these visible to subprojects (like orca/) using FindBoost
set(BOOST_ROOT         "${BOOST_PREFIX}" CACHE PATH "Boost root"                 FORCE)
set(Boost_ROOT         "${BOOST_PREFIX}" CACHE PATH "Boost root (CamelCase)"     FORCE)
set(BOOST_INCLUDEDIR   "${BOOST_INC}"    CACHE PATH "Boost include dir"          FORCE)
set(BOOST_LIBRARYDIR   "${BOOST_LIB}"    CACHE PATH "Boost library dir"          FORCE)
set(Boost_NO_SYSTEM_PATHS ON             CACHE BOOL ""                           FORCE)
set(Boost_USE_STATIC_LIBS ON             CACHE BOOL ""                           FORCE)
set(Boost_USE_MULTITHREADED ON           CACHE BOOL ""                           FORCE)
set(Boost_USE_STATIC_RUNTIME OFF         CACHE BOOL ""                           FORCE)

# --- Tell Orca to avoid localization (no Boost.Locale needed) and avoid GUI ---
set(SLIC3R_NLS OFF CACHE BOOL "Disable translations for WASM" FORCE)
set(SLIC3R_GUI OFF CACHE BOOL "Disable GUI for WASM" FORCE)

# --- Our subprojects ---
add_subdirectory(../bridge ${CMAKE_BINARY_DIR}/bridge-build)
add_subdirectory(../orca   ${CMAKE_BINARY_DIR}/orca-build EXCLUDE_FROM_ALL)

# --- Executable (bridge for now; we'll add Orca libs after the first link pass) ---
add_executable(slicer ../bridge/wasm_wrap.cpp)

target_include_directories(slicer PRIVATE
  ../bridge
  ${BOOST_INC}
)

# Link Boost static archives that exist in our install
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
  "${BOOST_LIB}/libboost_log.a"
  "${BOOST_LIB}/libboost_log_setup.a"
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