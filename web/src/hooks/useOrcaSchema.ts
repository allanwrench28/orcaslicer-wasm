// src/hooks/useOrcaSchema.ts

import { useState, useEffect } from 'react';
import { buildSchemaFromWasm } from '@/config/schemaBuilder';
import { SchemaSection, SchemaField } from '@/config/schema-map';

interface OrcaSchema {
  sections: SchemaSection[];
  fieldLookup: Map<string, SchemaField>;
  categoryLookup: Map<string, SchemaSection[]>;
  initialSettings: Record<string, any>;
  wasmKeyLookup: Map<string, string>; // Maps UI keys to WASM keys
}

/**
 * Load OrcaSlicer configuration schema from pre-generated static JSON.
 * This is MUCH faster than generating schema at runtime (instant vs 30-60 seconds).
 * 
 * The schema.json file is generated at build time by scripts/extract-schema.js
 */
export function useOrcaSchema() {
  const [schemaData, setSchemaData] = useState<OrcaSchema | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    async function loadSchema() {
      try {
        console.log('📦 Loading configuration schema from /schema.json...');
        
        const response = await fetch('/schema.json');
        
        if (!response.ok) {
          throw new Error(`Failed to fetch schema: ${response.statusText}`);
        }
        
        const wasmSchema = await response.json();
        
        console.log('✅ Schema loaded:', Object.keys(wasmSchema).length, 'keys');
        console.log('🔍 Sample WASM keys:', Object.keys(wasmSchema).sort().slice(0, 20));
        
        const builtSchema = buildSchemaFromWasm(wasmSchema);
        setSchemaData(builtSchema);
        
        console.log('📊 Schema built:', {
          sections: builtSchema.sections.length,
          fields: builtSchema.fieldLookup.size,
          categories: builtSchema.categoryLookup.size
        });
        
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        console.error('❌ Failed to load schema:', message);
        setError(message);
      } finally {
        setLoading(false);
      }
    }
    
    loadSchema();
  }, []);

  return {
    sections: schemaData?.sections || [],
    fieldLookup: schemaData?.fieldLookup || new Map(),
    categoryLookup: schemaData?.categoryLookup || new Map(),
    initialSettings: schemaData?.initialSettings || {},
    wasmKeyLookup: schemaData?.wasmKeyLookup || new Map(),
    loading,
    error
  };
}
