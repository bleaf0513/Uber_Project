import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: false,

    proxy: {
      /*
       * IMPORTANTE:
       * No usamos "/captain" como proxy general porque también
       * coincide con rutas del frontend como:
       * - /captain-home
       * - /captain-login
       * - /captain-signup
       * - /captain/offers/space
       *
       * Las llamadas al backend deben hacerse usando la URL base
       * configurada en getApiBaseUrl().
       */

      "/users": {
        target: "http://127.0.0.1:4000",
        changeOrigin: true,
      },

      "/maps": {
        target: "http://127.0.0.1:4000",
        changeOrigin: true,
      },

      "/rides": {
        target: "http://127.0.0.1:4000",
        changeOrigin: true,
      },

      "/socket.io": {
        target: "http://127.0.0.1:4000",
        ws: true,
        changeOrigin: true,
      },
    },
  },
});