import React, { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { getApiBaseUrl } from "../apiBase";

const SOUND_KEY = "centralgo_offer_sound_enabled";

const safeParse = (value) => {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
};

const findIdDeep = (obj) => {
  if (!obj || typeof obj !== "object") return "";

  if (obj._id) return String(obj._id);
  if (obj.id) return String(obj.id);

  const commonKeys = [
    "user",
    "captain",
    "data",
    "profile",
    "driver",
    "currentUser",
    "currentCaptain",
  ];

  for (const key of commonKeys) {
    if (obj[key] && typeof obj[key] === "object") {
      const found = findIdDeep(obj[key]);
      if (found) return found;
    }
  }

  return "";
};

const getLocalStorageValue = (keys) => {
  for (const key of keys) {
    const value = localStorage.getItem(key);
    if (!value) continue;

    if (key.toLowerCase().includes("id")) {
      return value;
    }

    const parsed = safeParse(value);
    const found = findIdDeep(parsed);

    if (found) return found;
  }

  return "";
};

const getSessionInfo = () => {
  const token =
    localStorage.getItem("token") ||
    localStorage.getItem("userToken") ||
    localStorage.getItem("captainToken") ||
    "";

  const userId = getLocalStorageValue([
    "userId",
    "user",
    "userData",
    "userInfo",
    "currentUser",
  ]);

  const captainId = getLocalStorageValue([
    "captainId",
    "captain",
    "captainData",
    "captainInfo",
    "currentCaptain",
  ]);

  return {
    token,
    userId,
    captainId,
  };
};

const playLoudSound = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    const ctx = new AudioContext();
    const now = ctx.currentTime;

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.95, now);
    masterGain.connect(ctx.destination);

    const tones = [
      { freq: 880, start: 0 },
      { freq: 1250, start: 0.14 },
      { freq: 1650, start: 0.28 },
      { freq: 1250, start: 0.48 },
      { freq: 880, start: 0.62 },
      { freq: 1650, start: 0.82 },
    ];

    tones.forEach((tone) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "square";
      osc.frequency.setValueAtTime(tone.freq, now + tone.start);

      gain.gain.setValueAtTime(0.0001, now + tone.start);
      gain.gain.exponentialRampToValueAtTime(0.9, now + tone.start + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + tone.start + 0.13);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(now + tone.start);
      osc.stop(now + tone.start + 0.15);
    });

    setTimeout(() => {
      try {
        ctx.close();
      } catch {
        // ignore
      }
    }, 1500);
  } catch (error) {
    console.warn("[GLOBAL NOTIFICATIONS] No se pudo reproducir sonido:", error);
  }
};

const showBrowserNotification = (title, body) => {
  try {
    if (!("Notification" in window)) return;

    if (Notification.permission === "granted") {
      new Notification(title, {
        body,
        icon: "/favicon.ico",
        tag: `centralgo-offer-${Date.now()}`,
      });
    }
  } catch (error) {
    console.warn("[GLOBAL NOTIFICATIONS] No se pudo mostrar notificación:", error);
  }
};

const GlobalOfferNotifications = () => {
  const [session, setSession] = useState(getSessionInfo);
  const [banner, setBanner] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(
    localStorage.getItem(SOUND_KEY) === "true"
  );
  const [debugStatus, setDebugStatus] = useState("");

  const userSocketRef = useRef(null);
  const captainSocketRef = useRef(null);
  const bannerTimerRef = useRef(null);
  const sessionRef = useRef(session);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    const refreshSession = () => {
      const next = getSessionInfo();

      setSession((prev) => {
        if (
          prev.token === next.token &&
          prev.userId === next.userId &&
          prev.captainId === next.captainId
        ) {
          return prev;
        }

        console.log("[GLOBAL NOTIFICATIONS] Sesión detectada:", next);
        return next;
      });
    };

    refreshSession();

    const interval = setInterval(refreshSession, 1000);

    window.addEventListener("storage", refreshSession);
    window.addEventListener("focus", refreshSession);

    return () => {
      clearInterval(interval);
      window.removeEventListener("storage", refreshSession);
      window.removeEventListener("focus", refreshSession);
    };
  }, []);

  const showAlert = useCallback((title, body, type = "offer") => {
    if (bannerTimerRef.current) {
      clearTimeout(bannerTimerRef.current);
    }

    setBanner({
      title,
      body,
      type,
      createdAt: new Date().toISOString(),
    });

    if (localStorage.getItem(SOUND_KEY) === "true") {
      playLoudSound();
    }

    showBrowserNotification(title, body);

    bannerTimerRef.current = setTimeout(() => {
      setBanner(null);
    }, 10000);
  }, []);

  const connectCaptainSocket = useCallback(
    (captainId) => {
      if (!captainId || captainSocketRef.current) return;

      const socket = io(getApiBaseUrl(), {
        transports: ["websocket", "polling"],
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });

      captainSocketRef.current = socket;

      socket.on("connect", () => {
        console.log("[GLOBAL SOCKET] Captain conectado:", {
          socketId: socket.id,
          captainId,
        });

        setDebugStatus("Conductor conectado a notificaciones");

        socket.emit("join", {
          userId: captainId,
          userType: "captain",
        });
      });

      socket.on("socket-joined", (data) => {
        console.log("[GLOBAL SOCKET] Captain socket-joined:", data);

        if (!data?.ok) {
          setDebugStatus(`Error join conductor: ${data?.message || "sin detalle"}`);
        }
      });

      socket.on("new-offer-bid", (data = {}) => {
        console.log("[GLOBAL SOCKET] new-offer-bid recibido:", data);

        const title = data.notificationTitle || "Nueva oferta recibida";
        const body =
          data.notificationBody ||
          `${data.customerName || "Un cliente"} envió una nueva oferta.`;

        showAlert(title, body, "new-offer-bid");

        window.dispatchEvent(
          new CustomEvent("centralgo:new-offer-bid", {
            detail: data,
          })
        );
      });

      socket.on("offer-counter-response", (data = {}) => {
        console.log("[GLOBAL SOCKET] offer-counter-response recibido:", data);

        const title = data.notificationTitle || "Respuesta a tu contraoferta";
        const body =
          data.notificationBody ||
          `${data.customerName || "Un cliente"} respondió tu contraoferta.`;

        showAlert(title, body, "offer-counter-response");

        window.dispatchEvent(
          new CustomEvent("centralgo:offer-counter-response", {
            detail: data,
          })
        );
      });

      socket.on("disconnect", (reason) => {
        console.log("[GLOBAL SOCKET] Captain desconectado:", reason);
        setDebugStatus("Conductor desconectado de notificaciones");
      });

      socket.on("connect_error", (error) => {
        console.error("[GLOBAL SOCKET] Captain error:", error);
        setDebugStatus("Error conectando notificaciones conductor");
      });
    },
    [showAlert]
  );

  const connectUserSocket = useCallback(
    (userId) => {
      if (!userId || userSocketRef.current) return;

      const socket = io(getApiBaseUrl(), {
        transports: ["websocket", "polling"],
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });

      userSocketRef.current = socket;

      socket.on("connect", () => {
        console.log("[GLOBAL SOCKET] User conectado:", {
          socketId: socket.id,
          userId,
        });

        setDebugStatus("Usuario conectado a notificaciones");

        socket.emit("join", {
          userId,
          userType: "user",
        });
      });

      socket.on("socket-joined", (data) => {
        console.log("[GLOBAL SOCKET] User socket-joined:", data);

        if (!data?.ok) {
          setDebugStatus(`Error join usuario: ${data?.message || "sin detalle"}`);
        }
      });

      socket.on("offer-bid-updated", (data = {}) => {
        console.log("[GLOBAL SOCKET] offer-bid-updated recibido:", data);

        const title = data.notificationTitle || "Respuesta a tu oferta";
        const body =
          data.notificationBody ||
          `El transportador respondió tu oferta para ${
            data.title || "una publicación"
          }.`;

        showAlert(title, body, "offer-bid-updated");

        window.dispatchEvent(
          new CustomEvent("centralgo:offer-bid-updated", {
            detail: data,
          })
        );
      });

      socket.on("disconnect", (reason) => {
        console.log("[GLOBAL SOCKET] User desconectado:", reason);
        setDebugStatus("Usuario desconectado de notificaciones");
      });

      socket.on("connect_error", (error) => {
        console.error("[GLOBAL SOCKET] User error:", error);
        setDebugStatus("Error conectando notificaciones usuario");
      });
    },
    [showAlert]
  );

  useEffect(() => {
    const { token, userId, captainId } = session;

    if (!token) return;

    if (captainId) {
      connectCaptainSocket(captainId);
    }

    if (userId) {
      connectUserSocket(userId);
    }
  }, [session, connectCaptainSocket, connectUserSocket]);

  useEffect(() => {
    return () => {
      if (captainSocketRef.current) {
        captainSocketRef.current.disconnect();
        captainSocketRef.current = null;
      }

      if (userSocketRef.current) {
        userSocketRef.current.disconnect();
        userSocketRef.current = null;
      }

      if (bannerTimerRef.current) {
        clearTimeout(bannerTimerRef.current);
      }
    };
  }, []);

  const enableSound = async () => {
    try {
      localStorage.setItem(SOUND_KEY, "true");
      setSoundEnabled(true);

      playLoudSound();

      if ("Notification" in window && Notification.permission === "default") {
        await Notification.requestPermission();
      }
    } catch (error) {
      console.warn("[GLOBAL NOTIFICATIONS] No se pudieron activar:", error);
    }
  };

  const disableSound = () => {
    localStorage.setItem(SOUND_KEY, "false");
    setSoundEnabled(false);
  };

  if (!session.token || (!session.userId && !session.captainId)) {
    return null;
  }

  return (
    <>
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col items-end gap-2">
        {debugStatus ? (
          <div className="max-w-[260px] rounded-2xl bg-black/80 text-white px-3 py-2 text-[10px] font-bold shadow-xl">
            {debugStatus}
          </div>
        ) : null}

        <button
          type="button"
          onClick={soundEnabled ? disableSound : enableSound}
          className={`rounded-full px-4 py-3 text-xs font-black shadow-2xl border ${
            soundEnabled
              ? "bg-emerald-600 text-white border-emerald-500"
              : "bg-orange-600 text-white border-orange-500 animate-pulse"
          }`}
        >
          {soundEnabled ? "🔊 Sonido activo" : "🔔 Activar sonido"}
        </button>
      </div>

      {banner ? (
        <div className="fixed top-4 left-4 right-4 z-[9999]">
          <div className="mx-auto max-w-md rounded-[26px] bg-slate-950 text-white border border-slate-800 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-2xl bg-orange-500 flex items-center justify-center shrink-0">
                <i className="ri-notification-3-line text-2xl" />
              </div>

              <div className="flex-1">
                <p className="text-sm font-black">{banner.title}</p>
                <p className="text-sm text-white/80 mt-1">{banner.body}</p>
              </div>

              <button
                type="button"
                onClick={() => setBanner(null)}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0"
              >
                <i className="ri-close-line text-lg" />
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

export default GlobalOfferNotifications;