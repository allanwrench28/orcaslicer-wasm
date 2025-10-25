// Minimal headless Orca WASM bridge
#include <cstdint>
#include <cstdlib>
#include <cstdio>
#include <vector>
#include <string>
#include <cstring>
#include <algorithm>
#include <unistd.h>
#include <new>
#include <errno.h>
#include <cinttypes>
#include <limits>

#include <chrono>

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#include <emscripten/heap.h>
#include <emscripten/stack.h>
#include <malloc.h>
#endif

#ifdef __EMSCRIPTEN__
extern "C" char __heap_base;
#endif

static double now_ms()
{
#ifdef __EMSCRIPTEN__
    return emscripten_get_now();
#else
    using clock = std::chrono::steady_clock;
    return std::chrono::duration<double, std::milli>(clock::now().time_since_epoch()).count();
#endif
}

static void log_memory_usage(const char* label)
{
#ifdef __EMSCRIPTEN__
    const size_t heap_bytes = static_cast<size_t>(emscripten_get_heap_size());
    // mallinfo() has been observed to trap under allocator corruption, so we rely on
    // sbrk() to approximate the active heap span even though it overestimates usage.
    const intptr_t heap_base = reinterpret_cast<intptr_t>(&__heap_base);
    const intptr_t heap_break = reinterpret_cast<intptr_t>(sbrk(0));
    size_t used_bytes = 0;
    if (heap_break > heap_base) {
        used_bytes = static_cast<size_t>(heap_break - heap_base);
    }
    const size_t slack_bytes = heap_bytes > used_bytes ? heap_bytes - used_bytes : 0;
    const size_t reported_free = slack_bytes; // best effort estimate without mallinfo
    fprintf(stderr,
        "[orc_slice] memory %s: heap=%zu used=%zu slack=%zu fordblks=%zu\n",
        label,
        heap_bytes,
        used_bytes,
        slack_bytes,
        reported_free);
    fflush(stderr);
#else
    (void)label;
#endif
}

#ifdef __EMSCRIPTEN__
// Instrument global new/delete so we can observe failing allocations at runtime.
namespace {

static constexpr std::size_t kLargeAllocLogThreshold = 0; // Log all attempts until cap
static constexpr unsigned int kMaxLoggedAllocations = std::numeric_limits<unsigned int>::max();
static constexpr std::size_t kAllocTableSize = 1 << 17; // 131072 entries for pointer tracking
static constexpr std::size_t kAllocTableMask = kAllocTableSize - 1;

struct AllocationRecord {
    void* ptr;
    std::size_t size;
    std::size_t alignment;
    unsigned long long id;
    const char* kind;
};

static AllocationRecord g_alloc_table[kAllocTableSize] = {};
static unsigned long long g_allocation_sequence = 0;
static unsigned int g_logged_large_allocations = 0;

static inline std::size_t hash_pointer(const void* ptr)
{
    return (static_cast<std::size_t>(reinterpret_cast<uintptr_t>(ptr) >> 4) & kAllocTableMask);
}

static void record_allocation(void* ptr, std::size_t size, std::size_t alignment, unsigned long long id, const char* kind)
{
    if (ptr == nullptr) {
        return;
    }
    const std::size_t start = hash_pointer(ptr);
    for (std::size_t probe = 0; probe < kAllocTableSize; ++probe) {
        const std::size_t idx = (start + probe) & kAllocTableMask;
        AllocationRecord& slot = g_alloc_table[idx];
        if (slot.ptr == nullptr) {
            slot.ptr = ptr;
            slot.size = size;
            slot.alignment = alignment;
            slot.id = id;
            slot.kind = kind;
            return;
        }
        if (slot.ptr == ptr) {
            fprintf(stderr, "[orc_alloc] warning: pointer reused without free ptr=%p old_id=%" PRIu64 " new_id=%" PRIu64 " size=%zu\n",
                ptr,
                slot.id,
                id,
                size);
            slot.size = size;
            slot.alignment = alignment;
            slot.id = id;
            slot.kind = kind;
            return;
        }
    }
    fprintf(stderr, "[orc_alloc] error: allocation tracking table exhausted for ptr=%p size=%zu id=%" PRIu64 "\n",
        ptr,
        size,
        id);
}

static void record_free(void* ptr, const char* kind)
{
    if (ptr == nullptr) {
        return;
    }
    const std::size_t start = hash_pointer(ptr);
    for (std::size_t probe = 0; probe < kAllocTableSize; ++probe) {
        const std::size_t idx = (start + probe) & kAllocTableMask;
        AllocationRecord& slot = g_alloc_table[idx];
        if (slot.ptr == ptr) {
            slot.ptr = nullptr;
            slot.size = 0;
            slot.id = 0;
            slot.alignment = 0;
            slot.kind = nullptr;
            return;
        }
        if (slot.ptr == nullptr) {
            fprintf(stderr, "[orc_alloc] warning: %s freeing untracked pointer ptr=%p\n", kind, ptr);
            return;
        }
    }
    fprintf(stderr, "[orc_alloc] warning: %s freeing pointer not found in tracking table ptr=%p\n", kind, ptr);
}

static void dump_allocation_summary(unsigned long long failure_id)
{
    struct TopEntry {
        std::size_t size;
        unsigned long long id;
        void* ptr;
        const char* kind;
        std::size_t alignment;
    };

    TopEntry top[8] = {};
    std::size_t active = 0;
    std::size_t total_bytes = 0;
    unsigned long long oldest_id = std::numeric_limits<unsigned long long>::max();
    unsigned long long newest_id = 0;

    struct KindStats {
        const char* kind;
        std::size_t count;
        std::size_t bytes;
    };

    KindStats kind_stats[16] = {};
    std::size_t kind_stats_used = 0;

    for (std::size_t idx = 0; idx < kAllocTableSize; ++idx) {
        const AllocationRecord& slot = g_alloc_table[idx];
        if (slot.ptr == nullptr) {
            continue;
        }

        ++active;
        total_bytes += slot.size;
        if (slot.id < oldest_id) {
            oldest_id = slot.id;
        }
        if (slot.id > newest_id) {
            newest_id = slot.id;
        }

        const TopEntry candidate{slot.size, slot.id, slot.ptr, slot.kind, slot.alignment};
        for (std::size_t pos = 0; pos < sizeof(top) / sizeof(top[0]); ++pos) {
            if (candidate.size > top[pos].size) {
                for (std::size_t shift = (sizeof(top) / sizeof(top[0])) - 1; shift > pos; --shift) {
                    top[shift] = top[shift - 1];
                }
                top[pos] = candidate;
                break;
            }
        }

        if (slot.kind != nullptr) {
            std::size_t kind_idx = 0;
            for (; kind_idx < kind_stats_used; ++kind_idx) {
                if (kind_stats[kind_idx].kind == slot.kind) {
                    break;
                }
            }
            if (kind_idx == kind_stats_used && kind_stats_used < (sizeof(kind_stats) / sizeof(kind_stats[0]))) {
                kind_stats[kind_idx].kind = slot.kind;
                kind_stats[kind_idx].count = 0;
                kind_stats[kind_idx].bytes = 0;
                ++kind_stats_used;
            }
            if (kind_idx < kind_stats_used) {
                kind_stats[kind_idx].count += 1;
                kind_stats[kind_idx].bytes += slot.size;
            }
        }
    }

    const double load = static_cast<double>(active) * 100.0 / static_cast<double>(kAllocTableSize);
    fprintf(stderr,
        "[orc_alloc] failure summary #%" PRIu64 ": active=%zu total_bytes=%zu table_load=%.2f%% oldest_id=%" PRIu64 " newest_id=%" PRIu64 "\n",
        failure_id,
        active,
        total_bytes,
        load,
        (oldest_id == std::numeric_limits<unsigned long long>::max()) ? 0 : oldest_id,
        newest_id);

    if (active > 0) {
        fprintf(stderr, "[orc_alloc] outstanding allocations by kind:\n");
        for (std::size_t i = 0; i < kind_stats_used; ++i) {
            fprintf(stderr, "  kind=%s count=%zu bytes=%zu\n",
                kind_stats[i].kind != nullptr ? kind_stats[i].kind : "(unknown)",
                kind_stats[i].count,
                kind_stats[i].bytes);
        }

        fprintf(stderr, "[orc_alloc] largest outstanding allocations:\n");
        for (std::size_t i = 0; i < sizeof(top) / sizeof(top[0]); ++i) {
            if (top[i].size == 0) {
                break;
            }
            fprintf(stderr,
                "  #%zu ptr=%p size=%zu align=%zu kind=%s id=%" PRIu64 "\n",
                i,
                top[i].ptr,
                top[i].size,
                top[i].alignment,
                top[i].kind != nullptr ? top[i].kind : "(unknown)",
                top[i].id);
        }
    }
    fflush(stderr);
}

static void* instrumented_allocate(std::size_t size, std::size_t alignment, bool nothrow, const char* kind)
{
    const unsigned long long alloc_id = ++g_allocation_sequence;
    if (size >= kLargeAllocLogThreshold && g_logged_large_allocations < kMaxLoggedAllocations) {
        ++g_logged_large_allocations;
        fprintf(stderr, "[orc_alloc] #%" PRIu64 " attempt size=%zu align=%zu kind=%s nothrow=%s\n",
            alloc_id,
            size,
            alignment,
            kind,
            nothrow ? "true" : "false");
        char pre_stack_buffer[2048] = {0};
        int attempt_written = emscripten_get_callstack(EM_LOG_C_STACK | EM_LOG_JS_STACK, pre_stack_buffer, static_cast<int>(sizeof(pre_stack_buffer)));
        if (attempt_written > 0) {
            pre_stack_buffer[sizeof(pre_stack_buffer) - 1] = '\0';
            fprintf(stderr, "[orc_alloc] #%" PRIu64 " callstack (attempt):\n%s\n", alloc_id, pre_stack_buffer);
        }
        log_memory_usage("before large alloc");
    }

    void* ptr = nullptr;
    if (alignment > 0) {
        ptr = memalign(alignment, size);
    } else {
        ptr = std::malloc(size);
    }

    if (ptr == nullptr) {
        fprintf(stderr, "[orc_alloc] #%" PRIu64 " %s failed size=%zu align=%zu\n", alloc_id, kind, size, alignment);
        log_memory_usage("alloc failure");
        dump_allocation_summary(alloc_id);
        char stack_buffer[4096] = {0};
        int written = emscripten_get_callstack(EM_LOG_C_STACK | EM_LOG_JS_STACK, stack_buffer, static_cast<int>(sizeof(stack_buffer)));
        if (written > 0) {
            stack_buffer[sizeof(stack_buffer) - 1] = '\0';
            fprintf(stderr, "[orc_alloc] #%" PRIu64 " callstack (failure):\n%s\n", alloc_id, stack_buffer);
        }
        errno = ENOMEM;
        if (!nothrow) {
            throw std::bad_alloc();
        }
    }

    record_allocation(ptr, size, alignment, alloc_id, kind);

    return ptr;
}

static void instrumented_deallocate(void* ptr, const char* kind) noexcept
{
    record_free(ptr, kind);
    std::free(ptr);
}

} // namespace

void* operator new(std::size_t size)
{
    return instrumented_allocate(size, 0, false, "operator new");
}

void* operator new[](std::size_t size)
{
    return instrumented_allocate(size, 0, false, "operator new[]");
}

void* operator new(std::size_t size, const std::nothrow_t&) noexcept
{
    return instrumented_allocate(size, 0, true, "operator new (nothrow)");
}

void* operator new[](std::size_t size, const std::nothrow_t&) noexcept
{
    return instrumented_allocate(size, 0, true, "operator new[] (nothrow)");
}

#if defined(__cpp_aligned_new)
void* operator new(std::size_t size, std::align_val_t alignment)
{
    return instrumented_allocate(size, static_cast<std::size_t>(alignment), false, "operator new aligned");
}

void* operator new[](std::size_t size, std::align_val_t alignment)
{
    return instrumented_allocate(size, static_cast<std::size_t>(alignment), false, "operator new[] aligned");
}

void* operator new(std::size_t size, std::align_val_t alignment, const std::nothrow_t&) noexcept
{
    return instrumented_allocate(size, static_cast<std::size_t>(alignment), true, "operator new aligned (nothrow)");
}

void* operator new[](std::size_t size, std::align_val_t alignment, const std::nothrow_t&) noexcept
{
    return instrumented_allocate(size, static_cast<std::size_t>(alignment), true, "operator new[] aligned (nothrow)");
}
#endif

void operator delete(void* ptr) noexcept
{
    instrumented_deallocate(ptr, "operator delete");
}

void operator delete[](void* ptr) noexcept
{
    instrumented_deallocate(ptr, "operator delete[]");
}

#if defined(__cpp_sized_deallocation)
void operator delete(void* ptr, std::size_t) noexcept
{
    instrumented_deallocate(ptr, "operator delete sized");
}

void operator delete[](void* ptr, std::size_t) noexcept
{
    instrumented_deallocate(ptr, "operator delete[] sized");
}
#endif

#if defined(__cpp_aligned_new)
void operator delete(void* ptr, std::align_val_t) noexcept
{
    instrumented_deallocate(ptr, "operator delete aligned");
}

void operator delete[](void* ptr, std::align_val_t) noexcept
{
    instrumented_deallocate(ptr, "operator delete[] aligned");
}

#if defined(__cpp_sized_deallocation)
void operator delete(void* ptr, std::size_t, std::align_val_t) noexcept
{
    instrumented_deallocate(ptr, "operator delete sized aligned");
}

void operator delete[](void* ptr, std::size_t, std::align_val_t) noexcept
{
    instrumented_deallocate(ptr, "operator delete[] sized aligned");
}
#endif
#endif // __cpp_aligned_new

#endif // __EMSCRIPTEN__

// Include Orca slicer headers
#include "libslic3r/libslic3r_version.h"
#include "../orca/src/libslic3r/TriangleMesh.hpp"
#include "../orca/src/libslic3r/Model.hpp"
#include "../orca/src/libslic3r/Print.hpp"
#include "../orca/src/libslic3r/PrintConfig.hpp"
#include "../orca/src/libslic3r/GCode.hpp"
#include "../orca/src/libslic3r/Format/STL.hpp"
#include "../orca/src/libslic3r/PresetBundle.hpp"
#include "../orca/src/libslic3r/BoundingBox.hpp"
#include "../orca/src/libslic3r/Utils.hpp"

using namespace Slic3r;

static bool g_dump_config = false;

static void ensure_resources_initialized()
{
    static bool initialized = false;
    if (initialized) {
        return;
    }

    set_resources_dir("/resources");
    set_var_dir("/resources/images");
    set_local_dir("/resources/i18n");
    set_sys_shapes_dir("/resources/shapes");
    set_custom_gcodes_dir("/resources/custom_gcodes");
    set_temporary_dir("/tmp");

    initialized = true;
}

static bool payload_requests_config_dump(const uint8_t *cfg, int len)
{
    if (cfg == nullptr || len <= 0) {
        return false;
    }
    try {
        std::string payload(reinterpret_cast<const char*>(cfg), static_cast<size_t>(len));
        if (payload.find("dumpConfig") != std::string::npos) {
            return payload.find("true") != std::string::npos || payload.find('1') != std::string::npos;
        }
        if (payload.find("dump-config") != std::string::npos) {
            return true;
        }
    } catch (...) {
        // Ignore malformed payloads; fallback to env below.
    }
    return false;
}

static const char* option_type_name(ConfigOptionType type)
{
    switch (type) {
    case coNone: return "coNone";
    case coFloat: return "coFloat";
    case coFloats: return "coFloats";
    case coInt: return "coInt";
    case coInts: return "coInts";
    case coString: return "coString";
    case coStrings: return "coStrings";
    case coPercent: return "coPercent";
    case coPercents: return "coPercents";
    case coFloatOrPercent: return "coFloatOrPercent";
    case coFloatsOrPercents: return "coFloatsOrPercents";
    case coPoint: return "coPoint";
    case coPoints: return "coPoints";
    case coPoint3: return "coPoint3";
    case coBool: return "coBool";
    case coBools: return "coBools";
    case coEnum: return "coEnum";
    case coEnums: return "coEnums";
    default: return "unknown";
    }
}

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

// Emit a concise config summary focused on tweaks applied for the WASM build.
static void log_config(const DynamicPrintConfig& config) {
    fprintf(stderr, "[orc_slice] config dump begin\n");
    std::vector<std::string> keys = config.keys();
    std::sort(keys.begin(), keys.end());
    for (const std::string &key : keys) {
        if (const ConfigOption* opt = config.optptr(key)) {
            std::string serialized = opt->serialize();
            fprintf(stderr, "  %s = %s\n", key.c_str(), serialized.c_str());
        }
    }
    fprintf(stderr, "[orc_slice] config dump end\n");
    fflush(stderr);
}

template <typename OptionT, typename ValueT>
static void assign_vector_values(OptionT *opt, const std::vector<ValueT> &values, ValueT fallback)
{
    auto &target = opt->values;
    if (values.empty()) {
        if (target.empty()) {
            target.assign(1, fallback);
        } else {
            std::fill(target.begin(), target.end(), fallback);
        }
    } else if (values.size() == 1 && target.size() > 1) {
        std::fill(target.begin(), target.end(), values.front());
    } else {
        target = values;
    }
    if (target.empty()) {
        target.assign(1, fallback);
    }
}

static bool set_bool_option(DynamicPrintConfig &config, const char *key, bool value)
{
    if (auto *opt = config.opt<ConfigOptionBool>(key, true)) {
        opt->value = value;
        return true;
    }
    unsigned char stored = value ? 1 : 0;
    if (auto *opt_vec = config.opt<ConfigOptionBools>(key, true)) {
        auto &target = opt_vec->values;
        if (target.empty()) {
            target.assign(1, stored);
        } else {
            std::fill(target.begin(), target.end(), stored);
        }
        return true;
    }
    if (auto *opt_vec_nullable = config.opt<ConfigOptionBoolsNullable>(key, true)) {
        auto &target = opt_vec_nullable->values;
        if (target.empty()) {
            target.assign(1, stored);
        } else {
            std::fill(target.begin(), target.end(), stored);
        }
        return true;
    }
    return false;
}

static bool set_int_vector_option(DynamicPrintConfig &config, const char *key, const std::vector<int> &values)
{
    if (auto *opt = config.opt<ConfigOptionInts>(key, true)) {
        assign_vector_values(opt, values, 0);
        return true;
    }
    if (auto *opt_nullable = config.opt<ConfigOptionIntsNullable>(key, true)) {
        assign_vector_values(opt_nullable, values, 0);
        return true;
    }
    if (values.size() == 1) {
        if (auto *opt_scalar = config.opt<ConfigOptionInt>(key, true)) {
            opt_scalar->value = values.front();
            return true;
        }
    }
    return false;
}

static bool set_int_option(DynamicPrintConfig &config, const char *key, int value)
{
    return set_int_vector_option(config, key, std::vector<int>{value});
}

static bool set_float_vector_option(DynamicPrintConfig &config, const char *key, const std::vector<double> &values)
{
    if (auto *opt = config.opt<ConfigOptionFloats>(key, true)) {
        assign_vector_values(opt, values, 0.0);
        return true;
    }
    if (auto *opt_nullable = config.opt<ConfigOptionFloatsNullable>(key, true)) {
        assign_vector_values(opt_nullable, values, 0.0);
        return true;
    }
    if (values.size() == 1) {
        if (auto *opt_scalar = config.opt<ConfigOptionFloat>(key, true)) {
            opt_scalar->value = values.front();
            return true;
        }
    }
    return false;
}

static bool set_float_option(DynamicPrintConfig &config, const char *key, double value)
{
    if (auto *opt = config.opt<ConfigOptionFloat>(key, true)) {
        opt->value = value;
        return true;
    }
    return set_float_vector_option(config, key, std::vector<double>{value});
}

static bool set_percent_option(DynamicPrintConfig &config, const char *key, double value)
{
    if (auto *opt = config.opt<ConfigOptionPercent>(key, true)) {
        opt->value = value;
        return true;
    }
    if (auto *opt_vec = config.opt<ConfigOptionPercents>(key, true)) {
        assign_vector_values(opt_vec, std::vector<double>{value}, 0.0);
        return true;
    }
    if (auto *opt_vec_nullable = config.opt<ConfigOptionPercentsNullable>(key, true)) {
        assign_vector_values(opt_vec_nullable, std::vector<double>{value}, 0.0);
        return true;
    }
    return set_float_option(config, key, value);
}

template <typename EnumT>
static bool set_enum_option(DynamicPrintConfig &config, const char *key, EnumT value)
{
    if (auto *opt = config.opt<ConfigOptionEnum<EnumT>>(key, true)) {
        opt->value = value;
        return true;
    }
    if (auto *opt_generic = config.opt<ConfigOptionEnumGeneric>(key, true)) {
        opt_generic->value = static_cast<int>(value);
        return true;
    }
    return false;
}

static bool set_float_or_percent_option(DynamicPrintConfig &config, const char *key, double value, bool percent = false)
{
    if (auto *opt = config.opt<ConfigOptionFloatOrPercent>(key, true)) {
        opt->value = value;
        opt->percent = percent;
        return true;
    }
    const FloatOrPercent fp{value, percent};
    if (auto *opt_vec = config.opt<ConfigOptionFloatsOrPercents>(key, true)) {
        auto &target = opt_vec->values;
        if (target.empty()) {
            target.assign(1, fp);
        } else {
            std::fill(target.begin(), target.end(), fp);
        }
        return true;
    }
    if (auto *opt_vec_nullable = config.opt<ConfigOptionFloatsOrPercentsNullable>(key, true)) {
        auto &target = opt_vec_nullable->values;
        if (target.empty()) {
            target.assign(1, fp);
        } else {
            std::fill(target.begin(), target.end(), fp);
        }
        return true;
    }
    return false;
}

static bool set_string_option(DynamicPrintConfig &config, const char *key, const std::string &value)
{
    if (auto *opt = config.opt<ConfigOptionString>(key, true)) {
        opt->value = value;
        return true;
    }
    if (auto *opt_vec = config.opt<ConfigOptionStrings>(key, true)) {
        auto &target = opt_vec->values;
        if (target.empty()) {
            target.assign(1, value);
        } else {
            std::fill(target.begin(), target.end(), value);
        }
        return true;
    }
    return false;
}

// Simple default config
static DynamicPrintConfig get_default_config() {
    // Seed with the full preset so overrides match real option types.
    DynamicPrintConfig config;
    config.apply(FullPrintConfig::defaults());
    config.set_num_extruders(1);
    config.set_num_filaments(1);

    auto ensure = [&](bool ok, const char *key) {
        if (!ok) {
            const DynamicPrintConfig &cfg_const = config;
            const ConfigOption *existing = cfg_const.option(key);
            if (existing == nullptr) {
                const auto &defaults = FullPrintConfig::defaults();
                existing = defaults.option(key);
            }
            const char *type_name = existing ? option_type_name(existing->type()) : "missing";
            fprintf(stderr, "[orc_slice] warning: failed to override %s (type=%s)\n", key, type_name);
        }
    };

    ensure(set_float_option(config, "layer_height", 0.2), "layer_height");
    ensure(set_percent_option(config, "sparse_infill_density", 0.0), "sparse_infill_density");
    ensure(set_int_option(config, "wall_loops", 2), "wall_loops");
    ensure(set_int_option(config, "top_shell_layers", 0), "top_shell_layers");
    ensure(set_int_option(config, "bottom_shell_layers", 0), "bottom_shell_layers");
    ensure(set_bool_option(config, "enable_support", false), "enable_support");
    ensure(set_int_option(config, "skirt_loops", 0), "skirt_loops");
    ensure(set_float_option(config, "brim_width", 0.0), "brim_width");
    ensure(set_enum_option(config, "wall_generator", PerimeterGeneratorType::Classic), "wall_generator");
    ensure(set_enum_option(config, "ensure_vertical_shell_thickness", EnsureVerticalShellThickness::evstNone), "ensure_vertical_shell_thickness");
    ensure(set_bool_option(config, "precise_outer_wall", false), "precise_outer_wall");
    ensure(set_bool_option(config, "thick_internal_bridges", false), "thick_internal_bridges");

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
    ensure_resources_initialized();
    g_dump_config = payload_requests_config_dump(cfg, len);
    if (!g_dump_config && std::getenv("ORC_DUMP_CONFIG")) {
        g_dump_config = true;
    }
    return 0;
}

// Slice: model bytes in, gcode out
__attribute__((used)) int orc_slice(const uint8_t* model, int len,
                                   uint8_t** gcode_out, int* gcode_len) {
    ensure_resources_initialized();
    try {
        fprintf(stderr, "[orc_slice] start len=%d\n", len);
        fflush(stderr);
        // 1) Load model from buffer
        Model orca_model;
        if (!load_stl_from_buffer(model, len, orca_model)) {
            fprintf(stderr, "[orc_slice] load_stl_from_buffer failed\n");
            fflush(stderr);
            return -1; // Failed to load
        }

        if (orca_model.objects.empty()) {
            fprintf(stderr, "[orc_slice] model empty\n");
            fflush(stderr);
            return -2; // No objects in model
        }

        const BoundingBoxf3 bbox = orca_model.bounding_box_exact();
        const Vec3d dims = bbox.size();
        const double min_dim = std::min({dims.x(), dims.y(), dims.z()});
        if (min_dim > 0.0 && min_dim < 0.5) {
            const double target = 20.0;
            const double scale_factor = target / std::max(min_dim, 1e-3);
            fprintf(stderr, "[orc_slice] auto-scaling model by %.3fx to reach %.1fmm min dimension\n", scale_factor, target);
            fflush(stderr);
            for (ModelObject *object : orca_model.objects) {
                if (object != nullptr) {
                    object->scale(scale_factor);
                }
            }
        }

        if (!orca_model.add_default_instances()) {
            fprintf(stderr, "[orc_slice] add_default_instances failed\n");
            fflush(stderr);
            return -2;
        }

        // 2) Create print with default config
        DynamicPrintConfig config = get_default_config();
        auto update_object_counts = [&]() {
            int printable_objects = 0;
            int printable_instances = 0;
            for (ModelObject *object : orca_model.objects) {
                if (object == nullptr) {
                    continue;
                }
                bool has_printable_instance = false;
                for (ModelInstance *instance : object->instances) {
                    if (instance != nullptr && instance->is_printable()) {
                        has_printable_instance = true;
                        ++printable_instances;
                    }
                }
                if (has_printable_instance) {
                    ++printable_objects;
                }
            }
            if (!set_int_option(config, "num_objects", printable_objects)) {
                fprintf(stderr, "[orc_slice] warning: failed to seed num_objects option (value=%d)\n", printable_objects);
            }
            if (!set_int_option(config, "num_instances", printable_instances)) {
                fprintf(stderr, "[orc_slice] warning: failed to seed num_instances option (value=%d)\n", printable_instances);
            }
        };
        update_object_counts();
        const bool dump_config = g_dump_config || (std::getenv("ORC_DUMP_CONFIG") != nullptr);
        if (dump_config) {
            log_config(config);
        }
        Print print;
        print.set_status_callback([](const PrintBase::SlicingStatus& status) {
            if (status.percent >= 0) {
                fprintf(stderr, "[orc_slice] status %d%% %s\n", status.percent, status.text.c_str());
            } else {
                fprintf(stderr, "[orc_slice] status %s\n", status.text.c_str());
            }
            fflush(stderr);
        });
    fprintf(stderr, "[orc_slice] applying config\n");
        fflush(stderr);
    log_memory_usage("before apply");
    print.apply(orca_model, config);
    log_memory_usage("after apply");

        // 3) Process (slice)
        fprintf(stderr, "[orc_slice] processing\n");
        fflush(stderr);
    log_memory_usage("before process");
    const double process_start_ms = now_ms();
        print.process();
    const double process_ms = now_ms() - process_start_ms;
        fprintf(stderr, "[orc_slice] process complete\n");
        fflush(stderr);
    log_memory_usage("after process");
    fprintf(stderr, "[orc_slice] process wall_time_ms=%.2f\n", process_ms);
    fflush(stderr);

        // 4) Generate G-code into a temporary file and read it back
        GCode gcode_generator;
        const Vec3d plate_origin = print.get_plate_origin();
        gcode_generator.set_gcode_offset(plate_origin(0), plate_origin(1));
        fprintf(stderr, "[orc_slice] exporting gcode\n");
        fflush(stderr);
    log_memory_usage("before export");
    const double export_start_ms = now_ms();

        const std::string temp_gcode_path = "/tmp/wasm_output.gcode";
        const auto remove_temp_file = [&]() { unlink(temp_gcode_path.c_str()); };
        gcode_generator.do_export(&print, temp_gcode_path.c_str());
    const double export_ms = now_ms() - export_start_ms;
    fprintf(stderr, "[orc_slice] export complete wall_time_ms=%.2f\n", export_ms);
    fflush(stderr);
    log_memory_usage("after export");

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

    } catch (const std::exception& e) {
        fprintf(stderr, "[orc_slice] exception: %s\n", e.what());
        fflush(stderr);
        return -4; // Exception
    } catch (...) {
        fprintf(stderr, "[orc_slice] unknown exception\n");
        fflush(stderr);
        return -4; // Exception
    }
}

__attribute__((used)) void orc_free(void* p) {
    free(p);
}

__attribute__((used)) const char* orc_decode_exception(void* exception_ptr)
{
    static std::string last_exception_message;
    if (exception_ptr == nullptr) {
        last_exception_message = "(null exception)";
        return last_exception_message.c_str();
    }

    try {
        const std::exception* ex = reinterpret_cast<const std::exception*>(exception_ptr);
        if (ex != nullptr) {
            last_exception_message = ex->what();
            if (last_exception_message.empty()) {
                last_exception_message = "(empty exception message)";
            }
        } else {
            last_exception_message = "(exception pointer not std::exception)";
        }
    } catch (...) {
        last_exception_message = "(failed to decode exception)";
    }

    return last_exception_message.c_str();
}

}
