# Profile Library Storage Strategy

## Problem Statement

OrcaSlicer has **57 vendors** with 1000+ printer/filament profiles:
- Full library: **15-25MB** uncompressed JSON
- Creality alone: 320KB (10 printers)
- Loading 20MB on app start = poor UX (especially mobile)

## Solution: Tiered Progressive Loading

### Architecture

```
web/public/profiles/
├── index.json              # 5KB - Vendor catalog
├── popular/                # Top 20 vendors (2-3MB total)
│   ├── Creality.json       # 320KB
│   ├── Prusa.json          # 400KB
│   ├── BBL.json            # 500KB (Bambu Lab)
│   ├── Anycubic.json       # 200KB
│   ├── Elegoo.json         # 180KB
│   └── ... (15 more)
├── extended/               # Next 20 vendors (3-5MB total)
│   ├── Artillery.json
│   ├── Voron.json
│   └── ... (18 more)
└── complete/               # Remaining vendors (5-10MB total)
    ├── LesserKnown.json
    └── ... (17 more)
```

### index.json Structure (5KB)

```json
{
  "version": "1.0.0",
  "generatedAt": "2025-10-27T...",
  "tiers": {
    "popular": {
      "vendors": [
        {
          "id": "Creality",
          "name": "Creality",
          "printerCount": 10,
          "filamentCount": 50,
          "processCount": 30,
          "fileSize": 320000,
          "url": "/profiles/popular/Creality.json"
        },
        {
          "id": "Prusa",
          "name": "Prusa Research",
          "printerCount": 12,
          "filamentCount": 60,
          "processCount": 40,
          "fileSize": 400000,
          "url": "/profiles/popular/Prusa.json"
        }
        // ... 18 more popular vendors
      ]
    },
    "extended": {
      "vendors": [
        // ... 20 mid-tier vendors
      ]
    },
    "complete": {
      "vendors": [
        // ... 17 niche vendors
      ]
    }
  },
  "search": {
    // Quick printer name → vendor mapping for instant search
    "Ender-3": "Creality",
    "i3 MK3S+": "Prusa",
    "X1 Carbon": "BBL",
    // ... all printer names
  }
}
```

### Loading Flow

#### Phase 1: App Startup (Instant - 5KB)
```typescript
// Load vendor index
const index = await fetch('/profiles/index.json');
// User sees full vendor list immediately (Creality, Prusa, BBL, ...)
```

#### Phase 2: User Selects Vendor (Fast - 50-100KB compressed)
```typescript
// User clicks "Creality"
const vendor = await fetch('/profiles/popular/Creality.json');
// Shows 10 printers, 50 filaments, 30 processes
```

#### Phase 3: Background Prefetch (Optional)
```typescript
// After user selects printer, prefetch their tier in background
if (selectedVendor.tier === 'popular') {
  // Prefetch other popular vendors (user might switch)
  prefetchTier('popular');
}
```

### Compression Strategy

**Automatic Gzip/Brotli (via web server)**:
- 320KB → **50-100KB** over network (70-85% reduction)
- Zero code changes
- All modern browsers support
- Configure in Vite/Firebase/Cloudflare

**Results:**
- Popular tier: 2-3MB → **400-600KB** compressed
- Typical user downloads: **5KB + 100KB = 105KB total**
- Compare to: **20MB** for full library

### Implementation Plan

#### Step 1: Modify Extraction Script

```javascript
// scripts/extract-profiles.js enhancements

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
  // Rest go to 'complete' tier
};

async function extractByTiers() {
  const index = {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    tiers: { popular: { vendors: [] }, extended: { vendors: [] }, complete: { vendors: [] } },
    search: {}
  };

  // Extract each vendor to its tier
  for (const vendor of allVendors) {
    const tier = getTier(vendor);
    const data = await extractVendorProfiles(vendor);
    
    // Write vendor file
    const outputPath = path.join(OUTPUT_DIR, 'profiles', tier, `${vendor}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
    
    // Add to index
    index.tiers[tier].vendors.push({
      id: vendor,
      name: data.name,
      printerCount: data.printers.length,
      filamentCount: data.filaments.length,
      processCount: data.processes.length,
      fileSize: Buffer.byteLength(JSON.stringify(data)),
      url: `/profiles/${tier}/${vendor}.json`
    });
    
    // Add to search index
    data.printers.forEach(printer => {
      index.search[printer.name] = vendor;
    });
  }

  // Write index
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'profiles', 'index.json'),
    JSON.stringify(index, null, 2)
  );
}
```

#### Step 2: Profile Loader Utility

```typescript
// web/src/lib/profile-loader.ts

export interface ProfileIndex {
  version: string;
  generatedAt: string;
  tiers: {
    popular: { vendors: VendorMetadata[] };
    extended: { vendors: VendorMetadata[] };
    complete: { vendors: VendorMetadata[] };
  };
  search: Record<string, string>; // printer name → vendor
}

export interface VendorMetadata {
  id: string;
  name: string;
  printerCount: number;
  filamentCount: number;
  processCount: number;
  fileSize: number;
  url: string;
}

export class ProfileLoader {
  private index: ProfileIndex | null = null;
  private cache = new Map<string, VendorProfile>();

  // Load index on app startup (5KB)
  async loadIndex(): Promise<ProfileIndex> {
    if (this.index) return this.index;
    
    const response = await fetch('/profiles/index.json');
    this.index = await response.json();
    return this.index;
  }

  // Get all vendors (from cached index)
  getAllVendors(): VendorMetadata[] {
    if (!this.index) throw new Error('Index not loaded');
    return [
      ...this.index.tiers.popular.vendors,
      ...this.index.tiers.extended.vendors,
      ...this.index.tiers.complete.vendors
    ];
  }

  // Load specific vendor (lazy)
  async loadVendor(vendorId: string): Promise<VendorProfile> {
    // Check cache
    if (this.cache.has(vendorId)) {
      return this.cache.get(vendorId)!;
    }

    // Find in index
    const allVendors = this.getAllVendors();
    const metadata = allVendors.find(v => v.id === vendorId);
    if (!metadata) throw new Error(`Vendor not found: ${vendorId}`);

    // Fetch vendor file
    const response = await fetch(metadata.url);
    const data = await response.json();

    // Cache it
    this.cache.set(vendorId, data);
    return data;
  }

  // Search printer → find vendor
  findVendorByPrinter(printerName: string): string | null {
    if (!this.index) throw new Error('Index not loaded');
    return this.index.search[printerName] || null;
  }

  // Prefetch tier (background)
  async prefetchTier(tier: 'popular' | 'extended' | 'complete') {
    if (!this.index) await this.loadIndex();
    
    const vendors = this.index.tiers[tier].vendors;
    const promises = vendors.map(v => this.loadVendor(v.id));
    
    // Fire and forget (don't await)
    Promise.all(promises).catch(err => 
      console.warn('Prefetch failed:', err)
    );
  }
}

// Singleton instance
export const profileLoader = new ProfileLoader();
```

#### Step 3: React Hook Integration

```typescript
// web/src/hooks/useProfiles.ts

import { useState, useEffect } from 'react';
import { profileLoader, ProfileIndex, VendorProfile } from '../lib/profile-loader';

export function useProfileIndex() {
  const [index, setIndex] = useState<ProfileIndex | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    profileLoader.loadIndex()
      .then(setIndex)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return { index, loading, error };
}

export function useVendorProfile(vendorId: string | null) {
  const [profile, setProfile] = useState<VendorProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!vendorId) {
      setProfile(null);
      return;
    }

    setLoading(true);
    profileLoader.loadVendor(vendorId)
      .then(setProfile)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [vendorId]);

  return { profile, loading, error };
}
```

#### Step 4: UI Component (Vendor Selector)

```typescript
// web/src/components/profiles/VendorSelector.tsx

export function VendorSelector({ onSelect }: { onSelect: (vendor: string) => void }) {
  const { index, loading, error } = useProfileIndex();

  if (loading) return <div>Loading vendors...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!index) return null;

  const allVendors = [
    ...index.tiers.popular.vendors,
    ...index.tiers.extended.vendors,
    ...index.tiers.complete.vendors
  ];

  return (
    <div className="vendor-selector">
      <h3>Select Manufacturer</h3>
      <div className="vendor-grid">
        {allVendors.map(vendor => (
          <button
            key={vendor.id}
            onClick={() => onSelect(vendor.id)}
            className="vendor-card"
          >
            <strong>{vendor.name}</strong>
            <span>{vendor.printerCount} printers</span>
            <span className="text-xs text-gray-500">
              {(vendor.fileSize / 1024).toFixed(0)}KB
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
```

### Benefits of This Approach

1. **Fast Initial Load**: 5KB index vs 20MB full library
2. **Minimal Data Transfer**: User downloads only what they need (100KB compressed)
3. **Scalable**: Easy to add more vendors without impacting existing users
4. **Cacheable**: Browser caches each vendor file separately
5. **Searchable**: Instant printer name search via index
6. **Progressive Enhancement**: Can prefetch popular tier in background
7. **CDN-Friendly**: Small files = better edge caching
8. **Developer-Friendly**: Extract once, optimize automatically

### Performance Metrics

| Scenario | Old Approach | New Approach | Improvement |
|----------|--------------|--------------|-------------|
| App startup | 20MB download | 5KB download | **4000x faster** |
| Select printer | Instant (already loaded) | 100KB download | Negligible |
| Switch vendor | Instant | 100KB download | Acceptable |
| Total data (typical user) | 20MB | 105KB | **190x less** |
| Time to interactive (3G) | ~40 seconds | <1 second | **40x faster** |

### Compression Configuration

#### Vite (Development & Local Production)
```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        // Ensure JSON files are copied to dist
        assetFileNames: 'assets/[name].[hash][extname]'
      }
    }
  },
  server: {
    // Vite dev server auto-compresses (local dev)
    compress: true
  }
});
```

**For local development:**
```bash
npm run dev  # Vite serves web/public/ automatically at localhost:5173
# Profiles load from: http://localhost:5173/profiles/index.json
```

**For local production build:**
```bash
npm run build   # Generates web/dist/ with compressed assets
npm run preview # Preview production build locally
```

#### Deployment Options (When Ready)

**GitHub Pages (FREE - Recommended)**
```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: cd web && npm install && npm run build
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./web/dist
```

**Netlify (FREE - Drag & Drop)**
1. Build locally: `cd web && npm run build`
2. Drag `web/dist/` folder to netlify.com/drop
3. Done! Auto-compression + CDN

**Cloudflare Pages (FREE - Unlimited Bandwidth)**
1. Connect GitHub repo
2. Build command: `cd web && npm run build`
3. Publish directory: `web/dist`
4. Auto-deploy on push

### Future Enhancements

1. **Service Worker Caching**: Cache popular tier offline
2. **Incremental Updates**: Download only changed vendors
3. **User Telemetry**: Track most-used vendors → optimize tiers
4. **Custom Profiles**: User profiles stored separately (LocalStorage)
5. **Profile Sharing**: Export/import custom profile bundles

## Decision: Proceed with Tiered Approach

**Next Steps:**
1. Modify `scripts/extract-profiles.js` to generate tiered structure
2. Create `profile-loader.ts` utility
3. Update React hooks to use lazy loading
4. Test with Creality first, then expand to popular tier

**Timeline:** +2-3 hours to extraction script, utilities ready for UI phase
