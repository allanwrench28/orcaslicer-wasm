# Profile Library Integration Plan

## Overview
Integrate OrcaSlicer's extensive printer/filament library (~100 manufacturers, 1000+ profiles) into the web UI.

## File Structure in orca/resources/profiles/

```
profiles/
├── {Vendor}.json              # Vendor index file
└── {Vendor}/                  # Vendor directory
    ├── machine/               # Printer profiles
    │   ├── {Printer Model}.json         # Base model definition
    │   └── {Printer} {nozzle}.json      # Variant with specific nozzle
    ├── filament/              # Filament profiles  
    │   └── {Brand} {Type} @{Printer}.json
    ├── process/               # Print quality profiles
    │   └── {Quality} @{Printer} {nozzle}.json
    └── *_cover.png            # Printer thumbnail images
```

## Key File Types

### 1. Vendor Index (.json at root)
```json
{
  "name": "Creality",
  "version": "02.03.01.10",
  "machine_model_list": [
    { "name": "Creality Ender-3 V3 SE", "sub_path": "machine/..." }
  ],
  "filament_list": [...],
  "process_list": [...]
}
```

### 2. Machine Model Definition
```json
{
  "type": "machine_model",
  "name": "Creality Ender-3 V3 SE",
  "model_id": "Creality-Ender3-V3-SE",
  "nozzle_diameter": "0.2;0.4;0.6;0.8",
  "bed_model": "creality_ender3v3se_buildplate_model.stl",
  "bed_texture": "creality_ender3v3se_buildplate_texture.png",
  "default_materials": "..."
}
```

### 3. Machine Variant (specific nozzle)
```json
{
  "type": "machine",
  "name": "Creality Ender-3 V3 SE 0.4 nozzle",
  "inherits": "fdm_creality_common",
  "printer_model": "Creality Ender-3 V3 SE",
  "printer_variant": "0.4",
  "nozzle_diameter": ["0.4"],
  "printable_area": ["0x0", "220x0", "220x220", "0x220"],
  "printable_height": "250",
  "retraction_length": ["1.2"],
  "machine_start_gcode": "...",
  "machine_end_gcode": "...",
  "machine_max_acceleration_x": ["2500"],
  ...
}
```

### 4. Filament Profile
```json
{
  "type": "filament",
  "name": "Creality Generic PLA @Ender-3V3-all",
  "inherits": "Creality Generic PLA",
  "nozzle_temperature": ["210"],
  "bed_temperature": ["60"],
  "filament_max_volumetric_speed": ["18"],
  "compatible_printers": ["Creality Ender-3 V3 SE 0.4 nozzle", ...]
}
```

## Implementation Strategy

### Phase 1: Build-Time Profile Extraction (scripts/extract-profiles.js)

1. **Parse all vendor index files** (`*.json` at root level)
2. **Resolve inheritance chains** (fdm_creality_common → base profiles)
3. **Generate consolidated JSON** for web distribution
4. **Copy essential assets** (cover images, build plate textures)

Output: `web/public/profiles.json` (~2-5 MB compressed)

```json
{
  "vendors": [
    {
      "name": "Creality",
      "printers": [
        {
          "id": "creality-ender3v3se",
          "name": "Creality Ender-3 V3 SE",
          "variants": [
            {
              "nozzle": 0.4,
              "config": { /* merged settings */ },
              "startGcode": "...",
              "endGcode": "...",
              "defaultFilaments": ["..."]
            }
          ]
        }
      ],
      "filaments": [...],
      "processes": [...]
    }
  ]
}
```

### Phase 2: Web UI Components

#### A. Printer Selector Component
```tsx
<PrinterSelector 
  onSelect={(printer, variant) => loadPrinterProfile(printer, variant)}
  vendors={profileLibrary.vendors}
/>
```

Features:
- Searchable dropdown by vendor/model
- Nozzle size selector
- Printer thumbnail preview
- "Recently used" section

#### B. Filament Selector Component  
```tsx
<FilamentSelector
  compatibleWith={selectedPrinter}
  onSelect={(filament) => loadFilamentProfile(filament)}
/>
```

Features:
- Filter by material type (PLA/PETG/ABS/TPU)
- Filter by brand
- Show compatible printers only
- Color indicator (if available)

#### C. Quality Preset Selector
```tsx
<QualityPresetSelector
  printer={selectedPrinter}
  filament={selectedFilament}
  onSelect={(preset) => loadProcessProfile(preset)}
/>
```

Presets:
- Draft (0.28mm, fast)
- Standard (0.20mm)
- Fine (0.12mm, slow)
- Custom (user-defined)

### Phase 3: Profile Merge Logic

```typescript
function buildFinalConfig(
  printer: PrinterProfile,
  filament: FilamentProfile,
  process: ProcessProfile,
  userOverrides: Partial<SlicerConfig>
): SlicerConfig {
  // Merge order (lowest to highest priority):
  // 1. Default base settings
  // 2. Printer settings (machine limits, start/end gcode)
  // 3. Filament settings (temps, speeds)
  // 4. Process settings (layer height, infill, walls)
  // 5. User overrides (from UI)
  
  return merge(
    DEFAULT_SETTINGS,
    printer.config,
    filament.config,
    process.config,
    userOverrides
  );
}
```

### Phase 4: Storage & Caching

```typescript
// LocalStorage for recent selections
interface UserPreferences {
  lastPrinter: string;
  lastFilament: string;
  lastProcess: string;
  recentPrinters: string[];
  favoriteProfiles: string[];
}
```

## Build Script: scripts/extract-profiles.js

```javascript
// Parse all vendor JSON files
// Resolve inheritance (inherits field)
// Flatten nested settings
// Generate web-optimized profiles.json
// Copy essential images to web/public/profiles/

Features:
- Inheritance resolution (common profiles)
- Setting deduplication
- Validation (check required fields)
- Asset optimization (compress images)
```

## Benefits

✅ **1000+ pre-configured printers** - No manual config needed
✅ **Manufacturer start/end G-code** - Tested and optimized
✅ **Material-specific settings** - Per-filament temps and speeds
✅ **Quality presets** - Draft/Standard/Fine for each printer
✅ **Easy updates** - Sync with upstream OrcaSlicer profiles
✅ **Better UX** - Search, filter, favorites, recent

## Data Size Considerations

- Full profile library: ~15-20 MB (all vendors, all machines)
- Optimized subset: ~2-5 MB (popular printers only)
- On-demand loading: Load vendor profiles only when selected
- Image lazy-loading: Load thumbnails on scroll

## Challenges & Solutions

### Challenge 1: Inheritance Resolution
Profiles use `inherits` field pointing to common base files.

**Solution**: Pre-resolve at build time, flatten into final configs.

### Challenge 2: File Size
Complete library is large for web delivery.

**Solution**: 
- Include only popular vendors by default
- Allow downloading additional vendors on-demand
- Use gzip compression (70-80% reduction)

### Challenge 3: Setting Name Mapping
Profile keys might not match WASM expected keys.

**Solution**: Extend schema-translation.ts with profile key mappings.

### Challenge 4: G-code Variables
Start/end G-code uses variables like `[nozzle_temperature]`.

**Solution**: Template replacement at slice time:
```typescript
function replaceGcodeVariables(gcode: string, settings: Config): string {
  return gcode.replace(/\[(\w+)\]/g, (match, key) => settings[key] || match);
}
```

## File Structure (Web)

```
web/
├── public/
│   ├── profiles.json              # Main profile library (2-5 MB)
│   └── profiles/
│       ├── covers/                # Printer thumbnails
│       │   ├── creality-ender3v3se.png
│       │   └── ...
│       └── textures/              # Build plate textures (optional)
│           └── ...
├── src/
│   ├── lib/
│   │   └── profiles/
│   │       ├── profile-loader.ts      # Load and parse profiles
│   │       ├── profile-merger.ts      # Merge printer/filament/process
│   │       └── gcode-templating.ts    # Variable replacement
│   └── components/
│       ├── PrinterSelector.tsx
│       ├── FilamentSelector.tsx
│       ├── QualityPresetSelector.tsx
│       └── ProfileManager.tsx         # Manage favorites/recent
```

## Next Steps

1. ✅ Create extraction script (`scripts/extract-profiles.js`)
2. ✅ Run script to generate `profiles.json`
3. ✅ Create profile loader utility
4. ✅ Build printer selector UI component
5. ✅ Build filament selector UI component
6. ✅ Integrate with existing settings system
7. ✅ Add G-code variable replacement
8. ✅ Test with popular printers (Ender 3, Prusa, Bambu)
9. ✅ Add to documentation

## Timeline Estimate

- Script development: 4-6 hours
- UI components: 6-8 hours  
- Integration & testing: 4-6 hours
- **Total**: ~14-20 hours of development

## Demo Workflow

```
User opens web UI
  ↓
Select "Creality Ender-3 V3 SE (0.4mm nozzle)"
  ↓
Machine settings auto-filled (220x220x250mm, start/end G-code, etc.)
  ↓
Select "Creality Generic PLA"
  ↓
Temps auto-set (210°C nozzle, 60°C bed)
  ↓
Select "Standard 0.20mm" quality
  ↓
Layer height, speed, infill auto-configured
  ↓
User imports STL → Clicks Slice
  ↓
G-code generated with proper start/end sequences
```

---

This gives users a **professional, plug-and-play experience** matching desktop OrcaSlicer! 🎉
