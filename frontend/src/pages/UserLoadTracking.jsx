import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Link,
  useParams,
} from "react-router-dom";
import axios from "axios";

import { getApiBaseUrl } from "../apiBase";
import LiveTracking from "../../components/LiveTracking";

const TRACKING_STATUS_LABELS = {
  pending_confirmation: "Pendiente de confirmación",
  awaiting_reservation: "Esperando reserva",
  confirmed: "Servicio confirmado",
  driver_heading_to_pickup: "Conductor en camino a recoger",
  arrived_at_pickup: "Conductor en el punto de recogida",
  loading: "Cargando mercancía",
  picked_up: "Carga recogida",
  in_transit: "Carga en tránsito",
  near_destination: "Cerca del destino",
  arrived_at_destination: "Conductor en el destino",
  unloading: "Descargando mercancía",
  delivered: "Carga entregada",
  completed: "Servicio finalizado",
  cancelled: "Servicio cancelado",
};

const VEHICLE_LABELS = {
  moto: "Moto",
  carro: "Carro",
  motocarro: "Motocarro",
  camioneta: "Camioneta",
  van: "Van",
  camion_ultraliviano: "Camión ultraliviano",
  camion_liviano: "Camión liviano",
  camion_mediano: "Camión mediano",
  camion_pesado: "Camión pesado",
  camion_sencillo: "Camión sencillo",
  doble_troque: "Doble troque",
  volqueta: "Volqueta",
  minimula: "Minimula",
  tractomula: "Tractomula",
  cama_baja: "Cama baja",
  vehiculo_especial: "Vehículo especial",
  otro: "Otro",
};

const BODY_LABELS = {
  no_especificada: "No especificada",
  furgon_cerrado: "Furgón cerrado",
  estacas: "Estacas",
  plataforma: "Plataforma",
  refrigerada: "Refrigerada",
  volco: "Volco",
  tanque: "Tanque",
  portacontenedor: "Portacontenedor",
  cama_baja: "Cama baja",
  carroceria_abierta: "Carrocería abierta",
  otro: "Otro",
};

const getUserToken = () =>
  localStorage.getItem("userToken") ||
  localStorage.getItem("token") ||
  "";

const formatCOP = (value) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

const formatDate = (value) => {
  if (!value) return "Sin registro";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Sin registro";
  }

  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const getFullName = (person, fallback) => {
  const first =
    person?.fullname?.firstname || "";

  const last =
    person?.fullname?.lastname || "";

  return (
    `${first} ${last}`.trim() ||
    person?.email ||
    fallback
  );
};

const normalizeMapPoint = (point) => {
  const lat = Number(point?.lat);
  const lng = Number(point?.lng);

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return null;
  }

  return {
    lat,
    lng,
    address: point?.address || "",
  };
};

const UserLoadTracking = () => {
  const { trackingId } = useParams();

  const [tracking, setTracking] =
    useState(null);

  const [routePoints, setRoutePoints] =
    useState([]);

  const [summary, setSummary] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const token = getUserToken();

  const fetchTracking = useCallback(
    async ({ silent = false } = {}) => {
      if (!trackingId || !token) {
        setError(
          "No se encontró una sesión o seguimiento válido."
        );
        setLoading(false);
        return;
      }

      try {
        if (!silent) {
          setLoading(true);
        }

        setError("");

        const response = await axios.get(
          `${getApiBaseUrl()}/marketplace-load-tracking/customer/${trackingId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        setTracking(
          response?.data?.tracking || null
        );

        setRoutePoints(
          Array.isArray(
            response?.data?.routePoints
          )
            ? response.data.routePoints
            : []
        );

        setSummary(
          response?.data?.summary || null
        );
      } catch (requestError) {
        console.error(
          "Error consultando seguimiento:",
          requestError
        );

        setError(
          requestError?.response?.data
            ?.message ||
            "No se pudo cargar el seguimiento."
        );
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [trackingId, token]
  );

  useEffect(() => {
    fetchTracking();

    const intervalId =
      window.setInterval(() => {
        fetchTracking({
          silent: true,
        });
      }, 8000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [fetchTracking]);

  const currentLocation =
    normalizeMapPoint(
      tracking?.currentLocation
    );

  const origin = normalizeMapPoint(
    tracking?.origin
  );

  const destination =
    normalizeMapPoint(
      tracking?.destination
    );

  const captainId =
    tracking?.captain?._id ||
    tracking?.captain ||
    "assigned-captain";

  const nearbyDrivers = useMemo(() => {
    if (!currentLocation) {
      return [];
    }

    return [
      {
        _id: captainId,
        lat: currentLocation.lat,
        lng: currentLocation.lng,
        heading:
          tracking?.currentLocation
            ?.heading || 0,
        fullname:
          tracking?.captain?.fullname ||
          "Transportador asignado",
      },
    ];
  }, [
    currentLocation,
    captainId,
    tracking?.captain,
    tracking?.currentLocation?.heading,
  ]);

  const spaceOffer =
    tracking?.spaceOffer || {};

  const acceptedBid =
    tracking?.acceptedBid || {};

  const statusLabel =
    TRACKING_STATUS_LABELS[
      tracking?.status
    ] ||
    tracking?.status ||
    "Pendiente";

  const captainName =
    summary?.captainName ||
    getFullName(
      tracking?.captain,
      "Transportador"
    );

  const vehicleType =
    VEHICLE_LABELS[
      tracking?.vehicle?.type
    ] ||
    VEHICLE_LABELS[
      acceptedBid
        ?.proposedVehicleType
    ] ||
    "No especificado";

  const bodyType =
    BODY_LABELS[
      tracking?.vehicle?.bodyType
    ] ||
    BODY_LABELS[
      acceptedBid?.proposedBodyType
    ] ||
    "No especificada";

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center px-5">
        <div className="rounded-[26px] bg-white border border-gray-200 shadow-xl p-6 text-center">
          <div className="w-12 h-12 rounded-full border-4 border-gray-200 border-t-purple-700 animate-spin mx-auto" />

          <p className="text-sm font-black text-gray-700 mt-4">
            Cargando seguimiento...
          </p>
        </div>
      </div>
    );
  }

  if (error || !tracking) {
    return (
      <div className="min-h-screen bg-slate-100 p-4">
        <Link
          to="/available-offers"
          className="inline-flex w-11 h-11 rounded-full bg-black text-white items-center justify-center shadow-lg"
        >
          <i className="ri-arrow-left-line text-xl" />
        </Link>

        <div className="mt-5 rounded-[28px] bg-red-50 border border-red-200 p-6 text-red-700 font-bold">
          {error ||
            "Seguimiento no encontrado."}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-gray-100 to-slate-200">
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-xl border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to="/available-offers"
              className="w-11 h-11 rounded-full bg-black text-white flex items-center justify-center shadow-lg shrink-0"
            >
              <i className="ri-arrow-left-line text-xl" />
            </Link>

            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-purple-700">
                Seguimiento profesional
              </p>

              <h1 className="text-lg font-black text-gray-950 truncate">
                {spaceOffer?.title ||
                  spaceOffer?.cargoType ||
                  "Servicio de carga"}
              </h1>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              fetchTracking()
            }
            className="w-11 h-11 rounded-2xl bg-purple-50 border border-purple-100 text-purple-700 flex items-center justify-center"
          >
            <i className="ri-refresh-line text-xl" />
          </button>
        </div>
      </header>

      <main className="p-4 space-y-4">
        <section className="overflow-hidden rounded-[30px] bg-gradient-to-r from-purple-900 via-violet-700 to-fuchsia-600 text-white shadow-2xl">
          <div className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-white/65">
                  Estado del servicio
                </p>

                <h2 className="text-2xl font-black mt-2">
                  {statusLabel}
                </h2>

                <p className="text-sm text-white/75 mt-2">
                  Última actualización:{" "}
                  {formatDate(
                    tracking
                      ?.statusUpdatedAt
                  )}
                </p>
              </div>

              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 border border-white/20 px-3 py-1.5 text-[10px] font-black">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                {tracking?.trackingPlan ===
                "professional"
                  ? "GPS PRO"
                  : "BÁSICO"}
              </span>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-[30px] bg-white border border-gray-200 shadow-xl">
          <div className="flex items-center justify-between gap-3 p-4 border-b border-gray-200">
            <div>
              <h2 className="text-lg font-black text-gray-950">
                Ubicación del conductor
              </h2>

              <p className="text-xs text-gray-600 mt-1">
                Se actualiza automáticamente cada 8 segundos.
              </p>
            </div>

            {currentLocation ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-700 px-3 py-1.5 text-[10px] font-black">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                EN VIVO
              </span>
            ) : (
              <span className="rounded-full bg-amber-100 border border-amber-200 text-amber-700 px-3 py-1.5 text-[10px] font-black">
                ESPERANDO GPS
              </span>
            )}
          </div>

          {currentLocation ? (
            <>
              <div className="h-[430px] w-full">
                <LiveTracking
                  pickup={origin}
                  destination={
                    destination
                  }
                  nearbyDrivers={
                    nearbyDrivers
                  }
                  selectedCaptainId={
                    captainId
                  }
                  showPickupRadar={false}
                  showRouteToPickup={
                    Boolean(origin)
                  }
                  autoFetchNearbyDrivers={
                    false
                  }
                  useViewerGeolocation={
                    false
                  }
                  zoom={15}
                />
              </div>

              <div className="grid grid-cols-2 gap-3 p-4 border-t border-gray-200">
                <div className="rounded-2xl bg-gray-50 border border-gray-200 p-3">
                  <p className="text-[10px] uppercase font-black text-gray-500">
                    Última ubicación
                  </p>

                  <p className="text-xs font-bold text-gray-800 mt-1">
                    {formatDate(
                      tracking
                        ?.currentLocation
                        ?.updatedAt ||
                        tracking
                          ?.lastLocationReceivedAt
                    )}
                  </p>
                </div>

                <div className="rounded-2xl bg-purple-50 border border-purple-100 p-3">
                  <p className="text-[10px] uppercase font-black text-purple-600">
                    Puntos registrados
                  </p>

                  <p className="text-lg font-black text-purple-900 mt-1">
                    {routePoints.length}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="min-h-[320px] flex items-center justify-center p-6 bg-gradient-to-br from-amber-50 to-white">
              <div className="max-w-sm text-center">
                <div className="w-20 h-20 rounded-full bg-amber-100 border border-amber-200 text-amber-700 flex items-center justify-center mx-auto">
                  <i className="ri-map-pin-time-line text-4xl" />
                </div>

                <h3 className="text-lg font-black text-gray-950 mt-4">
                  Esperando ubicación
                </h3>

                <p className="text-sm text-gray-600 mt-2 leading-6">
                  El seguimiento profesional está activo. El mapa aparecerá aquí cuando el conductor comparta la ubicación desde su servicio asignado.
                </p>
              </div>
            </div>
          )}
        </section>

        <section className="grid grid-cols-2 gap-3">
          <div className="rounded-[24px] bg-slate-950 text-white p-4 shadow-lg">
            <p className="text-[10px] uppercase font-black text-white/55">
              Valor acordado
            </p>

            <p className="text-xl font-black mt-2">
              {formatCOP(
                tracking?.serviceValue ||
                  acceptedBid?.offeredPrice
              )}
            </p>
          </div>

          <div className="rounded-[24px] bg-white border border-purple-100 p-4 shadow-lg">
            <p className="text-[10px] uppercase font-black text-purple-600">
              Distancia registrada
            </p>

            <p className="text-xl font-black text-purple-900 mt-2">
              {Number(
                summary?.totalDistanceKm || 0
              ).toFixed(1)}{" "}
              km
            </p>
          </div>
        </section>

        <section className="rounded-[28px] bg-white border border-gray-200 shadow-lg p-4">
          <h2 className="text-lg font-black text-gray-950">
            Ruta del servicio
          </h2>

          <div className="mt-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <i className="ri-map-pin-2-line" />
              </div>

              <div>
                <p className="text-[10px] uppercase font-black text-gray-500">
                  Recogida
                </p>

                <p className="text-base font-black text-gray-950 mt-1">
                  {tracking?.origin?.city ||
                    "Ciudad de origen"}
                </p>

                <p className="text-sm text-gray-600 mt-1">
                  {tracking?.origin?.address ||
                    spaceOffer?.origin ||
                    "Dirección por definir"}
                </p>
              </div>
            </div>

            <div className="ml-5 my-2 h-8 border-l-2 border-dashed border-gray-300" />

            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-fuchsia-100 text-fuchsia-700 flex items-center justify-center shrink-0">
                <i className="ri-flag-line" />
              </div>

              <div>
                <p className="text-[10px] uppercase font-black text-gray-500">
                  Destino
                </p>

                <p className="text-base font-black text-gray-950 mt-1">
                  {tracking?.destination?.city ||
                    "Ciudad de destino"}
                </p>

                <p className="text-sm text-gray-600 mt-1">
                  {tracking?.destination?.address ||
                    spaceOffer?.destination ||
                    "Dirección por definir"}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] bg-white border border-gray-200 shadow-lg p-4">
          <h2 className="text-lg font-black text-gray-950">
            Transportador y vehículo
          </h2>

          <div className="mt-4 flex items-center gap-3">
            <div className="w-14 h-14 rounded-[20px] bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
              <i className="ri-user-star-line text-2xl" />
            </div>

            <div>
              <p className="text-base font-black text-gray-950">
                {captainName}
              </p>

              <p className="text-sm text-gray-600 mt-1">
                Transportador asignado
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="rounded-2xl bg-gray-50 border border-gray-200 p-3">
              <p className="text-[10px] uppercase font-black text-gray-500">
                Vehículo
              </p>

              <p className="text-sm font-black text-gray-900 mt-1">
                {vehicleType}
              </p>
            </div>

            <div className="rounded-2xl bg-gray-50 border border-gray-200 p-3">
              <p className="text-[10px] uppercase font-black text-gray-500">
                Carrocería
              </p>

              <p className="text-sm font-black text-gray-900 mt-1">
                {bodyType}
              </p>
            </div>

            <div className="rounded-2xl bg-gray-50 border border-gray-200 p-3">
              <p className="text-[10px] uppercase font-black text-gray-500">
                Placa
              </p>

              <p className="text-sm font-black text-gray-900 mt-1">
                {tracking?.vehicle?.plate ||
                  acceptedBid
                    ?.proposedVehiclePlate ||
                  "No registrada"}
              </p>
            </div>

            <div className="rounded-2xl bg-gray-50 border border-gray-200 p-3">
              <p className="text-[10px] uppercase font-black text-gray-500">
                Capacidad
              </p>

              <p className="text-sm font-black text-gray-900 mt-1">
                {tracking?.vehicle?.capacity ||
                  acceptedBid
                    ?.proposedVehicleCapacity ||
                  "No especificada"}{" "}
                {tracking?.vehicle
                  ?.capacityUnit ||
                  acceptedBid
                    ?.proposedVehicleCapacityUnit ||
                  ""}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] bg-white border border-gray-200 shadow-lg p-4">
          <h2 className="text-lg font-black text-gray-950">
            Historial del servicio
          </h2>

          {Array.isArray(
            tracking?.statusHistory
          ) &&
          tracking.statusHistory.length >
            0 ? (
            <div className="mt-4 space-y-3">
              {[...tracking.statusHistory]
                .reverse()
                .map((item, index) => (
                  <div
                    key={`${item?.status}-${item?.createdAt}-${index}`}
                    className="flex items-start gap-3"
                  >
                    <div className="w-9 h-9 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                      <i className="ri-check-line" />
                    </div>

                    <div className="flex-1 border-b border-gray-100 pb-3">
                      <p className="text-sm font-black text-gray-900">
                        {TRACKING_STATUS_LABELS[
                          item?.status
                        ] ||
                          item?.status}
                      </p>

                      <p className="text-xs text-gray-500 mt-1">
                        {formatDate(
                          item?.createdAt
                        )}
                      </p>

                      {item?.note ? (
                        <p className="text-xs text-gray-600 mt-1">
                          {item.note}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-sm text-gray-600 mt-3">
              Todavía no hay cambios de estado registrados.
            </p>
          )}
        </section>
      </main>
    </div>
  );
};

export default UserLoadTracking;