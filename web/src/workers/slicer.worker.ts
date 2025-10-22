console.log('[WORKER] Script loaded');
import Module from '../../public/wasm/slicer.js';

let wasmModule: any = null;

self.onmessage = async (e: MessageEvent) => {
  console.log('[WORKER] Message:', e.data.type);
  
  if (e.data.type === 'init') {
    try {
      wasmModule = await Module({
        locateFile: (path: string) => path.endsWith('.wasm') ? '/wasm/slicer.wasm' : path,
      });
      
      if (!wasmModule || !wasmModule.HEAPU8) {
        throw new Error('WASM module loaded, but HEAPU8 memory is missing.');
      }
      
      self.postMessage({ type: 'ready' });
      console.log('[WORKER] Ready');
      
    } catch (error) {
      console.error('[WORKER] Init error:', error);
      self.postMessage({ type: 'error', error: String(error) });
    }
    
  } else if (e.data.file) {
    if (!wasmModule) {
      self.postMessage({ type: 'error', error: 'Not initialized' });
      return;
    }
    
    try {
      self.postMessage({ type: 'busy' });
      
      // Read file data
      const fileData = new Uint8Array(await e.data.file.arrayBuffer());
      console.log('[WORKER] File loaded, size:', fileData.byteLength);
      
      // Allocate memory in WASM heap
      const dataOffset = 1024 * 1024; // 1MB offset
      
      // Ensure we have enough memory
      if (wasmModule.HEAPU8.length < dataOffset + fileData.byteLength) {
        const pagesNeeded = Math.ceil((dataOffset + fileData.byteLength - wasmModule.HEAPU8.length) / 65536);
        wasmModule.wasmMemory.grow(pagesNeeded);
      }
      
      // Copy file data to WASM memory
      wasmModule.HEAPU8.set(fileData, dataOffset);
      console.log('[WORKER] File data copied to WASM heap at offset', dataOffset);
      
      // Create error buffer for C functions
      const errorBufferSize = 1024;
      const errorOffset = dataOffset + fileData.byteLength + 1024; // After file data
      const errorBuffer = wasmModule.HEAPU8.subarray(errorOffset, errorOffset + errorBufferSize);
      errorBuffer.fill(0); // Clear error buffer
      
      // Wrap C functions
      const loadMesh = wasmModule.cwrap('os_load_mesh', 'number', ['number', 'number', 'number', 'number']);
      const sliceBasic = wasmModule.cwrap('os_slice_basic', 'number', ['number', 'number', 'number', 'number']);
      const resultGcode = wasmModule.cwrap('os_result_gcode', 'number', ['number', 'number', 'number']);
      const freeMesh = wasmModule.cwrap('os_free_mesh', null, ['number']);
      const freeResult = wasmModule.cwrap('os_free_result', null, ['number']);
      
      console.log('[WORKER] Loading mesh...');
      const mesh = loadMesh(dataOffset, fileData.byteLength, errorOffset, errorBufferSize);
      
      if (!mesh) {
        // Read error message
        const errorMsg = wasmModule.UTF8ToString(errorOffset);
        throw new Error(`Failed to load mesh: ${errorMsg || 'Unknown error'}`);
      }
      console.log('[WORKER] Mesh loaded successfully:', mesh);
      
      console.log('[WORKER] Starting slicing...');
      const resultPtr = sliceBasic(mesh, 0, errorOffset, errorBufferSize); // Use null/0 for default settings
      freeMesh(mesh);
      
      if (!resultPtr) {
        const errorMsg = wasmModule.UTF8ToString(errorOffset);
        throw new Error(`Slicing failed: ${errorMsg || 'Unknown error'}`);
      }
      
      console.log('[WORKER] Slicing completed, getting G-code...');
      
      // First call to get the size needed
      const gcodeSize = resultGcode(resultPtr, 0, 0);
      if (gcodeSize === 0) {
        freeResult(resultPtr);
        throw new Error('Failed to get G-code size');
      }
      
      console.log('[WORKER] G-code size:', gcodeSize);
      
      // Allocate memory for G-code
      const gcodeOffset = errorOffset + errorBufferSize + 1024;
      if (wasmModule.HEAPU8.length < gcodeOffset + gcodeSize) {
        const pagesNeeded = Math.ceil((gcodeOffset + gcodeSize - wasmModule.HEAPU8.length) / 65536);
        wasmModule.wasmMemory.grow(pagesNeeded);
      }
      
      // Get the actual G-code
      const actualSize = resultGcode(resultPtr, gcodeOffset, gcodeSize);
      freeResult(resultPtr);
      
      if (actualSize === 0) {
        throw new Error('Failed to get G-code data');
      }
      
      // Extract G-code string
      const gcode = wasmModule.UTF8ToString(gcodeOffset);
      
      console.log('[WORKER] ✓ Slicing successful! G-code length:', gcode.length);
      self.postMessage({ type: 'result', gcode });
      
    } catch (error) {
      console.error('[WORKER] Error during slicing:', error);
      self.postMessage({ 
        type: 'error', 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }
};
