/**
 * React Hooks for Profile Loading
 * 
 * Provides easy-to-use hooks for loading and managing profiles in React components
 */

import { useState, useEffect } from 'react';
import { profileLoader, ProfileIndex, VendorProfile, VendorMetadata } from '../lib/profile-loader';

/**
 * Hook to load and access the profile index
 * Call this once at the app level
 */
export function useProfileIndex() {
  const [index, setIndex] = useState<ProfileIndex | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    profileLoader.loadIndex()
      .then(setIndex)
      .catch(err => {
        console.error('Failed to load profile index:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      })
      .finally(() => setLoading(false));
  }, []);

  return { 
    index, 
    loading, 
    error,
    vendors: index ? profileLoader.getAllVendors() : [],
    search: (printerName: string) => index ? profileLoader.findVendorByPrinter(printerName) : null
  };
}

/**
 * Hook to load a specific vendor's profiles
 * Lazy loads when vendorId changes
 */
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
    setError(null);

    profileLoader.loadVendor(vendorId)
      .then(setProfile)
      .catch(err => {
        console.error(`Failed to load vendor ${vendorId}:`, err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      })
      .finally(() => setLoading(false));
  }, [vendorId]);

  return { profile, loading, error };
}

/**
 * Hook to search printers by name
 */
export function usePrinterSearch(query: string, minLength = 2) {
  const [results, setResults] = useState<Array<{ printer: string; vendor: string }>>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (query.length < minLength) {
      setResults([]);
      return;
    }

    setSearching(true);
    
    // Small delay to avoid searching on every keystroke
    const timeout = setTimeout(() => {
      try {
        const searchResults = profileLoader.searchPrinters(query);
        setResults(searchResults);
      } catch (err) {
        console.error('Search failed:', err);
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 200);

    return () => clearTimeout(timeout);
  }, [query, minLength]);

  return { results, searching };
}

/**
 * Hook to get vendor metadata without loading full profile
 */
export function useVendorMetadata(vendorId: string | null): VendorMetadata | null {
  const { index } = useProfileIndex();
  
  if (!index || !vendorId) return null;
  
  return profileLoader.getVendorMetadata(vendorId);
}

/**
 * Hook to prefetch a tier in the background
 */
export function usePrefetchTier(tier: 'popular' | 'extended' | 'complete', enabled = true) {
  const [prefetched, setPrefetched] = useState(false);
  const [prefetching, setPrefetching] = useState(false);

  useEffect(() => {
    if (!enabled || prefetched || prefetching) return;

    setPrefetching(true);
    profileLoader.prefetchTier(tier)
      .then(() => setPrefetched(true))
      .catch(err => console.error(`Failed to prefetch ${tier}:`, err))
      .finally(() => setPrefetching(false));
  }, [tier, enabled, prefetched, prefetching]);

  return { prefetched, prefetching };
}
