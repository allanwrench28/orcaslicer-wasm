cmake_minimum_required(VERSION 3.22)
project(slicer_wasm)

# Release by default
set(CMAKE_BUILD_TYPE Release CACHE STRING "")

# --- Make our custom find-modules visible (Boost/TBB/OpenSSL shims) ---
list(PREPEND CMAKE_MODULE_PATH "${CMAKE_CURRENT_LIST_DIR}/cmake")

# --- Pthreads (needed by Boost.Thread) ---
add_compile_options(-pthread)
set(EM_PTHREAD_FLAGS "-pthread")  # Emscripten 4.x: do not pass -sPTHREADS=1

# --- Point to locally built Boost (headers + static libs) ---
set(BOOST_PREFIX "${CMAKE_SOURCE_DIR}/../deps/boost-wasm/install")
set(BOOST_INC    "${BOOST_PREFIX}/include")
set(BOOST_LIB    "${BOOST_PREFIX}/lib")

# Export to subprojects (orca)
set(BOOST_ROOT         "${BOOST_PREFIX}" CACHE PATH "Boost root"             FORCE)
set(Boost_ROOT         "${BOOST_PREFIX}" CACHE PATH "Boost root (CamelCase)" FORCE)
set(BOOST_INCLUDEDIR   "${BOOST_INC}"    CACHE PATH "Boost include dir"      FORCE)
set(BOOST_LIBRARYDIR   "${BOOST_LIB}"    CACHE PATH "Boost library dir"      FORCE)
set(Boost_NO_SYSTEM_PATHS ON             CACHE BOOL ""                       FORCE)
set(Boost_USE_STATIC_LIBS ON             CACHE BOOL ""                       FORCE)
set(Boost_USE_MULTITHREADED ON           CACHE BOOL ""                       FORCE)

# --- Disable TBB usage (shim will satisfy REQUIRED without linking) ---
set(SLIC3R_TBB OFF CACHE BOOL "Disable TBB in WASM build" FORCE)
set(SLIC3R_USE_TBB OFF CACHE BOOL "" FORCE)
add_compile_definitions(SLIC3R_NO_TBB=1)

# --- Tell Orca to avoid GUI and NLS (no Boost.Locale required) ---
set(SLIC3R_GUI OFF CACHE BOOL "Disable GUI for WASM" FORCE)
set(SLIC3R_NLS OFF CACHE BOOL "Disable translations for WASM" FORCE)

# --- Subprojects ---

# Provide Threads::Threads interface target for Emscripten (no real pthread lib needed)
if(NOT TARGET Threads::Threads)
  add_library(Threads::Threads INTERFACE IMPORTED)
  target_compile_options(Threads::Threads INTERFACE -pthread)
  target_link_options(Threads::Threads INTERFACE -pthread)
endif()

add_subdirectory(../bridge ${CMAKE_BINARY_DIR}/bridge-build)
add_subdirectory(../orca   ${CMAKE_BINARY_DIR}/orca-build  EXCLUDE_FROM_ALL)

# --- Executable (bridge for now; we will append Orca libs later) ---
add_executable(slicer ../bridge/wasm_wrap.cpp)

target_include_directories(slicer PRIVATE
  ../bridge
  ${BOOST_INC}
)

# Link Boost static archives that we know exist
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
