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

const SocketProvider = ({ children }) => {
  useEffect(() => {
    // Cold start (Render): first auto-connect can race the wake-up; nudge once after a short delay.
    const nudge = window.setTimeout(() => {
      if (!socket.connected) {
        socket.connect();
      }
    }, 1500);

    let warned = false;
    let warnTimer = null;
    const onConnectError = () => {
      if (warned || socket.connected) return;
      if (warnTimer != null) window.clearTimeout(warnTimer);
      warnTimer = window.setTimeout(() => {
        warnTimer = null;
        if (socket.connected || warned) return;
        warned = true;
        const url = getSocketBaseUrl();
        console.warn(
          `[socket] Still not connected to ${url}. Render free: open ${url} once to wake the API, set VITE_BASE_URL on Vercel, check CLIENT_ORIGINS on the server. Local: cd backend && npm run dev.`
        );
      }, 12000);
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
