import { Capacitor } from "@capacitor/core";

const PROD_API = "https://uber-project-psfi.onrender.com";
const LOCAL_API = "http://localhost:4000";

function cleanUrl(value) {
  return String(value || "")
    .trim()
    .replace(/\/+$/, "");
}

function isBadProductionApiBase(value) {
  const cleaned = cleanUrl(value);

  if (!cleaned) {
    return true;
  }

  /*
   * En producción no queremos que la API apunte
   * al mismo dominio donde está servido el frontend.
   */
  if (typeof window !== "undefined") {
    const currentOrigin = cleanUrl(
      window.location.origin
    );

    if (cleaned === currentOrigin) {
      return true;
    }

    if (
      cleaned.includes(
        "centralgo.mercalan.com.co"
      )
    ) {
      return true;
    }

    if (
      cleaned === "/" ||
      cleaned === "." ||
      cleaned === "./"
    ) {
      return true;
    }
  }

  return false;
}

export function getApiBaseUrl() {
  /*
   * Aplicación móvil instalada con Capacitor:
   * debe usar el backend público.
   */
  if (Capacitor.isNativePlatform()) {
    return PROD_API;
  }

  /*
   * Desarrollo local con Vite:
   * siempre utiliza el backend local.
   *
   * Esto evita que localhost:5173 termine enviando
   * las peticiones al backend antiguo de Render.
   */
  if (import.meta.env.DEV) {
    return LOCAL_API;
  }

  /*
   * Producción web:
   * permite una URL configurada mediante VITE_BASE_URL,
   * siempre que sea válida.
   */
  const productionEnvBaseUrl = cleanUrl(
    import.meta.env.VITE_BASE_URL
  );

  if (
    !isBadProductionApiBase(
      productionEnvBaseUrl
    )
  ) {
    return productionEnvBaseUrl;
  }

  return PROD_API;
}

export function getApiHintOrigin() {
  return getApiBaseUrl();
}