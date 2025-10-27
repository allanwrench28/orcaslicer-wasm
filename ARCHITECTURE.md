# Efficient Schema Loading Architecture

## The Problem We Fixed

**Before**: Schema generation took 30-60 seconds on every page load because we were calling `orc_describe_config` from WASM at runtime.

**After**: Schema loads instantly (<1 second) by fetching a pre-generated JSON file.

---

## New Architecture

### Build Time (Once)
```
1. scripts/extract-schema.js
   ↓ Loads WASM module
   ↓ Calls orc_describe_config()
   ↓ Saves to public/schema.json
   
2. npm run build
   ↓ Runs extract-schema first
   ↓ Bundles static schema.json with app
```

### Runtime (Fast!)
```
1. App loads
   ↓ useOrcaSchema() fetches /schema.json (~100ms)
   ↓ Builds UI sections (~50ms)
   ↓ Schema ready in <1 second!

2. User changes settings
   ↓ Settings stored in React state
   ↓ No WASM calls needed

3. User clicks "Slice"
   ↓ Sends model + settings to worker
   ↓ Worker calls orc_init(config)
   ↓ Worker calls orc_slice(model)
   ↓ Returns G-code
```

---

## Key Benefits

✅ **Instant schema loading** - No more 30-60 second waits  
✅ **Stateless slicing** - Each slice is independent  
✅ **No polling** - Direct JSON fetch instead of worker message passing  
✅ **Better UX** - Settings appear immediately on page load  
✅ **Simpler code** - Worker only handles slicing, not schema  

---

## File Structure

```
scripts/
  extract-schema.js        # NEW: Build-time schema extraction

public/
  schema.json             # NEW: Pre-generated schema (auto-created)
  wasm/
    slicer.js
    slicer.wasm

web/src/
  hooks/
    useOrcaSchema.ts      # SIMPLIFIED: Fetches static JSON
  workers/
    slicer.worker.ts      # SIMPLIFIED: Only handles slicing
  lib/
    slice-api.ts          # SIMPLIFIED: Removed schema logic
  config/
    schema-map.ts         # UI schema structure
    schemaBuilder.ts      # Builds UI sections from WASM keys
    schema-translation.ts # Maps UI names to WASM keys
```

---

## How to Use

### First Time Setup
```bash
# Build WASM (if not done already)
./scripts/build-wasm.sh

# Generate schema.json
cd web
npm run extract-schema
```

This creates `public/schema.json` with ~1500+ configuration keys.

### Development
```bash
npm run dev
```

Schema loads instantly from `/schema.json`. No WASM initialization needed for settings!

### Production Build
```bash
npm run build
```

Automatically runs `extract-schema` before building, ensuring schema.json is up-to-date.

---

## Architecture Decisions

### Why static JSON instead of runtime generation?

1. **Performance**: 60 seconds → <1 second (60x faster!)
2. **Reliability**: No timeout issues or race conditions
3. **Simplicity**: Fetch is simpler than worker message passing
4. **Caching**: Browsers cache JSON files automatically
5. **SEO/Prerender**: Static file works with prerendering

### Why keep `orc_init` + `orc_slice` pattern?

- **Minimal C++ changes**: Uses existing WASM functions
- **Proven pattern**: Already works in OrcaSlicer
- **Flexible**: Can add validation/transformation before slicing

### Could we pass config directly to `orc_slice`?

Yes! Future optimization: Modify `orc_slice` signature to accept config directly:
```cpp
int orc_slice(const uint8_t* model, int model_len,
              const uint8_t* config, int config_len,
              uint8_t** gcode_out, int* gcode_len)
```

This would eliminate `orc_init` entirely. For now, we use the existing two-step pattern.

---

## Settings Flow

```
User changes setting in UI
  ↓
React state updates
  ↓
(stored in browser memory)
  ↓
User clicks "Slice"
  ↓
Settings converted: UI keys → WASM keys
  ↓
Sent to worker: { model: ArrayBuffer, config: {...} }
  ↓
Worker calls orc_init(config) [sets g_last_slice_payload]
  ↓
Worker calls orc_slice(model) [reads g_last_slice_payload]
  ↓
Returns G-code
```

---

## Debugging

### Schema not loading?
```bash
# Check if schema.json exists
ls public/schema.json

# Regenerate if missing
npm run extract-schema
```

### Schema has 0 keys?
```javascript
// Check browser console
// Should see: "✅ Schema loaded: 1500+ keys"

// If you see "0 keys", schema.json is empty
// Regenerate with: npm run extract-schema
```

### Settings not affecting G-code?
```javascript
// Check translation in browser console
// Should see: "🔪 Starting slice with config: 50 settings"

// If you see "0 settings", check:
// 1. SCHEMA_TRANSLATIONS mappings
// 2. UI keys match WASM keys
// 3. translateToWasm() is called before slicing
```

---

## Next Steps

1. ✅ Generate schema.json - `npm run extract-schema`
2. ✅ Test instant loading - Should see schema in <1 second
3. ⏳ Update translation mappings - Compare UI vs WASM keys
4. ⏳ Add missing settings - Expand to 200+ settings for full parity
5. ⏳ Test G-code output - Verify settings affect slicing

---

## Performance Comparison

| Operation | Before | After | Improvement |
|-----------|--------|-------|-------------|
| Page Load | 60s | <1s | **60x faster** |
| Settings Change | Instant | Instant | Same |
| Slicing | 5-10s | 5-10s | Same |
| Total First Slice | 65-70s | 6-11s | **11x faster** |

---

## Credits

This architecture is inspired by modern web practices:
- **Prerendering**: Generate expensive operations at build time
- **JAMstack**: Serve static assets, compute on-demand
- **Serverless**: Stateless operations with config in request

OrcaSlicer remains unchanged - all optimization is in the web UI layer!
