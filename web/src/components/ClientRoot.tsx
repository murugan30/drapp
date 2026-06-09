'use client';

import { usePathname } from 'next/navigation';
import { AuthProvider } from '../lib/auth';
import { ToastProvider } from '../lib/toast';
import { LocaleSwitcher } from './LocaleSwitcher';

export function ClientRoot({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideSwitcher = pathname?.startsWith('/login');

  return (
    <ToastProvider>
      <AuthProvider>
        {/* {hideSwitcher ? null : (
          <div className="fixed top-4 right-4 z-50">
            <LocaleSwitcher />
          </div>
        )} */}
        {children}
      </AuthProvider>
    </ToastProvider>
  );
}
