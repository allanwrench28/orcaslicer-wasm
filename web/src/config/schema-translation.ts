// schema-translation.ts
// Translation layer between OrcaSlicer GUI naming and WASM schema keys
// This allows the Web UI to use familiar OrcaSlicer names while the backend
// translates them to whatever keys the WASM module expects

export interface TranslationRule {
  uiKey: string;           // Key used in UI (OrcaSlicer standard naming)
  wasmKey: string;         // Actual key expected by WASM
  transform?: (value: any) => any;  // Optional value transformation
}

// Bidirectional translation map
export const SCHEMA_TRANSLATIONS: TranslationRule[] = [
  // QUALITY SETTINGS
  { uiKey: 'layer_height', wasmKey: 'layer_height' },
  { uiKey: 'initial_layer_height', wasmKey: 'initial_layer_height' },
  { uiKey: 'line_width', wasmKey: 'line_width' },
  { uiKey: 'first_layer_line_width', wasmKey: 'first_layer_line_width' },
  { uiKey: 'wall_loops', wasmKey: 'wall_loops' },  // May need translation
  { uiKey: 'top_shell_layers', wasmKey: 'top_shell_layers' },
  { uiKey: 'bottom_shell_layers', wasmKey: 'bottom_shell_layers' },
  { uiKey: 'precise_wall', wasmKey: 'precise_wall' },
  { uiKey: 'seam_position', wasmKey: 'seam_position' },
  { uiKey: 'seam_gap', wasmKey: 'seam_gap' },
  
  // STRENGTH SETTINGS
  { uiKey: 'sparse_infill_density', wasmKey: 'sparse_infill_density' },
  { uiKey: 'sparse_infill_pattern', wasmKey: 'sparse_infill_pattern' },
  { uiKey: 'top_surface_pattern', wasmKey: 'top_surface_pattern' },
  { uiKey: 'bottom_surface_pattern', wasmKey: 'bottom_surface_pattern' },
  { uiKey: 'infill_direction', wasmKey: 'infill_direction' },
  { uiKey: 'bridge_flow', wasmKey: 'bridge_flow' },
  
  // SPEED SETTINGS
  { uiKey: 'outer_wall_speed', wasmKey: 'outer_wall_speed' },
  { uiKey: 'inner_wall_speed', wasmKey: 'inner_wall_speed' },
  { uiKey: 'sparse_infill_speed', wasmKey: 'sparse_infill_speed' },
  { uiKey: 'internal_solid_infill_speed', wasmKey: 'internal_solid_infill_speed' },
  { uiKey: 'top_surface_speed', wasmKey: 'top_surface_speed' },
  { uiKey: 'initial_layer_speed', wasmKey: 'initial_layer_speed' },
  { uiKey: 'travel_speed', wasmKey: 'travel_speed' },
  
  // ACCELERATION SETTINGS
  { uiKey: 'default_acceleration', wasmKey: 'default_acceleration' },
  { uiKey: 'outer_wall_acceleration', wasmKey: 'outer_wall_acceleration' },
  { uiKey: 'initial_layer_acceleration', wasmKey: 'initial_layer_acceleration' },
  { uiKey: 'travel_acceleration', wasmKey: 'travel_acceleration' },
  
  // SUPPORT SETTINGS
  { uiKey: 'enable_support', wasmKey: 'enable_support' },
  { uiKey: 'support_type', wasmKey: 'support_type' },
  { uiKey: 'support_threshold_angle', wasmKey: 'support_threshold_angle' },
  { uiKey: 'support_base_pattern', wasmKey: 'support_base_pattern' },
  { uiKey: 'support_interface_pattern', wasmKey: 'support_interface_pattern' },
  { uiKey: 'support_interface_spacing', wasmKey: 'support_interface_spacing' },
  { uiKey: 'support_bottom_interface_spacing', wasmKey: 'support_bottom_interface_spacing' },
  { uiKey: 'tree_support_branch_angle', wasmKey: 'tree_support_branch_angle' },
  
  // FILAMENT SETTINGS
  { uiKey: 'nozzle_temperature', wasmKey: 'nozzle_temperature' },
  { uiKey: 'nozzle_temperature_initial_layer', wasmKey: 'nozzle_temperature_initial_layer' },
  { uiKey: 'bed_temperature', wasmKey: 'bed_temperature' },
  { uiKey: 'bed_temperature_initial_layer', wasmKey: 'bed_temperature_initial_layer' },
  { uiKey: 'chamber_temperature', wasmKey: 'chamber_temperature' },
  { uiKey: 'fan_speed', wasmKey: 'fan_speed' },
  { uiKey: 'fan_min_speed', wasmKey: 'fan_min_speed' },
  { uiKey: 'fan_max_speed', wasmKey: 'fan_max_speed' },
  { uiKey: 'flow_ratio', wasmKey: 'flow_ratio' },
  { uiKey: 'first_layer_flow_ratio', wasmKey: 'first_layer_flow_ratio' },
  
  // PRINTER SETTINGS
  { uiKey: 'printer_model', wasmKey: 'printer_model' },
  { uiKey: 'printer_variant', wasmKey: 'printer_variant' },
  { uiKey: 'nozzle_diameter', wasmKey: 'nozzle_diameter' },
  { uiKey: 'retraction_length', wasmKey: 'retraction_length' },
  { uiKey: 'retraction_speed', wasmKey: 'retraction_speed' },
  { uiKey: 'z_hop', wasmKey: 'z_hop' },
  { uiKey: 'z_hop_types', wasmKey: 'z_hop_types' },
  
  // ADVANCED SETTINGS
  { uiKey: 'skirt_loops', wasmKey: 'skirt_loops' },
  { uiKey: 'skirt_distance', wasmKey: 'skirt_distance' },
  { uiKey: 'brim_width', wasmKey: 'brim_width' },
  { uiKey: 'brim_type', wasmKey: 'brim_type' },
  { uiKey: 'draft_shield', wasmKey: 'draft_shield' },
  { uiKey: 'ironing_type', wasmKey: 'ironing_type' },
  { uiKey: 'ironing_flow', wasmKey: 'ironing_flow' },
  { uiKey: 'ironing_spacing', wasmKey: 'ironing_spacing' },
  { uiKey: 'fuzzy_skin', wasmKey: 'fuzzy_skin' },
  { uiKey: 'fuzzy_skin_thickness', wasmKey: 'fuzzy_skin_thickness' },
  { uiKey: 'fuzzy_skin_point_distance', wasmKey: 'fuzzy_skin_point_distance' },
  { uiKey: 'arc_fitting', wasmKey: 'arc_fitting' },
  { uiKey: 'resolution', wasmKey: 'resolution' },
  { uiKey: 'gcode_comments', wasmKey: 'gcode_comments' },
  { uiKey: 'label_objects', wasmKey: 'label_objects' },
];

// Create lookup maps for fast bidirectional translation
const uiToWasmMap = new Map<string, string>();
const wasmToUiMap = new Map<string, string>();
const transformMap = new Map<string, (value: any) => any>();

SCHEMA_TRANSLATIONS.forEach(rule => {
  uiToWasmMap.set(rule.uiKey, rule.wasmKey);
  wasmToUiMap.set(rule.wasmKey, rule.uiKey);
  if (rule.transform) {
    transformMap.set(rule.uiKey, rule.transform);
  }
});

/**
 * Translate settings from UI format to WASM format
 * Used before sending config to slicer worker
 */
export function translateToWasm(uiSettings: Record<string, any>): Record<string, any> {
  const wasmSettings: Record<string, any> = {};
  
  Object.entries(uiSettings).forEach(([uiKey, value]) => {
    const wasmKey = uiToWasmMap.get(uiKey) || uiKey; // Fallback to original key
    const transform = transformMap.get(uiKey);
    
    wasmSettings[wasmKey] = transform ? transform(value) : value;
  });
  
  return wasmSettings;
}

/**
 * Translate settings from WASM format to UI format
 * Used when loading schema or preset values
 */
export function translateFromWasm(wasmSettings: Record<string, any>): Record<string, any> {
  const uiSettings: Record<string, any> = {};
  
  Object.entries(wasmSettings).forEach(([wasmKey, value]) => {
    const uiKey = wasmToUiMap.get(wasmKey) || wasmKey; // Fallback to original key
    uiSettings[uiKey] = value;
  });
  
  return uiSettings;
}

/**
 * Get the WASM key for a UI key
 */
export function getWasmKey(uiKey: string): string {
  return uiToWasmMap.get(uiKey) || uiKey;
}

/**
 * Get the UI key for a WASM key
 */
export function getUiKey(wasmKey: string): string {
  return wasmToUiMap.get(wasmKey) || wasmKey;
}

/**
 * Check if a key needs translation
 */
export function needsTranslation(key: string, direction: 'toWasm' | 'fromWasm'): boolean {
  return direction === 'toWasm' 
    ? uiToWasmMap.has(key)
    : wasmToUiMap.has(key);
}
