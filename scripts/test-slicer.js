const fs = require('fs');
const path = require('path');
const { TextDecoder } = require('util');

const OrcaModuleFactory = require('../web/public/wasm/slicer.js');

const debugDecoder = new TextDecoder('utf-8', { fatal: false });
let lastModule = null;

const args = process.argv.slice(2);
const wantConfigDump = process.env.ORC_DUMP_CONFIG === '1' || args.includes('--dump-config');
const stlArg = args.find((value) => !value.startsWith('--'));
const outArg = args.find((value) => value.startsWith('--out='));
const outputPath = outArg ? path.resolve(outArg.slice('--out='.length)) : null;

function dumpPointer(ptr, maxBytes = 128) {
  if (!Number.isInteger(ptr) || ptr <= 0) {
    console.error('[dumpPointer] invalid pointer:', ptr);
    return;
  }
  const heap = lastModule?.HEAPU8;
  if (!heap) {
    console.error('[dumpPointer] HEAPU8 unavailable');
    return;
  }
  const clampedEnd = Math.min(ptr + maxBytes, heap.length);
  const bytes = heap.subarray(ptr, clampedEnd);
  const zeroTerm = bytes.indexOf(0);
  const slice = zeroTerm === -1 ? bytes : bytes.subarray(0, zeroTerm);
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join(' ');
  console.error(`[dumpPointer] 0x${ptr.toString(16)} (${bytes.length} bytes): ${hex}`);
  if (slice.length > 0) {
    try {
      console.error('[dumpPointer] utf8:', debugDecoder.decode(slice));
    } catch (decodeErr) {
      console.error('[dumpPointer] utf8 decode failed:', decodeErr);
    }
  }
}

const DEFAULT_STL = `solid cube
  facet normal 0 0 0
    outer loop
      vertex 0 0 0
      vertex 1 0 0
      vertex 0 1 0
    endloop
  endfacet
  facet normal 0 0 0
    outer loop
      vertex 1 0 0
      vertex 1 1 0
      vertex 0 1 0
    endloop
  endfacet
  facet normal 0 0 1
    outer loop
      vertex 0 0 1
      vertex 0 1 1
      vertex 1 0 1
    endloop
  endfacet
  facet normal 0 0 1
    outer loop
      vertex 1 0 1
      vertex 0 1 1
      vertex 1 1 1
    endloop
  endfacet
  facet normal 0 -1 0
    outer loop
      vertex 0 0 0
      vertex 0 0 1
      vertex 1 0 0
    endloop
  endfacet
  facet normal 0 -1 0
    outer loop
      vertex 1 0 0
      vertex 0 0 1
      vertex 1 0 1
    endloop
  endfacet
  facet normal 0 1 0
    outer loop
      vertex 0 1 0
      vertex 1 1 0
      vertex 0 1 1
    endloop
  endfacet
  facet normal 0 1 0
    outer loop
      vertex 1 1 0
      vertex 1 1 1
      vertex 0 1 1
    endloop
  endfacet
  facet normal -1 0 0
    outer loop
      vertex 0 0 0
      vertex 0 1 0
      vertex 0 0 1
    endloop
  endfacet
  facet normal -1 0 0
    outer loop
      vertex 0 1 0
      vertex 0 1 1
      vertex 0 0 1
    endloop
  endfacet
  facet normal 1 0 0
    outer loop
      vertex 1 0 0
      vertex 1 0 1
      vertex 1 1 0
    endloop
  endfacet
  facet normal 1 0 0
    outer loop
      vertex 1 1 0
      vertex 1 0 1
      vertex 1 1 1
    endloop
  endfacet
endsolid cube
`;

function loadStlBytes(inputPath) {
  if (!inputPath) {
    return Buffer.from(DEFAULT_STL, 'utf-8');
  }
  const resolved = path.resolve(inputPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`STL file not found: ${resolved}`);
  }
  return fs.readFileSync(resolved);
}

function describeError(rc) {
  switch (rc) {
    case -1: return 'Failed to load STL into Orca model.';
    case -2: return 'Orca model contained no printable objects.';
    case -3: return 'Failed while generating G-code file.';
    case -4: return 'Internal Orca exception during slicing.';
    default: return `Unknown error code ${rc}`;
  }
}

async function main() {
  const stlBytes = loadStlBytes(stlArg);
  const wasmPath = path.join(__dirname, '../web/public/wasm/slicer.wasm');
  const wasmBinary = fs.readFileSync(wasmPath);
  let restoreTableGet;
  let guardedTable;

  const moduleOptions = {
    wasmBinary,
    locateFile(filename) {
      return path.join(__dirname, '../web/public/wasm', filename);
    },
    printErr: (...args) => {
      console.error('[emscripten-err]', ...args);
    },
    onAbort: (reason) => {
      console.error('[emscripten] abort:', reason);
    },
    async instantiateWasm(imports, receiveInstance) {
      if (imports?.a) {
        for (const [key, fn] of Object.entries(imports.a)) {
          if (typeof fn === 'function' && fn.name && fn.name.startsWith('invoke_')) {
            imports.a[key] = function invokeWithTracing(...args) {
              const targetIndex = args[0];
              const signature = fn.name || key;
              const shouldTrace = targetIndex === 3064;
              if (shouldTrace) {
                console.log(`[invoke-trace] ${signature} -> table[${targetIndex}] args=${args.length}`);
              }
              try {
                const result = fn.apply(this, args);
                if (shouldTrace) {
                  console.log(`[invoke-trace] ${signature} succeeded`);
                }
                return result;
              } catch (error) {
                console.error(`[invoke] ${signature} threw for table index ${targetIndex}: ${error}`);
                throw error;
              }
            };
          }
        }
      }

      const { instance, module } = await WebAssembly.instantiate(wasmBinary, imports);
      const exportNames = Object.keys(instance?.exports ?? {});
      if (exportNames.length) {
        console.log('[test-slicer] exports:', exportNames.join(', '));
      }
      let table = instance?.exports?.oa;
      if (!table) {
        for (const value of Object.values(instance?.exports ?? {})) {
          if (value instanceof WebAssembly.Table) {
            table = value;
            break;
          }
        }
      }
      if (table && typeof table.get === 'function' && !restoreTableGet) {
        const originalGet = table.get.bind(table);
        table.get = function wasmTableGuard(idx) {
          const fn = originalGet(idx);
          if (typeof fn !== 'function') {
            console.warn(`[wasm-table] get(${idx}) yielded ${fn}`);
            return function missingWasmTableEntry(...args) {
              const err = new Error(`[wasm-table] indirect call attempted with table index ${idx}; entry=${fn}`);
              console.error(err.stack);
              throw err;
            };
          }
          return fn;
        };
        restoreTableGet = () => {
          table.get = originalGet;
        };
        guardedTable = table;
      }
      return receiveInstance(instance, module);
    },
  };
  if (wantConfigDump) {
    moduleOptions.ENV = { ...(moduleOptions.ENV || {}), ORC_DUMP_CONFIG: '1' };
    const configureEnv = (Module) => {
      Module.ENV = Module.ENV || {};
      Module.ENV.ORC_DUMP_CONFIG = '1';
    };
    if (Array.isArray(moduleOptions.preRun)) {
      moduleOptions.preRun = [...moduleOptions.preRun, configureEnv];
    } else if (typeof moduleOptions.preRun === 'function') {
      moduleOptions.preRun = [moduleOptions.preRun, configureEnv];
    } else {
      moduleOptions.preRun = [configureEnv];
    }
  }
  const module = await OrcaModuleFactory(moduleOptions);
  lastModule = module;
  if (module && typeof module.ready?.then === 'function') {
    await module.ready;
  }
  if (guardedTable) {
    console.log(`[test-slicer] wasm table guard active (size=${guardedTable.length})`);
    const probeIndex = 3064;
    try {
      const entry = guardedTable.get(probeIndex);
      const description = typeof entry === 'function'
        ? `[function ${entry.name || 'anonymous'}]`
        : String(entry);
      console.log(`[test-slicer] table[${probeIndex}] -> ${description}`);
    } catch (probeErr) {
      console.error(`[test-slicer] table[${probeIndex}] inspection failed:`, probeErr);
    }
    try {
      const base = 54756;
      const words = Array.from({ length: 8 }, (_, idx) => module.getValue(base + idx * 4, 'i32') >>> 0);
      console.log(`[test-slicer] static vtable @${base}:`, words.map((w) => `0x${w.toString(16)}`).join(' '));
    } catch (inspectErr) {
      console.warn('[test-slicer] failed to inspect static table:', inspectErr);
    }
  } else {
    console.warn('[test-slicer] wasm table guard not attached');
  }

  const moduleKeys = Object.keys(module);
  const invokeKeys = moduleKeys.filter((key) => key.startsWith('invoke'));
  if (invokeKeys.length) {
    console.log('[test-slicer] invoke helpers:', invokeKeys.slice(0, 8).join(', '));
  }
  if (!module.setValue || !module.getValue) {
    console.error('[test-slicer] module keys:', moduleKeys);
    console.error('[test-slicer] module props:', Object.getOwnPropertyNames(module));
    throw new Error('setValue/getValue not available on module.');
  }
  const utf8Decoder = new TextDecoder('utf-8');
  const len = stlBytes.length;
  const inPtr = module._malloc(len);
  if (!inPtr) throw new Error('Failed to allocate memory for STL input.');
  for (let i = 0; i < len; i++) {
    module.setValue(inPtr + i, stlBytes[i], 'i8');
  }

  const outPtrPtr = module._malloc(4);
  const outLenPtr = module._malloc(4);
  if (!outPtrPtr || !outLenPtr) {
    if (inPtr) module._free(inPtr);
    if (outPtrPtr) module._free(outPtrPtr);
    if (outLenPtr) module._free(outLenPtr);
    throw new Error('Failed to allocate output pointer storage.');
  }

  module.setValue(outPtrPtr, 0, 'i32');
  module.setValue(outLenPtr, 0, 'i32');

  let gcodePtr = 0;
  let gcodeLen = 0;
  try {
  if (typeof module._orc_init === 'function') {
    if (wantConfigDump) {
      const payload = Buffer.from('{"dumpConfig":true}', 'utf-8');
      const payloadPtr = module._malloc(payload.length);
      if (!payloadPtr) {
        throw new Error('Failed to allocate config payload buffer.');
      }
      for (let i = 0; i < payload.length; i++) {
        module.setValue(payloadPtr + i, payload[i], 'i8');
      }
      module._orc_init(payloadPtr, payload.length);
      module._free(payloadPtr);
    } else {
      module._orc_init(0, 0);
    }
  }
  let rc;
  try {
    rc = module._orc_slice(inPtr, len, outPtrPtr, outLenPtr);
  } catch (sliceErr) {
    if (typeof sliceErr === 'number') {
      if (module.UTF8ToString) {
        try {
          console.error('[orc_slice] throw ptr message:', module.UTF8ToString(sliceErr));
        } catch (decodeErr) {
          console.error('[orc_slice] failed to decode throw ptr:', decodeErr);
        }
      }
      if (typeof module.ccall === 'function') {
        try {
          const decoded = module.ccall('orc_decode_exception', 'string', ['number'], [sliceErr]);
          if (decoded) {
            console.error('[orc_slice] decoded exception:', decoded);
          }
        } catch (decodeErr) {
          console.error('[orc_slice] failed to decode exception via bridge:', decodeErr);
        }
      }
      dumpPointer(sliceErr);
    }
    console.error('[orc_slice] threw:', sliceErr, sliceErr && sliceErr.stack);
    throw sliceErr;
  }
  gcodePtr = module.getValue(outPtrPtr, 'i32') >>> 0;
  gcodeLen = module.getValue(outLenPtr, 'i32') >>> 0;
  console.log(`[orc_slice] rc=${rc} gcodePtr=0x${gcodePtr.toString(16)} gcodeLen=${gcodeLen}`);

    if (rc !== 0) {
      if (gcodePtr) module._orc_free(gcodePtr);
      throw new Error(`Slice error ${rc}: ${describeError(rc)}`);
    }

    if (!gcodePtr || gcodeLen === 0) {
      console.warn('Slice succeeded but returned empty G-code.');
      return;
    }

    const gcodeBuffer = Buffer.alloc(gcodeLen);
    for (let i = 0; i < gcodeLen; i++) {
      let val = module.getValue(gcodePtr + i, 'i8');
      if (val < 0) val += 256;
      gcodeBuffer[i] = val;
    }
    const gcodeText = utf8Decoder.decode(gcodeBuffer);
    module._orc_free(gcodePtr);

    console.log('G-code length:', gcodeLen);
    console.log('G-code preview (first 40 lines):');
    console.log(gcodeText.split('\n').slice(0, 40).join('\n'));
    if (outputPath) {
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, gcodeText, 'utf-8');
      console.log(`[test-slicer] full G-code written to ${outputPath}`);
    }
  } finally {
    module._free(inPtr);
    module._free(outPtrPtr);
    module._free(outLenPtr);
  }
}

main().catch((err) => {
  if (typeof err === 'number') {
    if (lastModule?.UTF8ToString) {
      try {
        console.error('[test-slicer] throw ptr message:', lastModule.UTF8ToString(err));
      } catch (decodeErr) {
        console.error('[test-slicer] failed to decode throw ptr:', decodeErr);
      }
    }
    if (typeof lastModule?.ccall === 'function') {
      try {
        const decoded = lastModule.ccall('orc_decode_exception', 'string', ['number'], [err]);
        if (decoded) {
          console.error('[test-slicer] decoded exception:', decoded);
        }
      } catch (decodeErr) {
        console.error('[test-slicer] failed to decode exception via bridge:', decodeErr);
      }
    }
    dumpPointer(err);
  }
  console.error('[test-slicer] Failed:', err, err && err.stack);
  process.exit(1);
});
