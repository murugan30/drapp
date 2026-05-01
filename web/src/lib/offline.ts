'use client';

import { useEffect, useState } from 'react';
import { get, set } from 'idb-keyval';
import { apiFetch } from './api';

export function useOfflineStatus() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return offline;
}

export async function cachedFetch<T>(key: string, path: string) {
  try {
    const data = await apiFetch<T>(path);
    await set(key, data);
    return { data, offline: false };
  } catch (err) {
    const cached = await get<T>(key);
    if (cached) {
      return { data: cached, offline: true };
    }
    throw err;
  }
}
