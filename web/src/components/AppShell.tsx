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

  const showStaffHeader = isStaff && !hideShellChrome && !isPatientManageFamilyView;
  const showPatientHeader = isPatient && !isPatientMemberView && !isPatientManageFamilyView && !isPatientScheduleView;
  const isHome = pathname === '/home';
  const isShellHome = isHome || pathname === '/dashboard';
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

  const pageTitle = useMemo(() => {
    if (!pathname) return '';

    const findBestMatch = (items: Array<{ href: string; label: string }>) => {
      let best: { href: string; label: string } | null = null;
      for (const item of items) {
        const isMatch = pathname === item.href || pathname.startsWith(`${item.href}/`);
        if (!isMatch) continue;
        if (!best || item.href.length > best.href.length) {
          best = item;
        }
      }
      return best?.label || '';
    };

    const fromNav = isPatient
      ? findBestMatch(patientNavItems.map((i) => ({ href: i.href, label: i.label })))
      : findBestMatch(navItems);
    if (fromNav) return fromNav;

    if (pathname.startsWith('/patients')) {
      return user?.role === 'patient' ? t('members') : t('patients');
    }
    if (pathname.startsWith('/appointments')) {
      return t('appointments');
    }
    if (pathname.startsWith('/documents')) {
      return t('documents');
    }
    if (pathname.startsWith('/availability')) {
      return t('availability');
    }
    if (pathname.startsWith('/health-records')) {
      return t('healthRecords');
    }
    if (pathname.startsWith('/settings')) {
      return t('settings');
    }
    if (pathname.startsWith('/staff')) {
      return t('staff');
    }
    if (pathname.startsWith('/dashboard')) {
      return user?.role === 'assistant' || user?.role === 'lab' ? t('dashboard') : t('home');
    }
    return '';
  }, [isPatient, navItems, pathname, patientNavItems, t, user?.role]);

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

  const renderNavIcon = (href: string) => {
    const className = styles.navIcon;
    const stroke = { strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
    switch (true) {
      case href === '/dashboard' || href === '/home':
        return (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" {...stroke}>
            <path d="M3 10.5 12 3l9 7.5" />
            <path d="M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10" />
          </svg>
        );
      case href === '/appointments':
        return (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" {...stroke}>
            <path d="M8 2v3" />
            <path d="M16 2v3" />
            <path d="M3 9h18" />
            <path d="M5 5h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
            <path d="M12 13v3l2 1" />
          </svg>
        );
      case href === '/availability':
        return (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" {...stroke}>
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
        );
      case href === '/health-records':
        return (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" {...stroke}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
            <path d="M14 2v6h6" />
            <path d="M8 13h8" />
            <path d="M8 17h8" />
          </svg>
        );
      case href === '/patients':
        return (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" {...stroke}>
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        );
      case href === '/documents':
        return (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" {...stroke}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
            <path d="M14 2v6h6" />
            <path d="M16 13H8" />
            <path d="M16 17H8" />
            <path d="M10 9H8" />
          </svg>
        );
      case href === '/staff':
        return (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" {...stroke}>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
            <path d="m9 12 2 2 4-4" />
          </svg>
        );
      case href === '/settings':
        return (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" {...stroke}>
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.47a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        );
      default:
        return (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" {...stroke}>
            <circle cx="12" cy="12" r="10" />
          </svg>
        );
    }
  };

  const sidebarContent = (
    <>
      <nav className={styles.nav}>
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setDrawerOpen(false)}
            className={`${styles.navLink} ${isActive(item.href) ? styles.navLinkActive : ''}`}
          >
            {renderNavIcon(item.href)}
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
      {user ? (
        <div className={styles.userInfo}>
          <div className={styles.userAvatar}>
            {(user?.name?.[0] || user?.mobile?.[0] || 'U').toUpperCase()}
          </div>
          <div className={styles.userMeta}>
            <div className={styles.userName}>{user?.name || user?.mobile || 'User'}</div>
            <div className={styles.userRole}>{user?.role || 'User'}</div>
          </div>
        </div>
      ) : null}
      <div className={styles.footer}>
        <LocaleSwitcher />
        {user ? (
          <button className={styles.signOut} onClick={handleLogout}>
            <svg className={styles.signOutIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
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
      <div className={styles.shellBg} aria-hidden="true" />
      {isStaff && !hideShellChrome ? (
        <aside className={styles.sidebar}>
          <div className={styles.brand}>
            <Logo size={70} />
          </div>
          {sidebarContent}
        </aside>
      ) : null}

      <div className={styles.contentColumn} style={{ ['--shell-top-offset' as never]: shellTopOffset }}>
        {!hideShellChrome && !isPatientManageFamilyView && (pageTitle || isShellHome) ? (
          <header className={styles.desktopHeader} aria-label="Page title">
            {isShellHome ? <Logo size={70} /> : <div className={styles.desktopHeaderTitle}>{pageTitle}</div>}
          </header>
        ) : null}

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
            <div className={styles.shellTitle} aria-label="Page">
              {isShellHome ? <Logo size={70} /> : <div className={styles.shellTitleText}>{pageTitle}</div>}
            </div>
            <div className={styles.shellRight} />
          </header>
        ) : showPatientHeader ? (
          <header className={`${styles.patientHeader} ${!isHome ? 'border-b border-gray-200' : ''}`}>
            <div className={styles.shellLeft} />
            <div className={styles.shellTitle} aria-label="Page">
              {isShellHome ? <Logo size={70} /> : <div className={styles.shellTitleText}>{pageTitle}</div>}
            </div>
            <div className={styles.shellRight} />
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
            <div className={styles.drawerHeader}>
              <div className={styles.brand}>
                <Logo size={70} />
              </div>
              <button
                type="button"
                className={styles.drawerClose}
                onClick={() => setDrawerOpen(false)}
                aria-label="Close menu"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>
            <div className={styles.drawerBody}>
              {sidebarContent}
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
