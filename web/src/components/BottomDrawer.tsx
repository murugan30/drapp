'use client';

import { ReactNode, useEffect, useState } from 'react';

interface BottomDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: ReactNode;
}

export default function BottomDrawer({ isOpen, onClose, title, children }: BottomDrawerProps) {
    const [shouldRender, setShouldRender] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setShouldRender(true);
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
            const timer = setTimeout(() => setShouldRender(false), 300); // match transition duration
            return () => clearTimeout(timer);
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    if (!shouldRender) return null;

    return (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
            {/* Backdrop */}
            <div
                className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'
                    }`}
                onClick={onClose}
            />

            {/* Drawer */}
            <div
                className={`relative w-full bg-white rounded-t-3xl shadow-xl transition-transform duration-300 ease-out flex flex-col max-h-[90vh] ${isOpen ? 'translate-y-0' : 'translate-y-full'
                    }`}
            >
                <div className="flex-shrink-0 flex flex-col items-center pt-3 pb-2 px-6">
                    {/* Drag Handle */}
                    <div className="w-12 h-1.5 bg-gray-200 rounded-full mb-4" />

                    {/* Header */}
                    {title && (
                        <div className="w-full flex items-center justify-between">
                            <h2 className="text-lg font-bold text-gray-900">{title}</h2>
                            <button
                                onClick={onClose}
                                className="p-2 -mr-2 text-gray-400 hover:text-gray-600 active:scale-95 transition-all outline-none"
                            >
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M18 6 6 18M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    )}
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto px-6 pb-8 overscroll-contain">
                    {children}
                </div>
            </div>
        </div>
    );
}
