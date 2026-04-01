import React, { createContext, useEffect } from "react";
import { io } from "socket.io-client";
import { getSocketBaseUrl } from "../socketConfig";
import { getApiHintOrigin } from "../apiBase";

export const SocketContext = createContext();

const socket = io(getSocketBaseUrl(), {
  transports: ["websocket", "polling"],
  reconnectionDelay: 2000,
  reconnectionDelayMax: 15000,
});

const SocketProvider = ({ children }) => {
  useEffect(() => {
    let loggedConnectError = false;
    const onConnectError = () => {
      if (loggedConnectError) return;
      loggedConnectError = true;
      console.warn(
        `[socket] Cannot connect (${getApiHintOrigin()}). Start the backend: cd backend → npm run dev:memory, then refresh.`
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
