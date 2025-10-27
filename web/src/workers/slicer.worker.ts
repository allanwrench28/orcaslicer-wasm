// src/workers/slicer.worker.ts

// This will hold the initialized WASM module instance.
let OrcaModule: any = null;

async function loadAndInitializeWasm(payload: { url: string }) {
  try {
    console.log('📦 Loading WASM module...');
    
    // 1. Fetch the non-module script text
    const response = await fetch(payload.url);
    if (!response.ok) {
      throw new Error(`Failed to fetch WASM loader: ${response.statusText}`);
    }
    const scriptText = await response.text();

    // 2. Wrap it in a dynamic module
    const moduleContent = `${scriptText}\nexport default OrcaModule;`;
    const blob = new Blob([moduleContent], { type: 'application/javascript' });
    const objectURL = URL.createObjectURL(blob);

    // 3. Import the factory from the dynamic module
    const { default: OrcaModuleFactory } = await import(/* @vite-ignore */ objectURL);
    URL.revokeObjectURL(objectURL); // Clean up immediately

    // 4. Await the full initialization of the module.
    OrcaModule = await OrcaModuleFactory({
      locateFile: (path: string) => `/wasm/${path}`,
      // Suppress verbose WASM memory allocation warnings
      printErr: (text: string) => {
        // Filter out noise: [orc_alloc] warnings and status spam
        if (text.includes('[orc_alloc]')) return;
        if (text.includes('warning: operator delete')) return;
        // Show important progress milestones only (every 10%)
        if (text.includes('status') && text.includes('%')) {
          const match = text.match(/status\s+(\d+)%/);
          if (match) {
            const percent = parseInt(match[1]);
            if (percent % 10 === 0) {
              console.log(`🔪 Slicing: ${percent}%`);
            }
          }
          return;
        }
        // Show completion message
        if (text.includes('export complete')) {
          const match = text.match(/wall_time_ms=([\d.]+)/);
          const time = match ? ` (${(parseFloat(match[1]) / 1000).toFixed(1)}s)` : '';
          console.log(`✅ Slicing complete${time}`);
          return;
        }
        // Show memory summary
        if (text.includes('memory after export')) {
          return; // Skip detailed memory info
        }
        // Show everything else
        console.error(text);
      },
      print: (text: string) => {
        // Only log important messages, not debug spam
        if (!text.includes('[orc_alloc]') && !text.includes('warning: operator delete')) {
          console.log(text);
        }
      }
    });
    
    console.log('✅ WASM module ready');
    self.postMessage({ type: 'WASM_LOADED' });

  } catch (e) {
    console.error('❌ Critical error during WASM loading:', e);
    self.postMessage({ type: 'ERROR', payload: `Failed to load WASM: ${e}` });
  }
}

self.onmessage = async (event) => {
  const { type, payload } = event.data;

  switch (type) {
    case 'LOAD_WASM':
      await loadAndInitializeWasm(payload);
      break;

    case 'SLICE':
      if (!OrcaModule) {
        self.postMessage({ type: 'ERROR', payload: 'WASM module not ready.' });
        return;
      }
      try {
        const modelBuffer = payload.model; // ArrayBuffer
        const config = payload.config || {}; // Settings object

        if (!modelBuffer || !(modelBuffer instanceof ArrayBuffer)) {
          throw new Error('Model data must be an ArrayBuffer');
        }

        console.log('🔪 Starting slice with config:', Object.keys(config).length, 'settings');
        
        // Prepare config JSON and send to WASM via orc_init
        // (This sets g_last_slice_payload which orc_slice will read)
        const configJson = JSON.stringify(config);
        const configBytes = new TextEncoder().encode(configJson);
        const configPtr = OrcaModule._malloc(configBytes.length);
        OrcaModule.HEAPU8.set(configBytes, configPtr);
        
        const initResult = OrcaModule.ccall(
          'orc_init',
          'number',
          ['number', 'number'],
          [configPtr, configBytes.length]
        );
        OrcaModule._free(configPtr);
        
        if (initResult !== 0) {
          throw new Error(`Config initialization failed with code: ${initResult}`);
        }

        // Allocate memory in WASM heap for the model buffer
        const modelArray = new Uint8Array(modelBuffer);
        const modelPtr = OrcaModule._malloc(modelArray.length);
        OrcaModule.HEAPU8.set(modelArray, modelPtr);

        // Allocate pointers for output parameters (orc_slice uses output params!)
        const gcodeOutPtr = OrcaModule._malloc(4); // pointer to pointer (uint8_t**)
        const gcodeLenPtr = OrcaModule._malloc(4); // pointer to int
        
        // Initialize to null/0
        OrcaModule.HEAP32[gcodeOutPtr >> 2] = 0;
        OrcaModule.HEAP32[gcodeLenPtr >> 2] = 0;

        // Call orc_slice
        const returnCode = OrcaModule.ccall(
          'orc_slice',
          'number', // Returns int status code (0 = success, negative = error)
          ['number', 'number', 'number', 'number'], // model ptr, len, gcode_out**, gcode_len*
          [modelPtr, modelArray.length, gcodeOutPtr, gcodeLenPtr]
        );

        // Read output parameters
        const gcodePtr = OrcaModule.HEAP32[gcodeOutPtr >> 2];
        const gcodeLen = OrcaModule.HEAP32[gcodeLenPtr >> 2];

        // Free parameter pointers
        OrcaModule._free(gcodeOutPtr);
        OrcaModule._free(gcodeLenPtr);
        OrcaModule._free(modelPtr);

        if (returnCode !== 0) {
          throw new Error(`Slicing failed with error code: ${returnCode}`);
        }

        if (!gcodePtr || gcodeLen <= 0) {
          throw new Error('No G-code returned from slice operation.');
        }

        // Read G-code string from returned buffer
        const gcode = new TextDecoder().decode(
          OrcaModule.HEAPU8.subarray(gcodePtr, gcodePtr + gcodeLen)
        );

        // Free the G-code buffer (allocated by C code with malloc)
        OrcaModule._free(gcodePtr);

        console.log('✅ Slice complete! G-code:', gcodeLen, 'bytes');

        self.postMessage({ type: 'SLICE_COMPLETE', payload: { gcode } });
      } catch (error) {
        console.error('❌ Slicing failed:', error);
        self.postMessage({ type: 'ERROR', payload: `Slicing failed: ${(error as Error).message}` });
      }
      break;
  }
};

// Inform the main thread that the worker is ready to receive messages.
self.postMessage({ type: 'WORKER_READY' });
