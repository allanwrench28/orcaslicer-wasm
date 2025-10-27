// src/config/schema-map.ts

export interface SchemaField {
  key: string;                    // Full qualified key (e.g., "print::temperature::bed_temperature")
  displayName: string;            // Human-readable label
  section: string;                // Section grouping
  category: 'printer' | 'filament' | 'process';
  type: 'float' | 'int' | 'bool' | 'string' | 'enum' | 'percent';
  default?: any;
  min?: number;
  max?: number;
  unit?: string;                  // mm, °C, %, mm/s, etc.
  tooltip?: string;               // Help text from Orca
  order?: number;                 // Display order within section
  advanced?: boolean;             // Show only in advanced mode
  dependencies?: string[];        // Other keys this depends on
  options?: string[];             // For enum type
}

export interface SchemaSection {
  id: string;
  title: string;
  category: 'printer' | 'filament' | 'process';
  order: number;
  icon?: string;
  fields: SchemaField[];
  collapsed?: boolean;            // Default expansion state
}

// Maps Orca's namespace structure to UI sections
export const SCHEMA_SECTIONS: Record<string, Omit<SchemaSection, 'fields'>> = {
  // PRINTER SECTIONS
  'printer_basic': {
    id: 'printer_basic',
    title: 'Basic Information',
    category: 'printer',
    order: 1,
    icon: 'info',
    collapsed: false
  },
  'printer_machine': {
    id: 'printer_machine',
    title: 'Machine Limits',
    category: 'printer',
    order: 2,
    icon: 'settings',
    collapsed: false
  },
  'printer_extruder': {
    id: 'printer_extruder',
    title: 'Extruder Configuration',
    category: 'printer',
    order: 3,
    icon: 'tool',
    collapsed: false
  },
  'printer_retraction': {
    id: 'printer_retraction',
    title: 'Retraction Settings',
    category: 'printer',
    order: 4,
    icon: 'arrow-left',
    collapsed: true
  },
  
  // FILAMENT SECTIONS
  'filament_basic': {
    id: 'filament_basic',
    title: 'Filament Type',
    category: 'filament',
    order: 1,
    icon: 'package',
    collapsed: false
  },
  'filament_temperature': {
    id: 'filament_temperature',
    title: 'Temperature Settings',
    category: 'filament',
    order: 2,
    icon: 'thermometer',
    collapsed: false
  },
  'filament_cooling': {
    id: 'filament_cooling',
    title: 'Cooling Settings',
    category: 'filament',
    order: 3,
    icon: 'wind',
    collapsed: true
  },
  'filament_flow': {
    id: 'filament_flow',
    title: 'Flow Settings',
    category: 'filament',
    order: 4,
    icon: 'droplet',
    collapsed: true
  },
  
  // PROCESS SECTIONS
  'process_quality': {
    id: 'process_quality',
    title: 'Quality Settings',
    category: 'process',
    order: 1,
    icon: 'star',
    collapsed: false
  },
  'process_strength': {
    id: 'process_strength',
    title: 'Strength Settings',
    category: 'process',
    order: 2,
    icon: 'shield',
    collapsed: false
  },
  'process_speed': {
    id: 'process_speed',
    title: 'Speed Settings',
    category: 'process',
    order: 3,
    icon: 'zap',
    collapsed: false
  },
  'process_support': {
    id: 'process_support',
    title: 'Support Settings',
    category: 'process',
    order: 4,
    icon: 'anchor',
    collapsed: true
  },
  'process_advanced': {
    id: 'process_advanced',
    title: 'Advanced Settings',
    category: 'process',
    order: 5,
    icon: 'sliders',
    collapsed: true
  }
};

// This is a comprehensive mapping based on OrcaSlicer GUI naming
// Keys match the exact naming used in OrcaSlicer's interface
export const FIELD_MAPPINGS: Partial<Record<string, Omit<SchemaField, 'key'>>> = {
  // ============================================================================
  // PRINTER SETTINGS
  // ============================================================================
  
  // PRINTER: BASIC
  'printer_model': {
    displayName: 'Printer Model',
    section: 'printer_basic',
    category: 'printer',
    type: 'string',
    order: 1
  },
  'printer_variant': {
    displayName: 'Printer Variant',
    section: 'printer_basic',
    category: 'printer',
    type: 'string',
    order: 2
  },
  'nozzle_diameter': {
    displayName: 'Nozzle Diameter',
    section: 'printer_extruder',
    category: 'printer',
    type: 'float',
    unit: 'mm',
    order: 1,
    tooltip: 'Diameter of the printer nozzle'
  },
  
  // PRINTER: RETRACTION
  'retraction_length': {
    displayName: 'Retraction Length',
    section: 'printer_retraction',
    category: 'printer',
    type: 'float',
    unit: 'mm',
    order: 1,
    tooltip: 'Length of filament to retract when traveling'
  },
  'retraction_speed': {
    displayName: 'Retraction Speed',
    section: 'printer_retraction',
    category: 'printer',
    type: 'float',
    unit: 'mm/s',
    order: 2
  },
  'z_hop': {
    displayName: 'Z Hop Height',
    section: 'printer_retraction',
    category: 'printer',
    type: 'float',
    unit: 'mm',
    order: 3,
    tooltip: 'Lift nozzle when traveling'
  },
  'z_hop_types': {
    displayName: 'Z Hop Type',
    section: 'printer_retraction',
    category: 'printer',
    type: 'enum',
    order: 4,
    options: ['Normal', 'Spiral', 'Slope']
  },

  // ============================================================================
  // FILAMENT SETTINGS
  // ============================================================================
  
  // FILAMENT: BASIC
  'filament_type': {
    displayName: 'Filament Type',
    section: 'filament_basic',
    category: 'filament',
    type: 'enum',
    order: 1,
    options: ['PLA', 'PETG', 'ABS', 'TPU', 'Nylon', 'ASA', 'PC', 'PA', 'PVA', 'HIPS']
  },
  'filament_vendor': {
    displayName: 'Vendor',
    section: 'filament_basic',
    category: 'filament',
    type: 'string',
    order: 2
  },

  // FILAMENT: TEMPERATURE
  'nozzle_temperature': {
    displayName: 'Nozzle Temperature',
    section: 'filament_temperature',
    category: 'filament',
    type: 'int',
    unit: '°C',
    min: 180,
    max: 300,
    order: 1,
    tooltip: 'Printing temperature for nozzle'
  },
  'nozzle_temperature_initial_layer': {
    displayName: 'First Layer Nozzle Temp',
    section: 'filament_temperature',
    category: 'filament',
    type: 'int',
    unit: '°C',
    min: 180,
    max: 300,
    order: 2
  },
  'bed_temperature': {
    displayName: 'Bed Temperature',
    section: 'filament_temperature',
    category: 'filament',
    type: 'int',
    unit: '°C',
    min: 0,
    max: 120,
    order: 3,
    tooltip: 'Heated bed temperature'
  },
  'bed_temperature_initial_layer': {
    displayName: 'First Layer Bed Temp',
    section: 'filament_temperature',
    category: 'filament',
    type: 'int',
    unit: '°C',
    min: 0,
    max: 120,
    order: 4
  },

  // FILAMENT: COOLING
  'fan_cooling_layer_time': {
    displayName: 'Fan Cooling Layer Time',
    section: 'filament_cooling',
    category: 'filament',
    type: 'float',
    unit: 's',
    order: 1
  },

  // PROCESS: QUALITY (Layer Height Tab)
  'layer_height': {
    displayName: 'Layer Height',
    section: 'process_quality',
    category: 'process',
    type: 'float',
    unit: 'mm',
    min: 0.05,
    max: 0.4,
    order: 1,
    tooltip: 'Height of each printed layer'
  },
  'initial_layer_height': {
    displayName: 'First Layer Height',
    section: 'process_quality',
    category: 'process',
    type: 'float',
    unit: 'mm',
    min: 0.1,
    max: 0.5,
    order: 2,
    tooltip: 'Height of the first layer (usually thicker for better adhesion)'
  },
  'line_width': {
    displayName: 'Line Width',
    section: 'process_quality',
    category: 'process',
    type: 'float',
    unit: 'mm',
    order: 3,
    tooltip: 'Width of extruded lines'
  },
  'wall_loops': {
    displayName: 'Wall Loops',
    section: 'process_quality',
    category: 'process',
    type: 'int',
    min: 0,
    max: 20,
    order: 4,
    tooltip: 'Number of perimeter walls'
  },
  'top_shell_layers': {
    displayName: 'Top Shell Layers',
    section: 'process_quality',
    category: 'process',
    type: 'int',
    min: 0,
    max: 50,
    order: 5,
    tooltip: 'Number of solid layers on top surfaces'
  },
  'bottom_shell_layers': {
    displayName: 'Bottom Shell Layers',
    section: 'process_quality',
    category: 'process',
    type: 'int',
    min: 0,
    max: 50,
    order: 6,
    tooltip: 'Number of solid layers on bottom surfaces'
  },
  'top_shell_thickness': {
    displayName: 'Top Shell Thickness',
    section: 'process_quality',
    category: 'process',
    type: 'float',
    unit: 'mm',
    order: 7
  },
  'bottom_shell_thickness': {
    displayName: 'Bottom Shell Thickness',
    section: 'process_quality',
    category: 'process',
    type: 'float',
    unit: 'mm',
    order: 8
  },
  'precise_wall': {
    displayName: 'Precise Wall',
    section: 'process_quality',
    category: 'process',
    type: 'bool',
    order: 10,
    tooltip: 'Enable precise wall feature for better dimensional accuracy'
  },

  // PROCESS: STRENGTH (Infill Tab)
  'sparse_infill_density': {
    displayName: 'Infill Density',
    section: 'process_strength',
    category: 'process',
    type: 'percent',
    unit: '%',
    min: 0,
    max: 100,
    order: 1,
    tooltip: 'Density of sparse infill (0% = hollow, 100% = solid)'
  },
  'sparse_infill_pattern': {
    displayName: 'Infill Pattern',
    section: 'process_strength',
    category: 'process',
    type: 'enum',
    order: 2,
    options: ['grid', 'gyroid', 'honeycomb', 'triangles', 'cubic', 'line', 'rectilinear', 'concentric'],
    tooltip: 'Pattern used for sparse infill'
  },
  'top_surface_pattern': {
    displayName: 'Top Surface Pattern',
    section: 'process_strength',
    category: 'process',
    type: 'enum',
    order: 3,
    options: ['monotonic', 'monotonicline', 'concentric', 'rectilinear']
  },
  'bottom_surface_pattern': {
    displayName: 'Bottom Surface Pattern',
    section: 'process_strength',
    category: 'process',
    type: 'enum',
    order: 4,
    options: ['monotonic', 'monotonicline', 'concentric', 'rectilinear']
  },

  // PROCESS: SPEED
  'outer_wall_speed': {
    displayName: 'Outer Wall Speed',
    section: 'process_speed',
    category: 'process',
    type: 'float',
    unit: 'mm/s',
    min: 5,
    max: 300,
    order: 1,
    tooltip: 'Speed for printing outer perimeters'
  },
  'inner_wall_speed': {
    displayName: 'Inner Wall Speed',
    section: 'process_speed',
    category: 'process',
    type: 'float',
    unit: 'mm/s',
    min: 5,
    max: 300,
    order: 2,
    tooltip: 'Speed for printing inner perimeters'
  },
  'sparse_infill_speed': {
    displayName: 'Sparse Infill Speed',
    section: 'process_speed',
    category: 'process',
    type: 'float',
    unit: 'mm/s',
    min: 5,
    max: 300,
    order: 3
  },
  'internal_solid_infill_speed': {
    displayName: 'Internal Solid Infill Speed',
    section: 'process_speed',
    category: 'process',
    type: 'float',
    unit: 'mm/s',
    min: 5,
    max: 300,
    order: 4
  },
  'top_surface_speed': {
    displayName: 'Top Surface Speed',
    section: 'process_speed',
    category: 'process',
    type: 'float',
    unit: 'mm/s',
    min: 5,
    max: 300,
    order: 5
  },
  'initial_layer_speed': {
    displayName: 'Initial Layer Speed',
    section: 'process_speed',
    category: 'process',
    type: 'float',
    unit: 'mm/s',
    min: 5,
    max: 100,
    order: 6,
    tooltip: 'Speed for first layer (slower for better adhesion)'
  },
  'travel_speed': {
    displayName: 'Travel Speed',
    section: 'process_speed',
    category: 'process',
    type: 'float',
    unit: 'mm/s',
    min: 50,
    max: 500,
    order: 7
  },

  // PROCESS: SUPPORT
  'enable_support': {
    displayName: 'Enable Support',
    section: 'process_support',
    category: 'process',
    type: 'bool',
    order: 1,
    tooltip: 'Generate support structures for overhangs'
  },
  'support_type': {
    displayName: 'Support Type',
    section: 'process_support',
    category: 'process',
    type: 'enum',
    order: 2,
    options: ['normal', 'tree', 'tree(auto)', 'organic'],
    tooltip: 'Type of support structure'
  },
  'support_threshold_angle': {
    displayName: 'Support Threshold Angle',
    section: 'process_support',
    category: 'process',
    type: 'int',
    unit: '°',
    min: 0,
    max: 90,
    order: 3,
    tooltip: 'Minimum overhang angle that requires support'
  },
};
