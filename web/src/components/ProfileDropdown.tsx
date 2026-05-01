'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../lib/auth';

export default function ProfileDropdown() {
    const { user, logout } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (!user) return null;

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Avatar Trigger */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 shadow-sm border border-white hover:scale-105 active:scale-95 transition-transform outline-none"
            >
                <span className="text-sm font-bold text-white">
                    {user.role === 'patient' ? 'P' : 'S'}
                </span>
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute right-0 mt-3 w-64 bg-white rounded-3xl shadow-xl border border-gray-100 p-2 z-50 animate-in slide-in-from-top-2 fade-in duration-200">

                    <div className="px-3 py-3 border-b border-gray-100 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-inner">
                            <span className="text-base font-bold text-white tracking-wide">
                                {user.role === 'patient' ? 'P' : 'S'}
                            </span>
                        </div>
                        <div>
                            <p className="text-sm font-bold text-gray-900 tracking-tight">
                                {user.role === 'patient' ? 'Patient' : 'Staff'}
                            </p>
                            <p className="text-xs font-medium text-gray-500">
                                {user.mobile}
                            </p>
                        </div>
                    </div>

                    <div className="py-2">
                        <Link
                            href="/patients"
                            onClick={() => setIsOpen(false)}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-gray-50 active:bg-gray-100 transition-colors text-gray-700"
                        >
                            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-[#0254b7] flex-shrink-0">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                    <circle cx="9" cy="7" r="4"></circle>
                                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                                </svg>
                            </div>
                            <span className="text-sm font-semibold">Family Members</span>
                        </Link>

                        <button
                            onClick={() => {
                                setIsOpen(false);
                                logout();
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-red-50 text-red-600 transition-colors text-left"
                        >
                            <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                                    <polyline points="16 17 21 12 16 7"></polyline>
                                    <line x1="21" y1="12" x2="9" y2="12"></line>
                                </svg>
                            </div>
                            <span className="text-sm font-semibold">Sign Out</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
