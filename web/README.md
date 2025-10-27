# OrcaSlicer Web UI

Modern web interface for the OrcaSlicer WebAssembly slicing engine.

## Overview

This React-based web application provides a browser-native interface to OrcaSlicer's core slicing engine, compiled to WebAssembly. The UI is designed to be intuitive, fast, and work entirely offline after the initial load.

## Features

### Current Implementation

- **File Upload** - Drag & drop or browse for STL files
- **Settings Panel** - Configure printer, filament, and process settings organized in collapsible sections
- **Profile System** - Load/save printer and filament profiles (JSON-based)
- **Slicing** - Generate G-code using Web Workers (non-blocking UI)
- **G-code Download** - Export sliced files ready for printing
- **Instant Schema Loading** - Configuration schema loaded at build time (<1s vs 60s runtime generation)

### Architecture

```
┌─────────────────────────────────────────────────┐
│              React App (UI)                     │
│  - File upload/download                         │
│  - Settings configuration                       │
│  - Profile management                           │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼ (postMessage)
┌─────────────────────────────────────────────────┐
│         Web Worker (slicer.worker.ts)           │
│  - Load WASM module                             │
│  - Initialize OrcaSlicer engine                 │
│  - Execute slicing operations                   │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│       WASM Module (slicer.wasm)                 │
│  - OrcaSlicer C++ core (v2.3.1)                 │
│  - ~150MB data file with presets/resources      │
│  - Single-threaded execution                    │
└─────────────────────────────────────────────────┘
```

### Key Files

- `src/App.tsx` - Main application component and layout
- `src/workers/slicer.worker.ts` - WASM loading and slicing operations
- `src/lib/slice-api.ts` - Worker communication API
- `src/hooks/useOrcaSchema.ts` - Configuration schema hook
- `src/config/schemaBuilder.ts` - Schema parsing and UI structure generation
- `public/schema.json` - Static configuration schema (87 settings, build-time generated)
- `public/wasm/` - WASM artifacts (slicer.js, slicer.wasm, slicer.data)

## Development

### Prerequisites

- Node.js 18+ 
- npm or yarn
- A built WASM module in `public/wasm/` (see parent README)

### Setup

```bash
cd web
npm install
```

### Run Development Server

```bash
npm run dev
```

Open http://localhost:5173 (or the port shown in terminal)

### Build for Production

```bash
npm run build
```

Production build outputs to `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

## Configuration

### Schema System

The app uses a build-time generated schema (`public/schema.json`) that describes all available slicing settings. This provides:

- **Type Safety** - Settings are validated before being sent to WASM
- **UI Generation** - Settings panels are automatically generated from schema
- **Fast Loading** - Schema loads in <1 second (previously 30-60s at runtime)
- **Consistency** - Single source of truth for all configuration options

Schema format:
```json
{
  "generatedAt": "2025-10-27T10:00:00Z",
  "optionCount": 87,
  "categories": [
    {
      "id": "printer-settings",
      "label": "Printer Settings",
      "options": [
        {
          "key": "nozzle_diameter",
          "label": "Nozzle Diameter",
          "type": "float",
          "unit": "mm",
          "default": 0.4,
          "min": 0.1,
          "max": 2.0,
          "tooltip": "Diameter of the printer nozzle"
        }
      ]
    }
  ]
}
```

### Translation Layer

Settings names in the UI are mapped to OrcaSlicer's internal keys via `src/config/schema-translation.ts`. This allows the web UI to use friendlier names while maintaining compatibility with the C++ core.

## Performance

### Optimization Strategies

1. **Web Workers** - Slicing runs in background thread, UI stays responsive
2. **Build-time Schema** - Configuration loads instantly instead of waiting for WASM
3. **Lazy Loading** - Components load on demand
4. **Asset Optimization** - Vite handles code splitting and tree shaking
5. **WASM Caching** - Browser caches compiled WASM for subsequent loads

### Benchmarks

- **Initial Load**: ~3-5 seconds (150MB WASM data file)
- **Schema Load**: <1 second (static JSON fetch)
- **Slicing Time**: Similar to desktop OrcaSlicer (model dependent)
- **Memory Usage**: ~300-500MB for typical models

## Browser Compatibility

### Supported Browsers

- ✅ Chrome/Edge 90+ (recommended)
- ✅ Firefox 89+
- ✅ Safari 15.4+ (macOS/iOS)
- ⚠️ Opera 76+ (mostly works)

### Required Features

- WebAssembly 1.0
- Web Workers
- File API
- ES2020 JavaScript
- 2GB+ available RAM recommended

### Known Issues

- **Safari**: Slower WASM execution than Chrome
- **Mobile**: Large memory footprint may cause issues on low-end devices
- **Threading**: Multi-threading disabled pending browser SharedArrayBuffer support

## Troubleshooting

### WASM Module Not Found

Ensure `public/wasm/` contains:
- `slicer.js` (~1.2 MB)
- `slicer.wasm` (~6.7 MB)  
- `slicer.data` (~150 MB)

Rebuild using `../build.ps1` in the parent directory.

### Settings Don't Load

Check browser console for errors. Schema should load from `/schema.json`. If missing, the file should exist at `public/schema.json`.

### Slicing Fails

1. Check browser console for WASM errors
2. Verify STL file is valid (not corrupted)
3. Try with a simple test model (cube, sphere)
4. Check available browser memory (2GB+ recommended)

### UI Not Updating

Hard refresh (Ctrl+Shift+R / Cmd+Shift+R) to clear cached assets.

## Contributing

When adding new features:

1. **Settings**: Update `public/schema.json` and `src/config/FIELD_MAPPINGS.ts`
2. **UI Components**: Follow existing patterns in `src/components/`
3. **Worker Communication**: Use typed messages in `src/workers/slicer.worker.ts`
4. **Testing**: Test with multiple browsers and model sizes

## Future Roadmap

- [ ] 3D model visualization (Three.js WebGL viewer)
- [ ] G-code layer preview
- [ ] Interactive object manipulation (move/rotate/scale)
- [ ] Support painting interface
- [ ] Progressive Web App (PWA) with offline support
- [ ] Multi-threading when browser support improves
- [ ] Cloud storage integration (optional)
- [ ] Printer connectivity (via browser extensions or Companion Apps)

## License

This web UI is part of the OrcaSlicer WASM project and follows the same AGPL-3.0 license as OrcaSlicer.
