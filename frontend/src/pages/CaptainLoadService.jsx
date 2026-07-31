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

const TRACKING_ACTIONS = [
  {
    status: "confirmed",
    label: "Confirmar servicio",
    icon: "ri-shield-check-line",
  },
  {
    status: "driver_heading_to_pickup",
    label: "Voy a recoger",
    icon: "ri-navigation-line",
  },
  {
    status: "picked_up",
    label: "Carga recogida",
    icon: "ri-box-3-line",
  },
  {
    status: "in_transit",
    label: "En camino al destino",
    icon: "ri-truck-line",
  },
  {
    status: "delivered",
    label: "Carga entregada",
    icon: "ri-checkbox-circle-line",
  },
];

const STATUS_LABELS = {
  pending_confirmation: "Pendiente de confirmación",
  awaiting_reservation: "Esperando reserva",
  confirmed: "Servicio confirmado",
  driver_heading_to_pickup: "Voy a recoger",
  picked_up: "Carga recogida",
  in_transit: "En camino al destino",
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

const formatNumber = (value) =>
  new Intl.NumberFormat("es-CO").format(
    Number(value) || 0
  );

const getCaptainToken = () =>
  localStorage.getItem("captainToken") ||
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

const normalizePoint = (point) => {
  const lat = Number(point?.lat);
  const lng = Number(point?.lng);

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180 ||
    (Math.abs(lat) < 0.000001 &&
      Math.abs(lng) < 0.000001)
  ) {
    return null;
  }

  return {
    lat,
    lng,
    address: point?.address || "",
  };
};

const getCurrentStatusIndex = (status) => {
  if (
    status === "pending_confirmation" ||
    status === "awaiting_reservation"
  ) {
    return -1;
  }

  return TRACKING_ACTIONS.findIndex(
    (action) =>
      action.status === status
  );
};

const CaptainLoadService = () => {
  const { trackingId } = useParams();
  const token = getCaptainToken();

  const [tracking, setTracking] =
    useState(null);

  const [routePoints, setRoutePoints] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [pageError, setPageError] =
    useState("");

  const [pageSuccess, setPageSuccess] =
    useState("");

  const [sharingLocation, setSharingLocation] =
    useState(false);

  const [updatingStatus, setUpdatingStatus] =
    useState(false);

  const fetchTracking = useCallback(
    async ({ silent = false } = {}) => {
      try {
        if (!silent) {
          setLoading(true);
        }

        setPageError("");

        const response = await axios.get(
          `${getApiBaseUrl()}/marketplace-load-tracking/captain/${trackingId}`,
          {
            headers: {
              Authorization:
                `Bearer ${token}`,
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
      } catch (error) {
        setPageError(
          error?.response?.data?.message ||
            "No se pudo cargar el servicio."
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

  const currentIndex =
    getCurrentStatusIndex(
      tracking?.status
    );

  const nextAction =
    TRACKING_ACTIONS[
      currentIndex + 1
    ] || null;

  const currentLocation =
    normalizePoint(
      tracking?.currentLocation
    );

  const origin =
    normalizePoint(
      tracking?.origin
    );

  const destination =
    normalizePoint(
      tracking?.destination
    );

  const captainId =
    tracking?.captain?._id ||
    tracking?.captain ||
    "assigned-captain";

  const drivers = useMemo(() => {
    if (!currentLocation) return [];

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
          "Transportador",
      },
    ];
  }, [
    currentLocation,
    captainId,
    tracking?.captain,
    tracking?.currentLocation?.heading,
  ]);

  const shareLocation = async () => {
    if (!navigator.geolocation) {
      setPageError(
        "Este dispositivo no permite obtener la ubicación."
      );
      return;
    }

    try {
      setSharingLocation(true);
      setPageError("");
      setPageSuccess("");

      const position = await new Promise(
        (resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            resolve,
            reject,
            {
              enableHighAccuracy: true,
              timeout: 20000,
              maximumAge: 5000,
            }
          );
        }
      );

      await axios.patch(
        `${getApiBaseUrl()}/marketplace-load-tracking/${trackingId}/location`,
        {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy:
            position.coords.accuracy,
          heading:
            position.coords.heading,
          speed:
            position.coords.speed,
          source:
            "foreground_gps",
          platform: "web",
          deviceTimestamp:
            new Date(
              position.timestamp
            ).toISOString(),
        },
        {
          headers: {
            Authorization:
              `Bearer ${token}`,
          },
        }
      );

      setPageSuccess(
        "Ubicación compartida con el cliente."
      );

      await fetchTracking();
    } catch (error) {
      setPageError(
        error?.code === 1
          ? "Debes permitir el acceso a la ubicación."
          : error?.response?.data?.message ||
              "No se pudo compartir la ubicación."
      );
    } finally {
      setSharingLocation(false);
    }
  };

  const advanceStatus = async () => {
    if (!nextAction) return;

    try {
      setUpdatingStatus(true);
      setPageError("");
      setPageSuccess("");

      await axios.patch(
        `${getApiBaseUrl()}/marketplace-load-tracking/${trackingId}/status`,
        {
          status:
            nextAction.status,
        },
        {
          headers: {
            Authorization:
              `Bearer ${token}`,
          },
        }
      );

      setPageSuccess(
        "Estado actualizado correctamente."
      );

      await fetchTracking();
    } catch (error) {
      setPageError(
        error?.response?.data?.message ||
          "No se pudo actualizar el estado."
      );
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        Cargando servicio...
      </div>
    );
  }

  if (!tracking) {
    return (
      <div className="min-h-screen bg-slate-100 p-4">
        <Link
          to="/captain/load-proposals"
          className="inline-flex w-11 h-11 rounded-full bg-black text-white items-center justify-center"
        >
          <i className="ri-arrow-left-line" />
        </Link>

        <div className="mt-4 rounded-2xl bg-red-50 border border-red-200 p-4 text-red-700">
          {pageError ||
            "Servicio no encontrado."}
        </div>
      </div>
    );
  }

  const load =
    tracking?.spaceOffer || {};

  const bid =
    tracking?.acceptedBid || {};

  const customer =
    tracking?.customer || {};

  const customerName =
    [
      customer?.fullname?.firstname,
      customer?.fullname?.lastname,
    ]
      .filter(Boolean)
      .join(" ") ||
    customer?.email ||
    "Cliente";

  const vehicleType =
    VEHICLE_LABELS[
      tracking?.vehicle?.type
    ] ||
    VEHICLE_LABELS[
      bid?.proposedVehicleType
    ] ||
    "No especificado";

  const bodyType =
    BODY_LABELS[
      tracking?.vehicle?.bodyType
    ] ||
    BODY_LABELS[
      bid?.proposedBodyType
    ] ||
    "No especificada";

  const agreedValue =
    tracking?.serviceValue ||
    bid?.counterPrice ||
    bid?.offeredPrice ||
    load?.suggestedPrice ||
    0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-gray-100 to-slate-200">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-xl border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-3">
          <Link
            to="/captain/load-proposals"
            className="w-11 h-11 rounded-full bg-black text-white flex items-center justify-center shadow-lg"
          >
            <i className="ri-arrow-left-line text-xl" />
          </Link>

          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-purple-700">
              Servicio asignado
            </p>

            <h1 className="text-lg font-black text-gray-950">
              {load.title ||
                load.cargoType ||
                "Carga"}
            </h1>
          </div>
        </div>
      </header>

      <main className="p-4 space-y-4">
        {pageError ? (
          <div className="rounded-2xl bg-red-50 border border-red-200 text-red-700 p-4 text-sm font-bold">
            {pageError}
          </div>
        ) : null}

        {pageSuccess ? (
          <div className="rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 text-sm font-bold">
            {pageSuccess}
          </div>
        ) : null}

        <section className="rounded-[28px] bg-gradient-to-r from-purple-900 via-violet-700 to-fuchsia-600 p-5 text-white shadow-xl">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-white/65">
            Estado actual
          </p>

          <h2 className="text-2xl font-black mt-2">
            {STATUS_LABELS[
              tracking.status
            ] ||
              tracking.status}
          </h2>

          <p className="text-sm text-white/75 mt-2">
            Última actualización:{" "}
            {formatDate(
              tracking.statusUpdatedAt
            )}
          </p>
        </section>

        <section className="overflow-hidden rounded-[28px] bg-white border border-gray-200 shadow-xl">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-black text-gray-950">
              Mapa del servicio
            </h2>

            <p className="text-xs text-gray-600 mt-1">
              Tu ubicación será visible para el cliente.
            </p>
          </div>

          <div className="h-[380px]">
            <LiveTracking
              pickup={origin}
              destination={
                destination
              }
              nearbyDrivers={
                drivers
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
              enableDirections={false}
              zoom={15}
            />
          </div>

          <div className="p-4">
            <button
              type="button"
              onClick={shareLocation}
              disabled={sharingLocation}
              className="w-full rounded-2xl bg-blue-600 text-white py-3.5 font-black shadow-lg disabled:opacity-60"
            >
              <i className="ri-map-pin-user-line mr-1" />
              {sharingLocation
                ? "Compartiendo ubicación..."
                : "Compartir ubicación ahora"}
            </button>
          </div>
        </section>

        <section className="rounded-[28px] bg-white border border-gray-200 shadow-lg p-4">
          <h2 className="text-lg font-black text-gray-950">
            Progreso
          </h2>

          <div className="mt-4 space-y-2">
            {TRACKING_ACTIONS.map(
              (action, index) => {
                const completed =
                  index <= currentIndex;

                const isCurrent =
                  action.status ===
                  tracking.status;

                const isNext =
                  nextAction?.status ===
                  action.status;

                return (
                  <div
                    key={action.status}
                    className={`flex items-center gap-3 rounded-2xl border px-3 py-3 ${
                      isCurrent
                        ? "border-purple-300 bg-purple-50"
                        : completed
                        ? "border-emerald-200 bg-emerald-50"
                        : isNext
                        ? "border-blue-200 bg-blue-50"
                        : "border-gray-200 bg-gray-50"
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                        isCurrent
                          ? "bg-purple-700 text-white"
                          : completed
                          ? "bg-emerald-600 text-white"
                          : isNext
                          ? "bg-blue-600 text-white"
                          : "bg-gray-200 text-gray-500"
                      }`}
                    >
                      <i
                        className={
                          completed &&
                          !isCurrent
                            ? "ri-check-line"
                            : action.icon
                        }
                      />
                    </div>

                    <div>
                      <p className="text-xs font-black text-gray-900">
                        {action.label}
                      </p>

                      <p className="text-[10px] text-gray-500 mt-0.5">
                        {isCurrent
                          ? "Estado actual"
                          : completed
                          ? "Completado"
                          : isNext
                          ? "Siguiente paso"
                          : "Pendiente"}
                      </p>
                    </div>
                  </div>
                );
              }
            )}
          </div>

          {nextAction ? (
            <button
              type="button"
              onClick={advanceStatus}
              disabled={updatingStatus}
              className="w-full mt-4 rounded-2xl bg-gradient-to-r from-purple-800 via-violet-700 to-fuchsia-600 text-white py-4 font-black shadow-lg disabled:opacity-60"
            >
              <i
                className={`${nextAction.icon} mr-1`}
              />

              {updatingStatus
                ? "Actualizando..."
                : nextAction.label}
            </button>
          ) : null}
        </section>

        <section className="rounded-[28px] bg-white border border-gray-200 shadow-lg p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-purple-700">
                Información de la carga
              </p>

              <h2 className="text-lg font-black text-gray-950 mt-1">
                Datos proporcionados por el usuario
              </h2>

              <p className="text-xs text-gray-600 mt-1">
                Aquí solo aparecen los datos que el cliente registró al publicar la carga.
              </p>
            </div>

            <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
              <i className="ri-file-list-3-line text-2xl" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="rounded-2xl bg-slate-950 text-white p-3">
              <p className="text-[10px] uppercase font-black text-white/55">
                Valor publicado
              </p>

              <p className="text-lg font-black mt-1">
                {formatCOP(
                  load?.suggestedPrice ||
                    tracking?.serviceValue ||
                    bid?.offeredPrice
                )}
              </p>
            </div>

            <div className="rounded-2xl bg-purple-50 border border-purple-100 p-3">
              <p className="text-[10px] uppercase font-black text-purple-600">
                Código de publicación
              </p>

              <p className="text-sm font-black text-purple-900 mt-1">
                {load?.publicationCode || "Sin código"}
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-[24px] border border-gray-200 bg-white p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-gray-500">
              Ruta
            </p>

            <div className="mt-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <i className="ri-map-pin-2-line" />
                </div>

                <div>
                  <p className="text-[10px] uppercase font-black text-gray-500">
                    Ciudad de recogida
                  </p>

                  <p className="text-base font-black text-gray-950 mt-1">
                    {load?.originCity || "No especificada"}
                  </p>

                  <p className="text-sm text-gray-600 mt-1">
                    {load?.origin || "Dirección no especificada"}
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
                    Ciudad de destino
                  </p>

                  <p className="text-base font-black text-gray-950 mt-1">
                    {load?.destinationCity || "No especificada"}
                  </p>

                  <p className="text-sm text-gray-600 mt-1">
                    {load?.destination || "Dirección no especificada"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-[24px] border border-gray-200 bg-white p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-gray-500">
              Detalles de la carga
            </p>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="rounded-2xl bg-gray-50 border border-gray-200 p-3">
                <p className="text-[10px] uppercase font-black text-gray-500">
                  Título
                </p>

                <p className="text-sm font-black text-gray-900 mt-1">
                  {load?.title || "Sin título"}
                </p>
              </div>

              <div className="rounded-2xl bg-gray-50 border border-gray-200 p-3">
                <p className="text-[10px] uppercase font-black text-gray-500">
                  Tipo de carga
                </p>

                <p className="text-sm font-black text-gray-900 mt-1">
                  {load?.cargoType || "No especificado"}
                </p>
              </div>

              <div className="rounded-2xl bg-gray-50 border border-gray-200 p-3">
                <p className="text-[10px] uppercase font-black text-gray-500">
                  Peso
                </p>

                <p className="text-sm font-black text-gray-900 mt-1">
                  {load?.weightLabel ||
                    `${formatNumber(load?.weight)} ${load?.weightUnit || "kg"}`}
                </p>
              </div>

              <div className="rounded-2xl bg-gray-50 border border-gray-200 p-3">
                <p className="text-[10px] uppercase font-black text-gray-500">
                  Volumen
                </p>

                <p className="text-sm font-black text-gray-900 mt-1">
                  {Number(load?.volumeM3) > 0
                    ? `${load.volumeM3} m³`
                    : "No especificado"}
                </p>
              </div>

              <div className="rounded-2xl bg-gray-50 border border-gray-200 p-3">
                <p className="text-[10px] uppercase font-black text-gray-500">
                  Vehículo requerido
                </p>

                <p className="text-sm font-black text-gray-900 mt-1">
                  {VEHICLE_LABELS[
                    load?.requiredVehicleType
                  ] ||
                    load?.requiredVehicleLabel ||
                    "No especificado"}
                </p>
              </div>

              <div className="rounded-2xl bg-gray-50 border border-gray-200 p-3">
                <p className="text-[10px] uppercase font-black text-gray-500">
                  Carrocería requerida
                </p>

                <p className="text-sm font-black text-gray-900 mt-1">
                  {BODY_LABELS[
                    load?.requiredBodyType
                  ] ||
                    load?.requiredBodyLabel ||
                    "No especificada"}
                </p>
              </div>

              <div className="rounded-2xl bg-gray-50 border border-gray-200 p-3">
                <p className="text-[10px] uppercase font-black text-gray-500">
                  Capacidad mínima
                </p>

                <p className="text-sm font-black text-gray-900 mt-1">
                  {Number(load?.recommendedMinCapacityKg) > 0
                    ? `${formatNumber(
                        load.recommendedMinCapacityKg
                      )} kg`
                    : "No especificada"}
                </p>
              </div>

              <div className="rounded-2xl bg-gray-50 border border-gray-200 p-3">
                <p className="text-[10px] uppercase font-black text-gray-500">
                  Cantidad
                </p>

                <p className="text-sm font-black text-gray-900 mt-1">
                  {load?.quantity ||
                    load?.packageCount ||
                    "No especificada"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className={`rounded-2xl border p-3 ${
                load?.requiresRefrigeration
                  ? "bg-cyan-50 border-cyan-200"
                  : "bg-gray-50 border-gray-200"
              }`}>
                <p className="text-[10px] uppercase font-black text-gray-500">
                  Refrigeración
                </p>

                <p className="text-sm font-black text-gray-900 mt-1">
                  {load?.requiresRefrigeration ? "Sí requiere" : "No requiere"}
                </p>
              </div>

              <div className={`rounded-2xl border p-3 ${
                load?.isFragile
                  ? "bg-amber-50 border-amber-200"
                  : "bg-gray-50 border-gray-200"
              }`}>
                <p className="text-[10px] uppercase font-black text-gray-500">
                  Carga frágil
                </p>

                <p className="text-sm font-black text-gray-900 mt-1">
                  {load?.isFragile ? "Sí" : "No"}
                </p>
              </div>
            </div>

            {load?.description ? (
              <div className="mt-3 rounded-2xl bg-gray-50 border border-gray-200 p-3">
                <p className="text-[10px] uppercase font-black text-gray-500">
                  Descripción
                </p>

                <p className="text-sm text-gray-700 mt-1 leading-5">
                  {load.description}
                </p>
              </div>
            ) : null}
          </div>

          <div className="mt-4 rounded-[24px] border border-gray-200 bg-white p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-gray-500">
              Fechas indicadas por el usuario
            </p>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="rounded-2xl bg-gray-50 border border-gray-200 p-3">
                <p className="text-[10px] uppercase font-black text-gray-500">
                  Recogida
                </p>

                <p className="text-xs font-black text-gray-900 mt-1">
                  {formatDate(load?.pickupTime)}
                </p>
              </div>

              <div className="rounded-2xl bg-gray-50 border border-gray-200 p-3">
                <p className="text-[10px] uppercase font-black text-gray-500">
                  Entrega máxima
                </p>

                <p className="text-xs font-black text-gray-900 mt-1">
                  {formatDate(load?.deliveryDeadline)}
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default CaptainLoadService;