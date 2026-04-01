import { getApiBaseUrl } from "./apiBase";

/** Same host as REST API; Socket.IO is on the same HTTP server (or Vite proxy in dev). */
export function getSocketBaseUrl() {
  const base = getApiBaseUrl();
  if (base) return base;
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "http://127.0.0.1:5173";
}
