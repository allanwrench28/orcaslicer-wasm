#!/usr/bin/env node
/**
 * Extract OrcaSlicer configuration schema at build time
 * 
 * This script loads the WASM module, calls orc_describe_config once,
 * and saves the result to public/schema.json for instant loading at runtime.
 * 
 * This eliminates the 30-60 second schema generation delay on every page load.
 */

const fs = require('fs');
const path = require('path');

async function extractSchema() {
  console.log('📦 Loading WASM module...');
  
  // Load the WASM glue code
  const wasmPath = path.join(__dirname, '../public/wasm/slicer.js');
  if (!fs.existsSync(wasmPath)) {
    console.error('❌ WASM file not found at:', wasmPath);
    console.error('   Run the WASM build first: ./scripts/build-wasm.sh');
    process.exit(1);
  }

  // Import the WASM module
  const createModule = require(wasmPath);
  
  console.log('⏳ Initializing WASM (this may take 30-60 seconds)...');
  const OrcaModule = await createModule();
  
  console.log('✅ WASM module loaded');
  console.log('🔍 Extracting configuration schema...');

  // Allocate pointers for output parameters
  const jsonOutPtr = OrcaModule._malloc(4);
  const jsonLenPtr = OrcaModule._malloc(4);

  try {
    // Call orc_describe_config with output parameters
    const result = OrcaModule.ccall(
      'orc_describe_config',
      'number',
      ['number', 'number'],
      [jsonOutPtr, jsonLenPtr]
    );

    if (result !== 0) {
      throw new Error(`orc_describe_config returned error code: ${result}`);
    }

    // Read the output parameters
    const jsonDataPtr = OrcaModule.HEAP32[jsonOutPtr >> 2];
    const jsonLen = OrcaModule.HEAP32[jsonLenPtr >> 2];

    if (!jsonDataPtr || jsonLen <= 0) {
      throw new Error('Schema generation returned empty result');
    }

    // Read the JSON string from WASM memory
    const jsonBytes = new Uint8Array(OrcaModule.HEAPU8.buffer, jsonDataPtr, jsonLen);
    const jsonStr = new TextDecoder('utf-8').decode(jsonBytes);

    // Parse to validate
    const schema = JSON.parse(jsonStr);
    const keyCount = Object.keys(schema).length;

    console.log(`✅ Schema extracted: ${keyCount} configuration keys`);

    // Save to public/schema.json
    const outputPath = path.join(__dirname, '../public/schema.json');
    fs.writeFileSync(outputPath, JSON.stringify(schema, null, 2), 'utf-8');

    console.log(`💾 Schema saved to: ${outputPath}`);
    console.log('✨ Build-time schema extraction complete!');

    // Free WASM memory
    OrcaModule._free(jsonDataPtr);
    OrcaModule._free(jsonOutPtr);
    OrcaModule._free(jsonLenPtr);

    process.exit(0);
  } catch (error) {
    console.error('❌ Schema extraction failed:', error);
    
    // Clean up on error
    try {
      OrcaModule._free(jsonOutPtr);
      OrcaModule._free(jsonLenPtr);
    } catch (e) {
      // Ignore cleanup errors
    }
    
    process.exit(1);
  }
}

// Run the extraction
extractSchema().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
