/* SentinalIQ - API Client */

import { adminStorage } from './adminApi';

const API_BASE = '/api';

interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

function getToken(): string | null {
  return localStorage.getItem('sentinaliq_token');
}

function getRefreshToken(): string | null {
  return localStorage.getItem('sentinaliq_refresh');
}

function setTokens(token: string, refresh: string) {
  localStorage.setItem('sentinaliq_token', token);
  localStorage.setItem('sentinaliq_refresh', refresh);
}

function clearTokens() {
  localStorage.removeItem('sentinaliq_token');
  localStorage.removeItem('sentinaliq_refresh');
  localStorage.removeItem('sentinaliq_user');
}

async function refreshToken(): Promise<boolean> {
  const refresh = getRefreshToken();
  if (!refresh) return false;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${refresh}` },
    });
    if (!res.ok) return false;
    const data = await res.json();
    localStorage.setItem('sentinaliq_token', data.access_token);
    // Keep the mirrored admin-panel token in sync so an admin session that was
    // seeded via the regular login doesn't go stale after a token refresh.
    if (adminStorage.hasSession()) {
      adminStorage.setSession(data.access_token, adminStorage.getUser());
    }
    return true;
  } catch {
    return false;
  }
}

async function request<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const token = getToken();
  const { params, ...fetchOpts } = options;

  let url = `${API_BASE}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') searchParams.append(k, String(v));
    });
    const qs = searchParams.toString();
    if (qs) url += `?${qs}`;
  }

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!(fetchOpts.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  let res = await fetch(url, { ...fetchOpts, headers });

  // Try refresh on 401
  if (res.status === 401 && getRefreshToken()) {
    const refreshed = await refreshToken();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${getToken()}`;
      res = await fetch(url, { ...fetchOpts, headers });
    } else {
      clearTokens();
      window.location.href = '/login';
      throw new ApiError('Session expired', 401);
    }
  }

  if (!res.ok) {
    const errBody = await res.text();
    throw new ApiError(errBody || `Request failed: ${res.status}`, res.status);
  }

  return res.json();
}

export const api = {
  get: <T>(endpoint: string, params?: Record<string, string | number | boolean | undefined>) =>
    request<T>(endpoint, { params }),

  post: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),

  put: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  patch: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  del: <T>(endpoint: string) =>
    request<T>(endpoint, {
      method: 'DELETE',
    }),

  upload: <T>(endpoint: string, formData: FormData) =>
    request<T>(endpoint, {
      method: 'POST',
      body: formData,
    }),

  setTokens,
  clearTokens,
  getToken,
};
