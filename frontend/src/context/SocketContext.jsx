import React, { createContext, useEffect } from "react";
import { io } from "socket.io-client";
import { getSocketBaseUrl } from "../socketConfig";

export const SocketContext = createContext();

function buildSocketOptions() {
  const base = {
    path: "/socket.io/",
    withCredentials: false,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 12000,
    reconnectionAttempts: Infinity,
    // Handshake can exceed 25s while a Render dyno cold-starts.
    timeout: import.meta.env.PROD ? 60000 : 25000,
    autoConnect: true,
  };

  // Prefer WebSocket in production: repeated long-polling GET/POST with sid often hits Render 502s
  // (proxy drops long-held polls; error pages have no CORS → "blocked by CORS policy").
  // Socket.IO falls back to polling automatically if the upgrade fails (e.g. restrictive networks).
  if (import.meta.env.PROD) {
    return {
      ...base,
      transports: ["websocket", "polling"],
      upgrade: true,
      rememberUpgrade: true,
    };
  }
  return {
    ...base,
    transports: ["polling", "websocket"],
    upgrade: true,
    rememberUpgrade: true,
  };
}

const socket = io(getSocketBaseUrl(), buildSocketOptions());

/** Render free tier: HTTP GET wakes the dyno so Socket.IO is less likely to time out during cold start. */
function wakeBackendRoot(baseUrl) {
  if (!baseUrl || import.meta.env.DEV) return;
  const root = String(baseUrl).replace(/\/+$/, "");
  fetch(`${root}/`, {
    method: "GET",
    mode: "cors",
    credentials: "omit",
    cache: "no-store",
  }).catch(() => {});
}

const SocketProvider = ({ children }) => {
  useEffect(() => {
    if (import.meta.env.PROD) {
      const url = getSocketBaseUrl();
      wakeBackendRoot(url);
      window.setTimeout(() => wakeBackendRoot(url), 3000);
      window.setTimeout(() => wakeBackendRoot(url), 10000);
    }

    // Cold start (Render): nudge reconnect after wake requests start the dyno.
    const nudge = window.setTimeout(() => {
      if (!socket.connected) {
        socket.connect();
      }
    }, 1500);
    const nudge2 = window.setTimeout(() => {
      if (!socket.connected) {
        socket.connect();
      }
    }, 8000);

    let warned = false;
    let warnTimer = null;
    // Free Render cold starts often exceed 12s; warn only after a longer grace period.
    const warnAfterMs = import.meta.env.PROD ? 55000 : 12000;
    const onConnectError = () => {
      if (warned || socket.connected) return;
      // Do not reset on every reconnect attempt — otherwise the warning never fires.
      if (warnTimer != null) return;
      warnTimer = window.setTimeout(() => {
        warnTimer = null;
        if (socket.connected || warned) return;
        warned = true;
        const url = getSocketBaseUrl();
        console.warn(
          `[socket] Still not connected to ${url} after ${warnAfterMs / 1000}s. ` +
            `Render free: cold start can take 60s — wait or open ${url} in a tab to wake the API. ` +
            `Confirm VITE_BASE_URL on the frontend matches this host. Local API: cd backend && npm run dev.`
        );
      }, warnAfterMs);
    };

    const onConnect = () => {
      if (warnTimer != null) {
        window.clearTimeout(warnTimer);
        warnTimer = null;
      }
      warned = false;
    };

    socket.on("connect_error", onConnectError);
    socket.on("connect", onConnect);
    return () => {
      window.clearTimeout(nudge);
      window.clearTimeout(nudge2);
      if (warnTimer != null) window.clearTimeout(warnTimer);
      socket.off("connect_error", onConnectError);
      socket.off("connect", onConnect);
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket }}>
      {children}
    </SocketContext.Provider>
  );
};

export default SocketProvider;
