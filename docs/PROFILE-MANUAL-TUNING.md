# Profile Selection + Manual Tuning - UI Flow

## Visual Example: User Workflow

### Step 1: Select Printer Profile
```
┌─────────────────────────────────────────────────────────┐
│ Profile Selection (Optional)                            │
├─────────────────────────────────────────────────────────┤
│ 🖨️ Printer:   [Creality Ender-3 V3 SE 0.4mm]     ▼    │
│ 🧵 Filament:  [Select filament...]               ▼    │
│ ⚙️ Quality:   [Select quality preset...]         ▼    │
│                                                         │
│ ℹ️ Using profile defaults                              │
└─────────────────────────────────────────────────────────┘

Settings below auto-populate with:
- Machine limits (450mm/s max speed)
- Start G-code (Ender-3 V3 SE specific homing sequence)
- End G-code (Present print, turn off heaters)
- Retraction (1.2mm @ 60mm/s)
```

### Step 2: Select Filament
```
┌─────────────────────────────────────────────────────────┐
│ 🖨️ Printer:   [Creality Ender-3 V3 SE 0.4mm]     ▼    │
│ 🧵 Filament:  [Creality Generic PLA]             ▼    │  ← Just selected
│ ⚙️ Quality:   [Select quality preset...]         ▼    │
│                                                         │
│ ℹ️ Using profile defaults                              │
└─────────────────────────────────────────────────────────┘

Settings update with:
- Nozzle temp: 210°C
- Bed temp: 60°C
- Fan speed: 100%
- Max volumetric speed: 18mm³/s
```

### Step 3: Select Quality Preset
```
┌─────────────────────────────────────────────────────────┐
│ 🖨️ Printer:   [Creality Ender-3 V3 SE 0.4mm]     ▼    │
│ 🧵 Filament:  [Creality Generic PLA]             ▼    │
│ ⚙️ Quality:   [Standard (0.2mm)]                 ▼    │  ← Just selected
│                                                         │
│ ℹ️ Using profile defaults                              │
└─────────────────────────────────────────────────────────┘

Settings update with:
- Layer height: 0.2mm
- Wall loops: 3
- Infill: 20% (gyroid)
- Top/bottom shells: 4 layers
- Print speed: 60mm/s
```

### Step 4: User Manually Tweaks Settings
```
┌─────────────────────────────────────────────────────────┐
│ 🖨️ Printer:   [Creality Ender-3 V3 SE 0.4mm]     ▼    │
│ 🧵 Filament:  [Creality Generic PLA]             ▼    │
│ ⚙️ Quality:   [Standard (0.2mm)]                 ▼    │
│                                                         │
│ ⚠️ 3 custom overrides active  [Reset All]              │  ← Shows custom changes
└─────────────────────────────────────────────────────────┘

Settings Panel:
┌─────────────────────────────────────────────────────────┐
│ Quality Settings                                        │
├─────────────────────────────────────────────────────────┤
│ Layer Height       0.15 mm  [Reset]  ← Bold (changed)  │
│ Wall Loops         3                                    │
│ Infill Density     25%      [Reset]  ← Bold (changed)  │
│                                                         │
│ Temperature Settings                                    │
├─────────────────────────────────────────────────────────┤
│ Nozzle Temp        220°C    [Reset]  ← Bold (changed)  │
│ Bed Temp           60°C                                 │
└─────────────────────────────────────────────────────────┘

User changed:
✓ Layer height: 0.2 → 0.15mm (finer detail)
✓ Infill: 20% → 25% (stronger)
✓ Nozzle temp: 210°C → 220°C (better layer adhesion)
```

### Step 5: User Switches to Different Filament
```
┌─────────────────────────────────────────────────────────┐
│ 🖨️ Printer:   [Creality Ender-3 V3 SE 0.4mm]     ▼    │
│ 🧵 Filament:  [Creality Generic PETG]            ▼    │  ← Changed filament
│ ⚙️ Quality:   [Standard (0.2mm)]                 ▼    │
│                                                         │
│ ⚠️ 3 custom overrides preserved  [Reset All]           │
└─────────────────────────────────────────────────────────┘

Settings Panel:
┌─────────────────────────────────────────────────────────┐
│ Quality Settings                                        │
├─────────────────────────────────────────────────────────┤
│ Layer Height       0.15 mm  [Reset]  ← Still custom!   │
│ Wall Loops         3                                    │
│ Infill Density     25%      [Reset]  ← Still custom!   │
│                                                         │
│ Temperature Settings                                    │
├─────────────────────────────────────────────────────────┤
│ Nozzle Temp        220°C    [Reset]  ← Still custom!   │
│ Bed Temp           75°C              ← Updated for PETG│
└─────────────────────────────────────────────────────────┘

Behavior:
✓ Layer height preserved (user override)
✓ Infill preserved (user override)
✓ Nozzle temp preserved (user override)
✗ Bed temp updated (no user override, so profile wins)
```

### Step 6: User Wants Pure Filament Defaults
```
User clicks [Reset All] button

┌─────────────────────────────────────────────────────────┐
│ 🖨️ Printer:   [Creality Ender-3 V3 SE 0.4mm]     ▼    │
│ 🧵 Filament:  [Creality Generic PETG]            ▼    │
│ ⚙️ Quality:   [Standard (0.2mm)]                 ▼    │
│                                                         │
│ ℹ️ Using profile defaults                              │
└─────────────────────────────────────────────────────────┘

Settings Panel:
┌─────────────────────────────────────────────────────────┐
│ Quality Settings                                        │
├─────────────────────────────────────────────────────────┤
│ Layer Height       0.2 mm   ← Reset to profile default │
│ Wall Loops         3                                    │
│ Infill Density     20%      ← Reset to profile default │
│                                                         │
│ Temperature Settings                                    │
├─────────────────────────────────────────────────────────┤
│ Nozzle Temp        240°C    ← Reset to PETG default    │
│ Bed Temp           75°C                                 │
└─────────────────────────────────────────────────────────┘
```

---

## Advanced: Custom G-code Editing

### Scenario: User wants custom start G-code

Settings Panel (Advanced Section):
```
┌─────────────────────────────────────────────────────────┐
│ ▼ Advanced Settings                                     │
├─────────────────────────────────────────────────────────┤
│ Start G-code                                            │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ M220 S100 ;Reset feed rate                          │ │
│ │ M221 S100 ;Reset flow rate                          │ │
│ │                                                      │ │
│ │ M140 S[bed_temperature_initial_layer_single]        │ │
│ │ G28 ;Home                                           │ │
│ │ ... (user can edit)                                 │ │
│ └─────────────────────────────────────────────────────┘ │
│ [Reset to Profile Default]                              │
│                                                         │
│ ℹ️ Variables supported: [nozzle_temperature],          │
│    [bed_temperature], [layer_height], etc.             │
│                                                         │
│ ℹ️ Current source: Profile (Creality Ender-3 V3 SE)    │  ← Shows origin
└─────────────────────────────────────────────────────────┘
```

### If User Edits G-code:
```
┌─────────────────────────────────────────────────────────┐
│ Start G-code                                            │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ ; CUSTOM START GCODE                                │ │
│ │ G28 ;Home                                           │ │
│ │ G29 ;Bed leveling (user added this!)               │ │
│ │ M104 S[nozzle_temperature_initial_layer]           │ │
│ │ M140 S[bed_temperature_initial_layer_single]        │ │
│ │ ...                                                 │ │
│ └─────────────────────────────────────────────────────┘ │
│ [Reset to Profile Default]                              │
│                                                         │
│ ⚠️ Current source: Custom (edited by user)              │  ← Shows it's custom
└─────────────────────────────────────────────────────────┘
```

**Behavior**:
- User's custom G-code is stored as override
- Variables like `[nozzle_temperature]` still work
- Changing printer profile won't override custom G-code
- User can click "Reset to Profile Default" to restore

---

## Complete Settings Hierarchy (Implementation)

```typescript
// When user changes a setting via UI
function handleSettingChange(key: string, value: any) {
  // Track this as a user override
  setUserOverrides(prev => ({
    ...prev,
    [key]: value
  }));
  
  // Update merged settings
  const merged = mergeProfiles(
    initialSettings,
    selectedPrinter,
    selectedFilament,
    selectedProcess,
    { ...userOverrides, [key]: value }  // User overrides last
  );
  
  setSettings(merged);
}

// When user resets a single setting
function handleResetSetting(key: string) {
  // Remove from user overrides
  const newOverrides = { ...userOverrides };
  delete newOverrides[key];
  setUserOverrides(newOverrides);
  
  // Re-merge without this override
  const merged = mergeProfiles(
    initialSettings,
    selectedPrinter,
    selectedFilament,
    selectedProcess,
    newOverrides
  );
  
  setSettings(merged);
}

// When user clicks "Reset All"
function handleResetAll() {
  setUserOverrides({});
  
  // Pure profile merge (no overrides)
  const merged = mergeProfiles(
    initialSettings,
    selectedPrinter,
    selectedFilament,
    selectedProcess,
    {}  // No overrides
  );
  
  setSettings(merged);
}
```

---

## UI Component Enhancements

### SettingField Component (with override tracking)
```tsx
interface SettingFieldProps {
  field: SchemaField;
  value: any;
  isOverridden: boolean;  // NEW
  onReset: () => void;     // NEW
  onChange: (value: any) => void;
}

function SettingField({ field, value, isOverridden, onReset, onChange }: SettingFieldProps) {
  return (
    <div className="setting-field">
      <label className={isOverridden ? 'font-bold text-blue-600' : ''}>
        {field.displayName}
      </label>
      
      <div className="flex items-center gap-2">
        <input
          type={field.type === 'int' || field.type === 'float' ? 'number' : 'text'}
          value={value}
          onChange={(e) => onChange(parseValue(e.target.value, field.type))}
          className={isOverridden ? 'border-blue-500' : 'border-gray-300'}
        />
        
        {field.unit && <span className="text-xs text-gray-500">{field.unit}</span>}
        
        {isOverridden && (
          <button
            onClick={onReset}
            className="text-xs text-blue-600 hover:text-blue-800"
            title="Reset to profile default"
          >
            Reset
          </button>
        )}
      </div>
      
      {isOverridden && (
        <div className="text-xs text-blue-600 mt-1">
          Custom value (profile default: {getProfileDefault(field.key)})
        </div>
      )}
    </div>
  );
}
```

---

## Summary: Best of Both Worlds

✅ **Quick Start**: Select printer/filament → slice immediately (zero config)  
✅ **Power Users**: Select profile → tweak every setting → slice  
✅ **Mixed Mode**: Profile for basics → manual tune temperatures/speeds  
✅ **Custom G-code**: Full control over start/end sequences  
✅ **Override Tracking**: Always know what you've changed  
✅ **Easy Reset**: One click back to profile defaults  

**The profile system provides smart defaults, but never locks you in.**
