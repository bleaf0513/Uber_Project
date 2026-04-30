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
import { CaptainDataContext } from "../context/CaptainContext";
import { SocketContext } from "../context/SocketContext";
import axios from "axios";
import { getApiBaseUrl } from "../apiBase";
import LiveTracking from "../../components/LiveTracking";

const GREEN_GRADIENT = "linear-gradient(135deg, #B7F600, #7FE000)";
const GREEN_DARK = "#111827";

const CaptainHome = () => {
  const ridePopupRef = useRef(null);
  const locationWatchIdRef = useRef(null);
  const locationIntervalRef = useRef(null);
  const lastLocationSentRef = useRef(0);
  const availableRidesIntervalRef = useRef(null);
  const ignoredRideIdsRef = useRef(new Set());

  const navigate = useNavigate();

  const { captain } = useContext(CaptainDataContext);
  const { socket } = useContext(SocketContext);

  const [ridePopup, setRidePopup] = useState(false);
  const [ride, setRide] = useState(null);
  const [availableRides, setAvailableRides] = useState([]);

  const [socketReady, setSocketReady] = useState(false);
  const [locationReady, setLocationReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processingRideId, setProcessingRideId] = useState(null);

  const [geoSupported, setGeoSupported] = useState(true);
  const [locationPermission, setLocationPermission] = useState("prompt");
  const [locationError, setLocationError] = useState("");
  const [requestingLocation, setRequestingLocation] = useState(false);
  const [showGpsPrompt, setShowGpsPrompt] = useState(false);

  const formatCOP = (value) => {
    const number = Number(value) || 0;

    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(Math.ceil(number));
  };

  const formatKm = (value) => {
    const number = Number(value);

    if (!Number.isFinite(number) || number <= 0) {
      return "-- km";
    }

    return `${number.toFixed(1)} km`;
  };

  const formatShortAddress = (address = "") => {
    const safe = String(address || "").trim();

    if (!safe) return "Dirección no disponible";

    const parts = safe
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    if (parts.length <= 2) return safe;

    return `${parts[0]}, ${parts[1]}`;
  };

  const getUserName = (rideData) => {
    const user = rideData?.user || {};
    const fullname = user?.fullname || {};

    return (
      [fullname?.firstname, fullname?.lastname].filter(Boolean).join(" ") ||
      user?.name ||
      "Usuario"
    );
  };

  const upsertAvailableRide = useCallback((rideData) => {
    if (!rideData?._id) return;

    const rideId = String(rideData._id);

    if (ignoredRideIdsRef.current.has(rideId)) return;

    setAvailableRides((prev) => {
      const exists = prev.some((item) => String(item._id) === rideId);

      if (exists) {
        return prev.map((item) =>
          String(item._id) === rideId ? { ...item, ...rideData } : item
        );
      }

      return [rideData, ...prev];
    });
  }, []);

  const removeAvailableRide = useCallback(
    (rideId) => {
      if (!rideId) return;

      setAvailableRides((prev) =>
        prev.filter((item) => String(item._id) !== String(rideId))
      );

      if (String(ride?._id || "") === String(rideId)) {
        setRidePopup(false);
        setRide(null);
      }
    },
    [ride?._id]
  );

  const emitCaptainJoin = useCallback(() => {
    if (!captain?._id) {
      console.warn("[captain-home] no hay captain._id para join");
      return;
    }

    if (!socket?.connected) {
      console.warn("[captain-home] socket no conectado todavía");
      return;
    }

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

      if (!Number.isFinite(ltd) || !Number.isFinite(lng)) return;

      const now = Date.now();
      const elapsed = now - lastLocationSentRef.current;

      if (elapsed < 1500 && source !== "connect-refresh") return;

      lastLocationSentRef.current = now;
      setLocationReady(true);
      setLocationError("");
      setShowGpsPrompt(false);
      setLocationPermission("granted");

      socket.emit("update-location-captain", {
        userId: captain._id,
        location: { ltd, lng },
      });
    },
    [captain?._id, socket]
  );

  const getGeolocationErrorMessage = (error) => {
    const code = error?.code;

    if (code === 1) return "Debes permitir el acceso a la ubicación para continuar.";
    if (code === 2) return "No se pudo detectar tu ubicación. Activa el GPS del dispositivo.";
    if (code === 3) return "La ubicación tardó demasiado. Intenta nuevamente.";

    return error?.message || "No se pudo obtener la ubicación.";
  };

  const requestAndEmitCurrentLocation = useCallback(
    (source = "manual-request", forcePrompt = false) => {
      if (!navigator.geolocation) {
        setGeoSupported(false);
        setLocationReady(false);
        setShowGpsPrompt(true);
        setLocationError(
          "Este dispositivo o navegador no soporta geolocalización."
        );
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
      setLocationError(
        "Este dispositivo o navegador no soporta geolocalización."
      );
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
        .catch(() => {
          setShowGpsPrompt(true);
          requestAndEmitCurrentLocation("initial-auto-request", true);
        });
    } else {
      setShowGpsPrompt(true);
      requestAndEmitCurrentLocation("initial-auto-request", true);
    }
  }, [requestAndEmitCurrentLocation]);

  const fetchAvailableRidesForCaptain = useCallback(async () => {
    try {
      if (!captain?._id) return;

      const token = localStorage.getItem("token");
      if (!token) return;

      const response = await axios.get(
        `${getApiBaseUrl()}/rides/available-for-captain`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const rides = Array.isArray(response?.data?.rides)
        ? response.data.rides
        : [];

      const filteredRides = rides.filter((item) => {
        if (!item?._id) return false;
        return !ignoredRideIdsRef.current.has(String(item._id));
      });

      setAvailableRides(filteredRides);
    } catch (error) {
      console.warn(
        "[captain-home] No se pudieron consultar viajes abiertos:",
        error?.response?.data?.message || error?.message
      );
    }
  }, [captain?._id]);

  useEffect(() => {
    if (!socket) return;

    const onConnect = () => {
      setSocketReady(true);
      emitCaptainJoin();

      setTimeout(() => {
        requestAndEmitCurrentLocation("connect-refresh");
      }, 500);

      setTimeout(() => {
        fetchAvailableRidesForCaptain();
      }, 700);
    };

    const onDisconnect = () => {
      setSocketReady(false);
    };

    const onNewRide = (rideData) => {
      if (!rideData?._id) return;
      upsertAvailableRide(rideData);
    };

    const onRideNoLongerAvailable = (payload) => {
      const payloadRideId = String(payload?.rideId || payload?._id || "");

      if (!payloadRideId) return;

      removeAvailableRide(payloadRideId);

      if (payload?.message) {
        console.log("[captain-home] ride no disponible:", payload.message);
      }
    };

    const onRideOfferRejected = (payload) => {
      const rideId = String(payload?._id || payload?.rideId || "");

      alert("El usuario rechazó tu oferta para este viaje.");

      setRidePopup(false);
      setRide(null);

      if (rideId) {
        setTimeout(() => {
          fetchAvailableRidesForCaptain();
        }, 800);
      }
    };

    const onRideOfferAccepted = (payload) => {
      const acceptedRideId = String(payload?._id || payload?.rideId || "");
      const currentRideId = String(ride?._id || "");

      if (acceptedRideId && currentRideId && acceptedRideId === currentRideId) {
        setRide(payload);
        setRidePopup(false);

        navigate("/captain-riding", {
          state: { ride: payload },
        });
      } else if (acceptedRideId) {
        removeAvailableRide(acceptedRideId);
      }
    };

    socket.off("connect", onConnect);
    socket.off("disconnect", onDisconnect);
    socket.off("new-ride", onNewRide);
    socket.off("ride-no-longer-available", onRideNoLongerAvailable);
    socket.off("ride-offer-rejected", onRideOfferRejected);
    socket.off("ride-offer-accepted", onRideOfferAccepted);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("new-ride", onNewRide);
    socket.on("ride-no-longer-available", onRideNoLongerAvailable);
    socket.on("ride-offer-rejected", onRideOfferRejected);
    socket.on("ride-offer-accepted", onRideOfferAccepted);

    if (socket.connected) {
      onConnect();
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("new-ride", onNewRide);
      socket.off("ride-no-longer-available", onRideNoLongerAvailable);
      socket.off("ride-offer-rejected", onRideOfferRejected);
      socket.off("ride-offer-accepted", onRideOfferAccepted);
    };
  }, [
    socket,
    emitCaptainJoin,
    requestAndEmitCurrentLocation,
    ride?._id,
    navigate,
    fetchAvailableRidesForCaptain,
    upsertAvailableRide,
    removeAvailableRide,
  ]);

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

  useEffect(() => {
    if (!captain?._id) return;

    fetchAvailableRidesForCaptain();

    availableRidesIntervalRef.current = setInterval(() => {
      fetchAvailableRidesForCaptain();
    }, 4000);

    return () => {
      if (availableRidesIntervalRef.current) {
        clearInterval(availableRidesIntervalRef.current);
        availableRidesIntervalRef.current = null;
      }
    };
  }, [captain?._id, fetchAvailableRidesForCaptain]);

  const sendRideOffer = async ({ targetRide, price, message = "" }) => {
    try {
      const rideToOffer = targetRide || ride;

      if (!rideToOffer?._id) return;

      setProcessing(true);
      setProcessingRideId(String(rideToOffer._id));

      const response = await axios.post(
        `${getApiBaseUrl()}/rides/captain-offer`,
        {
          rideId: rideToOffer._id,
          price,
          message,
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      const updatedRide = response?.data || rideToOffer;

      setRide(updatedRide);
      setRidePopup(false);

      setAvailableRides((prev) =>
        prev.filter((item) => String(item._id) !== String(rideToOffer._id))
      );

      alert("Oferta enviada al usuario correctamente.");
    } catch (error) {
      alert(
        error?.response?.data?.message ||
          "No se pudo enviar la oferta del viaje."
      );
    } finally {
      setProcessing(false);
      setProcessingRideId(null);
    }
  };

  const confirmRide = async (targetRide = null) => {
    try {
      const rideToConfirm = targetRide || ride;

      if (!rideToConfirm?._id) return;

      const currentFare =
        Number(
          rideToConfirm?.offeredFare ??
            rideToConfirm?.fare ??
            rideToConfirm?.suggestedFare ??
            0
        ) || 0;

      if (!currentFare || currentFare <= 0) {
        alert("No hay un valor válido para aceptar este viaje.");
        return;
      }

      await sendRideOffer({
        targetRide: rideToConfirm,
        price: currentFare,
        message: "Acepto el valor propuesto por el usuario.",
      });
    } catch (error) {
      console.error("[captain-home] Error aceptando valor del usuario:", error);
    }
  };

  const handleCounterOffer = async ({ value, message }) => {
    await sendRideOffer({
      targetRide: ride,
      price: Number(value || 0),
      message: message || "Contraoferta del conductor.",
    });
  };

  const openCounterOffer = (rideData) => {
    if (!rideData?._id) return;

    setRide(rideData);
    setRidePopup(true);
  };

  const ignoreRide = (rideData = null) => {
    const rideToIgnore = rideData || ride;

    if (rideToIgnore?._id) {
      ignoredRideIdsRef.current.add(String(rideToIgnore._id));
      removeAvailableRide(rideToIgnore._id);
    }

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

      {availableRides.length > 0 && (
        <div className="absolute top-[92px] left-0 right-0 z-40 px-3">
          <div className="flex items-center justify-between px-2 mb-2">
            <div
              className="rounded-full px-4 py-2 shadow-lg text-black text-xs font-black"
              style={{
                background: GREEN_GRADIENT,
              }}
            >
              {availableRides.length} solicitudes disponibles
            </div>

            <button
              type="button"
              onClick={fetchAvailableRidesForCaptain}
              className="w-10 h-10 rounded-full bg-white shadow-lg border border-lime-200 flex items-center justify-center"
            >
              <i className="ri-refresh-line text-xl text-lime-600"></i>
            </button>
          </div>

          <div className="max-h-[46vh] overflow-y-auto space-y-3 pr-1 pb-3">
            {availableRides.map((item) => {
              const rideId = String(item?._id || "");
              const isThisProcessing = processing && processingRideId === rideId;

              const driverToPickupKm =
                item?.metrics?.driverToPickupKm ??
                item?.metrics?.driverToPickup ??
                null;

              const pickupToDestinationKm =
                item?.metrics?.pickupToDestinationKm ??
                item?.distance ??
                null;

              return (
                <div
                  key={rideId}
                  className="w-full rounded-[22px] bg-white shadow-2xl border border-lime-200 overflow-hidden"
                >
                  <div className="h-1.5" style={{ background: GREEN_GRADIENT }} />

                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="inline-flex rounded-xl bg-gray-100 px-3 py-1 text-xs font-black text-gray-800 mb-2">
                          Pasajero
                        </div>

                        <h4 className="text-xl font-black text-gray-950 leading-6 truncate">
                          {getUserName(item)}
                        </h4>

                        <div className="flex items-center gap-2 mt-2">
                          <i className="ri-star-fill text-black text-lg"></i>
                          <span className="text-sm font-black text-gray-900">
                            5.0
                          </span>
                          <span className="text-sm text-gray-500">
                            Central Go
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-[11px] font-black text-gray-500 uppercase">
                          Oferta
                        </p>

                        <p className="text-3xl font-black text-gray-950 leading-8">
                          {formatCOP(
                            item?.offeredFare ??
                              item?.fare ??
                              item?.suggestedFare ??
                              0
                          )}
                        </p>

                        <p className="text-sm font-bold text-gray-600 mt-1">
                          {formatKm(driverToPickupKm)} hasta cliente
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-4">
                      <div className="rounded-2xl bg-lime-50 border border-lime-200 p-3">
                        <p className="text-[10px] font-black text-lime-700 uppercase">
                          Tú al cliente
                        </p>
                        <p className="text-xl font-black text-gray-950 mt-1">
                          {formatKm(driverToPickupKm)}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-lime-50 border border-lime-200 p-3">
                        <p className="text-[10px] font-black text-lime-700 uppercase">
                          Recorrido
                        </p>
                        <p className="text-xl font-black text-gray-950 mt-1">
                          {formatKm(pickupToDestinationKm)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      <div className="flex items-start gap-2">
                        <div className="w-8 h-8 rounded-xl bg-lime-100 flex items-center justify-center shrink-0">
                          <i className="ri-map-pin-range-fill text-lime-700 text-base"></i>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-black text-gray-500 uppercase">
                            Recoger
                          </p>
                          <p className="text-xs font-bold text-gray-950 truncate">
                            {formatShortAddress(item?.pickup)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <div className="w-8 h-8 rounded-xl bg-lime-100 flex items-center justify-center shrink-0">
                          <i className="ri-flag-fill text-lime-700 text-base"></i>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-black text-gray-500 uppercase">
                            Llevar
                          </p>
                          <p className="text-xs font-bold text-gray-950 truncate">
                            {formatShortAddress(item?.destination)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-4">
                      <button
                        type="button"
                        disabled={processing}
                        onClick={() => ignoreRide(item)}
                        className="rounded-2xl py-3 bg-gray-100 text-gray-900 text-xs font-black disabled:opacity-60"
                      >
                        Ocultar
                      </button>

                      <button
                        type="button"
                        disabled={processing}
                        onClick={() => openCounterOffer(item)}
                        className="rounded-2xl py-3 bg-gray-100 text-gray-900 text-xs font-black disabled:opacity-60"
                      >
                        Ofertar
                      </button>

                      <button
                        type="button"
                        disabled={isThisProcessing}
                        onClick={() => confirmRide(item)}
                        className="rounded-2xl py-3 bg-lime-400 text-black text-xs font-black disabled:opacity-60"
                      >
                        {isThisProcessing ? "..." : "Aceptar"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
              Sin ubicación activa el conductor no podrá ser monitoreado ni
              recibir correctamente servicios en tiempo real.
            </p>
          </div>
        </div>
      )}

      <div className="bg-white absolute bottom-0 w-screen rounded-t-[24px] overflow-y-auto overflow-x-hidden z-50 shadow-2xl max-h-[42%]">
        <div className="pt-2">
          <div className="flex justify-center py-2">
            <div className="w-16 h-1.5 rounded-full bg-gray-300"></div>
          </div>

          <div className="px-5 pb-2 flex items-center justify-between gap-3">
            <p
              className="inline-flex items-center rounded-full px-4 py-2 text-sm font-black text-black"
              style={{
                background: GREEN_GRADIENT,
              }}
            >
              Panel del transportador
            </p>

            <div className="inline-flex items-center rounded-full bg-lime-50 text-lime-700 px-3 py-2 text-xs font-black">
              {availableRides.length} solicitudes
            </div>
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
            setRidePopup={setRidePopup}
            ride={ride}
            confirmRide={() => confirmRide(ride)}
            onIgnoreRide={() => ignoreRide(ride)}
            onCounterOffer={handleCounterOffer}
            isSubmitting={processing}
          />
        </div>
      </div>
    </div>
  );
};

export default CaptainHome;