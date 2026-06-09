const isProd = process.env.NODE_ENV === 'production';

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || (isProd ? '/api' : 'http://localhost:3000/api');

export function getToken() {
  return null;
}

export function setToken(token: string | null) {
  void token;
}

type ApiFetchOptions = RequestInit & {
  disableToast?: boolean;
};

function extractErrorMessage(body: any): string {
  if (!body) return 'Request failed';
  if (typeof body === 'string') return body;
  if (Array.isArray(body)) return body.map(String).join('\n');

  const msg = (body as any).message;
  if (Array.isArray(msg)) {
    return msg.map(String).join('\n');
  }
  if (typeof msg === 'string' && msg.trim()) {
    return msg;
  }
  if (typeof (body as any).error === 'string' && (body as any).error.trim()) {
    return (body as any).error;
  }
  try {
    return JSON.stringify(body);
  } catch {
    return 'Request failed';
  }
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}) {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });
  if (!res.ok) {
    let parsed: any = null;
    try {
      parsed = await res.json();
    } catch {
      try {
        parsed = await res.text();
      } catch {
        parsed = null;
      }
    }

    const message = extractErrorMessage(parsed);
    const err = new Error(message);

    const toastFn = (globalThis as any)?.__drapp_toast;
    const allowToastOn401 =
      path.startsWith('/auth/login') ||
      path.startsWith('/auth/staff/login') ||
      path.startsWith('/auth/password-reset/confirm');

    const shouldToast =
      !options.disableToast &&
      typeof toastFn === 'function' &&
      (res.status !== 401 || allowToastOn401);

    if (shouldToast) {
      toastFn({ kind: 'error', message });
    }

    throw err;
  }
  return (await res.json()) as T;
}
