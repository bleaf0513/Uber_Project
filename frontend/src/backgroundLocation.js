import { Capacitor, registerPlugin } from "@capacitor/core";

const BackgroundLocationPlugin = registerPlugin("BackgroundLocationPlugin");

export async function startBackgroundTracking({ driverId, token, apiBaseUrl }) {
  console.log("[BG-NATIVE] startBackgroundTracking llamado", {
    driverId,
    hasToken: !!token,
    apiBaseUrl,
    isNative: Capacitor.isNativePlatform(),
    platform: Capacitor.getPlatform(),
  });

  if (!Capacitor.isNativePlatform()) {
    console.warn("[BG-NATIVE] No es app nativa Capacitor");
    return { started: false, reason: "not_native" };
  }

  if (!driverId || !token || !apiBaseUrl) {
    console.error("[BG-NATIVE] Faltan datos", {
      driverId,
      hasToken: !!token,
      apiBaseUrl,
    });
    throw new Error("driverId, token y apiBaseUrl son obligatorios");
  }

  const result = await BackgroundLocationPlugin.startTracking({
    driverId,
    token,
    apiBaseUrl,
  });

  console.log("[BG-NATIVE] Respuesta plugin:", result);

  return result;
}

export async function stopBackgroundTracking() {
  console.log("[BG-NATIVE] stopBackgroundTracking llamado");

  if (!Capacitor.isNativePlatform()) {
    return { stopped: false, reason: "not_native" };
  }

  return await BackgroundLocationPlugin.stopTracking();
}