import { NextIntlClientProvider } from 'next-intl';
import { Inter } from 'next/font/google';
import { cookies } from 'next/headers';
import './global.css';
import { ClientRoot } from '../components/ClientRoot';
import { defaultLocale, getMessagesForLocale, resolveLocaleFromCookie } from '../lib/i18n';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
  weight: ['300', '400', '500', '600', '700'],
});

export const metadata = {
  title: 'DrApp Clinic',
  description: 'Clinic operations, appointments, and patient care in one secure workspace.',
  manifest: '/manifest.json',
  themeColor: '#0254b7',
  icons: {
    apple: '/apple-touch-icon.png',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const locale = resolveLocaleFromCookie(cookieStore.get('locale')?.value) || defaultLocale;
  const messages = await getMessagesForLocale(locale);

  return (
    <html lang={locale} className={inter.variable}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ClientRoot>{children}</ClientRoot>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
