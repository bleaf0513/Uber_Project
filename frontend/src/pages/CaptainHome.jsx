import React, {
  useState,
  useEffect,
  useContext,
  useRef,
  useCallback,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import "remixicon/fonts/remixicon.css";
import CaptainDetails from "../../components/CaptainDetails";
import RidePopup from "../../components/RidePopup";
import ConfirmRidePickup from "../../components/ConfirmRidePickup";
import { CaptainDataContext } from "../context/CaptainContext";
import { SocketContext } from "../context/SocketContext";
import axios from "axios";
import { getApiBaseUrl } from "../apiBase";
import LiveTracking from "../../components/LiveTracking";

const CaptainHome = () => {
  const ridePopupRef = useRef(null);
  const confirmRidePickupRef = useRef(null);
  const locationWatchIdRef = useRef(null);
  const locationIntervalRef = useRef(null);
  const lastLocationSentRef = useRef(0);

  const navigate = useNavigate();

  const { captain } = useContext(CaptainDataContext);
  const { socket } = useContext(SocketContext);

  const [ridePopup, setRidePopup] = useState(false);
  const [ride, setRide] = useState(null);
  const [confirmRidePickup, setConfirmRidePickup] = useState(false);
  const [socketReady, setSocketReady] = useState(false);
  const [locationReady, setLocationReady] = useState(false);
  const [processing, setProcessing] = useState(false);

  const [geoSupported, setGeoSupported] = useState(true);
  const [locationPermission, setLocationPermission] = useState("prompt");
  const [locationError, setLocationError] = useState("");
  const [requestingLocation, setRequestingLocation] = useState(false);
  const [showGpsPrompt, setShowGpsPrompt] = useState(false);

  const emitCaptainJoin = useCallback(() => {
    if (!captain?._id) {
      console.warn("[captain-home] no hay captain._id para join");
      return;
    }

    if (!socket?.connected) {
      console.warn("[captain-home] socket no conectado todavía");
      return;
    }

    console.log("[captain-home] emit join", {
      captainId: captain._id,
      socketId: socket.id,
    });

    socket.emit("join", {
      userId: captain._id,
      userType: "captain",
    });
  }, [captain?._id, socket]);

  const emitCaptainLocation = useCallback(
    (coords, source = "unknown") => {
      if (!captain?._id || !socket?.connected) {
        console.warn("[captain-home] no se puede enviar ubicación:", {
          hasCaptainId: !!captain?._id,
          socketConnected: !!socket?.connected,
          source,
        });
        return;
      }

      const ltd = Number(coords?.latitude);
      const lng = Number(coords?.longitude);

      if (!Number.isFinite(ltd) || !Number.isFinite(lng)) {
        console.warn("[captain-home] ubicación inválida", {
          source,
          latitude: coords?.latitude,
          longitude: coords?.longitude,
        });
        return;
      }

      const now = Date.now();
      const elapsed = now - lastLocationSentRef.current;

      if (elapsed < 1500 && source !== "connect-refresh") {
        return;
      }

      lastLocationSentRef.current = now;
      setLocationReady(true);
      setLocationError("");
      setShowGpsPrompt(false);
      setLocationPermission("granted");

      console.log("[captain-home] emit update-location-captain", {
        captainId: captain._id,
        socketId: socket.id,
        source,
        ltd,
        lng,
      });

      socket.emit("update-location-captain", {
        userId: captain._id,
        location: { ltd, lng },
      });
    },
    [captain?._id, socket]
  );

  const getGeolocationErrorMessage = (error) => {
    const code = error?.code;

    if (code === 1) {
      return "Debes permitir el acceso a la ubicación para continuar.";
    }

    if (code === 2) {
      return "No se pudo detectar tu ubicación. Activa el GPS del dispositivo.";
    }

    if (code === 3) {
      return "La ubicación tardó demasiado. Intenta nuevamente.";
    }

    return error?.message || "No se pudo obtener la ubicación.";
  };

  const requestAndEmitCurrentLocation = useCallback(
    (source = "manual-request", forcePrompt = false) => {
      if (!navigator.geolocation) {
        console.error("[captain-home] geolocation no soportado");
        setGeoSupported(false);
        setLocationReady(false);
        setShowGpsPrompt(true);
        setLocationError("Este dispositivo o navegador no soporta geolocalización.");
        return;
      }

      setRequestingLocation(true);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          emitCaptainLocation(position.coords, source);
          setRequestingLocation(false);
        },
        (error) => {
          const message = getGeolocationErrorMessage(error);

          console.error("[captain-home] error obteniendo ubicación actual:", {
            source,
            code: error?.code,
            message: error?.message,
          });

          setRequestingLocation(false);
          setLocationReady(false);
          setLocationError(message);
          setShowGpsPrompt(true);

          if (error?.code === 1) {
            setLocationPermission("denied");
          } else if (forcePrompt) {
            setLocationPermission("prompt");
          }
        },
        {
          enableHighAccuracy: true,
          maximumAge: 5000,
          timeout: 15000,
        }
      );
    },
    [emitCaptainLocation]
  );

  const stopLocationTracking = useCallback(() => {
    if (locationWatchIdRef.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(locationWatchIdRef.current);
      locationWatchIdRef.current = null;
    }

    if (locationIntervalRef.current != null) {
      clearInterval(locationIntervalRef.current);
      locationIntervalRef.current = null;
    }
  }, []);

  const startLocationTracking = useCallback(() => {
    if (!captain?._id || !socket || !navigator.geolocation) return;

    stopLocationTracking();

    requestAndEmitCurrentLocation("initial-getCurrentPosition");

    locationWatchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        emitCaptainLocation(position.coords, "watchPosition");
      },
      (error) => {
        const message = getGeolocationErrorMessage(error);

        console.error("[captain-home] error obteniendo ubicación:", {
          code: error?.code,
          message: error?.message,
        });

        setLocationReady(false);
        setLocationError(message);
        setShowGpsPrompt(true);

        if (error?.code === 1) {
          setLocationPermission("denied");
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000,
      }
    );

    locationIntervalRef.current = setInterval(() => {
      requestAndEmitCurrentLocation("interval-refresh");
    }, 10000);
  }, [
    captain?._id,
    socket,
    emitCaptainLocation,
    requestAndEmitCurrentLocation,
    stopLocationTracking,
  ]);

  const handleEnableGps = useCallback(() => {
    requestAndEmitCurrentLocation("manual-enable-gps", true);
  }, [requestAndEmitCurrentLocation]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoSupported(false);
      setShowGpsPrompt(true);
      setLocationError("Este dispositivo o navegador no soporta geolocalización.");
      return;
    }

    setGeoSupported(true);

    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: "geolocation" })
        .then((result) => {
          setLocationPermission(result.state);

          if (result.state !== "granted") {
            setShowGpsPrompt(true);
          }

          result.onchange = () => {
            setLocationPermission(result.state);

            if (result.state === "granted") {
              setShowGpsPrompt(false);
              setLocationError("");
              setLocationReady(false);
              requestAndEmitCurrentLocation("permission-changed-granted");
            } else {
              setLocationReady(false);
              setShowGpsPrompt(true);
            }
          };
        })
        .catch((err) => {
          console.warn("[captain-home] no se pudo consultar permiso geolocation", err);
          setShowGpsPrompt(true);
          requestAndEmitCurrentLocation("initial-auto-request", true);
        });
    } else {
      setShowGpsPrompt(true);
      requestAndEmitCurrentLocation("initial-auto-request", true);
    }
  }, [requestAndEmitCurrentLocation]);

  useEffect(() => {
    if (!socket) return;

    const onConnect = () => {
      console.log("[captain-home] socket connected:", socket.id);
      setSocketReady(true);
      emitCaptainJoin();

      setTimeout(() => {
        requestAndEmitCurrentLocation("connect-refresh");
      }, 500);
    };

    const onDisconnect = (reason) => {
      console.warn("[captain-home] socket disconnected:", reason);
      setSocketReady(false);
    };

    const onSocketJoined = (payload) => {
      console.log("[captain-home] socket-joined:", payload);
    };

    const onLocationUpdated = (payload) => {
      console.log("[captain-home] location-updated:", payload);
    };

    const onNewRide = (rideData) => {
      console.log("[captain-home] new-ride recibido:", {
        rideId: rideData?._id,
        pickup: rideData?.pickup,
        destination: rideData?.destination,
      });

      if (!rideData?._id) return;

      setRide(rideData);
      setConfirmRidePickup(false);
      setRidePopup(true);
    };

    socket.off("connect", onConnect);
    socket.off("disconnect", onDisconnect);
    socket.off("socket-joined", onSocketJoined);
    socket.off("location-updated", onLocationUpdated);
    socket.off("new-ride", onNewRide);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("socket-joined", onSocketJoined);
    socket.on("location-updated", onLocationUpdated);
    socket.on("new-ride", onNewRide);

    if (socket.connected) {
      onConnect();
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("socket-joined", onSocketJoined);
      socket.off("location-updated", onLocationUpdated);
      socket.off("new-ride", onNewRide);
    };
  }, [socket, emitCaptainJoin, requestAndEmitCurrentLocation]);

  useEffect(() => {
    if (!captain?._id || !socket || !geoSupported) return;

    if (locationPermission === "granted") {
      startLocationTracking();
    } else {
      stopLocationTracking();
    }

    return () => {
      stopLocationTracking();
    };
  }, [
    captain?._id,
    socket,
    geoSupported,
    locationPermission,
    startLocationTracking,
    stopLocationTracking,
  ]);

  const confirmRide = async () => {
    try {
      if (!ride?._id) {
        console.error("[captain-home] No hay servicio seleccionado para confirmar.");
        return;
      }

      setProcessing(true);

      console.log("[captain-home] confirmando ride:", {
        rideId: ride._id,
        captainId: captain?._id,
      });

      await axios.post(
        `${getApiBaseUrl()}/rides/confirm`,
        {
          rideId: ride._id,
          captainId: captain?._id,
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      setRidePopup(false);
      setConfirmRidePickup(true);
    } catch (error) {
      console.error("[captain-home] Error confirmando servicio:", error);
      alert(
        error?.response?.data?.message ||
          "No se pudo confirmar el servicio. Intenta nuevamente."
      );
    } finally {
      setProcessing(false);
    }
  };

  const ignoreRide = () => {
    setRidePopup(false);
    setRide(null);
  };

  const goToGoodsOffer = () => {
    navigate("/captain/offers/goods");
  };

  const goToSpaceOffer = () => {
    navigate("/captain/offers/space");
  };

  const goToSeatOffer = () => {
    navigate("/captain/offers/seats");
  };

  const goToReceivedBids = () => {
    navigate("/captain/offers/received");
  };

  useGSAP(
    () => {
      if (ridePopup) {
        gsap.to(ridePopupRef.current, {
          y: "0%",
          delay: 0.1,
          duration: 0.25,
          ease: "power2.out",
        });
      } else {
        gsap.to(ridePopupRef.current, {
          y: "100%",
          duration: 0.2,
          ease: "power2.inOut",
        });
      }
    },
    [ridePopup]
  );

  useGSAP(
    () => {
      if (confirmRidePickup) {
        gsap.to(confirmRidePickupRef.current, {
          y: "0%",
          delay: 0.1,
          duration: 0.25,
          ease: "power2.out",
        });
      } else {
        gsap.to(confirmRidePickupRef.current, {
          y: "100%",
          duration: 0.2,
          ease: "power2.inOut",
        });
      }
    },
    [confirmRidePickup]
  );

  const gpsBlocked = !locationReady || locationPermission !== "granted";

  return (
    <div className="overflow-hidden h-screen w-screen bg-gray-50">
      <div className="absolute top-0 left-0 ml-7 py-7 z-30">
        <Link to="/">
          <img className="w-20" src="/logo-centralgo.png" alt="Central Go" />
        </Link>
      </div>

      <Link
        to="/captain-logout"
        className="absolute top-3 right-3 w-12 h-12 rounded-full bg-black flex items-center justify-center z-50"
      >
        <i
          style={{ color: "white" }}
          className="ri-logout-box-line ri-xl mb mr-0.5"
        ></i>
      </Link>

      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40">
        <div className="flex items-center gap-2 rounded-full bg-white/95 shadow-lg border border-gray-200 px-4 py-2">
          <span
            className={`inline-block w-2.5 h-2.5 rounded-full ${
              socketReady ? "bg-emerald-500" : "bg-red-500"
            }`}
          />
          <span className="text-xs font-semibold text-gray-700">
            {socketReady ? "Conectado" : "Reconectando..."}
          </span>
          <span className="text-gray-300">|</span>
          <span
            className={`text-xs font-semibold ${
              locationReady ? "text-emerald-700" : "text-amber-600"
            }`}
          >
            {locationReady ? "Ubicación activa" : "GPS pendiente"}
          </span>
        </div>
      </div>

      <div className="absolute w-screen h-[100%] top-0 z-20">
        <LiveTracking />
      </div>

      {showGpsPrompt && (
        <div className="fixed inset-0 z-[90] bg-black/55 flex items-center justify-center px-5">
          <div className="w-full max-w-md rounded-[28px] bg-white shadow-2xl p-6">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <i className="ri-map-pin-user-fill text-3xl text-emerald-700"></i>
            </div>

            <h2 className="text-2xl font-bold text-gray-900 text-center">
              Activa tu ubicación
            </h2>

            <p className="text-sm text-gray-600 text-center mt-3 leading-6">
              Para usar Central Go como conductor debes permitir el acceso al GPS
              y mantener la ubicación activa en tiempo real.
            </p>

            {!!locationError && (
              <div className="mt-4 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
                {locationError}
              </div>
            )}

            {!geoSupported && (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                Tu dispositivo o navegador no permite obtener la ubicación.
              </div>
            )}

            {locationPermission === "denied" && (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                El permiso fue bloqueado. Debes habilitar la ubicación desde la
                configuración del navegador o del teléfono y luego volver a
                intentar.
              </div>
            )}

            <div className="mt-5 space-y-3">
              <button
                type="button"
                onClick={handleEnableGps}
                disabled={requestingLocation || !geoSupported}
                className="w-full rounded-2xl bg-emerald-600 text-white font-bold py-4 px-4 disabled:opacity-60"
              >
                {requestingLocation ? "Activando GPS..." : "Activar GPS ahora"}
              </button>

              <button
                type="button"
                onClick={() => requestAndEmitCurrentLocation("retry-location")}
                disabled={requestingLocation || !geoSupported}
                className="w-full rounded-2xl border border-gray-300 bg-white text-gray-800 font-semibold py-4 px-4 disabled:opacity-60"
              >
                Reintentar ubicación
              </button>
            </div>

            <p className="text-[12px] text-gray-500 text-center mt-4 leading-5">
              Sin ubicación activa el conductor no podrá ser monitoreado ni recibir
              correctamente servicios en tiempo real.
            </p>
          </div>
        </div>
      )}

      <div className="bg-white absolute bottom-0 w-screen rounded-t-[24px] overflow-y-auto overflow-x-hidden z-50 shadow-2xl max-h-[52%]">
        <div className="pt-2">
          <div className="flex justify-center py-2">
            <div className="w-16 h-1.5 rounded-full bg-gray-300"></div>
          </div>

          <div className="px-5 pb-2 flex items-center justify-between gap-3">
            <p className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 px-4 py-2 text-sm font-semibold">
              Panel del transportador
            </p>

            {ride?._id && ridePopup && (
              <div className="inline-flex items-center rounded-full bg-orange-50 text-orange-700 px-3 py-2 text-xs font-bold">
                Nueva solicitud
              </div>
            )}
          </div>

          {gpsBlocked && (
            <div className="px-4 pb-2">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3">
                <div className="mt-0.5">
                  <i className="ri-map-pin-line text-xl text-amber-700"></i>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-amber-800">
                    Ubicación requerida
                  </p>
                  <p className="text-xs text-amber-700 mt-1">
                    Debes activar el GPS para operar como conductor.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleEnableGps}
                  className="rounded-xl bg-amber-600 text-white text-xs font-bold px-3 py-2"
                >
                  Activar
                </button>
              </div>
            </div>
          )}

          <CaptainDetails />

          <div className="px-4 pb-5">
            <div className="rounded-[24px] border border-gray-200 bg-gray-50 p-4 mt-2">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    Oportunidades en ruta
                  </h3>
                  <p className="text-sm text-gray-600">
                    Publica mercancía, espacio libre o cupos disponibles.
                  </p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-violet-100 flex items-center justify-center">
                  <i className="ri-road-map-line text-2xl text-violet-700"></i>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={goToGoodsOffer}
                  className="rounded-2xl bg-white border border-gray-200 p-4 text-left shadow-sm"
                >
                  <div className="w-11 h-11 rounded-2xl bg-orange-100 flex items-center justify-center mb-2">
                    <i className="ri-shopping-basket-2-line text-xl text-orange-600"></i>
                  </div>
                  <h4 className="text-base font-bold text-gray-900">
                    Publicar mercancía
                  </h4>
                  <p className="text-xs text-gray-600 mt-1">
                    Vende productos que llevas en ruta.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={goToSpaceOffer}
                  className="rounded-2xl bg-white border border-gray-200 p-4 text-left shadow-sm"
                >
                  <div className="w-11 h-11 rounded-2xl bg-blue-100 flex items-center justify-center mb-2">
                    <i className="ri-inbox-archive-line text-xl text-blue-600"></i>
                  </div>
                  <h4 className="text-base font-bold text-gray-900">
                    Publicar espacio
                  </h4>
                  <p className="text-xs text-gray-600 mt-1">
                    Ofrece capacidad libre para carga.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={goToSeatOffer}
                  className="rounded-2xl bg-white border border-gray-200 p-4 text-left shadow-sm"
                >
                  <div className="w-11 h-11 rounded-2xl bg-emerald-100 flex items-center justify-center mb-2">
                    <i className="ri-user-3-line text-xl text-emerald-600"></i>
                  </div>
                  <h4 className="text-base font-bold text-gray-900">
                    Publicar cupos
                  </h4>
                  <p className="text-xs text-gray-600 mt-1">
                    Comparte puestos para pasajeros.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={goToReceivedBids}
                  className="rounded-2xl bg-black p-4 text-left shadow-sm"
                >
                  <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center mb-2">
                    <i className="ri-mail-open-line text-xl text-white"></i>
                  </div>
                  <h4 className="text-base font-bold text-white">
                    Ofertas recibidas
                  </h4>
                  <p className="text-xs text-white/80 mt-1">
                    Revisa, acepta o contraoferta.
                  </p>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div
          ref={ridePopupRef}
          className="fixed z-[60] bottom-0 w-screen translate-y-full rounded-t-[24px] bg-white overflow-scroll shadow-2xl"
        >
          <RidePopup
            setConfirmRidePickup={setConfirmRidePickup}
            setRidePopup={setRidePopup}
            ride={ride}
            confirmRide={confirmRide}
            onIgnoreRide={ignoreRide}
            isSubmitting={processing}
          />
        </div>

        <div
          ref={confirmRidePickupRef}
          className="fixed z-[70] bottom-0 w-screen h-screen translate-y-full rounded-t-[24px] bg-white overflow-scroll shadow-2xl"
        >
          <ConfirmRidePickup
            setConfirmRidePickup={setConfirmRidePickup}
            setRidePopup={setRidePopup}
            ride={ride}
          />
        </div>
      </div>
    </div>
  );
};

export default CaptainHome;
