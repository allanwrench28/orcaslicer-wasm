if(NOT DEFINED BOOST_PREFIX)
  set(BOOST_PREFIX "${CMAKE_CURRENT_LIST_DIR}/../../deps/boost-wasm/install")
endif()
set(BOOST_INC "${BOOST_PREFIX}/include")
set(BOOST_LIB "${BOOST_PREFIX}/lib")

if(NOT EXISTS "${BOOST_INC}/boost/version.hpp")
  message(FATAL_ERROR "Boost headers not found at ${BOOST_INC}")
endif()

# Public vars expected by consumers
set(Boost_FOUND TRUE)
set(Boost_VERSION 108300)
set(Boost_INCLUDE_DIR "${BOOST_INC}")
set(Boost_INCLUDE_DIRS "${BOOST_INC}")
set(Boost_LIBRARIES "")  # we will append below
set(Boost_NO_SYSTEM_PATHS ON)
set(Boost_USE_STATIC_LIBS ON)
set(Boost_USE_MULTITHREADED ON)

# Helper macro to register a static lib + imported target
macro(_boost_add component libfile)
  set(_path "${BOOST_LIB}/${libfile}")
  if(EXISTS "${_path}")
    set(Boost_${component}_FOUND TRUE)
    list(APPEND Boost_LIBRARIES "${_path}")
    # Create imported target Boost::<component>
    add_library(Boost::${component} STATIC IMPORTED)
    set_target_properties(Boost::${component} PROPERTIES
      IMPORTED_LOCATION "${_path}"
      INTERFACE_INCLUDE_DIRECTORIES "${BOOST_INC}"
    )
  else()
    set(Boost_${component}_FOUND FALSE)
  endif()
endmacro()

# Register libs we built
_boost_add(system          libboost_system.a)
_boost_add(filesystem      libboost_filesystem.a)
_boost_add(thread          libboost_thread.a)
_boost_add(regex           libboost_regex.a)
_boost_add(chrono          libboost_chrono.a)
_boost_add(atomic          libboost_atomic.a)
_boost_add(date_time       libboost_date_time.a)
_boost_add(iostreams       libboost_iostreams.a)
_boost_add(program_options libboost_program_options.a)
_boost_add(log             libboost_log.a)
_boost_add(log_setup       libboost_log_setup.a)

# Header-only: nowide
set(Boost_nowide_FOUND TRUE)
add_library(Boost::nowide INTERFACE IMPORTED)
set_target_properties(Boost::nowide PROPERTIES
  INTERFACE_INCLUDE_DIRECTORIES "${BOOST_INC}"
)

# Optional: locale (we disabled NLS; expose if present)
if(EXISTS "${BOOST_LIB}/libboost_locale.a")
  _boost_add(locale libboost_locale.a)
else()
  set(Boost_locale_FOUND FALSE)
endif()
EOF