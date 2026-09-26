import type { AuthPayload } from "./types";

const BASE = "/api/v1";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
  }
}

// The access token lives only in memory; the refresh token is an httpOnly cookie.
let accessToken: string | null = null;
let refreshing: Promise<AuthPayload | null> | null = null;
const sessionListeners = new Set<(payload: AuthPayload | null) => void>();

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

/** Notified whenever a refresh succeeds (new user data) or the session is lost (null). */
export const onSessionChange = (listener: (payload: AuthPayload | null) => void) => {
  sessionListeners.add(listener);
  return () => sessionListeners.delete(listener);
};

const emit = (payload: AuthPayload | null) => sessionListeners.forEach((l) => l(payload));

/** Exchanges the refresh cookie for a new access token. Concurrent callers share one request. */
export const refreshSession = (): Promise<AuthPayload | null> => {
  if (!refreshing) {
    refreshing = fetch(`${BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    })
      .then(async (res) => {
        if (!res.ok) return null;
        const json = await res.json();
        return json.data as AuthPayload;
      })
      .catch(() => null)
      .then((payload) => {
        setAccessToken(payload?.accessToken ?? null);
        emit(payload);
        return payload;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
};

type Query = Record<string, string | number | boolean | undefined | null>;

export const toQueryString = (query?: Query) => {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
};

export async function api<T = unknown>(
  path: string,
  { method = "GET", body, query, signal }: { method?: string; body?: unknown; query?: Query; signal?: AbortSignal } = {},
): Promise<T> {
  const send = () =>
    fetch(`${BASE}${path}${toQueryString(query)}`, {
      method,
      signal,
      credentials: "include",
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

  let res = await send();
  const isAuthCall = path.startsWith("/auth/login") || path.startsWith("/auth/refresh");
  if (res.status === 401 && !isAuthCall) {
    const session = await refreshSession();
    if (!session) throw new ApiError("Your session has expired. Please sign in again.", 401);
    res = await send();
  }

  let json: { data?: unknown; message?: string; errors?: { message?: string } } | null = null;
  try {
    json = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) {
    const detail = json?.errors?.message;
    throw new ApiError(json?.message && detail ? `${json.message}: ${detail}` : (json?.message ?? res.statusText), res.status, json);
  }
  return (json?.data ?? json) as T;
}

export const errorMessage = (err: unknown) =>
  err instanceof Error ? err.message : typeof err === "string" ? err : "Something went wrong";
