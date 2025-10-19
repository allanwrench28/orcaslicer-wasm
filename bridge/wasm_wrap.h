#ifndef ORCA_WASM_WRAP_H
#define ORCA_WASM_WRAP_H
#include <stddef.h>
#include <stdint.h>
#ifdef __cplusplus
extern "C" {
#endif

typedef void* OS_Mesh;
typedef void* OS_Result;

OS_Mesh   os_load_mesh(const uint8_t* bytes, size_t len, char* err, size_t err_cap);
OS_Result os_slice_basic(OS_Mesh mesh, const char* settings_json, char* err, size_t err_cap);
size_t    os_result_gcode(OS_Result r, uint8_t* out, size_t cap);
size_t    os_result_preview_layer(OS_Result r, int layer_index, uint8_t* out, size_t cap);
void      os_free_mesh(OS_Mesh m);
void      os_free_result(OS_Result r);

#ifdef __cplusplus
}
#endif
#endif
