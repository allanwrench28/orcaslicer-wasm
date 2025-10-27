// src/lib/slice-api.ts

// This file serves as a client to interact with the slicer worker.
// It abstracts away the message passing and provides a clean async API.

class SlicerAPI {
  private worker: Worker;
  private isWasmLoaded: boolean = false;

  constructor() {
    this.worker = new Worker(new URL('../workers/slicer.worker.ts', import.meta.url), {
      type: 'module'
    });

    this.worker.onmessage = (event) => {
      const { type, payload } = event.data;
      switch (type) {
        case 'WORKER_READY':
          console.log('✅ Slicer worker ready, loading WASM...');
          this.loadWasm();
          break;
        case 'WASM_LOADED':
          this.isWasmLoaded = true;
          console.log('✅ WASM module loaded and ready to slice');
          break;
        case 'SLICE_COMPLETE':
          console.log('✅ Slice complete:', payload.gcode?.length || 0, 'bytes');
          break;
        case 'ERROR':
          console.error('❌ Worker error:', payload);
          break;
        default:
          console.warn('⚠️ Unknown message from worker:', type);
      }
    };
  }

  private loadWasm() {
    // Construct an absolute URL to the WASM glue code.
    // Vite serves the `public` directory at the root.
    const wasmUrl = new URL('/wasm/slicer.js', window.location.origin).href;
    this.worker.postMessage({ type: 'LOAD_WASM', payload: { url: wasmUrl } });
  }

  public async slice(model: ArrayBuffer, config: Record<string, any>): Promise<{ gcode: string }> {
    if (!this.isWasmLoaded) {
      return Promise.reject(new Error('Slicer is not yet initialized.'));
    }

    return new Promise((resolve, reject) => {
      const messageHandler = (event: MessageEvent) => {
        const { type, payload } = event.data;
        if (type === 'SLICE_COMPLETE') {
          this.worker.removeEventListener('message', messageHandler);
          resolve(payload);
        } else if (type === 'ERROR' && event.data.payload.includes('Slicing failed')) {
          this.worker.removeEventListener('message', messageHandler);
          reject(new Error(payload));
        }
      };

      this.worker.addEventListener('message', messageHandler);
      
      // Transfer the ArrayBuffer to the worker (zero-copy)
      this.worker.postMessage({
        type: 'SLICE',
        payload: { model, config }
      }, [model]);
    });
  }

  public isReady(): boolean {
    return this.isWasmLoaded;
  }
}

// Export a singleton instance of the API
export const slicerApi = new SlicerAPI();
