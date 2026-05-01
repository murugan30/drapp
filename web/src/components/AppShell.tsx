'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { useAuth } from '../lib/auth';
import { LocaleSwitcher } from './LocaleSwitcher';
import { Logo } from './Logo';
import styles from './AppShell.module.css';

type PatientTabKey = 'home' | 'appointments' | 'healthRecords' | 'profile';

export function AppShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations();
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isWelcome = pathname === '/welcome';

  const isStaff = user?.role === 'admin' || user?.role === 'doctor' || user?.role === 'assistant' || user?.role === 'lab';
  const isPatient = user?.role === 'patient';
  const isAdmin = user?.role === 'admin';
  const canSetAvailability = user?.role === 'admin' || user?.role === 'doctor';

  const isPatientMemberView = !!pathname && pathname.startsWith('/patients/') && pathname !== '/patients';
  const isPatientManageFamilyView = !!pathname && pathname === '/patients';
  const isPatientScheduleView =
    !!pathname && (pathname.startsWith('/appointments/schedule') || pathname.startsWith('/appointments/book'));
  const isPatientChatView = !!pathname && /^\/patients\/[^/]+$/.test(pathname);
  const hideShellChrome = isPatientChatView;

  const showStaffHeader = isStaff && !hideShellChrome;
  const showPatientHeader = isPatient && !isPatientMemberView && !isPatientManageFamilyView && !isPatientScheduleView;
  const isHome = pathname === '/home';
  const shellTopOffset = showStaffHeader || showPatientHeader ? '72px' : '0px';
  const showBottomTabs = isPatient && !isPatientScheduleView && !isPatientManageFamilyView && !isPatientChatView;

  const navItems = useMemo(() => {
    if (isWelcome || !isStaff) return [];
    if (user?.role === 'doctor') {
      return [
        { href: '/dashboard', label: t('home') },
        { href: '/appointments', label: t('appointments') },
        { href: '/availability', label: t('availability') },
        { href: '/health-records', label: t('healthRecords') },
        { href: '/settings', label: t('settings') },
      ];
    }
    if (user?.role === 'admin') {
      return [
        { href: '/dashboard', label: t('home') },
        { href: '/appointments', label: t('appointments') },
        { href: '/availability', label: t('availability') },
        { href: '/health-records', label: t('healthRecords') },
        { href: '/staff', label: t('staff') },
        { href: '/settings', label: t('settings') },
      ];
    }
    const items = [
      { href: '/dashboard', label: t('dashboard') },
      { href: '/patients', label: t('patients') },
      { href: '/appointments', label: t('appointments') },
      { href: '/documents', label: t('documents') },
    ];
    if (user?.role === 'assistant' || user?.role === 'lab') {
      items.push({ href: '/health-records', label: t('healthRecords') });
    }
    if (canSetAvailability) {
      items.push({ href: '/availability', label: t('availability') });
    }
    if (isAdmin) {
      items.push({ href: '/staff', label: t('staff') });
    }
    items.push({ href: '/settings', label: t('settings') });
    return items;
  }, [canSetAvailability, isAdmin, isStaff, isWelcome, t, user?.role]);

  const patientNavItems = useMemo(() => {
    if (isWelcome || !isPatient) return [];
    return [
      { key: 'home' as const, href: '/home', label: t('home') },
      { key: 'appointments' as const, href: '/appointments', label: t('appointments') },
      { key: 'healthRecords' as const, href: '/health-records', label: t('healthRecords') },
      { key: 'profile' as const, href: '/profile', label: t('profile') },
    ];
  }, [isPatient, isWelcome, t]);

  const renderPatientTabIcon = (key: PatientTabKey) => {
    switch (key) {
      case 'home':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 10.5 12 3l9 7.5" />
            <path d="M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10" />
          </svg>
        );
      case 'appointments':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 2v3" />
            <path d="M16 2v3" />
            <path d="M3 9h18" />
            <path d="M5 5h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
            <path d="M12 13v3l2 1" />
          </svg>
        );
      case 'healthRecords':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
            <path d="M14 2v6h6" />
            <path d="M8 13h8" />
            <path d="M8 17h8" />
          </svg>
        );
      case 'profile':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <path d="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
          </svg>
        );
      default:
        return null;
    }
  };

  const isActive = (href: string) => {
    if (!pathname) return false;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const handleLogout = () => {
    setDrawerOpen(false);
    logout();
  };

  const drawerNav = (
    <>
      <div className={styles.brand}>
        <Logo size={40} />
      </div>
      <nav className={styles.nav}>
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setDrawerOpen(false)}
            className={`${styles.navLink} ${isActive(item.href) ? styles.navLinkActive : ''}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className={styles.footer}>
        <LocaleSwitcher />
        {user ? (
          <button className={styles.signOut} onClick={handleLogout}>
            Sign out
          </button>
        ) : null}
      </div>
    </>
  );

  if (isWelcome) {
    return <>{children}</>;
  }

  return (
    <div className={styles.appShell}>
      {isStaff && !hideShellChrome ? <aside className={styles.sidebar}>{drawerNav}</aside> : null}

      <div className={styles.contentColumn} style={{ ['--shell-top-offset' as never]: shellTopOffset }}>
        {showStaffHeader ? (
          <header className={styles.mobileHeader}>
            <button
              className={styles.menuButton}
              type="button"
              aria-label="Open menu"
              onClick={() => setDrawerOpen(true)}
            >
              <span className={styles.menuIcon} />
            </button>
            <div className={styles.mobileBrand}>
              <Logo size={60} />
            </div>
          </header>
        ) : showPatientHeader ? (
          <header className={`${styles.patientHeader} ${!isHome ? 'border-b border-gray-200' : ''}`}>
            <div className={styles.patientBrand}>
              <Logo size={60} />
            </div>
            <div className={styles.patientHeaderRight}>
              {/* Removed translation switcher as per user request */}
            </div>
          </header>
        ) : null}

        <main className={isStaff ? styles.main : showBottomTabs ? styles.mainPatient : styles.mainFull}>{children}</main>
      </div>

      {showBottomTabs ? (
        <>
          <nav className={styles.bottomTabs} aria-label="Patient navigation">
            <div className={styles.bottomTabsInner}>
              {patientNavItems.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`${styles.tabLink} ${active ? styles.tabLinkActive : ''}`}
                  >
                    <span className={styles.tabIcon} aria-hidden="true">
                      {renderPatientTabIcon(item.key)}
                    </span>
                    <span className={styles.tabLabel}>{item.label}</span>
                    {active ? <span className={styles.tabActivePill} aria-hidden="true" /> : null}
                  </Link>
                );
              })}
            </div>
          </nav>
        </>
      ) : null}

      {isStaff && drawerOpen && !hideShellChrome ? (
        <div
          className={styles.drawerOverlay}
          onClick={() => setDrawerOpen(false)}
          role="button"
          tabIndex={0}
        >
          <aside
            className={styles.drawer}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            {drawerNav}
          </aside>
        </div>
      ) : null}
    </div>
  );
}
