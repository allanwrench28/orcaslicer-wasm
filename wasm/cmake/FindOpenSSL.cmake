set(OPENSSL_FOUND TRUE)
set(OPENSSL_INCLUDE_DIR "")
set(OPENSSL_CRYPTO_LIBRARY "")
set(OPENSSL_SSL_LIBRARY "")

# Old-style variables some projects read:
set(OpenSSL_FOUND TRUE)
set(OpenSSL_INCLUDE_DIR "")
set(OpenSSL_CRYPTO_LIBRARY "")
set(OpenSSL_SSL_LIBRARY "")

# Imported targets (new-style)
if(NOT TARGET OpenSSL::Crypto)
  add_library(OpenSSL::Crypto INTERFACE IMPORTED)
  set_target_properties(OpenSSL::Crypto PROPERTIES INTERFACE_INCLUDE_DIRECTORIES "")
endif()

if(NOT TARGET OpenSSL::SSL)
  add_library(OpenSSL::SSL INTERFACE IMPORTED)
  set_target_properties(OpenSSL::SSL PROPERTIES INTERFACE_INCLUDE_DIRECTORIES "")
endif()
EOF