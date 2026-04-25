import { Capacitor } from "@capacitor/core";

const PROD_API = "https://uber-project-psfi.onrender.com";

export function getApiBaseUrl() {
  const v = import.meta.env.VITE_BASE_URL;
  if (v != null && String(v).trim() !== "") {
    return String(v).replace(/\/+$/, "");
  }

  if (Capacitor.isNativePlatform()) {
    return PROD_API;
  }

  if (import.meta.env.DEV) {
    return "";
  }

  return PROD_API;
}

export function getApiHintOrigin() {
  return getApiBaseUrl();
}