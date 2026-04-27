import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { getApiBaseUrl } from "../apiBase";

const NOTIFICATION_SOUND_KEY = "centralgo_offer_sound_enabled";

const safeParse = (value) => {
  try {
    if (!value) return null;
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const getStoredUserId = () => {
  const possibleKeys = [
    "user",
    "userData",
    "userInfo",
    "userId",
  ];

  for (const key of possibleKeys) {
    const value = localStorage.getItem(key);

    if (!value) continue;

    if (key === "userId") return value;

    const parsed = safeParse(value);

    if (parsed?._id || parsed?.id) {
      return parsed._id || parsed.id;
    }
  }

  return "";
};

const getStoredCaptainId = () => {
  const possibleKeys = [
    "captain",
    "captainData",
    "captainInfo",
    "captainId",
  ];

  for (const key of possibleKeys) {
    const value = localStorage.getItem(key);

    if (!value) continue;

    if (key === "captainId") return value;

    const parsed = safeParse(value);

    if (parsed?._id || parsed?.id) {
      return parsed._id || parsed.id;
    }
  }

  return "";
};

const playLoudOfferSound = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    const ctx = new AudioContext();
    const now = ctx.currentTime;

    const tones = [
      { freq: 950, start: 0 },
      { freq: 1300, start: 0.16 },
      { freq: 1650, start: 0.32 },
      { freq: 1300, start: 0.52 },
      { freq: 950, start: 0.68 },
    ];

    tones.forEach((tone) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();

      oscillator.type = "square";
      oscillator.frequency.setValueAtTime(tone.freq, now + tone.start);

      gain.gain.setValueAtTime(0.0001, now + tone.start);
      gain.gain.exponentialRampToValueAtTime(0.65, now + tone.start + 0.035);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + tone.start + 0.14);

      oscillator.connect(gain);
      gain.connect(ctx.destination);

      oscillator.start(now + tone.start);
      oscillator.stop(now + tone.start + 0.16);
    });

    setTimeout(() => {
      try {
        ctx.close();
      } catch {
        // ignore
      }
    }, 1300);
  } catch (error) {
    console.warn("No se pudo reproducir sonido global:", error);
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
    console.warn("No se pudo mostrar notificación global:", error);
  }
};

const GlobalOfferNotifications = () => {
  const [banner, setBanner] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(
    localStorage.getItem(NOTIFICATION_SOUND_KEY) === "true"
  );

  const userSocketRef = useRef(null);
  const captainSocketRef = useRef(null);
  const bannerTimerRef = useRef(null);

  const token = localStorage.getItem("token");

  const userId = useMemo(() => getStoredUserId(), []);
  const captainId = useMemo(() => getStoredCaptainId(), []);

  const showGlobalAlert = useCallback(
    ({ title, body, type = "offer" }) => {
      if (bannerTimerRef.current) {
        clearTimeout(bannerTimerRef.current);
      }

      setBanner({
        title,
        body,
        type,
        createdAt: new Date().toISOString(),
      });

      if (localStorage.getItem(NOTIFICATION_SOUND_KEY) === "true") {
        playLoudOfferSound();
      }

      showBrowserNotification(title, body);

      bannerTimerRef.current = setTimeout(() => {
        setBanner(null);
      }, 10000);
    },
    []
  );

  useEffect(() => {
    if (!token) return;

    if (!userId && !captainId) return;

    const apiBase = getApiBaseUrl();

    if (captainId && !captainSocketRef.current) {
      const captainSocket = io(apiBase, {
        transports: ["websocket", "polling"],
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });

      captainSocketRef.current = captainSocket;

      captainSocket.on("connect", () => {
        captainSocket.emit("join", {
          userId: captainId,
          userType: "captain",
        });
      });

      captainSocket.on("new-offer-bid", (data = {}) => {
        const title = data.notificationTitle || "Nueva oferta recibida";
        const body =
          data.notificationBody ||
          `${data.customerName || "Un cliente"} envió una nueva oferta.`;

        showGlobalAlert({
          title,
          body,
          type: "new-offer-bid",
        });

        window.dispatchEvent(
          new CustomEvent("centralgo:new-offer-bid", {
            detail: data,
          })
        );
      });

      captainSocket.on("offer-counter-response", (data = {}) => {
        const title = data.notificationTitle || "Respuesta a tu contraoferta";
        const body =
          data.notificationBody ||
          `${data.customerName || "Un cliente"} respondió tu contraoferta.`;

        showGlobalAlert({
          title,
          body,
          type: "offer-counter-response",
        });

        window.dispatchEvent(
          new CustomEvent("centralgo:offer-counter-response", {
            detail: data,
          })
        );
      });
    }

    if (userId && !userSocketRef.current) {
      const userSocket = io(apiBase, {
        transports: ["websocket", "polling"],
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });

      userSocketRef.current = userSocket;

      userSocket.on("connect", () => {
        userSocket.emit("join", {
          userId,
          userType: "user",
        });
      });

      userSocket.on("offer-bid-updated", (data = {}) => {
        const title = data.notificationTitle || "Respuesta a tu oferta";
        const body =
          data.notificationBody ||
          `El transportador respondió tu oferta para ${
            data.title || "una publicación"
          }.`;

        showGlobalAlert({
          title,
          body,
          type: "offer-bid-updated",
        });

        window.dispatchEvent(
          new CustomEvent("centralgo:offer-bid-updated", {
            detail: data,
          })
        );
      });
    }

    return () => {
      if (captainSocketRef.current) {
        captainSocketRef.current.off("connect");
        captainSocketRef.current.off("new-offer-bid");
        captainSocketRef.current.off("offer-counter-response");
        captainSocketRef.current.disconnect();
        captainSocketRef.current = null;
      }

      if (userSocketRef.current) {
        userSocketRef.current.off("connect");
        userSocketRef.current.off("offer-bid-updated");
        userSocketRef.current.disconnect();
        userSocketRef.current = null;
      }

      if (bannerTimerRef.current) {
        clearTimeout(bannerTimerRef.current);
      }
    };
  }, [token, userId, captainId, showGlobalAlert]);

  const enableSound = async () => {
    try {
      localStorage.setItem(NOTIFICATION_SOUND_KEY, "true");
      setSoundEnabled(true);

      playLoudOfferSound();

      if ("Notification" in window && Notification.permission === "default") {
        await Notification.requestPermission();
      }
    } catch (error) {
      console.warn("No se pudieron activar notificaciones globales:", error);
    }
  };

  const disableSound = () => {
    localStorage.setItem(NOTIFICATION_SOUND_KEY, "false");
    setSoundEnabled(false);
  };

  if (!token || (!userId && !captainId)) {
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