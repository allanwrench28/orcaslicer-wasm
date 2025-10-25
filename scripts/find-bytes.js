const fs = require('fs');
const path = require('path');

const targetHex = process.argv[2] || '0bf8';
const needle = Buffer.from(targetHex.match(/../g).reverse().join(''), 'hex');
const wasmPath = path.resolve(__dirname, '../web/public/wasm/slicer.wasm');
const data = fs.readFileSync(wasmPath);
const hits = [];
for (let offset = 0; offset <= data.length - needle.length; offset += 1) {
  let match = true;
  for (let i = 0; i < needle.length; i += 1) {
    if (data[offset + i] !== needle[i]) {
      match = false;
      break;
    }
  }
  if (match) {
    hits.push(offset);
  }
}
if (!hits.length) {
  console.log(`No matches for 0x${targetHex}`);
} else {
  console.log(`Matches for 0x${targetHex}:`);
  hits.forEach((offset) => {
    console.log(`  0x${offset.toString(16)} (${offset})`);
  });
}
