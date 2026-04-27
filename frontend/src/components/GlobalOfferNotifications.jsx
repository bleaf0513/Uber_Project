import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { io } from "socket.io-client";
import { getApiBaseUrl } from "../apiBase";
import { CaptainDataContext } from "../context/CaptainContext";
import { UserDataContext } from "../context/UserContext";

const SOUND_KEY = "centralgo_offer_sound_enabled";

const safeParse = (value) => {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
};

const decodeJwtPayload = (token) => {
  try {
    if (!token || !token.includes(".")) return null;

    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      window
        .atob(base64)
        .split("")
        .map((c) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join("")
    );

    return JSON.parse(json);
  } catch {
    return null;
  }
};

const findIdDeep = (obj) => {
  if (!obj || typeof obj !== "object") return "";

  if (obj._id) return String(obj._id);
  if (obj.id) return String(obj.id);
  if (obj.userId) return String(obj.userId);
  if (obj.captainId) return String(obj.captainId);

  const keys = [
    "user",
    "captain",
    "data",
    "profile",
    "driver",
    "currentUser",
    "currentCaptain",
  ];

  for (const key of keys) {
    const found = findIdDeep(obj[key]);
    if (found) return found;
  }

  return "";
};

const getIdFromStorage = (keys) => {
  for (const key of keys) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;

    if (key.toLowerCase().includes("id")) return raw;

    const parsed = safeParse(raw);
    const found = findIdDeep(parsed);

    if (found) return found;
  }

  return "";
};

const isCaptainPath = (pathname) => {
  return (
    pathname.startsWith("/captain") ||
    pathname.includes("/captain/") ||
    pathname === "/captain-home"
  );
};

const isUserPath = (pathname) => {
  return (
    pathname === "/home" ||
    pathname === "/available-offers" ||
    pathname === "/my-sent-bids" ||
    pathname === "/user-logout"
  );
};

const getToken = () => {
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("userToken") ||
    localStorage.getItem("captainToken") ||
    ""
  );
};

const getSessionFromStorage = (pathname) => {
  const token = getToken();
  const decoded = decodeJwtPayload(token);

  const storageUserId = getIdFromStorage([
    "userId",
    "user",
    "userData",
    "userInfo",
    "currentUser",
  ]);

  const storageCaptainId = getIdFromStorage([
    "captainId",
    "captain",
    "captainData",
    "captainInfo",
    "currentCaptain",
  ]);

  const decodedId =
    decoded?.captain?._id ||
    decoded?.captain?.id ||
    decoded?.captainId ||
    decoded?.user?._id ||
    decoded?.user?.id ||
    decoded?.userId ||
    decoded?._id ||
    decoded?.id ||
    "";

  let userId = storageUserId;
  let captainId = storageCaptainId;

  if (!userId && !captainId && decodedId) {
    if (isCaptainPath(pathname)) {
      captainId = String(decodedId);
    } else if (isUserPath(pathname)) {
      userId = String(decodedId);
    }
  }

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
    masterGain.gain.setValueAtTime(1.0, now);
    masterGain.connect(ctx.destination);

    const tones = [
      { freq: 900, start: 0 },
      { freq: 1300, start: 0.13 },
      { freq: 1700, start: 0.26 },
      { freq: 1300, start: 0.44 },
      { freq: 900, start: 0.57 },
      { freq: 1700, start: 0.75 },
    ];

    tones.forEach((tone) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "square";
      osc.frequency.setValueAtTime(tone.freq, now + tone.start);

      gain.gain.setValueAtTime(0.0001, now + tone.start);
      gain.gain.exponentialRampToValueAtTime(0.95, now + tone.start + 0.025);
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
    }, 1600);
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
  const location = useLocation();
  const { user } = useContext(UserDataContext);
  const { captain } = useContext(CaptainDataContext);

  const [session, setSession] = useState(() =>
    getSessionFromStorage(location.pathname)
  );
  const [banner, setBanner] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(
    localStorage.getItem(SOUND_KEY) === "true"
  );
  const [debugStatus, setDebugStatus] = useState("");

  const userSocketRef = useRef(null);
  const captainSocketRef = useRef(null);
  const bannerTimerRef = useRef(null);

  const buildSession = useCallback(() => {
    const storage = getSessionFromStorage(location.pathname);

    const contextUserId = findIdDeep(user);
    const contextCaptainId = findIdDeep(captain);

    return {
      token: storage.token,
      userId: contextUserId || storage.userId || "",
      captainId: contextCaptainId || storage.captainId || "",
    };
  }, [user, captain, location.pathname]);

  useEffect(() => {
    const refresh = () => {
      const next = buildSession();

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

    refresh();

    const interval = setInterval(refresh, 1000);

    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [buildSession]);

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
          setDebugStatus(`Error conductor: ${data?.message || "join falló"}`);
        } else {
          setDebugStatus("Conductor conectado a notificaciones");
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

      socket.on("connect_error", (error) => {
        console.error("[GLOBAL SOCKET] Captain error:", error);
        setDebugStatus("Error conectando conductor");
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
          setDebugStatus(`Error usuario: ${data?.message || "join falló"}`);
        } else {
          setDebugStatus("Usuario conectado a notificaciones");
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

      socket.on("connect_error", (error) => {
        console.error("[GLOBAL SOCKET] User error:", error);
        setDebugStatus("Error conectando usuario");
      });
    },
    [showAlert]
  );

  useEffect(() => {
    if (!session.token) return;

    if (session.captainId) {
      connectCaptainSocket(session.captainId);
    }

    if (session.userId) {
      connectUserSocket(session.userId);
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
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col items-end gap-2">
        {debugStatus ? (
          <div className="max-w-[280px] rounded-2xl bg-black/80 text-white px-3 py-2 text-[10px] font-bold shadow-xl">
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