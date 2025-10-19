# Minimal TBB shim for Emscripten/WASM builds.
# Marks TBB as found and provides empty imported targets.

# Classic variables some scripts read
set(TBB_FOUND TRUE)
set(TBB_INCLUDE_DIRS "")
set(TBB_LIBRARIES "")
# Imported targets expected by consumers
if(NOT TARGET TBB::tbb)
  add_library(TBB::tbb INTERFACE IMPORTED)
  set_target_properties(TBB::tbb PROPERTIES
    INTERFACE_INCLUDE_DIRECTORIES ""
  )
endif()

if(NOT TARGET TBB::tbbmalloc)
  add_library(TBB::tbbmalloc INTERFACE IMPORTED)
  set_target_properties(TBB::tbbmalloc PROPERTIES
    INTERFACE_INCLUDE_DIRECTORIES ""
  )
endif()
