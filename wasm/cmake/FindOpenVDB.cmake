# Minimal OpenVDB shim for Emscripten/WASM.
# Satisfies find_package(OpenVDB REQUIRED) without linking real libs.

set(OPENVDB_FOUND TRUE)
set(OpenVDB_FOUND TRUE)
set(OpenVDB_INCLUDE_DIRS "")
set(OpenVDB_LIBRARY "")
set(OpenVDB_LIBRARIES "")
# Provide imported target expected by consumers
if(NOT TARGET OpenVDB::openvdb)
  add_library(OpenVDB::openvdb INTERFACE IMPORTED)
  set_target_properties(OpenVDB::openvdb PROPERTIES
    INTERFACE_INCLUDE_DIRECTORIES ""
  )
endif()
