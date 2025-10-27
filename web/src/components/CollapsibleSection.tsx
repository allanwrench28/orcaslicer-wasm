import React, { useState, ReactNode } from 'react';
import { Icons } from '@/components/Icons';

interface CollapsibleSectionProps {
    title: string | ReactNode;
    children: ReactNode;
    defaultOpen?: boolean;
}

export function CollapsibleSection({ title, children, defaultOpen = true }: CollapsibleSectionProps) {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <>
            <div className="section-header" onClick={() => setIsOpen(!isOpen)}>
                <span>{title}</span>
                <span className={`chevron ${isOpen ? '' : 'collapsed'}`}>
                    <Icons.ChevronDown />
                </span>
            </div>
            {isOpen && <div className="section-content">{children}</div>}
        </>
    );
}
