'use client';

import { useRouter } from 'next/navigation';

interface TopHeaderProps {
    title: string;
    subtitle?: React.ReactNode;
    onBack?: () => void;
    backHref?: string;
    className?: string;
    rightElement?: React.ReactNode;
}

export default function TopHeader({ title, subtitle, onBack, backHref, className = 'bg-white backdrop-blur-xl', rightElement }: TopHeaderProps) {
    const router = useRouter();

    const handleBack = () => {
        if (onBack) {
            onBack();
        } else if (backHref) {
            router.push(backHref);
        } else {
            router.back();
        }
    };

    return (
        <div className={`flex items-center justify-between px-6 pt-4 pb-4 sticky top-0 z-20 transition-all border-b border-gray-100 ${className}`}>
            <button
                onClick={handleBack}
                className="flex items-center justify-center text-gray-900 active:scale-95 transition-transform"
            >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m15 18-6-6 6-6" />
                </svg>
            </button>
            <div className="flex flex-col items-center px-4 text-center">
                <h1 className="text-base font-bold text-gray-900 leading-tight">{title}</h1>
                {subtitle && <div className="text-xs text-gray-500 mt-0.5">{subtitle}</div>}
            </div>
            {rightElement ? (
                <div>{rightElement}</div>
            ) : (
                <div className="w-6 flex-shrink-0" />
            )}
        </div>
    );
}
