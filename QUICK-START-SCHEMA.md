# Quick Start: Finding WASM Schema Keys

## Step 1: Open the Browser Console

1. Navigate to http://localhost:5174 (or whatever port Vite is using)
2. Press **F12** to open Developer Tools
3. Click the **Console** tab

## Step 2: Look for Debug Output

You should see these log entries:

```
🔍 WASM Schema Keys (sorted): 
  [Array with all available settings keys]

🔍 Sample WASM Schema Entries: 
  [First 20 entries showing key names and their config]

📊 Schema built: X sections, Y fields, Z translations
```

## Step 3: Inspect the Keys

### Option A: In the Console Log

Click the arrow next to the array to expand it and see all keys alphabetically sorted.

### Option B: Interactive Search

In the console, type these commands:

```javascript
// See all keys
Object.keys(window.__wasmSchema || {}).sort()

// Search for specific settings
Object.keys(window.__wasmSchema || {}).filter(k => k.includes('infill'))
Object.keys(window.__wasmSchema || {}).filter(k => k.includes('wall'))
Object.keys(window.__wasmSchema || {}).filter(k => k.includes('layer'))
Object.keys(window.__wasmSchema || {}).filter(k => k.includes('speed'))
Object.keys(window.__wasmSchema || {}).filter(k => k.includes('support'))
Object.keys(window.__wasmSchema || {}).filter(k => k.includes('temperature'))
```

## Step 4: Compare with UI Names

Check if WASM keys match our UI names in `schema-map.ts`:

**Example comparison:**

| UI Name (schema-map.ts) | Need to find WASM key |
|-------------------------|------------------------|
| `wall_loops` | Search: `...filter(k => k.includes('wall'))` |
| `sparse_infill_density` | Search: `...filter(k => k.includes('infill'))` |
| `layer_height` | Search: `...filter(k => k.includes('layer'))` |

## Step 5: Update Translation Map

If WASM uses different names, update `schema-translation.ts`:

```typescript
// Example: If WASM uses "perimeters" instead of "wall_loops"
{ 
  uiKey: 'wall_loops',         // What users see in UI
  wasmKey: 'perimeters'        // What WASM expects
}
```

## Common Patterns to Look For

WASM keys might use:
- **Shorter names**: `perim` instead of `perimeter`
- **Different words**: `fill` instead of `infill`
- **Underscores vs no underscores**: `layerheight` vs `layer_height`
- **Prefixes**: `print_` or `printer_` prefix
- **Legacy PrusaSlicer names**: OrcaSlicer is forked from PrusaSlicer

## What to Do Next

1. ✅ **Note the differences** between UI names and WASM names
2. ✅ **Update `schema-translation.ts`** with the correct mappings
3. ✅ **Reload the browser** (Ctrl+R)
4. ✅ **Check that settings appear** in the left sidebar
5. ✅ **Slice a model** and verify settings are applied

## Troubleshooting

### "WASM Schema Keys" not showing in console?

- WASM might not be loaded yet. Wait a few seconds and refresh.
- Check for errors in console (red text)
- Verify the dev server is running: `npm run dev`

### Can't find a specific setting?

Try broader searches:
```javascript
// See ALL keys
Object.keys(window.__wasmSchema || {})

// Count them
Object.keys(window.__wasmSchema || {}).length

// Search with partial match
Object.keys(window.__wasmSchema || {}).filter(k => k.includes('temp'))
```

### Settings still not appearing in UI?

Check these files:
1. `schema-translation.ts` - Does the uiKey match your wasmKey?
2. `schema-map.ts` - Is the FIELD_MAPPINGS entry using the UI key?
3. Console - Are there warnings about "Unmapped schema key"?

## Example Real Output

When you open the console, you might see something like:

```
🔍 WASM Schema Keys (sorted): 
  (300) ["bed_temperature", "bed_temperature_initial_layer", "brim_width", 
   "fan_min_speed", "fan_max_speed", "fill_density", "first_layer_height", 
   "layer_height", "perimeters", "nozzle_temperature", ...]

🔍 Sample WASM Schema Entries: 
  [
    ["layer_height", {type: "float", default_value: 0.2, min: "0.05", max: "0.4", ...}],
    ["perimeters", {type: "int", default_value: 3, min: "0", max: "100", ...}],
    ["fill_density", {type: "percent", default_value: 20, min: "0", max: "100", ...}],
    ...
  ]
```

This tells you:
- ✅ `layer_height` → Same name in WASM (no translation needed)
- ⚠️ `perimeters` → We call it `wall_loops` (translation needed!)
- ⚠️ `fill_density` → We call it `sparse_infill_density` (translation needed!)
