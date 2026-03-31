import React, { createContext, useContext } from "react";
import { useJsApiLoader } from "@react-google-maps/api";
import { GOOGLE_MAPS_JS_LIBRARIES } from "../googleMapsConfig";

const GoogleMapsLoadContext = createContext({
  isLoaded: false,
  loadError: null,
});

export function GoogleMapsLoadProvider({ children }) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: "uberclone-maps-script",
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API || "",
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
