#!/usr/bin/env node
/**
 * extract-profiles.js
 * 
 * Extracts OrcaSlicer printer/filament/process profiles from orca/resources/profiles/
 * and generates a tiered web-optimized structure for the web UI.
 * 
 * Features:
 * - Resolves inheritance chains (inherits field)
 * - Flattens nested settings
 * - Generates tiered structure (popular/extended/complete)
 * - Creates searchable index.json
 * - Progressive loading optimization
 * 
 * Usage: 
 *   node scripts/extract-profiles.js --tier=popular
 *   node scripts/extract-profiles.js --tier=all
 *   node scripts/extract-profiles.js --vendors=Creality,Prusa
 */

const fs = require('fs');
const path = require('path');

// Configuration
const PROFILES_DIR = path.join(__dirname, '../orca/resources/profiles');
const OUTPUT_DIR = path.join(__dirname, '../web/public/profiles');

// Tier definitions (by popularity/market share)
const TIER_DEFINITIONS = {
  popular: [
    'Creality', 'Prusa', 'BBL', 'Anycubic', 'Elegoo', 
    'Voron', 'Artillery', 'FlashForge', 'Snapmaker', 'QIDI',
    'Kingroon', 'TwoTrees', 'Sovol', 'Geeetech', 'JGAurora',
    'Longer', 'Monoprice', 'Tronxy', 'Ultimaker', 'Wanhao'
  ],
  extended: [
    'Anet', 'BambuLab', 'Builder', 'CraftBot', 'Dagoma',
    'Delta', 'Easythreed', 'Felix', 'Flying_Bear', 'FolgerTech',
    'Hephestos', 'iFactory3D', 'JGMaker', 'Kywoo', 'Leapfrog',
    'Lulzbot', 'MakerBot', 'Malyan', 'Micromake', 'Newmatter'
  ]
  // All others automatically go to 'complete' tier
};

// Parse command line args
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, value] = arg.replace(/^--/, '').split('=');
  acc[key] = value || true;
  return acc;
}, {});

// Determine which vendors to extract
let INCLUDE_VENDORS = null;
if (args.vendors) {
  INCLUDE_VENDORS = args.vendors.split(',');
} else if (args.tier) {
  if (args.tier === 'popular') {
    INCLUDE_VENDORS = TIER_DEFINITIONS.popular;
  } else if (args.tier === 'extended') {
    INCLUDE_VENDORS = TIER_DEFINITIONS.extended;
  } else if (args.tier === 'all') {
    INCLUDE_VENDORS = null; // All vendors
  }
}

console.log('🔧 OrcaSlicer Profile Extractor (Tiered)');
console.log('=========================================');
console.log(`📂 Source: ${PROFILES_DIR}`);
console.log(`📂 Output: ${OUTPUT_DIR}`);
if (INCLUDE_VENDORS) {
  console.log(`🏷️  Vendors: ${INCLUDE_VENDORS.join(', ')}`);
  console.log(`📊 Tier: ${args.tier || 'custom'}`);
} else {
  console.log(`🏷️  Vendors: All (${args.tier || 'all'} tier)`);
}
console.log('');

// Utility: Read JSON file
function readJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    console.error(`❌ Failed to read ${filePath}:`, error.message);
    return null;
  }
}

// Utility: Resolve inheritance
function resolveInheritance(profile, baseProfiles, visited = new Set()) {
  if (!profile.inherits) {
    return profile;
  }
  
  // Prevent circular inheritance
  if (visited.has(profile.inherits)) {
    console.warn(`⚠️  Circular inheritance detected: ${profile.inherits}`);
    return profile;
  }
  
  visited.add(profile.inherits);
  
  const baseName = profile.inherits;
  const baseProfile = baseProfiles[baseName];
  
  if (!baseProfile) {
    console.warn(`⚠️  Base profile not found: ${baseName}`);
    return profile;
  }
  
  // Recursively resolve base profile
  const resolvedBase = resolveInheritance(baseProfile, baseProfiles, visited);
  
  // Merge: base settings first, then override with current profile
  return {
    ...resolvedBase,
    ...profile,
    inherits: undefined // Remove inherits field after resolution
  };
}

// Extract vendor profiles
function extractVendorProfiles(vendorName, vendorDir) {
  console.log(`\n📦 Processing vendor: ${vendorName}`);
  
  const vendorIndexPath = path.join(PROFILES_DIR, `${vendorName}.json`);
  const vendorIndex = readJSON(vendorIndexPath);
  
  if (!vendorIndex) {
    return null;
  }
  
  const result = {
    name: vendorName,
    version: vendorIndex.version || '1.0.0',
    printers: [],
    filaments: [],
    processes: []
  };
  
  // Load common base profiles for inheritance resolution
  const baseProfiles = {};
  const commonFiles = [
    'fdm_machine_common.json',
    'fdm_creality_common.json',
    'fdm_filament_common.json',
    'fdm_filament_pla.json',
    'fdm_filament_abs.json',
    'fdm_filament_petg.json',
    'fdm_filament_tpu.json',
    'fdm_filament_asa.json',
    'fdm_filament_pa.json',
    'fdm_filament_pc.json'
  ];
  
  commonFiles.forEach(file => {
    const commonPath = path.join(vendorDir, 'machine', file);
    if (fs.existsSync(commonPath)) {
      const common = readJSON(commonPath);
      if (common) {
        baseProfiles[file.replace('.json', '')] = common;
      }
    }
    
    const filamentCommonPath = path.join(vendorDir, 'filament', file);
    if (fs.existsSync(filamentCommonPath)) {
      const common = readJSON(filamentCommonPath);
      if (common) {
        baseProfiles[file.replace('.json', '')] = common;
      }
    }
  });
  
  // Process machine models
  if (vendorIndex.machine_model_list) {
    console.log(`  🖨️  Processing ${vendorIndex.machine_model_list.length} printer models...`);
    
    vendorIndex.machine_model_list.forEach((model, idx) => {
      if (idx >= 10 && !args.all) {
        // Limit to first 10 printers per vendor unless --all specified
        return;
      }
      
      const modelPath = path.join(vendorDir, model.sub_path);
      const modelData = readJSON(modelPath);
      
      if (!modelData) return;
      
      const printer = {
        id: modelData.model_id || model.name.toLowerCase().replace(/\s+/g, '-'),
        name: model.name,
        nozzleSizes: modelData.nozzle_diameter ? modelData.nozzle_diameter.split(';').map(n => parseFloat(n)) : [0.4],
        bedModel: modelData.bed_model,
        bedTexture: modelData.bed_texture,
        defaultMaterials: modelData.default_materials ? modelData.default_materials.split(';') : [],
        variants: []
      };
      
      // Find variant files (e.g., "Ender-3 V3 SE 0.4 nozzle.json")
      const machineDir = path.join(vendorDir, 'machine');
      const variantFiles = fs.readdirSync(machineDir)
        .filter(f => f.startsWith(model.name) && f !== path.basename(modelPath) && f.endsWith('.json'));
      
      variantFiles.forEach(variantFile => {
        const variantPath = path.join(machineDir, variantFile);
        let variantData = readJSON(variantPath);
        
        if (!variantData) return;
        
        // Resolve inheritance
        variantData = resolveInheritance(variantData, baseProfiles);
        
        const variant = {
          name: variantData.name,
          nozzle: parseFloat(variantData.printer_variant || variantData.nozzle_diameter?.[0] || 0.4),
          config: {
            // Machine limits
            printableArea: variantData.printable_area,
            printableHeight: variantData.printable_height,
            bedExcludeArea: variantData.bed_exclude_area,
            
            // Machine structure
            printerStructure: variantData.printer_structure,
            auxiliaryFan: variantData.auxiliary_fan,
            
            // Nozzle
            nozzleDiameter: variantData.nozzle_diameter,
            nozzleType: variantData.nozzle_type,
            
            // Speeds
            machineMaxSpeedX: variantData.machine_max_speed_x,
            machineMaxSpeedY: variantData.machine_max_speed_y,
            machineMaxSpeedZ: variantData.machine_max_speed_z,
            machineMaxSpeedE: variantData.machine_max_speed_e,
            
            // Acceleration
            machineMaxAccelX: variantData.machine_max_acceleration_x,
            machineMaxAccelY: variantData.machine_max_acceleration_y,
            machineMaxAccelZ: variantData.machine_max_acceleration_z,
            machineMaxAccelExtruding: variantData.machine_max_acceleration_extruding,
            machineMaxAccelRetracting: variantData.machine_max_acceleration_retracting,
            machineMaxAccelTravel: variantData.machine_max_acceleration_travel,
            
            // Jerk
            machineMaxJerkX: variantData.machine_max_jerk_x,
            machineMaxJerkY: variantData.machine_max_jerk_y,
            machineMaxJerkZ: variantData.machine_max_jerk_z,
            machineMaxJerkE: variantData.machine_max_jerk_e,
            
            // Retraction
            retractionLength: variantData.retraction_length,
            retractionSpeed: variantData.retraction_speed,
            deretractionSpeed: variantData.deretraction_speed,
            retractionMinimumTravel: variantData.retraction_minimum_travel,
            retractBeforeWipe: variantData.retract_before_wipe,
            retractWhenChangingLayer: variantData.retract_when_changing_layer,
            zHop: variantData.z_hop,
            zHopTypes: variantData.z_hop_types,
            wipe: variantData.wipe,
            
            // Layer height limits
            maxLayerHeight: variantData.max_layer_height,
            minLayerHeight: variantData.min_layer_height,
            
            // Clearances
            extruderClearanceRadius: variantData.extruder_clearance_radius,
            extruderClearanceHeightToRod: variantData.extruder_clearance_height_to_rod,
            extruderClearanceHeightToLid: variantData.extruder_clearance_height_to_lid,
            
            // Other settings
            machineMinExtrudingRate: variantData.machine_min_extruding_rate,
            machineMinTravelRate: variantData.machine_min_travel_rate,
            silentMode: variantData.silent_mode,
            singleExtruderMultiMaterial: variantData.single_extruder_multi_material,
            
            // G-code flavor
            gcodeFlavor: variantData.gcode_flavor,
            
            // Default profiles
            defaultPrintProfile: variantData.default_print_profile,
            defaultFilamentProfile: variantData.default_filament_profile
          },
          startGcode: variantData.machine_start_gcode || '',
          endGcode: variantData.machine_end_gcode || '',
          pauseGcode: variantData.machine_pause_gcode || '',
          changeFilamentGcode: variantData.change_filament_gcode || ''
        };
        
        printer.variants.push(variant);
      });
      
      if (printer.variants.length > 0) {
        result.printers.push(printer);
      }
    });
  }
  
  // Process filaments
  if (vendorIndex.filament_list) {
    console.log(`  🧵 Processing ${vendorIndex.filament_list.length} filament profiles...`);
    
    vendorIndex.filament_list.slice(0, 50).forEach(filament => {
      const filamentPath = path.join(vendorDir, filament.sub_path);
      let filamentData = readJSON(filamentPath);
      
      if (!filamentData) return;
      
      // Resolve inheritance
      filamentData = resolveInheritance(filamentData, baseProfiles);
      
      result.filaments.push({
        name: filament.name,
        type: filamentData.filament_type || 'PLA',
        config: {
          nozzleTemperature: filamentData.nozzle_temperature,
          bedTemperature: filamentData.hot_plate_temp || filamentData.cool_plate_temp,
          bedTemperatureInitialLayer: filamentData.hot_plate_temp_initial_layer || filamentData.cool_plate_temp_initial_layer,
          filamentMaxVolumetricSpeed: filamentData.filament_max_volumetric_speed,
          fanSpeed: filamentData.fan_cooling_time,
          slowDownMinSpeed: filamentData.slow_down_min_speed,
          compatiblePrinters: filamentData.compatible_printers || []
        }
      });
    });
  }
  
  // Process quality presets
  if (vendorIndex.process_list) {
    console.log(`  ⚙️  Processing ${vendorIndex.process_list.length} process profiles...`);
    
    vendorIndex.process_list.slice(0, 30).forEach(process => {
      const processPath = path.join(vendorDir, process.sub_path);
      const processData = readJSON(processPath);
      
      if (!processData) return;
      
      result.processes.push({
        name: process.name,
        config: {
          layerHeight: processData.layer_height,
          initialLayerHeight: processData.initial_layer_height,
          wallLoops: processData.wall_loops,
          sparseInfillDensity: processData.sparse_infill_density,
          sparseInfillPattern: processData.sparse_infill_pattern,
          topShellLayers: processData.top_shell_layers,
          bottomShellLayers: processData.bottom_shell_layers,
          compatiblePrinters: processData.compatible_printers || []
        }
      });
    });
  }
  
  console.log(`  ✅ Extracted ${result.printers.length} printers, ${result.filaments.length} filaments, ${result.processes.length} processes`);
  
  return result;
}

// Main execution
function main() {
  console.log('🚀 Starting tiered profile extraction...\n');
  
  // Create output directories
  const dirs = [OUTPUT_DIR, path.join(OUTPUT_DIR, 'popular'), path.join(OUTPUT_DIR, 'extended'), path.join(OUTPUT_DIR, 'complete')];
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
  
  // Read all vendor directories
  const allVendors = fs.readdirSync(PROFILES_DIR)
    .filter(name => {
      const vendorDir = path.join(PROFILES_DIR, name);
      return fs.statSync(vendorDir).isDirectory() && 
             fs.existsSync(path.join(PROFILES_DIR, `${name}.json`));
    })
    .filter(name => !INCLUDE_VENDORS || INCLUDE_VENDORS.includes(name));
  
  console.log(`📋 Found ${allVendors.length} vendors to process`);
  
  // Initialize index structure
  const index = {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    tiers: {
      popular: { vendors: [] },
      extended: { vendors: [] },
      complete: { vendors: [] }
    },
    search: {} // printer name -> vendor mapping
  };
  
  // Helper: Determine tier for vendor
  function getTier(vendorName) {
    if (TIER_DEFINITIONS.popular.includes(vendorName)) return 'popular';
    if (TIER_DEFINITIONS.extended.includes(vendorName)) return 'extended';
    return 'complete';
  }
  
  // Process each vendor
  let totalPrinters = 0, totalFilaments = 0, totalProcesses = 0;
  
  allVendors.forEach(vendorName => {
    const vendorDir = path.join(PROFILES_DIR, vendorName);
    const vendorData = extractVendorProfiles(vendorName, vendorDir);
    
    if (!vendorData) return;
    
    const tier = getTier(vendorName);
    const outputPath = path.join(OUTPUT_DIR, tier, `${vendorName}.json`);
    
    // Write vendor file
    fs.writeFileSync(outputPath, JSON.stringify(vendorData, null, 2));
    
    const fileSize = fs.statSync(outputPath).size;
    
    // Add to index
    const vendorMeta = {
      id: vendorName,
      name: vendorData.name,
      version: vendorData.version,
      printerCount: vendorData.printers.length,
      filamentCount: vendorData.filaments.length,
      processCount: vendorData.processes.length,
      fileSize: fileSize,
      url: `/profiles/${tier}/${vendorName}.json`
    };
    
    index.tiers[tier].vendors.push(vendorMeta);
    
    // Add printers to search index
    vendorData.printers.forEach(printer => {
      index.search[printer.name] = vendorName;
      printer.variants?.forEach(variant => {
        index.search[`${printer.name} ${variant.name}`] = vendorName;
      });
    });
    
    totalPrinters += vendorData.printers.length;
    totalFilaments += vendorData.filaments.length;
    totalProcesses += vendorData.processes.length;
    
    console.log(`  � ${vendorName} -> ${tier}/ (${(fileSize / 1024).toFixed(0)}KB)`);
  });
  
  // Write index file
  const indexPath = path.join(OUTPUT_DIR, 'index.json');
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
  
  // Calculate tier sizes
  const tierSizes = {};
  ['popular', 'extended', 'complete'].forEach(tier => {
    const tierDir = path.join(OUTPUT_DIR, tier);
    if (fs.existsSync(tierDir)) {
      const files = fs.readdirSync(tierDir).filter(f => f.endsWith('.json'));
      const totalSize = files.reduce((sum, file) => {
        return sum + fs.statSync(path.join(tierDir, file)).size;
      }, 0);
      tierSizes[tier] = totalSize;
    }
  });
  
  // Summary
  const indexSize = fs.statSync(indexPath).size;
  
  console.log('\n✅ Extraction complete!');
  console.log('========================');
  console.log(`📊 Total: ${allVendors.length} vendors, ${totalPrinters} printers, ${totalFilaments} filaments, ${totalProcesses} processes`);
  console.log(`\n📦 Index: ${(indexSize / 1024).toFixed(1)}KB`);
  console.log(`📦 Popular tier: ${index.tiers.popular.vendors.length} vendors, ${(tierSizes.popular / 1024 / 1024).toFixed(2)}MB`);
  console.log(`📦 Extended tier: ${index.tiers.extended.vendors.length} vendors, ${(tierSizes.extended / 1024 / 1024).toFixed(2)}MB`);
  console.log(`📦 Complete tier: ${index.tiers.complete.vendors.length} vendors, ${(tierSizes.complete / 1024 / 1024).toFixed(2)}MB`);
  console.log(`\n📂 Output: ${OUTPUT_DIR}/`);
  console.log(`   ├── index.json (${(indexSize / 1024).toFixed(1)}KB)`);
  console.log(`   ├── popular/ (${index.tiers.popular.vendors.length} vendors)`);
  console.log(`   ├── extended/ (${index.tiers.extended.vendors.length} vendors)`);
  console.log(`   └── complete/ (${index.tiers.complete.vendors.length} vendors)`);
}

// Run
try {
  main();
} catch (error) {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
}
