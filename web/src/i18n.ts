import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { defaultLocale, getMessagesForLocale, resolveLocaleFromCookie } from './lib/i18n';

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const locale = resolveLocaleFromCookie(cookieStore.get('locale')?.value) || defaultLocale;
  return {
    locale,
    messages: await getMessagesForLocale(locale),
  };
});
