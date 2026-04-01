/**
 * Base URL for REST + Socket.IO client.
 * - Dev / empty VITE_BASE_URL: same origin as Vite (requests like /captain/... are proxied to port 4000).
 * - Set VITE_BASE_URL in .env to call the API directly (e.g. http://127.0.0.1:4000).
 */
export function getApiBaseUrl() {
  const v = import.meta.env.VITE_BASE_URL;
  if (v != null && String(v).trim() !== "") {
    return String(v).replace(/\/+$/, "");
  }
  if (import.meta.env.DEV) {
    return "";
  }
  return "http://127.0.0.1:4000";
}

/** Human-readable API target for error toasts (backend must listen on 4000 when using the proxy). */
export function getApiHintOrigin() {
  const base = getApiBaseUrl();
  if (base) return base;
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin} (proxied → http://127.0.0.1:4000)`;
  }
  return "http://127.0.0.1:4000";
}
