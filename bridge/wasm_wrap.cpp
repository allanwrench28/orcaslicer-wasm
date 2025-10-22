// Minimal headless Orca WASM bridge
#include <cstdint>
#include <cstdlib>
#include <cstdio>
#include <vector>
#include <string>
#include <cstring>
#include <unistd.h>

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#endif

// Include Orca slicer headers
#include "libslic3r/libslic3r_version.h"
#include "../orca/src/libslic3r/TriangleMesh.hpp"
#include "../orca/src/libslic3r/Model.hpp"
#include "../orca/src/libslic3r/Print.hpp"
#include "../orca/src/libslic3r/PrintConfig.hpp"
#include "../orca/src/libslic3r/GCode.hpp"
#include "../orca/src/libslic3r/Format/STL.hpp"
#include "../orca/src/libslic3r/PresetBundle.hpp"

using namespace Slic3r;

// Simple helper for STL loading
static bool load_stl_from_buffer(const uint8_t* data, size_t len, Model& model) {
    try {
        // For now, write to temp location - in production we'd use memory stream
        std::string temp_path = "/tmp/model.stl";
        FILE* f = fopen(temp_path.c_str(), "wb");
        if (!f) return false;
        fwrite(data, 1, len, f);
        fclose(f);
        
        return Slic3r::load_stl(temp_path.c_str(), &model);
    } catch (...) {
        return false;
    }
}

// Simple default config
static DynamicPrintConfig get_default_config() {
    DynamicPrintConfig config;
    
    // Basic settings for a working slice
    config.set_key_value("layer_height", new ConfigOptionFloat(0.2));
    config.set_key_value("fill_density", new ConfigOptionPercent(20));
    config.set_key_value("perimeters", new ConfigOptionInt(2));
    config.set_key_value("top_solid_layers", new ConfigOptionInt(3));
    config.set_key_value("bottom_solid_layers", new ConfigOptionInt(3));
    config.set_key_value("filament_diameter", new ConfigOptionFloats { 1.75 });
    config.set_key_value("nozzle_diameter", new ConfigOptionFloats { 0.4 });
    config.set_key_value("extruder_temperature", new ConfigOptionInts { 210 });
    config.set_key_value("bed_temperature", new ConfigOptionInts { 60 });
    
    return config;
}

// Helper function to create STL from memory buffer using Orca's STL loader
bool load_stl_from_memory(const uint8_t* data, size_t len, Model* model, std::string& error) {
    try {
        // Write data to a temporary file since Orca's STL loader expects a file path
        // In a production version, we'd extend Orca to support memory buffers
        std::string temp_filename = "/tmp/temp_model.stl";
        
        FILE* temp_file = fopen(temp_filename.c_str(), "wb");
        if (!temp_file) {
            error = "Failed to create temporary file";
            return false;
        }
        
        size_t written = fwrite(data, 1, len, temp_file);
        fclose(temp_file);
        
        if (written != len) {
            error = "Failed to write complete file data";
            return false;
        }
        
        // Use Orca's built-in STL loader
        bool success = load_stl(temp_filename.c_str(), model, "imported_object", nullptr, 80);
        
        // Clean up temporary file
        unlink(temp_filename.c_str());
        
        if (!success) {
            error = "Failed to load STL using Orca's loader";
            return false;
        }
        
        return true;
        
    } catch (const std::exception& e) {
        error = std::string("Exception: ") + e.what();
        return false;
    } catch (...) {
        error = "Unknown exception during STL loading";
        return false;
    }
}

extern "C" {

// Optional: capture config (JSON/TOML) once  
__attribute__((used)) int orc_init(const uint8_t* cfg, int len) {
    // Parse cfg if needed; otherwise no-op
    return 0;
}

// Slice: model bytes in, gcode out
__attribute__((used)) int orc_slice(const uint8_t* model, int len,
                                   uint8_t** gcode_out, int* gcode_len) {
    try {
        // 1) Load model from buffer
        Model orca_model;
        if (!load_stl_from_buffer(model, len, orca_model)) {
            return -1; // Failed to load
        }
        
        if (orca_model.objects.empty()) {
            return -2; // No objects in model
        }
        
        // 2) Create print with default config
        DynamicPrintConfig config = get_default_config();
        Print print;
        print.apply(orca_model, config);
        
        // 3) Process (slice)
        print.process();
        
        // 4) Generate G-code into a temporary file and read it back
        GCode gcode_generator;
        const Vec3d plate_origin = print.get_plate_origin();
        gcode_generator.set_gcode_offset(plate_origin(0), plate_origin(1));

        const std::string temp_gcode_path = "/tmp/wasm_output.gcode";
        const auto remove_temp_file = [&]() { unlink(temp_gcode_path.c_str()); };
        gcode_generator.do_export(&print, temp_gcode_path.c_str());

        FILE* gcode_file = fopen(temp_gcode_path.c_str(), "rb");
        if (!gcode_file) {
            remove_temp_file();
            *gcode_out = nullptr;
            return -3;
        }

        if (fseek(gcode_file, 0, SEEK_END) != 0) {
            fclose(gcode_file);
            remove_temp_file();
            *gcode_out = nullptr;
            return -3;
        }

        long file_length = ftell(gcode_file);
        if (file_length < 0) {
            fclose(gcode_file);
            remove_temp_file();
            *gcode_out = nullptr;
            return -3;
        }
        rewind(gcode_file);

        std::string gcode_str;
        gcode_str.resize(static_cast<size_t>(file_length));

        if (file_length > 0) {
            size_t read_bytes = fread(gcode_str.data(), 1, gcode_str.size(), gcode_file);
            if (read_bytes != gcode_str.size()) {
                fclose(gcode_file);
                remove_temp_file();
                *gcode_out = nullptr;
                return -3;
            }
        }

        fclose(gcode_file);
        remove_temp_file();

        *gcode_len = static_cast<int>(gcode_str.size());
        if (*gcode_len == 0) {
            *gcode_out = nullptr;
            return 0;
        }

        uint8_t* buf = static_cast<uint8_t*>(malloc(gcode_str.size()));
        if (!buf) {
            *gcode_out = nullptr;
            return -3;
        }

        std::memcpy(buf, gcode_str.data(), gcode_str.size());
        *gcode_out = buf;

        return 0; // Success
        
    } catch (...) {
        return -4; // Exception
    }
}

__attribute__((used)) void orc_free(void* p) {
    free(p);
}

}