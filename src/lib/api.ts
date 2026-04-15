function localApiPort(): string {
  return (import.meta.env.VITE_API_PORT as string | undefined)?.trim() || "5000";
}

/** True for typical LAN dev URLs (same machine or phone on Wi‑Fi) so API hits host:5000, not empty base. */
function isRfc1918IPv4(hostname: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

/**
 * Base URL for API requests.
 * - `VITE_API_URL` in `.env` wins when set.
 * - If the page is opened on localhost / 127.0.0.1 / ::1, we always talk to the API on
 *   127.0.0.1:PORT (default 5000). This does not rely on `import.meta.env.DEV` (which is
 *   false for `vite preview` and production builds), and avoids the Vite proxy breaking
 *   multipart `/api/auth/register`.
 */
export function getApiBase(): string {
  const trimmed = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
  let out: string | undefined;

  if (trimmed) {
    out = trimmed.replace(/\/$/, "");
  } else if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") {
      out = `http://127.0.0.1:${localApiPort()}`;
    } else if (isRfc1918IPv4(host)) {
      out = `http://${host}:${localApiPort()}`;
    }
  }

  if (out === undefined || out === "") {
    if (import.meta.env.DEV || import.meta.env.MODE === "development") {
      out = `http://127.0.0.1:${localApiPort()}`;
    } else {
      out = "";
    }
  }

  const final = out || "";

  // #region agent log
  fetch("http://127.0.0.1:7811/ingest/6c86c919-6589-407b-8e31-fd0612b14d82", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "6424f2" },
    body: JSON.stringify({
      sessionId: "6424f2",
      location: "api.ts:getApiBase",
      message: "getApiBase resolved",
      data: {
        final,
        viteApiUrlSet: Boolean(trimmed),
        hostname: typeof window !== "undefined" ? window.location.hostname : null,
        href: typeof window !== "undefined" ? window.location.href : null,
        mode: String(import.meta.env.MODE),
        dev: Boolean(import.meta.env.DEV),
      },
      timestamp: Date.now(),
      hypothesisId: "H1",
      runId: "post-fix",
    }),
  }).catch(() => {});
  // #endregion

  return final;
}

export type ApiErrorBody = { error?: string };

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const base = getApiBase();
  const headers = new Headers(init.headers);
  const body = init.body;
  if (body && !headers.has("Content-Type") && !(typeof FormData !== 'undefined' && body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const token = localStorage.getItem("token");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${base}${path}`, {
    ...init,
    headers,
  });

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    const msg = (data as ApiErrorBody)?.error || res.statusText || "Request failed";
    throw new Error(msg);
  }

  return data as T;
}
