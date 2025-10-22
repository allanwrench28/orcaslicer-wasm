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

# --- Staged GMP/MPFR/CGAL toolchain for WASM ---
set(WASM_MATH_PREFIX "${CMAKE_SOURCE_DIR}/../deps/toolchain-wasm/install")
set(WASM_MATH_PREFIX "${WASM_MATH_PREFIX}" CACHE PATH "Prefix with GMP/MPFR/CGAL for WASM" FORCE)
set(ENV{WASM_MATH_PREFIX} "${WASM_MATH_PREFIX}")
list(PREPEND CMAKE_PREFIX_PATH "${WASM_MATH_PREFIX}")

# --- Create WASM shims for complex dependencies ---
add_library(wasm_shims INTERFACE)
target_include_directories(wasm_shims INTERFACE
  ${CMAKE_CURRENT_SOURCE_DIR}/wasm_shims
)
target_compile_definitions(wasm_shims INTERFACE
  WASM_BUILD=1
  TBB_MOCK=1
  SLIC3R_NO_TBB=1
)

# --- Prefer our shims for cereal/libigl but keep real Boost visible ---
include_directories(BEFORE
  ${CMAKE_SOURCE_DIR}/wasm/wasm_shims
  ${BOOST_INC}
)

# --- Eigen include (try common in-tree layouts) ---
# Use the dir that contains the "Eigen/" folder.
set(_eigen_candidates)

if(EIGEN3_INCLUDE_DIR)
  list(APPEND _eigen_candidates "${EIGEN3_INCLUDE_DIR}")
endif()

list(APPEND _eigen_candidates
  "${PROJECT_SOURCE_DIR}/deps_src/eigen3"
  "${PROJECT_SOURCE_DIR}/deps_src/eigen"
  "${PROJECT_SOURCE_DIR}/../orca/deps_src/eigen3"
  "${PROJECT_SOURCE_DIR}/../orca/deps_src/eigen"
)

set(_eigen_resolved "")
foreach(_candidate IN LISTS _eigen_candidates)
  if(EXISTS "${_candidate}/Eigen/Core")
    set(_eigen_resolved "${_candidate}")
    break()
  endif()
endforeach()

if(_eigen_resolved)
  include_directories("${_eigen_resolved}")
  set(EIGEN3_INCLUDE_DIR "${_eigen_resolved}" CACHE PATH "Eigen include dir for WASM build" FORCE)
  set(EIGEN3_INCLUDE_DIRS "${_eigen_resolved}" CACHE PATH "Eigen include dirs for WASM build" FORCE)
else()
  message(WARNING "Eigen headers not found – CGAL components may fail to configure")
endif()

# Eigen runtime-sane flags for wasm
add_compile_definitions(
  EIGEN_DONT_ALIGN_STATICALLY=1
  EIGEN_DISABLE_UNALIGNED_ARRAY_ASSERT=1
)

# --- Disable TBB usage (shim will satisfy REQUIRED without linking) ---
set(SLIC3R_TBB OFF CACHE BOOL "Disable TBB in WASM build" FORCE)
set(SLIC3R_USE_TBB OFF CACHE BOOL "" FORCE)

# OCCT-based functionality is not available in the WASM toolchain
set(SLIC3R_WITH_OCCT OFF CACHE BOOL "Disable OCCT for WASM" FORCE)
set(SLIC3R_WITH_OPENCV OFF CACHE BOOL "Disable OpenCV for WASM" FORCE)

# --- Tell Orca to avoid GUI and NLS (no Boost.Locale required) ---
set(SLIC3R_GUI OFF CACHE BOOL "Disable GUI for WASM" FORCE)
set(SLIC3R_NLS OFF CACHE BOOL "Disable translations for WASM" FORCE)
set(SLIC3R_ENC_CHECK OFF CACHE BOOL "Disable encoding check for WASM" FORCE)

# --- Emscripten-specific compile options ---
if(EMSCRIPTEN)
  # Silence unknown warning option spam
  add_compile_options(-Wno-unknown-warning-option)
  
  # Remove problematic warning flags that Emscripten doesn't support
  string(REPLACE "-Werror=enum-constexpr-conversion" "" CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS}")
  string(REPLACE "-Werror=enum-constexpr-conversion" "" CMAKE_C_FLAGS "${CMAKE_C_FLAGS}")
  
  # Disable PCH for WASM builds to avoid include ordering issues
  set(SLIC3R_PCH OFF CACHE BOOL "Disable PCH for WASM" FORCE)
  
endif()

# --- Subprojects ---

# Provide Threads::Threads interface target for Emscripten (no real pthread lib needed)
if(NOT TARGET Threads::Threads)
  add_library(Threads::Threads INTERFACE IMPORTED)
  target_compile_options(Threads::Threads INTERFACE -pthread)
  target_link_options(Threads::Threads INTERFACE -pthread)
endif()

add_subdirectory(../bridge ${CMAKE_BINARY_DIR}/bridge-build)
add_subdirectory(../orca   ${CMAKE_BINARY_DIR}/orca-build  EXCLUDE_FROM_ALL)

# --- Finalise bridge wiring now that targets exist ---
if (TARGET orca_wasm_bridge)
  if (EXISTS "${PROJECT_SOURCE_DIR}/deps_src/semver/include/semver/semver.h")
    target_include_directories(orca_wasm_bridge BEFORE PRIVATE
      ${PROJECT_SOURCE_DIR}/deps_src/semver/include
    )
  elseif (EXISTS "${PROJECT_SOURCE_DIR}/deps_src/semver/semver/semver.h")
    target_include_directories(orca_wasm_bridge BEFORE PRIVATE
      ${PROJECT_SOURCE_DIR}/deps_src/semver
    )
  elseif (EXISTS "${PROJECT_SOURCE_DIR}/../orca/deps_src/semver/include/semver/semver.h")
    target_include_directories(orca_wasm_bridge BEFORE PRIVATE
      ${PROJECT_SOURCE_DIR}/../orca/deps_src/semver/include
    )
  elseif (EXISTS "${PROJECT_SOURCE_DIR}/../orca/deps_src/semver/semver/semver.h")
    target_include_directories(orca_wasm_bridge BEFORE PRIVATE
      ${PROJECT_SOURCE_DIR}/../orca/deps_src/semver
    )
  endif()

  if(NOT SLIC3R_WITH_OCCT)
    target_compile_definitions(orca_wasm_bridge PUBLIC SLIC3R_NO_OCCT)
  endif()
endif()

if (NOT SLIC3R_WITH_OCCT)
  if (TARGET libslic3r)
    target_compile_definitions(libslic3r PUBLIC SLIC3R_NO_OCCT)
    target_include_directories(libslic3r PUBLIC ${PROJECT_SOURCE_DIR}/wasm_shims)
  endif()
  if (TARGET libslic3r_cgal)
    target_compile_definitions(libslic3r_cgal PUBLIC SLIC3R_NO_OCCT)
    target_include_directories(libslic3r_cgal PUBLIC ${PROJECT_SOURCE_DIR}/wasm_shims)
  endif()
endif()

# --- Suppress third-party warnings for Emscripten ---
if(EMSCRIPTEN AND TARGET mcut)
  target_compile_options(mcut PRIVATE -Wno-deprecated-non-prototype)
endif()

# Eigen settings for libslic3r
if(EMSCRIPTEN AND TARGET libslic3r)
  target_compile_definitions(libslic3r PRIVATE
    EIGEN_DONT_ALIGN_STATICALLY=1
    EIGEN_DISABLE_UNALIGNED_ARRAY_ASSERT=1
    ORCA_DISABLE_OPENVDB=1
  )
endif()

# --- Executable (bridge that links to Orca slicer) ---
add_executable(slicer ../bridge/wasm_wrap.cpp)

target_include_directories(slicer PRIVATE
  ../bridge
  ${BOOST_INC}
  ../orca/src
  ${CMAKE_CURRENT_SOURCE_DIR}/wasm_shims
  ${CMAKE_CURRENT_SOURCE_DIR}/wasm_shims/boost_runtime
  ${CMAKE_BINARY_DIR}/orca-build/src/libslic3r
)

if(NOT SLIC3R_WITH_OCCT)
  target_compile_definitions(slicer PRIVATE SLIC3R_NO_OCCT)
endif()

# Link Orca slicer libraries and our shims
target_link_libraries(slicer PRIVATE
  libslic3r
  libslic3r_cgal
  wasm_shims
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


# --- Fix em++ options: use target_link_options instead of LINK_FLAGS ---
# First, clear any previous LINK_FLAGS we set earlier:

# --- Emscripten link options ---
target_link_options(slicer PRIVATE
  -O3
  -sALLOW_MEMORY_GROWTH=1
  -sMALLOC=emmalloc
  -sENVIRONMENT=web,worker
  -sMODULARIZE=1
  -sEXPORT_NAME=OrcaModule
  -sDISABLE_EXCEPTION_CATCHING=0
  -fexceptions
  -pthread
  "-sEXPORTED_FUNCTIONS=['_orc_init','_orc_slice','_malloc','_free','_orc_free']"
  "-sEXPORTED_RUNTIME_METHODS=['ccall','cwrap','getValue','setValue']"
)
