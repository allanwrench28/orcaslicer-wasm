add_library(orca_wasm_bridge STATIC wasm_wrap.cpp)

# Expose bridge headers alongside Orca core and shim headers so consumers
# (including the standalone slicer executable) compile without chasing
# include paths manually.
target_include_directories(orca_wasm_bridge
	PUBLIC
		${CMAKE_CURRENT_LIST_DIR}
		${CMAKE_CURRENT_LIST_DIR}/../orca/src
		${CMAKE_CURRENT_LIST_DIR}/../orca/deps_src
		${CMAKE_CURRENT_LIST_DIR}/../orca/deps_src/eigen
		${CMAKE_CURRENT_LIST_DIR}/../wasm/wasm_shims
		${BOOST_INC}
)
