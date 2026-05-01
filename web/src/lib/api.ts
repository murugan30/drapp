const isProd = process.env.NODE_ENV === 'production';

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || (isProd ? '/api' : 'http://localhost:3000/api');

export function getToken() {
  return null;
}

export function setToken(token: string | null) {
  void token;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });
  if (!res.ok) {
    const error = await res.text();
    throw new Error(error || 'Request failed');
  }
  return (await res.json()) as T;
}
