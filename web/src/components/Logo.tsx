import React from 'react';
import Image from 'next/image';

interface LogoProps extends React.SVGProps<SVGSVGElement> {
    size?: number | string;
    variant?: 'default' | 'white';
    priority?: boolean;
    fetchPriority?: 'high' | 'low' | 'auto';
}

export function Logo({ size = 32, variant = 'default', className, style, priority = false, fetchPriority }: LogoProps) {
    const numSize = typeof size === 'string' ? parseInt(size, 10) : size;
    const src = variant === 'white' ? '/logo-white.png' : '/logo.png';

    return (
        <Image
            src={src}
            alt="App Logo"
            width={numSize}
            height={numSize}
            className={className}
            style={style}
            priority={priority}
            fetchPriority={fetchPriority}
        />
    );
}
