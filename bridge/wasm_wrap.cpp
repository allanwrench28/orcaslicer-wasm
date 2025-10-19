#include "wasm_wrap.h"

extern "C" {

OS_Mesh os_load_mesh(const uint8_t* bytes, size_t len, char* err, size_t err_cap) {
    return nullptr;
}

OS_Result os_slice_basic(OS_Mesh mesh, const char* settings_json, char* err, size_t err_cap) {
    return nullptr;
}

size_t os_result_gcode(OS_Result r, uint8_t* out, size_t cap) {
    return 0;
}

size_t os_result_preview_layer(OS_Result r, int layer_index, uint8_t* out, size_t cap) {
    return 0;
}

void os_free_mesh(OS_Mesh m) {
}

void os_free_result(OS_Result r) {
}

}
