import React, {
  useState,
  useEffect,
  useContext,
  useRef,
  useCallback,
  useMemo,
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
  const [selectedRide, setSelectedRide] = useState(null);
  const [incomingRides, setIncomingRides] = useState([]);
  const [confirmRidePickup, setConfirmRidePickup] = useState(false);
  const [socketReady, setSocketReady] = useState(false);
  const [locationReady, setLocationReady] = useState(false);
  const [processingRideId, setProcessingRideId] = useState(null);

  const apiBase = getApiBaseUrl();

  const normalizeRide = useCallback((rideData) => {
    if (!rideData?._id) return null;

    return {
      ...rideData,
      vehicleType: rideData?.vehicleType || rideData?.vehicle || "car",
      fare:
        rideData?.offeredFare ??
        rideData?.fare ??
        0,
      receivedAt: Date.now(),
    };
  }, []);

  const sortedIncomingRides = useMemo(() => {
    return [...incomingRides].sort((a, b) => {
      return (b.receivedAt || 0) - (a.receivedAt || 0);
    });
  }, [incomingRides]);

  const upsertIncomingRide = useCallback((rideData) => {
    const normalized = normalizeRide(rideData);
    if (!normalized) return;

    setIncomingRides((prev) => {
      const exists = prev.some((item) => item._id === normalized._id);
      if (exists) {
        return prev.map((item) =>
          item._id === normalized._id ? { ...item, ...normalized } : item
        );
      }
      return [normalized, ...prev];
    });

    setSelectedRide((current) => current || normalized);
  }, [normalizeRide]);

  const removeIncomingRide = useCallback((rideId) => {
    if (!rideId) return;

    setIncomingRides((prev) => prev.filter((item) => item._id !== rideId));

    setSelectedRide((current) => {
      if (!current?._id || current._id !== rideId) return current;

      const remaining = incomingRides.filter((item) => item._id !== rideId);
      return remaining.length ? remaining[0] : null;
    });
  }, [incomingRides]);

  const openRidePopup = useCallback((rideData) => {
    const normalized = normalizeRide(rideData);
    if (!normalized) return;

    console.log("[captain-home] abriendo popup de servicio:", {
      rideId: normalized?._id,
      pickup: normalized?.pickup,
      destination: normalized?.destination,
    });

    upsertIncomingRide(normalized);
    setSelectedRide(normalized);
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
  }, [normalizeRide, upsertIncomingRide]);

  const emitCaptainJoin = useCallback(() => {
    if (!captain?._id || !socket?.connected) return;

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
      if (!captain?._id || !socket?.connected) return;

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

      socket.emit("update-location-captain", {
        userId: captain._id,
        location: { ltd, lng },
      });
    },
    [captain?._id, socket]
  );

  const requestAndEmitCurrentLocation = useCallback(
    (source = "manual-request") => {
      if (!navigator.geolocation) return;

      navigator.geolocation.getCurrentPosition(
        (position) => emitCaptainLocation(position.coords, source),
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

      openRidePopup(rideData);
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
  }, [socket, emitCaptainJoin, requestAndEmitCurrentLocation, openRidePopup]);

  useEffect(() => {
    if (!captain?._id || !socket || !navigator.geolocation) return;

    requestAndEmitCurrentLocation("initial-getCurrentPosition");

    locationWatchIdRef.current = navigator.geolocation.watchPosition(
      (position) => emitCaptainLocation(position.coords, "watchPosition"),
      (error) => {
        console.error("[captain-home] Error obteniendo ubicación:", {
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

  const selectRide = (rideItem) => {
    setSelectedRide(rideItem);
    setRidePopup(true);
  };

  const closeRidePopup = () => {
    setRidePopup(false);
  };

  const ignoreRide = async (rideId) => {
    if (!rideId) return;

    removeIncomingRide(rideId);

    if (selectedRide?._id === rideId) {
      const remaining = sortedIncomingRides.filter((r) => r._id !== rideId);
      setSelectedRide(remaining.length ? remaining[0] : null);
      setRidePopup(remaining.length > 0);
    }
  };

  const confirmRide = async () => {
    try {
      if (!selectedRide?._id) {
        console.error("[captain-home] No hay servicio seleccionado para confirmar.");
        return;
      }

      setProcessingRideId(selectedRide._id);

      await axios.post(
        `${apiBase}/rides/confirm`,
        {
          rideId: selectedRide._id,
          captainId: captain?._id,
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      removeIncomingRide(selectedRide._id);
      setRidePopup(false);
      setConfirmRidePickup(true);
    } catch (error) {
      console.error("[captain-home] Error confirmando servicio:", error);
      alert(
        error?.response?.data?.message ||
          "No se pudo confirmar el servicio. Intenta nuevamente."
      );
    } finally {
      setProcessingRideId(null);
    }
  };

  const sendCounterOffer = async ({ ride, value }) => {
    if (!ride?._id) {
      throw new Error("No hay servicio seleccionado.");
    }

    try {
      setProcessingRideId(ride._id);

      await axios.post(
        `${apiBase}/rides/counter-offer`,
        {
          rideId: ride._id,
          captainId: captain?._id,
          counterFare: value,
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      setIncomingRides((prev) =>
        prev.map((item) =>
          item._id === ride._id
            ? {
                ...item,
                counterOfferFare: value,
                offerStatus: "countered",
              }
            : item
        )
      );

      alert("Contraoferta enviada correctamente.");
    } catch (error) {
      console.error("[captain-home] Error enviando contraoferta:", error);
      throw error;
    } finally {
      setProcessingRideId(null);
    }
  };

  const goToGoodsOffer = () => navigate("/captain/offers/goods");
  const goToSpaceOffer = () => navigate("/captain/offers/space");
  const goToSeatOffer = () => navigate("/captain/offers/seats");
  const goToReceivedBids = () => navigate("/captain/offers/received");

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

  const formatCOP = (value) => {
    const number = Number(value) || 0;
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(Math.ceil(number));
  };

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

      <div className="bg-white absolute bottom-0 w-screen rounded-t-[24px] overflow-y-auto overflow-x-hidden z-50 shadow-2xl max-h-[58%]">
        <div className="pt-2">
          <div className="flex justify-center py-2">
            <div className="w-16 h-1.5 rounded-full bg-gray-300"></div>
          </div>

          <div className="px-5 pb-2 flex items-center justify-between gap-3">
            <p className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 px-4 py-2 text-sm font-semibold">
              Panel del transportador
            </p>

            <div className="inline-flex items-center rounded-full bg-violet-50 text-violet-700 px-3 py-2 text-xs font-bold">
              {sortedIncomingRides.length} ofertas
            </div>
          </div>

          <CaptainDetails />

          <div className="px-4 pb-4">
            <div className="rounded-[24px] border border-gray-200 bg-gray-50 p-4 mt-2">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    Solicitudes disponibles
                  </h3>
                  <p className="text-sm text-gray-600">
                    Revisa todas las ofertas que te van entrando.
                  </p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center">
                  <i className="ri-notification-3-line text-2xl text-emerald-700"></i>
                </div>
              </div>

              {sortedIncomingRides.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-5 text-center">
                  <p className="text-sm font-semibold text-gray-700">
                    No tienes ofertas pendientes
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Cuando lleguen nuevas solicitudes, aparecerán aquí.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sortedIncomingRides.map((item) => {
                    const isSelected = selectedRide?._id === item._id;
                    const amount =
                      item?.counterOfferFare ??
                      item?.offeredFare ??
                      item?.fare ??
                      0;

                    return (
                      <button
                        key={item._id}
                        type="button"
                        onClick={() => selectRide(item)}
                        className={`w-full rounded-2xl border p-4 text-left shadow-sm transition ${
                          isSelected
                            ? "border-emerald-400 bg-emerald-50"
                            : "border-gray-200 bg-white"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-base font-bold text-gray-900 truncate">
                              {item?.pickup || "Nuevo servicio"}
                            </div>
                            <div className="text-sm text-gray-600 truncate mt-1">
                              {item?.destination || "Destino pendiente"}
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <div className="text-base font-extrabold text-emerald-700">
                              {formatCOP(amount)}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {item?.counterOfferFare ? "Tu contraoferta" : "Oferta"}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-3">
                          <span className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                            {item?.vehicleType || item?.vehicle || "car"}
                          </span>

                          <span className="text-xs font-semibold text-violet-700">
                            {isSelected ? "Seleccionada" : "Tocar para ver"}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

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
            ride={selectedRide}
            confirmRide={confirmRide}
            onCounterOffer={sendCounterOffer}
            onIgnoreRide={() => ignoreRide(selectedRide?._id)}
            isSubmitting={processingRideId === selectedRide?._id}
          />
        </div>

        <div
          ref={confirmRidePickupRef}
          className="fixed z-[70] bottom-0 w-screen h-screen translate-y-full rounded-t-[24px] bg-white overflow-scroll shadow-2xl"
        >
          <ConfirmRidePickup
            setConfirmRidePickup={setConfirmRidePickup}
            setRidePopup={setRidePopup}
            ride={selectedRide}
          />
        </div>
      </div>
    </div>
  );
};

export default CaptainHome;
