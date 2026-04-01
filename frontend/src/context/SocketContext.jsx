import React, { createContext, useEffect } from "react";
import { io } from "socket.io-client";
import { getSocketBaseUrl } from "../socketConfig";

export const SocketContext = createContext();

// Render (and similar) often fail WebSocket upgrade behind the proxy; long-polling is fully supported by Socket.IO.
const socketOptions =
  import.meta.env.PROD
    ? {
        transports: ["polling"],
        reconnectionDelay: 2000,
        reconnectionDelayMax: 20000,
        timeout: 25000,
      }
    : {
        transports: ["polling", "websocket"],
        upgrade: true,
        rememberUpgrade: true,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 15000,
        timeout: 20000,
      };

const socket = io(getSocketBaseUrl(), socketOptions);

const SocketProvider = ({ children }) => {
  useEffect(() => {
    let loggedConnectError = false;
    const onConnectError = () => {
      if (loggedConnectError) return;
      loggedConnectError = true;
      console.warn(
        `[socket] Cannot connect to ${getSocketBaseUrl()}. If the API is on Render, open the service URL in a tab once (cold start), then refresh this page. Local dev: cd backend → npm run dev / dev:memory.`
      );
    };

    socket.on("connect_error", onConnectError);
    return () => {
      socket.off("connect_error", onConnectError);
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket }}>
      {children}
    </SocketContext.Provider>
  );
};

export default SocketProvider;
