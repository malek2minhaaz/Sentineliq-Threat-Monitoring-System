/* SentinalIQ - Admin API Client (separate token from regular user session) */

const API_BASE = '/api';
const ADMIN_TOKEN_KEY = 'sentinaliq_admin_token';
const ADMIN_USER_KEY = 'sentinaliq_admin_user';

export const adminStorage = {
  getToken: () => localStorage.getItem(ADMIN_TOKEN_KEY),
  setSession: (token: string, user: unknown) => {
    localStorage.setItem(ADMIN_TOKEN_KEY, token);
    localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(user));
  },
  getUser: () => {
    try {
      const raw = localStorage.getItem(ADMIN_USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  clear: () => {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(ADMIN_USER_KEY);
  },
  hasSession: () => !!localStorage.getItem(ADMIN_TOKEN_KEY),
};

class AdminApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'AdminApiError';
  }
}

async function adminRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = adminStorage.getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });

  if (res.status === 401 || res.status === 403) {
    // Only auto-redirect when there was an existing session (e.g. expired token).
    // During a login attempt there is no token, so the backend's error message is
    // preserved and thrown for the AdminLogin page to display instead of a reload.
    if (token) {
      adminStorage.clear();
      window.location.href = '/admin/login';
    }
    const errBody = await res.text().catch(() => '');
    let message = 'Admin session expired';
    if (errBody && !errBody.includes('<')) {
      try {
        const parsed = JSON.parse(errBody);
        message = parsed?.detail || parsed?.message || errBody;
      } catch {
        message = errBody;
      }
    }
    throw new AdminApiError(message, res.status);
  }

  if (!res.ok) {
    const errBody = await res.text();
    throw new AdminApiError(errBody || `Request failed: ${res.status}`, res.status);
  }

  return res.json();
}

export const adminApi = {
  get: <T>(endpoint: string) => adminRequest<T>(endpoint),
  post: <T>(endpoint: string, body?: unknown) =>
    adminRequest<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};
