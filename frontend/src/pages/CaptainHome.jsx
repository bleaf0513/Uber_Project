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
  const latestRideIdRef = useRef(null);

  const navigate = useNavigate();

  const { captain } = useContext(CaptainDataContext);
  const { socket } = useContext(SocketContext);

  const [ridePopup, setRidePopup] = useState(false);
  const [ride, setRide] = useState(null);
  const [confirmRidePickup, setConfirmRidePickup] = useState(false);
  const [socketReady, setSocketReady] = useState(false);
  const [locationReady, setLocationReady] = useState(false);

  const openRidePopup = useCallback((rideData) => {
    if (!rideData) return;

    console.log("[captain-home] abriendo popup de servicio:", {
      rideId: rideData?._id,
      pickup: rideData?.pickup,
      destination: rideData?.destination,
    });

    latestRideIdRef.current = rideData?._id || null;
    setRide(rideData);
    setConfirmRidePickup(false);
    setRidePopup(true);

    if (ridePopupRef.current) {
      gsap.killTweensOf(ridePopupRef.current);
      gsap.to(ridePopupRef.current, {
        y: "0%",
        duration: 0.25,
        ease: "power2.out",
      });
    }
  }, []);

  const emitCaptainJoin = useCallback(() => {
    if (!captain?._id) {
      console.warn("[captain-home] no hay captain._id para join");
      return;
    }

    if (!socket) {
      console.warn("[captain-home] socket no disponible para join");
      return;
    }

    if (!socket.connected) {
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

      // Evita spam absurdo por duplicados muy pegados
      if (elapsed < 1500 && source !== "connect-refresh") {
        return;
      }

      lastLocationSentRef.current = now;
      setLocationReady(true);

      console.log("[captain-home] emit update-location-captain", {
        captainId: captain._id,
        socketId: socket.id,
        source,
        ltd,
        lng,
      });

      socket.emit("update-location-captain", {
        userId: captain._id,
        location: {
          ltd,
          lng,
        },
      });
    },
    [captain?._id, socket]
  );

  const requestAndEmitCurrentLocation = useCallback(
    (source = "manual-request") => {
      if (!navigator.geolocation) {
        console.error("[captain-home] geolocation no soportado");
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          emitCaptainLocation(position.coords, source);
        },
        (error) => {
          console.error("[captain-home] error obteniendo ubicación actual:", {
            source,
            code: error?.code,
            message: error?.message,
          });
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

  useEffect(() => {
    if (!socket) return;

    const onConnect = () => {
      console.log("[captain-home] socket connected:", socket.id);
      setSocketReady(true);

      emitCaptainJoin();

      // Reenvía ubicación apenas reconecta
      setTimeout(() => {
        requestAndEmitCurrentLocation("connect-refresh");
      }, 500);
    };

    const onDisconnect = (reason) => {
      console.warn("[captain-home] socket disconnected:", reason);
      setSocketReady(false);
    };

    const onConnectError = (error) => {
      console.error("[captain-home] socket connect_error:", error?.message || error);
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
        raw: rideData,
      });

      openRidePopup(rideData);
    };

    socket.off("connect", onConnect);
    socket.off("disconnect", onDisconnect);
    socket.off("connect_error", onConnectError);
    socket.off("socket-joined", onSocketJoined);
    socket.off("location-updated", onLocationUpdated);
    socket.off("new-ride", onNewRide);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.on("socket-joined", onSocketJoined);
    socket.on("location-updated", onLocationUpdated);
    socket.on("new-ride", onNewRide);

    if (socket.connected) {
      onConnect();
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.off("socket-joined", onSocketJoined);
      socket.off("location-updated", onLocationUpdated);
      socket.off("new-ride", onNewRide);
    };
  }, [socket, emitCaptainJoin, requestAndEmitCurrentLocation, openRidePopup]);

  useEffect(() => {
    if (!captain?._id || !socket) return;
    if (!navigator.geolocation) return;

    const onLocationSuccess = (position) => {
      emitCaptainLocation(position.coords, "watchPosition");
    };

    const onLocationError = (error) => {
      console.error("[captain-home] Error obteniendo ubicación del transportador:", {
        code: error?.code,
        message: error?.message,
      });
    };

    requestAndEmitCurrentLocation("initial-getCurrentPosition");

    locationWatchIdRef.current = navigator.geolocation.watchPosition(
      onLocationSuccess,
      onLocationError,
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000,
      }
    );

    locationIntervalRef.current = setInterval(() => {
      requestAndEmitCurrentLocation("interval-refresh");
    }, 10000);

    return () => {
      if (locationWatchIdRef.current != null) {
        navigator.geolocation.clearWatch(locationWatchIdRef.current);
        locationWatchIdRef.current = null;
      }

      if (locationIntervalRef.current != null) {
        clearInterval(locationIntervalRef.current);
        locationIntervalRef.current = null;
      }
    };
  }, [captain?._id, socket, emitCaptainLocation, requestAndEmitCurrentLocation]);

  const confirmRide = async () => {
    try {
      if (!ride?._id) {
        console.error("[captain-home] No hay servicio seleccionado para confirmar.");
        return;
      }

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
    }
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
            {locationReady ? "Ubicación activa" : "Ubicando..."}
          </span>
        </div>
      </div>

      <div className="absolute w-screen h-[100%] top-0 z-20">
        <LiveTracking />
      </div>

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
