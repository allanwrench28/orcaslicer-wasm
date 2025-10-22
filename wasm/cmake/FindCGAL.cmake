# Minimal CGAL finder for the WASM toolchain.
# Assumes CGAL (and its GMP/MPFR deps) were installed into deps/toolchain-wasm/install
# or a custom prefix exported via the WASM_MATH_PREFIX CMake variable / env var.

set(_cgal_prefix "${WASM_MATH_PREFIX}")
if(NOT _cgal_prefix AND DEFINED ENV{WASM_MATH_PREFIX})
  set(_cgal_prefix "$ENV{WASM_MATH_PREFIX}")
endif()
if(NOT _cgal_prefix)
  get_filename_component(_repo_root "${CMAKE_CURRENT_LIST_DIR}/../.." ABSOLUTE)
  set(_cgal_prefix "${_repo_root}/deps/toolchain-wasm/install")
endif()

set(_cgal_config "${_cgal_prefix}/lib/cmake/CGAL/CGALConfig.cmake")
set(CGAL_INCLUDE_DIR "${_cgal_prefix}/include")

if(EXISTS "${_cgal_config}")
  include("${_cgal_config}")
  if(TARGET CGAL::CGAL)
    set(CGAL_FOUND TRUE)
  endif()
elseif(EXISTS "${CGAL_INCLUDE_DIR}/CGAL/version.h")
  set(CGAL_FOUND TRUE)
  set(CGAL_INCLUDE_DIRS "${CGAL_INCLUDE_DIR}")
  if(NOT TARGET CGAL::CGAL)
    add_library(CGAL::CGAL INTERFACE IMPORTED)
    set_target_properties(CGAL::CGAL PROPERTIES
      INTERFACE_INCLUDE_DIRECTORIES "${CGAL_INCLUDE_DIR}"
    )
  endif()
else()
  set(CGAL_FOUND FALSE)
endif()

if(CGAL_FOUND AND TARGET CGAL::CGAL)
  if(NOT CGAL_INCLUDE_DIRS)
    get_target_property(CGAL_INCLUDE_DIRS CGAL::CGAL INTERFACE_INCLUDE_DIRECTORIES)
  endif()
  if(NOT CGAL_LIBRARIES)
    get_target_property(CGAL_LIBRARIES CGAL::CGAL INTERFACE_LINK_LIBRARIES)
  endif()
endif()
