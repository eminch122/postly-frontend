/**
 * api-client.ts
 * Typed fetch wrapper that talks to the Express API gateway.
 * - Reads NEXT_PUBLIC_API_URL for the base URL.
 * - Automatically attaches the stored Bearer token.
 * - Parses JSON responses and throws typed ApiError on non-2xx.
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// ── Token storage ─────────────────────────────────────────────────────────────
// Access tokens live in memory (fast, XSS-safer) and are backed up to
// localStorage so they survive a page refresh. The refresh token is
// stored as an httpOnly cookie by the server and is handled transparently.

let _accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  _accessToken = token;
  if (typeof window !== "undefined") {
    if (token) {
      localStorage.setItem("postly_at", token);
    } else {
      localStorage.removeItem("postly_at");
    }
  }
}

export function getAccessToken(): string | null {
  if (_accessToken) return _accessToken;
  if (typeof window !== "undefined") {
    _accessToken = localStorage.getItem("postly_at");
  }
  return _accessToken;
}

// ── Session cookie (used by middleware for server-side routing) ──────────────
// NOT a security token — just a routing hint readable by Next.js middleware.
//
// SameSite=Lax (not Strict) is deliberate. Strict drops this cookie on any
// top-level navigation that originated on a third-party site, which means the
// browser won't send it when payment gateways (Flouci) or OAuth providers
// redirect the user back to us — the middleware then sees no session and
// bounces them to /login. Lax allows top-level GET navigations to carry the
// cookie while still blocking subresource and POST CSRF, which is the same
// security posture this cookie needs (it's not a security token, the real
// auth is the httpOnly refreshToken + Bearer access token).
export function setSessionCookie(value: 'pending' | 'active' | null): void {
  if (typeof document === 'undefined') return;
  if (value === null) {
    document.cookie = 'postly_session=; path=/; max-age=0; samesite=lax';
  } else {
    const maxAge = 7 * 24 * 60 * 60; // 7 days — mirrors refresh token TTL
    document.cookie = `postly_session=${value}; path=/; max-age=${maxAge}; samesite=lax`;
  }
}

export function clearAuthSession() {
  setAccessToken(null);
  setSessionCookie(null);
}

// ── Error type ────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ── Core fetch helper ─────────────────────────────────────────────────────────

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Skip auth header — used for login/register */
  noAuth?: boolean;
}

let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string | null) => void; reject: (err: any) => void }> = [];

function processQueue(error: any, token: string | null = null) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, noAuth, ...init } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
  };

  if (!noAuth) {
    const token = getAccessToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  let response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    credentials: "include", // send httpOnly refresh-token cookie
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // Intercept 401 Unauthorized for token refresh
  if (response.status === 401 && !noAuth && path !== "/api/v1/auth/refresh") {
    if (isRefreshing) {
      // Wait for the current refresh to finish
      try {
        const newToken = await new Promise<string | null>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        });
        if (newToken) {
          headers["Authorization"] = `Bearer ${newToken}`;
          response = await fetch(`${BASE_URL}${path}`, {
            ...init,
            credentials: "include",
            headers,
            body: body !== undefined ? JSON.stringify(body) : undefined,
          });
        }
      } catch (err) {
        throw new ApiError(401, "Session expired");
      }
    } else {
      isRefreshing = true;
      try {
        const refreshRes = await fetch(`${BASE_URL}/api/v1/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        });

        if (refreshRes.ok) {
          const refreshJson = await refreshRes.json();
          const newToken = refreshJson?.data?.accessToken ?? refreshJson?.accessToken;
          setAccessToken(newToken);
          processQueue(null, newToken);

          // Retry the original request
          headers["Authorization"] = `Bearer ${newToken}`;
          response = await fetch(`${BASE_URL}${path}`, {
            ...init,
            credentials: "include",
            headers,
            body: body !== undefined ? JSON.stringify(body) : undefined,
          });
        } else {
          processQueue(new Error("Refresh failed"), null);
          clearAuthSession();
          throw new ApiError(401, "Session expired");
        }
      } catch (err) {
        processQueue(err, null);
        clearAuthSession();
        throw new ApiError(401, "Session expired");
      } finally {
        isRefreshing = false;
      }
    }
  }

  if (!response.ok) {
    let errorMessage = `API error ${response.status}`;
    let errBody: unknown = undefined;
    try {
      errBody = await response.json();
      const body = errBody as { message?: string; errors?: Array<{ field: string; message: string }> };
      // When the Zod middleware bounces a request it returns a generic
      // "Validation failed" plus a per-field errors[] array. Surface the
      // first concrete field error so the caller can show something useful.
      if (Array.isArray(body?.errors) && body.errors.length > 0) {
        const first = body.errors[0];
        errorMessage = first?.field
          ? `${first.field}: ${first.message}`
          : first?.message ?? body.message ?? errorMessage;
      } else {
        errorMessage = body?.message ?? errorMessage;
      }
    } catch {
      // ignore parse errors
    }
    throw new ApiError(response.status, errorMessage, errBody);
  }

  // 204 No Content — nothing to parse
  if (response.status === 204) return undefined as T;

  const json = await response.json();
  // Unwrap the standard { success, data, message } envelope
  return (json?.data ?? json) as T;
}

// ── Convenience methods ───────────────────────────────────────────────────────

export const apiClient = {
  get: <T>(path: string, options?: Omit<RequestOptions, "body">) =>
    request<T>(path, { ...options, method: "GET" }),

  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "POST", body }),

  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PUT", body }),

  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PATCH", body }),

  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "DELETE" }),
};
