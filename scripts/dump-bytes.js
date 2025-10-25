const fs = require('fs');
const path = require('path');

const wasmPath = path.resolve(__dirname, '../web/public/wasm/slicer.wasm');
const data = fs.readFileSync(wasmPath);
const offset = parseInt(process.argv[2], 16);
const length = parseInt(process.argv[3] || '20', 16);
const slice = data.subarray(offset, offset + length);
let line = offset;
let out = '';
for (let i = 0; i < slice.length; i += 1) {
  if (i % 16 === 0) {
    if (i) out += '\n';
    out += `0x${(line + i).toString(16).padStart(6, '0')}: `;
  }
  out += slice[i].toString(16).padStart(2, '0') + ' ';
}
console.log(out);
