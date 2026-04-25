import React, { createContext, useContext } from "react";
import { useJsApiLoader } from "@react-google-maps/api";
import { Capacitor } from "@capacitor/core";
import { GOOGLE_MAPS_JS_LIBRARIES } from "../googleMapsConfig";

const GoogleMapsLoadContext = createContext({
  isLoaded: false,
  loadError: null,
});

function getGoogleMapsApiKey() {
  const isNative = Capacitor.isNativePlatform();

  if (isNative) {
    return import.meta.env.VITE_GOOGLE_MAPS_API_ANDROID || "";
  }

  return import.meta.env.VITE_GOOGLE_MAPS_API || "";
}

export function GoogleMapsLoadProvider({ children }) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: "uberclone-maps-script",
    googleMapsApiKey: getGoogleMapsApiKey(),
    version: "weekly",
    libraries: GOOGLE_MAPS_JS_LIBRARIES,
  });

  return (
    <GoogleMapsLoadContext.Provider value={{ isLoaded, loadError }}>
      {children}
    </GoogleMapsLoadContext.Provider>
  );
}

export function useGoogleMapsScript() {
  return useContext(GoogleMapsLoadContext);
}