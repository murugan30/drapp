export const locales = ['en', 'ta'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

export function resolveLocaleFromCookie(cookieValue?: string | null): Locale {
  if (!cookieValue) return defaultLocale;
  return locales.includes(cookieValue as Locale) ? (cookieValue as Locale) : defaultLocale;
}

export async function getMessagesForLocale(locale: Locale) {
  return (await import(`../../messages/${locale}.json`)).default;
}
