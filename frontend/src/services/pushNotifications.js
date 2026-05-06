import axios from "axios";
import { getToken, onMessage } from "firebase/messaging";
import { getFirebaseMessaging } from "../firebase";
import { getApiBaseUrl } from "../apiBase";

const PUSH_TOKEN_STORAGE_KEY = "centralgo_fcm_token";
const PUSH_DEVICE_ID_STORAGE_KEY = "centralgo_push_device_id";

function getOrCreateDeviceId() {
  try {
    const current = localStorage.getItem(PUSH_DEVICE_ID_STORAGE_KEY);

    if (current) return current;

    const next =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `device-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    localStorage.setItem(PUSH_DEVICE_ID_STORAGE_KEY, next);

    return next;
  } catch {
    return `device-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

function getPlatform() {
  const userAgent = navigator?.userAgent || "";

  if (/android/i.test(userAgent)) return "android";
  if (/iphone|ipad|ipod/i.test(userAgent)) return "ios";

  return "web";
}

function canUseNotifications() {
  return (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator
  );
}

async function ensureServiceWorkerRegistration() {
  if (!("serviceWorker" in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js"
    );

    return registration;
  } catch (error) {
    console.error("[push] Error registrando service worker:", error);
    return null;
  }
}

async function saveTokenToBackend({ token, role }) {
  const authToken =
    role === "captain"
      ? localStorage.getItem("captainToken") || localStorage.getItem("token")
      : localStorage.getItem("token");

  if (!authToken) {
    console.warn("[push] No hay token de sesión para registrar push.");
    return false;
  }

  const endpoint =
    role === "captain"
      ? `${getApiBaseUrl()}/captains/push-token`
      : `${getApiBaseUrl()}/users/push-token`;

  await axios.post(
    endpoint,
    {
      token,
      platform: getPlatform(),
      deviceId: getOrCreateDeviceId(),
      userAgent: navigator?.userAgent || "",
    },
    {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    }
  );

  try {
    localStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token);
  } catch {
    // No bloqueamos si localStorage falla.
  }

  return true;
}

export async function requestPushPermissionAndRegister(role = "user") {
  try {
    if (!canUseNotifications()) {
      console.warn("[push] Este navegador no soporta notificaciones push.");
      return {
        ok: false,
        reason: "not_supported",
      };
    }

    const messaging = await getFirebaseMessaging();

    if (!messaging) {
      return {
        ok: false,
        reason: "messaging_not_available",
      };
    }

    let permission = Notification.permission;

    if (permission === "default") {
      permission = await Notification.requestPermission();
    }

    if (permission !== "granted") {
      console.warn("[push] Permiso de notificación no concedido:", permission);

      return {
        ok: false,
        reason: permission,
      };
    }

    const serviceWorkerRegistration = await ensureServiceWorkerRegistration();

    if (!serviceWorkerRegistration) {
      return {
        ok: false,
        reason: "service_worker_failed",
      };
    }

    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;

    if (!vapidKey) {
      console.warn("[push] Falta VITE_FIREBASE_VAPID_KEY.");
      return {
        ok: false,
        reason: "missing_vapid_key",
      };
    }

    const fcmToken = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration,
    });

    if (!fcmToken) {
      return {
        ok: false,
        reason: "empty_token",
      };
    }

    await saveTokenToBackend({
      token: fcmToken,
      role,
    });

    console.log("[push] Token push registrado:", {
      role,
      tokenPreview: `${fcmToken.slice(0, 18)}...`,
    });

    return {
      ok: true,
      token: fcmToken,
    };
  } catch (error) {
    console.error("[push] Error solicitando/registrando push:", error);

    return {
      ok: false,
      reason: error?.message || "push_error",
    };
  }
}

export async function listenForegroundPushNotifications(onNotification) {
  try {
    const messaging = await getFirebaseMessaging();

    if (!messaging) return null;

    return onMessage(messaging, (payload) => {
      console.log("[push] Notificación en primer plano:", payload);

      if (typeof onNotification === "function") {
        onNotification(payload);
      }
    });
  } catch (error) {
    console.error("[push] Error escuchando notificaciones:", error);
    return null;
  }
}