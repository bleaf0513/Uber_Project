import { Capacitor } from "@capacitor/core";

const PROD_API = "https://uber-project-psfi.onrender.com";

function cleanUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function isBadProductionApiBase(value) {
  const cleaned = cleanUrl(value);

  if (!cleaned) return true;

  /**
   * En producción NO queremos que la API apunte al mismo dominio del frontend,
   * porque eso causa errores como:
   *
   * Cannot POST /enterprise-deliveries/optimize-routes
   *
   * ya que centralgo.mercalan.com.co sirve el frontend, no el backend Express.
   */
  if (typeof window !== "undefined") {
    const currentOrigin = cleanUrl(window.location.origin);

    if (cleaned === currentOrigin) {
      return true;
    }

    if (cleaned.includes("centralgo.mercalan.com.co")) {
      return true;
    }

    if (cleaned === "/" || cleaned === "." || cleaned === "./") {
      return true;
    }
  }

  return false;
}

export function getApiBaseUrl() {
  /**
   * App nativa Android/iOS con Capacitor:
   * siempre debe usar el backend público de Render.
   */
  if (Capacitor.isNativePlatform()) {
    return PROD_API;
  }

  /**
   * Desarrollo local:
   * permite usar VITE_BASE_URL si lo configuraste.
   * Si no existe, retorna vacío para usar el proxy de Vite.
   */
  if (import.meta.env.DEV) {
    const devBaseUrl = cleanUrl(import.meta.env.VITE_BASE_URL);

    if (devBaseUrl) {
      return devBaseUrl;
    }

    return "";
  }

  /**
   * Producción web:
   * siempre usamos Render, excepto si VITE_BASE_URL trae una URL válida
   * y diferente al dominio del frontend.
   */
  const productionEnvBaseUrl = cleanUrl(import.meta.env.VITE_BASE_URL);

  if (!isBadProductionApiBase(productionEnvBaseUrl)) {
    return productionEnvBaseUrl;
  }

  return PROD_API;
}

export function getApiHintOrigin() {
  return getApiBaseUrl();
}