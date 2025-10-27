/**
 * Profile Loader Utility
 * 
 * Handles tiered progressive loading of printer/filament profiles.
 * Loads lightweight index on startup, then lazy-loads vendor files on demand.
 */

export interface VendorMetadata {
  id: string;
  name: string;
  version: string;
  printerCount: number;
  filamentCount: number;
  processCount: number;
  fileSize: number;
  url: string;
}

export interface ProfileIndex {
  version: string;
  generatedAt: string;
  tiers: {
    popular: { vendors: VendorMetadata[] };
    extended: { vendors: VendorMetadata[] };
    complete: { vendors: VendorMetadata[] };
  };
  search: Record<string, string>; // printer name -> vendor id
}

export interface PrinterVariant {
  name: string;
  nozzle: string;
  config: Record<string, any>;
  startGcode?: string;
  endGcode?: string;
  pauseGcode?: string;
  changeFilamentGcode?: string;
}

export interface PrinterProfile {
  id: string;
  name: string;
  nozzleSizes: string[];
  bedModel?: string;
  bedTexture?: string;
  defaultMaterials?: string[];
  variants?: PrinterVariant[];
}

export interface FilamentProfile {
  name: string;
  type: string;
  config: Record<string, any>;
}

export interface ProcessProfile {
  name: string;
  config: Record<string, any>;
}

export interface VendorProfile {
  name: string;
  version: string;
  printers: PrinterProfile[];
  filaments: FilamentProfile[];
  processes: ProcessProfile[];
}

/**
 * Profile Loader Class
 * Singleton for managing profile loading and caching
 */
export class ProfileLoader {
  private index: ProfileIndex | null = null;
  private vendorCache = new Map<string, VendorProfile>();
  private loadingPromises = new Map<string, Promise<VendorProfile>>();

  /**
   * Load the profile index (5KB)
   * Call this on app startup
   */
  async loadIndex(): Promise<ProfileIndex> {
    if (this.index) {
      return this.index;
    }

    try {
      const response = await fetch('/profiles/index.json');
      if (!response.ok) {
        throw new Error(`Failed to load index: ${response.statusText}`);
      }
      
      this.index = await response.json();
      console.log('✅ Profile index loaded:', {
        version: this.index!.version,
        vendors: this.getAllVendors().length,
        printers: Object.keys(this.index!.search).length
      });
      
      return this.index!;
    } catch (error) {
      console.error('❌ Failed to load profile index:', error);
      throw error;
    }
  }

  /**
   * Get all vendors from the cached index
   */
  getAllVendors(): VendorMetadata[] {
    if (!this.index) {
      throw new Error('Index not loaded. Call loadIndex() first.');
    }

    return [
      ...this.index.tiers.popular.vendors,
      ...this.index.tiers.extended.vendors,
      ...this.index.tiers.complete.vendors
    ];
  }

  /**
   * Get vendors by tier
   */
  getVendorsByTier(tier: 'popular' | 'extended' | 'complete'): VendorMetadata[] {
    if (!this.index) {
      throw new Error('Index not loaded. Call loadIndex() first.');
    }

    return this.index.tiers[tier].vendors;
  }

  /**
   * Get vendor metadata by ID
   */
  getVendorMetadata(vendorId: string): VendorMetadata | null {
    const vendors = this.getAllVendors();
    return vendors.find(v => v.id === vendorId) || null;
  }

  /**
   * Load specific vendor profile (lazy loading)
   * Returns cached version if available
   */
  async loadVendor(vendorId: string): Promise<VendorProfile> {
    // Return cached version
    if (this.vendorCache.has(vendorId)) {
      console.log(`📦 Using cached vendor: ${vendorId}`);
      return this.vendorCache.get(vendorId)!;
    }

    // Return existing loading promise to avoid duplicate requests
    if (this.loadingPromises.has(vendorId)) {
      console.log(`⏳ Waiting for vendor load: ${vendorId}`);
      return this.loadingPromises.get(vendorId)!;
    }

    // Find vendor in index
    const metadata = this.getVendorMetadata(vendorId);
    if (!metadata) {
      throw new Error(`Vendor not found: ${vendorId}`);
    }

    // Start loading
    console.log(`📥 Loading vendor: ${vendorId} (${(metadata.fileSize / 1024).toFixed(0)}KB)`);
    
    const loadPromise = (async () => {
      try {
        const response = await fetch(metadata.url);
        if (!response.ok) {
          throw new Error(`Failed to load vendor: ${response.statusText}`);
        }

        const data: VendorProfile = await response.json();
        
        // Cache it
        this.vendorCache.set(vendorId, data);
        console.log(`✅ Vendor loaded: ${vendorId} (${data.printers.length} printers, ${data.filaments.length} filaments)`);
        
        return data;
      } finally {
        // Clean up loading promise
        this.loadingPromises.delete(vendorId);
      }
    })();

    this.loadingPromises.set(vendorId, loadPromise);
    return loadPromise;
  }

  /**
   * Find vendor by printer name
   * Uses the search index for instant lookup
   */
  findVendorByPrinter(printerName: string): string | null {
    if (!this.index) {
      throw new Error('Index not loaded. Call loadIndex() first.');
    }

    return this.index.search[printerName] || null;
  }

  /**
   * Search for printers by partial name match
   */
  searchPrinters(query: string): Array<{ printer: string; vendor: string }> {
    if (!this.index) {
      throw new Error('Index not loaded. Call loadIndex() first.');
    }

    const lowerQuery = query.toLowerCase();
    const results: Array<{ printer: string; vendor: string }> = [];

    for (const [printer, vendor] of Object.entries(this.index.search)) {
      if (printer.toLowerCase().includes(lowerQuery)) {
        results.push({ printer, vendor });
      }
    }

    return results;
  }

  /**
   * Prefetch entire tier in background
   * Useful for preloading popular vendors after user selects one
   */
  async prefetchTier(tier: 'popular' | 'extended' | 'complete'): Promise<void> {
    if (!this.index) {
      await this.loadIndex();
    }

    const vendors = this.index!.tiers[tier].vendors;
    console.log(`🔄 Prefetching ${tier} tier (${vendors.length} vendors)...`);

    const promises = vendors.map(v => 
      this.loadVendor(v.id).catch(err => 
        console.warn(`Failed to prefetch ${v.id}:`, err)
      )
    );

    await Promise.all(promises);
    console.log(`✅ ${tier} tier prefetched`);
  }

  /**
   * Clear vendor cache (useful for testing or memory management)
   */
  clearCache(): void {
    this.vendorCache.clear();
    this.loadingPromises.clear();
    console.log('🗑️ Vendor cache cleared');
  }

  /**
   * Get cache stats
   */
  getCacheStats(): { cached: number; loading: number; totalSize: number } {
    const totalSize = Array.from(this.vendorCache.values()).reduce((sum, vendor) => {
      const size = JSON.stringify(vendor).length;
      return sum + size;
    }, 0);

    return {
      cached: this.vendorCache.size,
      loading: this.loadingPromises.size,
      totalSize
    };
  }
}

// Export singleton instance
export const profileLoader = new ProfileLoader();
