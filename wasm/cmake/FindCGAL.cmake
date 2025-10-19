# Minimal CGAL shim for Emscripten/WASM.
# Satisfies find_package(CGAL REQUIRED) without linking real libs.

set(CGAL_FOUND TRUE)
set(CGAL_VERSION "5.0")
set(CGAL_INCLUDE_DIRS "")
set(CGAL_LIBRARIES "")
# Provide imported target expected by consumers
if(NOT TARGET CGAL::CGAL)
  add_library(CGAL::CGAL INTERFACE IMPORTED)
  set_target_properties(CGAL::CGAL PROPERTIES
    INTERFACE_INCLUDE_DIRECTORIES ""
  )
endif()
