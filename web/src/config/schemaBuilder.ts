// src/config/schemaBuilder.ts

import { SchemaField, SchemaSection, SCHEMA_SECTIONS, FIELD_MAPPINGS } from './schema-map';
import { getUiKey, getWasmKey } from './schema-translation';

// New schema format from orc_describe_config
interface WasmConfigOption {
  key: string;
  label: string;
  fullLabel?: string;
  type: string;
  mode: string;
  category: string;
  guiType: string;
  tooltip?: string;
  unit?: string;
  min?: number;
  max?: number;
  default?: any;
  enumValues?: string[];
  enumLabels?: string[];
  serializationOrdinal: number;
}

interface WasmSchemaCategory {
  id: string;
  label: string;
  options: WasmConfigOption[];
}

interface WasmSchema {
  generatedAt: string;
  optionCount: number;
  categories: WasmSchemaCategory[];
}

function getCategoryFromKey(key: string): 'printer' | 'filament' | 'process' {
    if (key.startsWith('printer_') || key.startsWith('nozzle_') || key.startsWith('retraction_') || key.startsWith('z_hop')) return 'printer';
    if (key.startsWith('filament_') || key.startsWith('nozzle_temperature') || key.startsWith('bed_temperature') || key.startsWith('fan_')) return 'filament';
    return 'process';
}

function getSectionFromKey(key: string, categoryLabel: string): string {
    // Map based on category label from schema
    const cat = categoryLabel.toLowerCase();
    
    if (cat.includes('printer')) {
        if (key.includes('extruder')) return 'printer_extruder';
        if (key.includes('retraction') || key.includes('z_hop')) return 'printer_retraction';
        if (key.includes('machine')) return 'printer_machine';
        return 'printer_basic';
    }
    if (cat.includes('filament')) {
        if (key.includes('temperature')) return 'filament_temperature';
        if (key.includes('cooling') || key.includes('fan')) return 'filament_cooling';
        if (key.includes('flow')) return 'filament_flow';
        return 'filament_basic';
    }
    if (cat.includes('quality')) {
        return 'process_quality';
    }
    if (cat.includes('strength')) {
        return 'process_strength';
    }
    if (cat.includes('speed')) {
        return 'process_speed';
    }
    if (cat.includes('support')) {
        return 'process_support';
    }
    if (cat.includes('advanced')) {
        return 'process_advanced';
    }
    
    // Fallback based on key patterns
    if (key.includes('layer') || key.includes('wall') || key.includes('seam')) return 'process_quality';
    if (key.includes('infill') || key.includes('bridge')) return 'process_strength';
    if (key.includes('speed') || key.includes('acceleration')) return 'process_speed';
    if (key.includes('support')) return 'process_support';
    
    return 'process_advanced';
}

function getType(wasmType: string): SchemaField['type'] {
    if (wasmType.includes('percent')) return 'percent';
    if (wasmType.includes('float')) return 'float';
    if (wasmType.includes('int')) return 'int';
    if (wasmType.includes('bool')) return 'bool';
    if (wasmType.includes('enum')) return 'enum';
    return 'string';
}

export function buildSchemaFromWasm(wasmSchema: WasmSchema | Record<string, any>): {
  sections: SchemaSection[];
  fieldLookup: Map<string, SchemaField>;
  categoryLookup: Map<string, SchemaSection[]>;
  initialSettings: Record<string, any>;
  wasmKeyLookup: Map<string, string>; // Maps UI keys to WASM keys
} {
  console.log('🔧 Building UI schema from WASM data...');
  
  const fieldLookup = new Map<string, SchemaField>();
  const sectionMap = new Map<string, SchemaField[]>();
  const initialSettings: Record<string, any> = {};
  const wasmKeyLookup = new Map<string, string>();
  
  // Initialize sections
  Object.keys(SCHEMA_SECTIONS).forEach(sectionId => {
    sectionMap.set(sectionId, []);
  });
  
  // Handle both old and new schema formats
  let allOptions: WasmConfigOption[] = [];
  
  if ('categories' in wasmSchema && Array.isArray(wasmSchema.categories)) {
    // New format from orc_describe_config
    console.log('📊 New schema format:', wasmSchema.optionCount, 'options in', wasmSchema.categories.length, 'categories');
    wasmSchema.categories.forEach((cat: WasmSchemaCategory) => {
      allOptions.push(...cat.options);
    });
  } else {
    // Old flat format (shouldn't happen anymore, but keep as fallback)
    console.log('📊 Old schema format:', Object.keys(wasmSchema).length, 'keys');
    allOptions = Object.entries(wasmSchema).map(([key, config]: [string, any]) => ({
      key,
      label: config.label || key,
      type: config.type || 'string',
      mode: 'Simple',
      category: config.category || 'General',
      guiType: config.guiType || 'text',
      tooltip: config.tooltip,
      unit: config.unit,
      min: config.min,
      max: config.max,
      default: config.default_value,
      enumValues: config.enum_values,
      serializationOrdinal: 0
    }));
  }
  
  console.log('📋 Processing', allOptions.length, 'config options...');
  
  // Process each option
  allOptions.forEach((option) => {
    const wasmKey = option.key;
    const uiKey = getUiKey(wasmKey);
    const mapping = FIELD_MAPPINGS[uiKey];
    const category = getCategoryFromKey(wasmKey);
    const section = mapping?.section || getSectionFromKey(wasmKey, option.category);

    const field: SchemaField = {
      key: uiKey,
      displayName: mapping?.displayName || option.label,
      section,
      category,
      type: mapping?.type || getType(option.type),
      default: option.default,
      min: option.min,
      max: option.max,
      unit: option.unit,
      tooltip: option.tooltip,
      options: option.enumValues,
      order: mapping?.order || option.serializationOrdinal || 999,
    };
      
    fieldLookup.set(uiKey, field);
    initialSettings[uiKey] = option.default;
    wasmKeyLookup.set(uiKey, wasmKey);
      
    // Add to appropriate section
    const sectionFields = sectionMap.get(field.section);
    if (sectionFields) {
      sectionFields.push(field);
    } else {
      if (!sectionMap.has('process_advanced')) {
          sectionMap.set('process_advanced', []);
      }
      sectionMap.get('process_advanced')!.push(field);
      console.warn(`Unmapped key '${wasmKey}' (UI: '${uiKey}') -> process_advanced`);
    }
  });
  
  console.log(`✅ Processed ${allOptions.length} options → ${fieldLookup.size} UI fields`);
  
  // Build final sections with sorted fields
  const sections: SchemaSection[] = [];
  Object.entries(SCHEMA_SECTIONS).forEach(([sectionId, sectionConfig]) => {
    const fields = sectionMap.get(sectionId) || [];
    fields.sort((a, b) => (a.order || 999) - (b.order || 999));
    
    if (fields.length > 0) {
        sections.push({
          ...sectionConfig,
          fields
        });
        console.log(`  ✓ ${sectionConfig.title}: ${fields.length} fields`);
    }
  });
  
  // Sort sections by order
  sections.sort((a, b) => a.order - b.order);
  
  // Build category lookup
  const categoryLookup = new Map<string, SchemaSection[]>();
  ['printer', 'filament', 'process'].forEach(cat => {
    const categorySections = sections.filter(s => s.category === cat);
    categoryLookup.set(cat, categorySections);
  });
  
  console.log(`📊 Final: ${sections.length} sections, ${fieldLookup.size} fields total`);
  
  return { sections, fieldLookup, categoryLookup, initialSettings, wasmKeyLookup };
}
