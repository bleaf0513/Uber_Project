import React, { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { getApiBaseUrl } from "../apiBase";

const SOUND_KEY = "centralgo_offer_sound_enabled";

const safeJson = (value) => {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
};

const getSessionInfo = () => {
  const token = localStorage.getItem("token");

  const user =
    safeJson(localStorage.getItem("user")) ||
    safeJson(localStorage.getItem("userData")) ||
    safeJson(localStorage.getItem("userInfo"));

  const captain =
    safeJson(localStorage.getItem("captain")) ||
    safeJson(localStorage.getItem("captainData")) ||
    safeJson(localStorage.getItem("captainInfo"));

  const userId =
    user?._id ||
    user?.id ||
    localStorage.getItem("userId") ||
    "";

  const captainId =
    captain?._id ||
    captain?.id ||
    localStorage.getItem("captainId") ||
    "";

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

    const tones = [
      { freq: 900, start: 0 },
      { freq: 1250, start: 0.16 },
      { freq: 1650, start: 0.32 },
      { freq: 1250, start: 0.52 },
      { freq: 900, start: 0.68 },
    ];

    tones.forEach((tone) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "square";
      osc.frequency.setValueAtTime(tone.freq, now + tone.start);

      gain.gain.setValueAtTime(0.0001, now + tone.start);
      gain.gain.exponentialRampToValueAtTime(0.85, now + tone.start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + tone.start + 0.14);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + tone.start);
      osc.stop(now + tone.start + 0.16);
    });

    setTimeout(() => {
      try {
        ctx.close();
      } catch {
        // ignore
      }
    }, 1300);
  } catch (error) {
    console.warn("No se pudo reproducir sonido:", error);
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
    console.warn("No se pudo mostrar notificación:", error);
  }
};

const GlobalOfferNotifications = () => {
  const [soundEnabled, setSoundEnabled] = useState(
    localStorage.getItem(SOUND_KEY) === "true"
  );
  const [banner, setBanner] = useState(null);
  const [session, setSession] = useState(getSessionInfo());

  const userSocketRef = useRef(null);
  const captainSocketRef = useRef(null);
  const bannerTimerRef = useRef(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const next = getSessionInfo();

      setSession((prev) => {
        if (
          prev.token === next.token &&
          prev.userId === next.userId &&
          prev.captainId === next.captainId
        ) {
          return prev;
        }

        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const showAlert = useCallback((title, body, type = "offer") => {
    if (bannerTimerRef.current) {
      clearTimeout(bannerTimerRef.current);
    }

    setBanner({
      title,
      body,
      type,
    });

    if (localStorage.getItem(SOUND_KEY) === "true") {
      playLoudSound();
    }

    showBrowserNotification(title, body);

    bannerTimerRef.current = setTimeout(() => {
      setBanner(null);
    }, 10000);
  }, []);

  useEffect(() => {
    const { token, userId, captainId } = session;

    if (!token) return;

    const apiBase = getApiBaseUrl();

    if (captainId && !captainSocketRef.current) {
      const socket = io(apiBase, {
        transports: ["websocket", "polling"],
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });

      captainSocketRef.current = socket;

      socket.on("connect", () => {
        console.log("[GLOBAL SOCKET] Captain conectado", captainId);

        socket.emit("join", {
          userId: captainId,
          userType: "captain",
        });
      });

      socket.on("socket-joined", (data) => {
        console.log("[GLOBAL SOCKET] Captain joined:", data);
      });

      socket.on("new-offer-bid", (data = {}) => {
        console.log("[GLOBAL SOCKET] new-offer-bid:", data);

        const title = data.notificationTitle || "Nueva oferta recibida";
        const body =
          data.notificationBody ||
          `${data.customerName || "Un cliente"} envió una oferta.`;

        showAlert(title, body, "new-offer-bid");

        window.dispatchEvent(
          new CustomEvent("centralgo:new-offer-bid", { detail: data })
        );
      });

      socket.on("offer-counter-response", (data = {}) => {
        console.log("[GLOBAL SOCKET] offer-counter-response:", data);

        const title = data.notificationTitle || "Respuesta a tu contraoferta";
        const body =
          data.notificationBody ||
          `${data.customerName || "Un cliente"} respondió tu contraoferta.`;

        showAlert(title, body, "offer-counter-response");

        window.dispatchEvent(
          new CustomEvent("centralgo:offer-counter-response", { detail: data })
        );
      });

      socket.on("disconnect", () => {
        console.log("[GLOBAL SOCKET] Captain desconectado");
      });

      socket.on("connect_error", (error) => {
        console.error("[GLOBAL SOCKET] Captain error:", error);
      });
    }

    if (userId && !userSocketRef.current) {
      const socket = io(apiBase, {
        transports: ["websocket", "polling"],
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });

      userSocketRef.current = socket;

      socket.on("connect", () => {
        console.log("[GLOBAL SOCKET] User conectado", userId);

        socket.emit("join", {
          userId,
          userType: "user",
        });
      });

      socket.on("socket-joined", (data) => {
        console.log("[GLOBAL SOCKET] User joined:", data);
      });

      socket.on("offer-bid-updated", (data = {}) => {
        console.log("[GLOBAL SOCKET] offer-bid-updated:", data);

        const title = data.notificationTitle || "Respuesta a tu oferta";
        const body =
          data.notificationBody ||
          `El transportador respondió tu oferta.`;

        showAlert(title, body, "offer-bid-updated");

        window.dispatchEvent(
          new CustomEvent("centralgo:offer-bid-updated", { detail: data })
        );
      });

      socket.on("disconnect", () => {
        console.log("[GLOBAL SOCKET] User desconectado");
      });

      socket.on("connect_error", (error) => {
        console.error("[GLOBAL SOCKET] User error:", error);
      });
    }

    return () => {
      // No desconectamos aquí para evitar cortes en cambios pequeños de estado.
    };
  }, [session, showAlert]);

  useEffect(() => {
    return () => {
      if (userSocketRef.current) {
        userSocketRef.current.disconnect();
        userSocketRef.current = null;
      }

      if (captainSocketRef.current) {
        captainSocketRef.current.disconnect();
        captainSocketRef.current = null;
      }

      if (bannerTimerRef.current) {
        clearTimeout(bannerTimerRef.current);
      }
    };
  }, []);

  const enableSound = async () => {
    localStorage.setItem(SOUND_KEY, "true");
    setSoundEnabled(true);

    playLoudSound();

    if ("Notification" in window && Notification.permission === "default") {
      await Notification.requestPermission();
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
      <div className="fixed bottom-4 right-4 z-[9999]">
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