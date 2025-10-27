# Profile Library UI Components

## Overview
React components for selecting and managing printer profiles in the OrcaSlicer WASM web UI.

**Key Design Principle**: Profile selection provides smart defaults, but **all settings remain manually editable**. User overrides always take highest priority.

---

## Profile Selection + Manual Tuning Philosophy

### How It Works
1. **Select a profile** (printer/filament/process) → Settings auto-populate
2. **Manual edits override profile values** → Your changes take priority
3. **Change profile** → Settings update, but preserves your manual overrides where sensible
4. **Reset option** → Clear overrides and return to pure profile defaults

### Merge Priority (Lowest to Highest)
1. **Default Settings** - Base schema defaults
2. **Printer Profile** - Machine limits, G-code templates
3. **Filament Profile** - Temperatures, speeds
4. **Process Profile** - Layer height, infill, walls
5. **USER OVERRIDES** ⭐ - Your manual edits (ALWAYS WIN)

Example:
```typescript
// Profile says: layer_height = 0.2
// User manually changes to: layer_height = 0.15
// Result: 0.15 (user override wins)

// User switches filament profile
// layer_height STAYS 0.15 (user override preserved)
// But nozzle_temperature updates to new filament default
```

### UI Behavior
- Settings with user overrides show **bold** or **highlighted**
- "Reset" button next to each setting (reverts to profile default)
- "Reset All" button (clears all overrides)
- Visual indicator: "Using profile defaults" vs "Custom settings"

---

## Component Architecture

### 1. ProfileManager (Parent Component)
**Purpose**: Orchestrates all profile selection and manages merged configuration

**State**:
```typescript
interface ProfileManagerState {
  selectedPrinter: PrinterProfile | null;
  selectedFilament: FilamentProfile | null;
  selectedProcess: ProcessProfile | null;
  mergedConfig: Record<string, any>;
  recentSelections: RecentSelection[];
}
```

**Functions**:
- `loadProfiles()` - Fetch profiles.json on mount
- `selectPrinter(printer: PrinterProfile)` - Update printer selection
- `selectFilament(filament: FilamentProfile)` - Update filament selection
- `selectProcess(process: ProcessProfile)` - Update process selection
- `getMergedConfig()` - Combine all selections into final config
- `validateCompatibility()` - Check printer/filament/process compatibility
- `saveToLocalStorage()` - Persist selections
- `loadFromLocalStorage()` - Restore previous selections

---

### 2. PrinterSelector Component

**Purpose**: Dropdown for selecting printer vendor + model + nozzle

**UI Layout**:
```
┌─────────────────────────────────────────┐
│ 🖨️ Select Printer                   ▼  │
├─────────────────────────────────────────┤
│ 🔍 Search printers...                   │
├─────────────────────────────────────────┤
│ 📦 Creality (32 printers)               │
│   ├─ Ender-3 V3 SE                      │
│   │  ├─ 0.4mm nozzle (default)          │
│   │  ├─ 0.6mm nozzle                    │
│   │  └─ 0.8mm nozzle                    │
│   ├─ Ender-3 V3                         │
│   └─ CR-10 Max                          │
│ 📦 Prusa (18 printers)                  │
│ 📦 Bambu Lab (12 printers)              │
└─────────────────────────────────────────┘
```

**Props**:
```typescript
interface PrinterSelectorProps {
  profiles: ProfileLibrary;
  selectedPrinter: PrinterProfile | null;
  onSelect: (printer: PrinterProfile, variant: PrinterVariant) => void;
}
```

**Features**:
- Search filter (fuzzy match on vendor + model name)
- Vendor grouping/collapsing
- Nozzle variant sub-menu
- Thumbnail preview (if available)
- "Recently used" section at top

**State**:
```typescript
const [searchTerm, setSearchTerm] = useState('');
const [expandedVendors, setExpandedVendors] = useState<Set<string>>(new Set());
const [hoveredPrinter, setHoveredPrinter] = useState<string | null>(null);
```

---

### 3. FilamentSelector Component

**Purpose**: Dropdown for selecting filament material

**UI Layout**:
```
┌─────────────────────────────────────────┐
│ 🧵 Select Filament                   ▼  │
├─────────────────────────────────────────┤
│ 🔍 Filter by material...                │
├─────────────────────────────────────────┤
│ [PLA] [PETG] [ABS] [TPU] [All]          │ (Material filter buttons)
├─────────────────────────────────────────┤
│ ✅ Creality Generic PLA                  │ (Compatible)
│ ✅ Creality Generic PETG                 │
│ ⚠️  Creality High Temp ABS               │ (Compatibility warning)
│ ❌ Bambu Lab PLA Basic (incompatible)    │
└─────────────────────────────────────────┘
```

**Props**:
```typescript
interface FilamentSelectorProps {
  profiles: ProfileLibrary;
  selectedPrinter: PrinterProfile | null;
  selectedFilament: FilamentProfile | null;
  onSelect: (filament: FilamentProfile) => void;
}
```

**Features**:
- Material type filter (PLA, PETG, ABS, TPU, etc.)
- Compatibility check (compatible_printers field)
- Visual indicators:
  - ✅ Fully compatible
  - ⚠️ Partial compatibility (temperature/speed warnings)
  - ❌ Incompatible (grayed out)
- Temperature range display on hover
- Brand/vendor filtering

**State**:
```typescript
const [materialFilter, setMaterialFilter] = useState<string | null>(null);
const [showIncompatible, setShowIncompatible] = useState(false);
```

---

### 4. QualityPresetSelector Component

**Purpose**: Quick selection of layer height / speed presets

**UI Layout**:
```
┌─────────────────────────────────────────┐
│ ⚙️ Quality Preset                     ▼  │
├─────────────────────────────────────────┤
│ ⚡ Draft (0.3mm layers, fast)            │
│ ⚙️ Standard (0.2mm layers, balanced)     │
│ ⭐ Fine (0.12mm layers, detailed)        │
│ 🎯 Custom                                │
└─────────────────────────────────────────┘
```

**Props**:
```typescript
interface QualityPresetSelectorProps {
  profiles: ProfileLibrary;
  selectedPrinter: PrinterProfile | null;
  selectedProcess: ProcessProfile | null;
  onSelect: (process: ProcessProfile) => void;
}
```

**Features**:
- Preset categories: Draft / Standard / Fine
- Layer height indicator
- Est. print time multiplier
- Speed indicators
- Custom process profiles from library

**Preset Definitions** (if no process profiles available):
```typescript
const DEFAULT_PRESETS = {
  draft: {
    layer_height: 0.3,
    wall_loops: 2,
    sparse_infill_density: 15,
    default_speed: 80
  },
  standard: {
    layer_height: 0.2,
    wall_loops: 3,
    sparse_infill_density: 20,
    default_speed: 60
  },
  fine: {
    layer_height: 0.12,
    wall_loops: 4,
    sparse_infill_density: 20,
    default_speed: 40
  }
};
```

---

### 5. ProfileMerger Utility

**Purpose**: Merge printer + filament + process + user overrides into final config

**Function Signature**:
```typescript
function mergeProfiles(
  defaults: Record<string, any>,
  printer: PrinterProfile | null,
  filament: FilamentProfile | null,
  process: ProcessProfile | null,
  userOverrides: Record<string, any>
): Record<string, any>
```

**Merge Priority** (lowest to highest):
1. DEFAULT_SETTINGS (from schemaBuilder.ts)
2. printer.config (machine limits, G-code)
3. filament.config (temperatures, speeds)
4. process.config (layer height, infill, walls)
5. userOverrides (user's manual edits)

**Implementation**:
```typescript
export function mergeProfiles(defaults, printer, filament, process, userOverrides) {
  let merged = { ...defaults };
  
  // Apply printer config
  if (printer?.config) {
    Object.entries(printer.config).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        merged[key] = value;
      }
    });
  }
  
  // Apply filament config
  if (filament?.config) {
    Object.entries(filament.config).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        // Extract first value from arrays (OrcaSlicer uses arrays for extruder-specific settings)
        merged[key] = Array.isArray(value) ? value[0] : value;
      }
    });
  }
  
  // Apply process config
  if (process?.config) {
    Object.entries(process.config).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        merged[key] = Array.isArray(value) ? value[0] : value;
      }
    });
  }
  
  // Apply user overrides
  Object.entries(userOverrides).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      merged[key] = value;
    }
  });
  
  return merged;
}
```

---

### 6. GCodeTemplateEngine Utility

**Purpose**: Replace variables in G-code templates

**Function Signature**:
```typescript
function replaceGcodeVariables(
  gcode: string,
  config: Record<string, any>
): string
```

**Variable Pattern**: `[variable_name]`

**Common Variables**:
- `[nozzle_temperature]` → config.nozzle_temperature
- `[nozzle_temperature_initial_layer]` → config.nozzle_temperature_initial_layer || config.nozzle_temperature
- `[bed_temperature]` → config.bed_temperature
- `[bed_temperature_initial_layer]` → config.bed_temperature_initial_layer || config.bed_temperature
- `[layer_height]` → config.layer_height
- `[filament_type]` → config.filament_type

**Implementation**:
```typescript
export function replaceGcodeVariables(gcode: string, config: Record<string, any>): string {
  return gcode.replace(/\[([^\]]+)\]/g, (match, variableName) => {
    let value = config[variableName];
    
    // Handle arrays (take first value)
    if (Array.isArray(value)) {
      value = value[0];
    }
    
    // If undefined, try snake_case to camelCase conversion
    if (value === undefined) {
      const camelCase = variableName.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      value = config[camelCase];
    }
    
    // If still undefined, keep original bracket syntax
    if (value === undefined) {
      console.warn(`G-code variable not found: ${variableName}`);
      return match;
    }
    
    return String(value);
  });
}
```

**Usage Example**:
```typescript
const startGcode = printer.variant.startGcode;
const processedGcode = replaceGcodeVariables(startGcode, mergedConfig);

// Before: "M104 S[nozzle_temperature_initial_layer]"
// After:  "M104 S210"
```

### G-code Customization Support

Users can override G-code in multiple ways:

**1. Edit in Settings Panel** (Recommended)
- Add G-code fields to settings UI (under "Advanced" section)
- `machine_start_gcode` text area
- `machine_end_gcode` text area
- When user edits these, they override profile G-code

**2. Profile + Variable Override**
- Keep profile G-code
- User only changes temperature/speed variables
- G-code automatically updates with new values

**3. Complete Custom G-code**
- User replaces entire start/end G-code
- Stored as user override (highest priority)
- Can still use variables like `[nozzle_temperature]`

**Implementation**:
```typescript
// In mergeProfiles()
function mergeProfiles(defaults, printer, filament, process, userOverrides) {
  let merged = { ...defaults };
  
  // Apply printer G-code (if no user override)
  if (printer?.variant && !userOverrides.machine_start_gcode) {
    merged.machine_start_gcode = printer.variant.startGcode;
  }
  
  if (printer?.variant && !userOverrides.machine_end_gcode) {
    merged.machine_end_gcode = printer.variant.endGcode;
  }
  
  // ... apply other profile settings ...
  
  // User overrides ALWAYS win
  Object.assign(merged, userOverrides);
  
  return merged;
}

// Before slicing
if (merged.machine_start_gcode?.includes('[')) {
  merged.machine_start_gcode = replaceGcodeVariables(
    merged.machine_start_gcode,
    merged
  );
}
```

---

## Integration with App.tsx

**Updated App Structure**:
```typescript
function App() {
  const { sections, fieldLookup, initialSettings, loading, error } = useOrcaSchema();
  const [settings, setSettings] = useState<Record<string, any> | null>(null);
  const [profiles, setProfiles] = useState<ProfileLibrary | null>(null);
  
  // Profile selections
  const [selectedPrinter, setSelectedPrinter] = useState<PrinterProfile | null>(null);
  const [selectedFilament, setSelectedFilament] = useState<FilamentProfile | null>(null);
  const [selectedProcess, setSelectedProcess] = useState<ProcessProfile | null>(null);
  
  // Load profiles.json
  useEffect(() => {
    fetch('/profiles.json')
      .then(res => res.json())
      .then(data => setProfiles(data))
      .catch(err => console.error('Failed to load profiles:', err));
  }, []);
  
  // Merge profiles when selections change
  useEffect(() => {
    if (!initialSettings) return;
    
    const merged = mergeProfiles(
      initialSettings,
      selectedPrinter,
      selectedFilament,
      selectedProcess,
      settings || {}
    );
    
    setSettings(merged);
  }, [selectedPrinter, selectedFilament, selectedProcess, initialSettings]);
  
  const handleSlice = async () => {
    if (!settings || !model) return;
    
    // Apply G-code template variables
    let finalConfig = { ...settings };
    
    if (selectedPrinter?.variant) {
      finalConfig.machine_start_gcode = replaceGcodeVariables(
        selectedPrinter.variant.startGcode,
        finalConfig
      );
      finalConfig.machine_end_gcode = replaceGcodeVariables(
        selectedPrinter.variant.endGcode,
        finalConfig
      );
    }
    
    // Translate to WASM format
    const wasmSettings = translateToWasm(finalConfig);
    
    // Slice
    const result = await slicerApi.slice(model, wasmSettings);
    // ...
  };
  
  return (
    <div className="app">
      <LeftSidebar>
        {/* Profile Selectors at Top */}
        <ProfileManager
          profiles={profiles}
          onPrinterSelect={setSelectedPrinter}
          onFilamentSelect={setSelectedFilament}
          onProcessSelect={setSelectedProcess}
        />
        
        {/* Settings Panels Below */}
        <SettingsSections sections={sections} settings={settings} onChange={setSettings} />
      </LeftSidebar>
      
      {/* ... rest of app ... */}
    </div>
  );
}
```

---

## LocalStorage Persistence

**Keys**:
- `orca-recent-printers` → Array<{vendor, model, variant, timestamp}>
- `orca-recent-filaments` → Array<{vendor, material, name, timestamp}>
- `orca-selected-printer` → {vendor, model, variant}
- `orca-selected-filament` → {vendor, material, name}
- `orca-selected-process` → {name}

**Implementation**:
```typescript
export function saveSelection(type: 'printer' | 'filament' | 'process', selection: any) {
  localStorage.setItem(`orca-selected-${type}`, JSON.stringify(selection));
  
  // Add to recent list (max 10)
  const recentKey = `orca-recent-${type}s`;
  const recent = JSON.parse(localStorage.getItem(recentKey) || '[]');
  recent.unshift({ ...selection, timestamp: Date.now() });
  const deduped = recent.slice(0, 10);
  localStorage.setItem(recentKey, JSON.stringify(deduped));
}

export function loadSelection(type: 'printer' | 'filament' | 'process') {
  const saved = localStorage.getItem(`orca-selected-${type}`);
  return saved ? JSON.parse(saved) : null;
}
```

---

## Styling Approach

**CSS Classes** (Tailwind):
```css
/* Dropdown Container */
.profile-selector {
  @apply border border-gray-300 rounded bg-white shadow-sm;
}

/* Search Input */
.profile-search {
  @apply w-full px-3 py-2 border-b border-gray-200 focus:ring-2 focus:ring-blue-500;
}

/* Vendor Group */
.vendor-group {
  @apply border-b border-gray-100 last:border-b-0;
}

.vendor-header {
  @apply px-3 py-2 bg-gray-50 font-medium text-sm flex items-center justify-between cursor-pointer hover:bg-gray-100;
}

/* Printer Item */
.printer-item {
  @apply px-4 py-2 hover:bg-blue-50 cursor-pointer flex items-center gap-2;
}

.printer-item.selected {
  @apply bg-blue-100 font-medium;
}

.printer-item.incompatible {
  @apply text-gray-400 cursor-not-allowed;
}

/* Nozzle Variant */
.nozzle-variant {
  @apply px-6 py-1 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer;
}

.nozzle-variant.default {
  @apply font-medium;
}

/* Material Filter Buttons */
.material-filter {
  @apply flex gap-2 px-3 py-2 border-b border-gray-200;
}

.material-filter button {
  @apply px-3 py-1 text-xs rounded-full border border-gray-300 hover:bg-gray-100;
}

.material-filter button.active {
  @apply bg-blue-600 text-white border-blue-600;
}

/* Compatibility Indicators */
.compat-icon {
  @apply w-4 h-4 flex-shrink-0;
}

.compat-icon.compatible {
  @apply text-green-600;
}

.compat-icon.warning {
  @apply text-yellow-600;
}

.compat-icon.incompatible {
  @apply text-red-600;
}
```

---

## File Structure

```
web/src/
├── components/
│   ├── profiles/
│   │   ├── ProfileManager.tsx        (Parent orchestrator)
│   │   ├── PrinterSelector.tsx       (Printer dropdown)
│   │   ├── FilamentSelector.tsx      (Filament dropdown)
│   │   ├── QualityPresetSelector.tsx (Process preset dropdown)
│   │   └── CompatibilityBadge.tsx    (Reusable compat indicator)
│   └── ...
├── lib/
│   ├── profile-merger.ts             (mergeProfiles function)
│   ├── gcode-template.ts             (replaceGcodeVariables function)
│   └── profile-storage.ts            (LocalStorage utils)
└── types/
    └── profiles.ts                   (TypeScript interfaces)
```

---

## TypeScript Interfaces

```typescript
// types/profiles.ts

export interface ProfileLibrary {
  generatedAt: string;
  version: string;
  vendors: VendorProfiles[];
}

export interface VendorProfiles {
  name: string;
  version: string;
  printers: PrinterProfile[];
  filaments: FilamentProfile[];
  processes: ProcessProfile[];
}

export interface PrinterProfile {
  id: string;
  name: string;
  nozzleSizes: number[];
  bedModel: string;
  bedTexture: string;
  defaultMaterials: string[];
  variants: PrinterVariant[];
}

export interface PrinterVariant {
  name: string;
  nozzle: number;
  config: Record<string, any>;
  startGcode: string;
  endGcode: string;
  pauseGcode: string;
  changeFilamentGcode: string;
}

export interface FilamentProfile {
  name: string;
  type: string | string[];
  config: {
    nozzleTemperature: string | string[];
    bedTemperature: string | string[];
    bedTemperatureInitialLayer: string | string[];
    filamentMaxVolumetricSpeed: string | string[];
    fanSpeed?: any;
    slowDownMinSpeed: string | string[];
    compatiblePrinters: string[];
  };
}

export interface ProcessProfile {
  name: string;
  config: {
    layerHeight: string;
    initialLayerHeight: string;
    wallLoops: string;
    sparseInfillDensity: string;
    sparseInfillPattern: string;
    topShellLayers: string;
    bottomShellLayers: string;
    compatiblePrinters: string[];
  };
}

export interface RecentSelection {
  type: 'printer' | 'filament' | 'process';
  vendor: string;
  name: string;
  timestamp: number;
}
```

---

## Testing Strategy

1. **Unit Tests**:
   - `profile-merger.test.ts` - Test merge priority
   - `gcode-template.test.ts` - Test variable replacement
   - `profile-storage.test.ts` - Test localStorage

2. **Integration Tests**:
   - Load profiles.json
   - Select printer → verify config merge
   - Select filament → verify compatibility check
   - Full workflow: printer + filament + process + slice

3. **Manual Testing Checklist**:
   - [ ] All vendors visible in dropdown
   - [ ] Search filters correctly
   - [ ] Nozzle variants selectable
   - [ ] Filament compatibility indicators accurate
   - [ ] G-code variables replaced correctly
   - [ ] Selections persist across page reload
   - [ ] Recent selections display
   - [ ] Incompatible combos show warnings

---

## Implementation Timeline

**Phase 1** (3-4 hours):
- Create TypeScript interfaces
- Implement profile-merger.ts
- Implement gcode-template.ts
- Unit tests for utilities

**Phase 2** (4-5 hours):
- Create PrinterSelector.tsx
- Create FilamentSelector.tsx
- Create QualityPresetSelector.tsx
- Create CompatibilityBadge.tsx

**Phase 3** (3-4 hours):
- Create ProfileManager.tsx
- Integrate into App.tsx
- Implement LocalStorage persistence
- Add loading states and error handling

**Phase 4** (2-3 hours):
- Styling and polish
- Responsive design
- Integration testing
- Documentation

**Total**: 12-16 hours

---

## Future Enhancements

1. **Profile Editing**: Allow users to modify and save custom profiles
2. **Profile Sharing**: Export/import profile bundles
3. **Cloud Sync**: Sync selections across devices
4. **Profile Updates**: Check for upstream profile updates
5. **Advanced Filtering**: Filter by bed size, features, manufacturer
6. **Profile Comparison**: Side-by-side comparison of profiles
7. **Thumbnails**: Display printer images in selector
8. **Build Plate Preview**: 3D preview of build plate model
