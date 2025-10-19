# Expect caller to provide BOOST_PREFIX / BOOST_INC / BOOST_LIB in cache or parent CMakeLists.
if(NOT BOOST_PREFIX)
  set(BOOST_PREFIX "${CMAKE_SOURCE_DIR}/../deps/boost-wasm/install")
endif()
if(NOT BOOST_INC)
  set(BOOST_INC "${BOOST_PREFIX}/include")
endif()
if(NOT BOOST_LIB)
  set(BOOST_LIB "${BOOST_PREFIX}/lib")
endif()

# Public variables expected by projects using FindBoost
set(Boost_INCLUDE_DIR "${BOOST_INC}")
set(Boost_INCLUDE_DIRS "${BOOST_INC}")

# Helper to register a static library if present
function(_boost_reg component libname)
  set(path "${BOOST_LIB}/${libname}")
  if(EXISTS "${path}")
    set(Boost_${component}_FOUND ON PARENT_SCOPE)
    set(Boost_${component}_LIBRARY "${path}" PARENT_SCOPE)
    # Append to aggregate libs list
    set(_acc "${Boost_LIBRARIES}")
    list(APPEND _acc "${path}")
    set(Boost_LIBRARIES "${_acc}" PARENT_SCOPE)
  else()
    set(Boost_${component}_FOUND OFF PARENT_SCOPE)
  fi()
endfunction()

# Header-only components: mark FOUND (no library)
function(_boost_hdr component)
  set(Boost_${component}_FOUND ON PARENT_SCOPE)
endfunction()

# Register the libs we actually built
_boost_reg(system          libboost_system.a)
_boost_reg(filesystem      libboost_filesystem.a)
_boost_reg(thread          libboost_thread.a)
_boost_reg(regex           libboost_regex.a)
_boost_reg(chrono          libboost_chrono.a)
_boost_reg(atomic          libboost_atomic.a)
_boost_reg(date_time       libboost_date_time.a)
_boost_reg(iostreams       libboost_iostreams.a)
_boost_reg(program_options libboost_program_options.a)
_boost_reg(log             libboost_log.a)
_boost_reg(log_setup       libboost_log_setup.a)

# Header-only
_boost_hdr(nowide)

# We disable NLS in our parent CMake, so don't require locale.
# If locale lib exists, we can expose it; otherwise mark as NOTFOUND.
if(EXISTS "${BOOST_LIB}/libboost_locale.a")
  _boost_reg(locale libboost_locale.a)
else()
  set(Boost_LOCALE_FOUND OFF)
endif()

# Aggregate flags typically expected by consumers
set(Boost_FOUND ON)
set(Boost_VERSION 108300)
set(Boost_USE_STATIC_LIBS ON)
set(Boost_USE_MULTITHREADED ON)
set(Boost_NO_SYSTEM_PATHS ON)

# Export include dirs/definitions
set(Boost_DEFINITIONS "")
set(Boost_LIB_VERSION "1_83")
EOF
2) Tell your top-level CMake to use the override
Edit wasm/CMakeLists.txt to prepend our custom module path before adding orca/. Replace the entire file with this version (it also keeps your Boost paths, disables NLS, and links static libs explicitly):

cmake
Copy code
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

# Make these visible to subprojects
set(BOOST_ROOT         "${BOOST_PREFIX}" CACHE PATH "Boost root"             FORCE)
set(Boost_ROOT         "${BOOST_PREFIX}" CACHE PATH "Boost root (CamelCase)" FORCE)
set(BOOST_INCLUDEDIR   "${BOOST_INC}"    CACHE PATH "Boost include dir"      FORCE)
set(BOOST_LIBRARYDIR   "${BOOST_LIB}"    CACHE PATH "Boost library dir"      FORCE)
set(Boost_NO_SYSTEM_PATHS ON             CACHE BOOL ""                       FORCE)
set(Boost_USE_STATIC_LIBS ON             CACHE BOOL ""                       FORCE)
set(Boost_USE_MULTITHREADED ON           CACHE BOOL ""                       FORCE)

# --- Use our FindBoost override so orca/ finds the local Boost ---
list(PREPEND CMAKE_MODULE_PATH "${CMAKE_SOURCE_DIR}/cmake")

# --- Tell Orca to avoid GUI and NLS (no Boost.Locale required) ---
set(SLIC3R_GUI OFF CACHE BOOL "Disable GUI for WASM" FORCE)
set(SLIC3R_NLS OFF CACHE BOOL "Disable translations for WASM" FORCE)

# --- Subprojects ---
add_subdirectory(../bridge ${CMAKE_BINARY_DIR}/bridge-build)
add_subdirectory(../orca   ${CMAKE_BINARY_DIR}/orca-build  EXCLUDE_FROM_ALL)

# --- Executable (bridge for now; Orca libs will be appended after link errs) ---
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