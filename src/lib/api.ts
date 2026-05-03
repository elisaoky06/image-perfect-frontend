function localApiPort(): string {
  return (import.meta.env.VITE_API_PORT as string | undefined)?.trim() || "5000";
}

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

export function getApiBase(): string {
  const trimmed = (import.meta.env.VITE_API_URL as string | undefined)?.trim();

  if (trimmed) return trimmed.replace(/\/$/, "");

  if (typeof window !== "undefined") {
    const host = window.location.hostname;

    if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") {
      return `http://127.0.0.1:${localApiPort()}`;
    }

    if (isRfc1918IPv4(host)) {
      return `http://${host}:${localApiPort()}`;
    }
  }

  if (import.meta.env.DEV || import.meta.env.MODE === "development") {
    return `http://127.0.0.1:${localApiPort()}`;
  }

  return "";
}

export type ApiErrorBody = { error?: string };

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const base = getApiBase();
  const headers = new Headers(init.headers);

  const token = localStorage.getItem("token");

  if (token && token !== "undefined" && token !== "null") {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const body = init.body;

  if (
    body &&
    !headers.has("Content-Type") &&
    !(typeof FormData !== "undefined" && body instanceof FormData)
  ) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${base}${path}`, {
    ...init,
    headers,
  });

  const text = await res.text();

  let data: any = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem("token");
    }

    const msg = data?.error || res.statusText || "Request failed";
    throw new Error(msg);
  }

  return data as T;
}