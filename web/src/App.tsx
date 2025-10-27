import React, { useState, useEffect, useCallback } from 'react';
import { Viewport3D } from '@/viewer/Viewport3D';
import { CollapsibleSection } from '@/components/CollapsibleSection';
import { Icons } from '@/components/Icons';
import { slicerApi } from '@/lib/slice-api';
import { useOrcaSchema } from '@/hooks/useOrcaSchema';
import { translateToWasm } from '@/config/schema-translation';
import { SchemaSection, SchemaField } from '@/config/schema-map';

function SettingsField({ field, value, onChange }: { field: SchemaField, value: any, onChange: (key: string, value: any) => void }) {
    const commonProps = {
        id: field.key,
        onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
            let val: any = e.target.value;
            if (field.type === 'int') val = parseInt(val, 10);
            if (field.type === 'float' || field.type === 'percent') val = parseFloat(val);
            if (field.type === 'bool') val = (e.target as HTMLInputElement).checked;
            onChange(field.key, val);
        }
    };

    const renderInput = () => {
        switch (field.type) {
            case 'bool':
                return <input type="checkbox" checked={!!value} {...commonProps} />;
            case 'enum':
                return (
                    <select value={value} {...commonProps} className="setting-input">
                        {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                );
            case 'int':
            case 'float':
                return <input type="number" value={value} min={field.min} max={field.max} step={field.type === 'int' ? 1 : 0.01} {...commonProps} className="setting-input" />;
            case 'percent':
                 return (
                    <div className="setting-row" style={{ alignItems: 'center' }}>
                        <input type="range" min={field.min ?? 0} max={field.max ?? 100} value={value} {...commonProps} className="slider-input" />
                        <input type="number" value={value} min={field.min ?? 0} max={field.max ?? 100} {...commonProps} className="setting-input" style={{ width: '60px' }} />
                        <span>{field.unit || '%'}</span>
                    </div>
                );
            default:
                return <input type="text" value={value} {...commonProps} className="setting-input" />;
        }
    };

    if (field.type === 'bool') {
        return (
            <div className="setting-row-checkbox">
                <label htmlFor={field.key}>{field.displayName}</label>
                {renderInput()}
            </div>
        );
    }
    
    if (field.type === 'percent') {
        return (
             <div className="setting-row-vertical">
                <span className="setting-label">{field.displayName}</span>
                {renderInput()}
            </div>
        )
    }

    return (
        <div className="setting-row">
            <span className="setting-label" title={field.tooltip}>{field.displayName}</span>
            {renderInput()}
            {field.unit && <span>{field.unit}</span>}
        </div>
    );
}


// Main App
function OrcaSlicerApp() {
    const [mainTab, setMainTab] = useState('prepare');
    const [activeTool, setActiveTool] = useState('select');
    const [selectedObject, setSelectedObject] = useState<number | null>(null);
    const [isSlicing, setIsSlicing] = useState(false);
    const [slicingStatus, setSlicingStatus] = useState('Ready');
    const [modelFile, setModelFile] = useState<ArrayBuffer | null>(null);
    const [modelFileName, setModelFileName] = useState<string>('');
    const [gcode, setGcode] = useState<string | null>(null);
    
    const { sections, initialSettings, loading, error } = useOrcaSchema();
    const [settings, setSettings] = useState<Record<string, any> | null>(null);

    useEffect(() => {
        console.log('📊 Schema state:', { 
            sections: sections?.length, 
            loading, 
            error,
            hasInitialSettings: !!initialSettings 
        });
        if (sections) {
            console.log('📋 Sections detail:', sections.map(s => ({
                id: s.id,
                title: s.title,
                category: s.category,
                fields: s.fields.length
            })));
        }
    }, [sections, loading, error, initialSettings]);

    useEffect(() => {
        if (initialSettings) {
            console.log('✅ Setting initial settings:', Object.keys(initialSettings).length, 'keys');
            setSettings(initialSettings);
        }
    }, [initialSettings]);
    
    const [objects, setObjects] = useState<Array<{
        id: number;
        name: string;
        type: string;
        size: number;
        position: { x: number; y: number; z: number };
        rotation: { x: number; y: number; z: number };
        color: number;
        visible: boolean;
        modelData?: ArrayBuffer;
    }>>([]);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const buffer = event.target?.result as ArrayBuffer;
            setModelFile(buffer);
            setModelFileName(file.name);
            console.log(`Loaded ${file.name}: ${buffer.byteLength} bytes`);
            
            // Clear existing objects and add the loaded file as a new object
            const newObj = {
                id: Date.now(),
                name: file.name,
                type: 'imported',
                size: 3,
                position: { x: 0, y: 0, z: 0 }, // Mesh position at origin - geometry already positioned correctly
                rotation: { x: 0, y: 0, z: 0 },
                color: 0xe0e0e0,
                visible: true,
                modelData: buffer // Store the buffer for later use
            };
            setObjects([newObj]); // Replace all objects with the new one
            setSelectedObject(newObj.id);
            setSlicingStatus(`Model loaded: ${file.name}`);
        };
        reader.readAsArrayBuffer(file);
    };

    const handleSlice = async () => {
        if (!settings || isSlicing) {
            console.warn("Slicer not ready or already slicing.");
            return;
        }

        if (!modelFile) {
            setSlicingStatus('Error: No model file loaded');
            return;
        }

        setIsSlicing(true);
        setSlicingStatus('Slicing...');

        try {
            // Translate UI settings to WASM format before slicing
            const wasmSettings = translateToWasm(settings);
            console.log("UI settings:", settings);
            console.log("Translated WASM settings:", wasmSettings);
            
            const result = await slicerApi.slice(modelFile, wasmSettings);
            setGcode(result.gcode);
            setSlicingStatus('Slice complete!');
            console.log("G-code result:", result.gcode.substring(0, 500) + '...');
            setTimeout(() => setSlicingStatus('Ready'), 5000);
        } catch (error) {
            console.error("Slicing failed in App:", error);
            setSlicingStatus(`Error: ${(error as Error).message}`);
        } finally {
            setIsSlicing(false);
        }
    };

    const handleExportGcode = () => {
        if (!gcode) {
            alert('No G-code to export. Please slice first.');
            return;
        }

        const blob = new Blob([gcode], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        // Generate filename: modelname_date.gcode
        const baseName = modelFileName.replace(/\.(stl|obj|3mf)$/i, '');
        const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        a.download = `${baseName}_${timestamp}.gcode`;
        
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log(`Exported G-code: ${a.download} (${gcode.length} bytes)`);
    };

    const addObject = (type: string) => {
        const newObj = {
            id: Date.now(),
            name: `${type}.stl`,
            type: type,
            size: 3,
            position: { 
                x: Math.random() * 4 - 2, 
                y: 1.5, 
                z: Math.random() * 4 - 2 
            },
            rotation: { x: 0, y: Math.random() * Math.PI, z: 0 },
            color: 0xe0e0e0,
            visible: true
        };
        setObjects([...objects, newObj]);
    };

    const toggleObjectVisibility = (id: number) => {
        setObjects(objects.map(obj => 
            obj.id === id ? { ...obj, visible: !obj.visible } : obj
        ));
    };

    const updateSetting = useCallback((key: string, value: any) => {
        setSettings(prev => (prev ? { ...prev, [key]: value } : null));
    }, []);

    const selectedObjData = objects.find(o => o.id === selectedObject);
    const isWasmReady = !!sections;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f0f0f0' }}>
            {/* Top Menu Bar */}
            <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                height: '48px', 
                padding: '0 12px', 
                background: 'linear-gradient(180deg, #fafafa 0%, #f0f0f0 100%)', 
                borderBottom: '1px solid #ccc',
                gap: '12px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '28px', height: '28px', background: 'linear-gradient(135deg, #00AE42 0%, #00D854 100%)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'white', fontSize: '16px' }}>O</div>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#333' }}>OrcaSlicer</span>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                    <label className="toolbar-btn" style={{ padding: '4px 10px', fontSize: '12px', cursor: 'pointer' }}>
                        <input 
                            type="file" 
                            accept=".stl,.obj,.3mf" 
                            onChange={handleFileUpload}
                            style={{ display: 'none' }}
                        />
                        Import Model
                    </label>
                    <button className="toolbar-btn" style={{ padding: '4px 10px', fontSize: '12px' }}>File</button>
                    <button className="toolbar-btn" style={{ padding: '4px 10px', fontSize: '12px' }}>Edit</button>
                    <button className="toolbar-btn" style={{ padding: '4px 10px', fontSize: '12px' }}>View</button>
                    <button className="toolbar-btn" style={{ padding: '4px 10px', fontSize: '12px' }}>Calibration</button>
                    <button className="toolbar-btn" style={{ padding: '4px 10px', fontSize: '12px' }}>Help</button>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {modelFileName && (
                        <span style={{ fontSize: '12px', color: '#666' }}>📄 {modelFileName}</span>
                    )}
                    <span style={{ fontSize: '12px', color: '#999' }}>
                        {slicingStatus}
                    </span>
                    <button 
                        className="btn-primary" 
                        style={{ padding: '6px 16px' }} 
                        onClick={handleSlice}
                        disabled={isSlicing || !isWasmReady || objects.length === 0}
                    >
                        {isSlicing ? 'Slicing...' : 
                         !isWasmReady ? 'Loading...' : 
                         objects.length === 0 ? 'No Model' : 
                         'Slice Plate'}
                    </button>
                    <button 
                        className="toolbar-btn" 
                        style={{ 
                            padding: '6px 16px',
                            background: gcode ? '#28a745' : '#e0e0e0',
                            color: gcode ? 'white' : '#999',
                            cursor: gcode ? 'pointer' : 'not-allowed'
                        }} 
                        onClick={handleExportGcode}
                        disabled={!gcode}
                        title={gcode ? `Export G-code (${(gcode.length / 1024).toFixed(1)} KB)` : 'Slice first to export G-code'}
                    >
                        Export G-code
                    </button>
                </div>
            </div>

            {/* Main Tabs */}
            <div style={{ 
                display: 'flex', 
                height: '42px', 
                background: 'white', 
                borderBottom: '1px solid #ddd',
                alignItems: 'flex-end'
            }}>
                <button className={`main-tab ${mainTab === 'prepare' ? 'active' : ''}`} onClick={() => setMainTab('prepare')}>Prepare</button>
                <button className={`main-tab ${mainTab === 'preview' ? 'active' : ''}`} onClick={() => setMainTab('preview')}>Preview</button>
                <button className={`main-tab ${mainTab === 'device' ? 'active' : ''}`} onClick={() => setMainTab('device')}>Device</button>
                <button className={`main-tab ${mainTab === 'project' ? 'active' : ''}`} onClick={() => setMainTab('project')}>Project</button>
            </div>

            {/* Main Content */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                {/* Left Sidebar - Settings Panel */}
                <div style={{ width: '320px', display: 'flex', flexDirection: 'column', background: 'white', borderRight: '1px solid #ddd' }}>
                    <div style={{ flex: 1, overflowY: 'auto', padding: '0' }}>
                        {loading && (
                            <div style={{ padding: '20px', textAlign: 'center' }}>
                                <div style={{ fontSize: '14px', marginBottom: '8px' }}>Loading Settings...</div>
                                <div style={{ fontSize: '11px', color: '#666' }}>
                                    Building configuration schema from WASM
                                </div>
                                <div style={{ fontSize: '10px', color: '#999', marginTop: '4px' }}>
                                    (This may take 30-60 seconds on first load)
                                </div>
                            </div>
                        )}
                        {error && <div style={{ color: 'red', padding: '20px' }}>Error: {error}</div>}
                        
                        {/* Debug Info */}
                        {!loading && !error && (
                            <div style={{ padding: '12px', background: '#f0f0f0', fontSize: '11px', fontFamily: 'monospace', borderBottom: '1px solid #ccc' }}>
                                <div>Sections: {sections?.length || 0}</div>
                                <div>Settings keys: {settings ? Object.keys(settings).length : 0}</div>
                                {sections && sections.map(s => (
                                    <div key={s.id}>{s.title}: {s.fields.length} fields</div>
                                ))}
                            </div>
                        )}
                        
                        {sections && settings && (
                            <>
                                {/* Printer Settings Section */}
                                <div style={{ borderBottom: '2px solid #e0e0e0' }}>
                                    <CollapsibleSection 
                                        title={
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <Icons.Settings size={16} />
                                                <span>Printer</span>
                                            </div>
                                        } 
                                        defaultOpen={false}
                                    >
                                        <div style={{ padding: '8px 12px', background: '#f9f9f9', borderBottom: '1px solid #e0e0e0' }}>
                                            <div className="dropdown-selector" style={{ width: '100%', fontSize: '12px' }}>
                                                <span>Voron 2.4</span>
                                                <Icons.ChevronDown size={14} />
                                            </div>
                                        </div>
                                        {sections.filter(s => s.category === 'printer').map(section => (
                                            <CollapsibleSection key={section.id} title={section.title} defaultOpen={!section.collapsed}>
                                                {section.fields.map(field => (
                                                    <SettingsField 
                                                        key={field.key}
                                                        field={field}
                                                        value={settings[field.key]}
                                                        onChange={updateSetting}
                                                    />
                                                ))}
                                            </CollapsibleSection>
                                        ))}
                                    </CollapsibleSection>
                                </div>

                                {/* Filament Settings Section */}
                                <div style={{ borderBottom: '2px solid #e0e0e0' }}>
                                    <CollapsibleSection 
                                        title={
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <Icons.Package size={16} />
                                                <span>Filament</span>
                                            </div>
                                        } 
                                        defaultOpen={false}
                                    >
                                        <div style={{ padding: '8px 12px', background: '#f9f9f9', borderBottom: '1px solid #e0e0e0' }}>
                                            <div className="dropdown-selector" style={{ width: '100%', fontSize: '12px' }}>
                                                <span>Generic PLA</span>
                                                <Icons.ChevronDown size={14} />
                                            </div>
                                        </div>
                                        {sections.filter(s => s.category === 'filament').map(section => (
                                            <CollapsibleSection key={section.id} title={section.title} defaultOpen={!section.collapsed}>
                                                {section.fields.map(field => (
                                                    <SettingsField 
                                                        key={field.key}
                                                        field={field}
                                                        value={settings[field.key]}
                                                        onChange={updateSetting}
                                                    />
                                                ))}
                                            </CollapsibleSection>
                                        ))}
                                    </CollapsibleSection>
                                </div>

                                {/* Process Settings Section */}
                                <div>
                                    <CollapsibleSection 
                                        title={
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <Icons.Layers size={16} />
                                                <span>Process</span>
                                            </div>
                                        } 
                                        defaultOpen={true}
                                    >
                                        <div style={{ padding: '8px 12px', background: '#f9f9f9', borderBottom: '1px solid #e0e0e0' }}>
                                            <div className="dropdown-selector" style={{ width: '100%', fontSize: '12px' }}>
                                                <span>0.20mm Standard @Voron2</span>
                                                <Icons.ChevronDown size={14} />
                                            </div>
                                        </div>
                                        {sections.filter(s => s.category === 'process').map(section => (
                                            <CollapsibleSection key={section.id} title={section.title} defaultOpen={!section.collapsed}>
                                                {section.fields.map(field => (
                                                    <SettingsField 
                                                        key={field.key}
                                                        field={field}
                                                        value={settings[field.key]}
                                                        onChange={updateSetting}
                                                    />
                                                ))}
                                            </CollapsibleSection>
                                        ))}
                                    </CollapsibleSection>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Center Viewport */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#e8e8e8' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '8px 12px', background: 'white', borderBottom: '1px solid #ddd' }}>
                        <button className="toolbar-btn" onClick={() => addObject('cube')}>Add</button>
                        <div style={{width: '1px', height: '24px', background: '#ddd', margin: '0 8px'}}></div>
                        <button className={`toolbar-btn ${activeTool === 'move' ? 'active' : ''}`} onClick={() => setActiveTool('move')}>Move</button>
                        <button className={`toolbar-btn ${activeTool === 'rotate' ? 'active' : ''}`} onClick={() => setActiveTool('rotate')}>Rotate</button>
                        <button className={`toolbar-btn ${activeTool === 'scale' ? 'active' : ''}`} onClick={() => setActiveTool('scale')}>Scale</button>
                    </div>
                    <div style={{ flex: 1, position: 'relative' }}>
                        <Viewport3D mainTab={mainTab} objects={objects} />
                    </div>
                </div>

                {/* Right Sidebar */}
                <div style={{ width: '240px', display: 'flex', flexDirection: 'column', background: 'white', borderLeft: '1px solid #ddd' }}>
                    <div style={{ padding: '10px 12px', borderBottom: '1px solid #eee', fontWeight: 600, fontSize: '12px' }}>Objects</div>
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        {objects.length === 0 ? (
                            <div style={{ 
                                padding: '20px', 
                                textAlign: 'center', 
                                color: '#999', 
                                fontSize: '12px',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '8px'
                            }}>
                                <Icons.Package size={32} strokeWidth={1.5} />
                                <div>No objects on plate</div>
                                <div style={{ fontSize: '11px' }}>Click "Import Model" to load a file</div>
                            </div>
                        ) : (
                            objects.map(obj => (
                                <div key={obj.id} className={`object-tree-item ${selectedObject === obj.id ? 'selected' : ''}`} onClick={() => setSelectedObject(obj.id)}>
                                    <input type="checkbox" checked={obj.visible} onChange={() => toggleObjectVisibility(obj.id)} />
                                    <span>{obj.name}</span>
                                </div>
                            ))
                        )}
                    </div>
                    {selectedObjData && (
                        <div style={{ padding: '12px', background: '#fafafa', borderTop: '1px solid #eee', fontSize: '12px' }}>
                            <div style={{ fontWeight: 600, color: '#333', marginBottom: '8px' }}>{selectedObjData.name}</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', color: '#666' }}>
                                <span>Position:</span>
                                <span>{`X:${selectedObjData.position.x.toFixed(2)} Y:${selectedObjData.position.y.toFixed(2)} Z:${selectedObjData.position.z.toFixed(2)}`}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#666' }}>
                                <span>Size:</span>
                                <span>{`${selectedObjData.size}mm`}</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Status Bar */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                height: '24px',
                padding: '0 12px',
                background: '#2d2d2d',
                color: '#ddd',
                fontSize: '11px',
                gap: '16px'
            }}>
                <span>{`${objects.length} objects on plate`}</span>
                <span style={{color: '#666'}}>|</span>
                <span>{slicingStatus}</span>
                <span style={{ marginLeft: 'auto', color: '#999' }}>OrcaSlicer v2.0.0</span>
            </div>
        </div>
    );
}

export default OrcaSlicerApp;

