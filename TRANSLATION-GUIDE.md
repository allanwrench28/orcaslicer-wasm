# OrcaSlicer Web Translation Layer Guide

## Overview

The Web UI now uses **OrcaSlicer's exact naming** for all settings in the interface, while automatically translating to whatever keys the WASM module expects behind the scenes. This ensures the UI looks and feels like OrcaSlicer while maintaining compatibility with the WASM backend.

## Architecture

```
┌─────────────────┐
│   UI (React)    │  Uses OrcaSlicer names
│                 │  (e.g., "wall_loops", "sparse_infill_density")
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Translation     │  Maps UI keys ↔ WASM keys
│ Layer           │  (schema-translation.ts)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ WASM Module     │  Uses internal keys
│                 │  (e.g., "perimeters", "fill_density")
└─────────────────┘
```

## How It Works

### 1. Schema Loading (useOrcaSchema.ts)

When the app starts, it:
1. Loads the WASM schema containing all available settings
2. **NEW**: Logs the actual WASM keys to browser console
3. Translates WASM keys to UI-friendly names
4. Builds the settings panel structure

### 2. Settings Display (App.tsx)

The UI displays settings using OrcaSlicer naming:
- `wall_loops` → "Wall Loops" 
- `sparse_infill_density` → "Infill Density"
- `nozzle_temperature` → "Nozzle Temperature"

### 3. Settings Translation (Before Slicing)

When you click "Slice":
```typescript
// UI settings (what you see)
{
  "wall_loops": 3,
  "sparse_infill_density": 20,
  "layer_height": 0.2
}

// Automatically translated to WASM format
{
  "perimeters": 3,           // ← translated
  "fill_density": 20,        // ← translated
  "layer_height": 0.2        // ← same key
}
```

## Finding Actual WASM Keys

### Method 1: Browser Console (Automatic)

Open the web app and check the **browser console** (F12 → Console tab). You'll see:

```
🔍 WASM Schema Keys (sorted): [Array of all keys]
🔍 Sample WASM Schema Entries: [First 20 entries with details]
📊 Schema built: X sections, Y fields, Z translations
```

### Method 2: Manual Inspection

In the browser console, type:
```javascript
// Get all WASM keys
Object.keys(window.__wasmSchema).sort()

// Search for specific settings
Object.keys(window.__wasmSchema).filter(k => k.includes('infill'))
Object.keys(window.__wasmSchema).filter(k => k.includes('wall'))
Object.keys(window.__wasmSchema).filter(k => k.includes('speed'))
```

## Adding New Settings

### Step 1: Find the WASM Key

Check the console output or use the search methods above.

Example: Looking for "seam position" setting:
```javascript
Object.keys(window.__wasmSchema).filter(k => k.includes('seam'))
// Returns: ["seam_position", "seam_gap", ...]
```

### Step 2: Add to Translation Map

Edit `web/src/config/schema-translation.ts`:

```typescript
export const SCHEMA_TRANSLATIONS: TranslationRule[] = [
  // ... existing rules ...
  
  // Add new translation
  { 
    uiKey: 'seam_position',      // OrcaSlicer UI name
    wasmKey: 'seam_pos'          // Actual WASM key (if different)
  },
  
  // If keys are identical, still add it for documentation
  { 
    uiKey: 'seam_position', 
    wasmKey: 'seam_position' 
  },
];
```

### Step 3: Add UI Mapping

Edit `web/src/config/schema-map.ts`:

```typescript
export const FIELD_MAPPINGS: Partial<Record<string, Omit<SchemaField, 'key'>>> = {
  // ... existing mappings ...
  
  'seam_position': {
    displayName: 'Seam Position',
    section: 'process_quality',
    category: 'process',
    type: 'enum',
    order: 11,
    options: ['random', 'nearest', 'aligned', 'rear'],
    tooltip: 'Position of the Z seam'
  },
};
```

### Step 4: Test

1. Reload the app
2. Check that the setting appears in the UI
3. Change its value
4. Click "Slice"
5. Check console: Should see both UI and translated WASM settings logged

## Common WASM Key Patterns

Based on OrcaSlicer's C++ codebase, common naming conventions:

### Likely Translations Needed:
| UI Name (OrcaSlicer) | Possible WASM Key |
|----------------------|-------------------|
| `wall_loops` | `perimeters` or `wall_count` |
| `sparse_infill_density` | `fill_density` or `infill_sparse_density` |
| `sparse_infill_pattern` | `fill_pattern` |
| `top_shell_layers` | `top_solid_layers` |
| `bottom_shell_layers` | `bottom_solid_layers` |
| `initial_layer_height` | `first_layer_height` |
| `initial_layer_speed` | `first_layer_speed` |

### Likely Same Keys:
| UI Name | WASM Key (probably same) |
|---------|--------------------------|
| `layer_height` | `layer_height` |
| `nozzle_diameter` | `nozzle_diameter` |
| `bed_temperature` | `bed_temperature` |
| `retraction_length` | `retraction_length` |

## Debugging Translation Issues

### Symptom: Settings don't appear in UI

**Cause**: The WASM schema doesn't have that key at all.

**Solution**: 
1. Check console for actual WASM keys
2. Find the correct key name
3. Update `SCHEMA_TRANSLATIONS` mapping

### Symptom: Settings appear but don't affect G-code

**Cause**: Translation might be incorrect or WASM is ignoring the setting.

**Debug**:
1. Check console when slicing - should see both UI and WASM settings
2. Compare WASM settings to what WASM expects
3. Verify the key name is correct

Example console output when slicing:
```
UI settings: {wall_loops: 3, sparse_infill_density: 20, ...}
Translated WASM settings: {perimeters: 3, fill_density: 20, ...}
```

### Symptom: Type mismatch errors

**Cause**: UI sends wrong data type (e.g., string instead of number).

**Solution**: Add transform function in translation:
```typescript
{ 
  uiKey: 'infill_density', 
  wasmKey: 'fill_density',
  transform: (value) => parseFloat(value) / 100  // Convert 20% to 0.2
}
```

## File Reference

### Core Translation Files:
- `web/src/config/schema-translation.ts` - Translation rules (UI ↔ WASM)
- `web/src/config/schema-map.ts` - UI display config (labels, tooltips, sections)
- `web/src/config/schemaBuilder.ts` - Combines WASM schema + UI config

### Usage Points:
- `web/src/hooks/useOrcaSchema.ts` - Loads schema, logs WASM keys
- `web/src/App.tsx` - Applies translation before slicing
- `web/src/workers/slicer.worker.ts` - Receives translated settings

## Next Steps

1. **Open browser console** (F12) and check the logged WASM keys
2. **Compare** WASM keys to our UI names in `FIELD_MAPPINGS`
3. **Update** `SCHEMA_TRANSLATIONS` with correct mappings
4. **Test** by changing settings and checking G-code output

## Example Workflow

```bash
# 1. Start dev server
cd web
npm run dev

# 2. Open http://localhost:5174 in browser
# 3. Open browser console (F12)
# 4. Look for: "🔍 WASM Schema Keys"
# 5. Copy the keys you need
# 6. Update schema-translation.ts and schema-map.ts
# 7. Refresh browser and test
```

## Benefits of This Approach

✅ **UI matches OrcaSlicer** - Users see familiar setting names  
✅ **Maintainable** - Translation layer is centralized  
✅ **Flexible** - Easy to add new settings or fix mappings  
✅ **Debuggable** - Console logs show both UI and WASM values  
✅ **Future-proof** - If WASM keys change, only update translations
