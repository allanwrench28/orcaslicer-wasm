import React from 'react';

export const Icons = {
    ChevronDown: ({ size = 12 }: { size?: number } = {}) => (
        <svg width={size} height={size} viewBox="0 0 12 12" fill="currentColor">
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
        </svg>
    ),
    ChevronRight: () => (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
        </svg>
    ),
    Package: ({ size = 24, strokeWidth = 2 }: { size?: number, strokeWidth?: number }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}>
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" strokeLinecap="round" strokeLinejoin="round"/>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="12" y1="22.08" x2="12" y2="12" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
    ),
    Settings: ({ size = 24, strokeWidth = 2 }: { size?: number, strokeWidth?: number }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}>
            <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 1v6m0 6v6m8.66-15l-3 5.2M9.34 12.8L6.34 18M23 12h-6m-6 0H1m15.66 8.66l-3-5.2M9.34 11.2l-3-5.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
    ),
    Layers: ({ size = 24, strokeWidth = 2 }: { size?: number, strokeWidth?: number }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}>
            <polygon points="12 2 2 7 12 12 22 7 12 2" strokeLinecap="round" strokeLinejoin="round"/>
            <polyline points="2 17 12 22 22 17" strokeLinecap="round" strokeLinejoin="round"/>
            <polyline points="2 12 12 17 22 12" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
    )
};
