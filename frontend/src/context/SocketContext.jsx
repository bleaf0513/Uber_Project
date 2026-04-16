import React, { createContext, useEffect } from "react";
import { io } from "socket.io-client";
import { getSocketBaseUrl } from "../socketConfig";

export const SocketContext = createContext();

function buildSocketOptions() {
  const base = {
    path: "/socket.io/",
    withCredentials: false,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 12000,
    randomizationFactor: 0.5,
    timeout: import.meta.env.PROD ? 60000 : 25000,
    autoConnect: true,
    forceNew: false,
  };

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
    const url = getSocketBaseUrl();

    if (import.meta.env.PROD) {
      wakeBackendRoot(url);
      window.setTimeout(() => wakeBackendRoot(url), 3000);
      window.setTimeout(() => wakeBackendRoot(url), 10000);
    }

    const safeReconnect = (label) => {
      try {
        if (socket.connected) return;

        console.log(`[socket-context] ${label}: forcing reconnect`, {
          url,
          connected: socket.connected,
          id: socket.id || null,
        });

        socket.connect();
      } catch (error) {
        console.error(`[socket-context] ${label}: reconnect error`, error);
      }
    };

    const nudge = window.setTimeout(() => {
      safeReconnect("nudge-1");
    }, 1500);

    const nudge2 = window.setTimeout(() => {
      safeReconnect("nudge-2");
    }, 8000);

    const nudge3 = window.setTimeout(() => {
      safeReconnect("nudge-3");
    }, 15000);

    let warned = false;
    let warnTimer = null;
    const warnAfterMs = import.meta.env.PROD ? 55000 : 12000;

    const onConnect = () => {
      console.log("[socket-context] connected", {
        id: socket.id,
        url,
        transport: socket.io.engine?.transport?.name || "unknown",
      });

      if (warnTimer != null) {
        window.clearTimeout(warnTimer);
        warnTimer = null;
      }

      warned = false;
    };

    const onDisconnect = (reason) => {
      console.warn("[socket-context] disconnected", {
        reason,
        id: socket.id || null,
      });
    };

    const onConnectError = (error) => {
      console.warn("[socket-context] connect_error", {
        message: error?.message || "unknown",
        url,
      });

      if (warned || socket.connected) return;
      if (warnTimer != null) return;

      warnTimer = window.setTimeout(() => {
        warnTimer = null;

        if (socket.connected || warned) return;

        warned = true;
        console.warn(
          `[socket] Still not connected to ${url} after ${
            warnAfterMs / 1000
          }s. Render cold start may still be waking up.`
        );
      }, warnAfterMs);
    };

    const onReconnect = (attempt) => {
      console.log("[socket-context] reconnect", {
        attempt,
        id: socket.id,
      });
    };

    const onReconnectAttempt = (attempt) => {
      console.log("[socket-context] reconnect_attempt", {
        attempt,
        connected: socket.connected,
      });
    };

    const onReconnectError = (error) => {
      console.warn("[socket-context] reconnect_error", {
        message: error?.message || "unknown",
      });
    };

    const onReconnectFailed = () => {
      console.error("[socket-context] reconnect_failed");
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);

    socket.io.on("reconnect", onReconnect);
    socket.io.on("reconnect_attempt", onReconnectAttempt);
    socket.io.on("reconnect_error", onReconnectError);
    socket.io.on("reconnect_failed", onReconnectFailed);

    if (!socket.connected) {
      safeReconnect("initial");
    }

    return () => {
      window.clearTimeout(nudge);
      window.clearTimeout(nudge2);
      window.clearTimeout(nudge3);

      if (warnTimer != null) {
        window.clearTimeout(warnTimer);
      }

      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);

      socket.io.off("reconnect", onReconnect);
      socket.io.off("reconnect_attempt", onReconnectAttempt);
      socket.io.off("reconnect_error", onReconnectError);
      socket.io.off("reconnect_failed", onReconnectFailed);
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket }}>
      {children}
    </SocketContext.Provider>
  );
};

export default SocketProvider;