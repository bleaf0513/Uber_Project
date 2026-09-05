import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { getApiBaseUrl } from "../apiBase";

const VEHICLE_OPTIONS = [
  { value: "", label: "Todos los vehículos" },
  { value: "moto", label: "Moto" },
  { value: "carro", label: "Carro" },
  { value: "motocarro", label: "Motocarro" },
  { value: "camioneta", label: "Camioneta" },
  { value: "van", label: "Van" },
  {
    value: "camion_ultraliviano",
    label: "Camión ultraliviano",
  },
  {
    value: "camion_liviano",
    label: "Camión liviano",
  },
  {
    value: "camion_mediano",
    label: "Camión mediano",
  },
  {
    value: "camion_pesado",
    label: "Camión pesado",
  },
  {
    value: "camion_sencillo",
    label: "Camión sencillo",
  },
  {
    value: "doble_troque",
    label: "Doble troque",
  },
  { value: "volqueta", label: "Volqueta" },
  { value: "minimula", label: "Minimula" },
  { value: "tractomula", label: "Tractomula" },
  { value: "cama_baja", label: "Cama baja" },
  {
    value: "vehiculo_especial",
    label: "Vehículo especial",
  },
  { value: "otro", label: "Otro" },
];

const BODY_OPTIONS = [
  { value: "", label: "Todas las carrocerías" },
  {
    value: "no_especificada",
    label: "No especificada",
  },
  {
    value: "furgon_cerrado",
    label: "Furgón cerrado",
  },
  { value: "estacas", label: "Estacas" },
  { value: "plataforma", label: "Plataforma" },
  { value: "refrigerada", label: "Refrigerada" },
  { value: "volco", label: "Volco" },
  { value: "tanque", label: "Tanque" },
  {
    value: "portacontenedor",
    label: "Portacontenedor",
  },
  { value: "cama_baja", label: "Cama baja" },
  {
    value: "carroceria_abierta",
    label: "Carrocería abierta",
  },
  { value: "otro", label: "Otro" },
];

const VEHICLE_LABELS = Object.fromEntries(
  VEHICLE_OPTIONS.map((item) => [item.value, item.label])
);

const BODY_LABELS = Object.fromEntries(
  BODY_OPTIONS.map((item) => [item.value, item.label])
);

const formatCOP = (value) => {
  const number = Number(value) || 0;

  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(number);
};

const formatNumber = (value) => {
  return new Intl.NumberFormat("es-CO").format(
    Number(value) || 0
  );
};

const formatDate = (value) => {
  if (!value) return "Por definir";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Por definir";
  }

  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const getCustomerName = (customer) => {
  const first = customer?.fullname?.firstname || "";
  const last = customer?.fullname?.lastname || "";
  const full = `${first} ${last}`.trim();

  return full || customer?.email || "Cliente";
};

const getCaptainToken = () => {
  return (
    localStorage.getItem("captainToken") ||
    localStorage.getItem("token") ||
    ""
  );
};

/*
 * CENTRAL GO - servicios programados provenientes del Home.
 * Después de 5 minutos dejan de competir con las solicitudes inmediatas
 * y aparecen automáticamente en Explorar cargas.
 */
const RIDE_SNOOZE_PREFIX = "centralgo:ride-snooze:";

const getRideSnoozeKey = (captainId, rideId) =>
  `${RIDE_SNOOZE_PREFIX}${captainId || "anonymous"}:${rideId || "unknown"}`;

const getStoredCaptainId = () =>
  localStorage.getItem("captainId") ||
  localStorage.getItem("captain_id") ||
  "";

const isRideSnoozed = (captainId, rideId) => {
  if (!captainId || !rideId) return false;

  const key = getRideSnoozeKey(captainId, rideId);
  const until = Number(localStorage.getItem(key) || 0);

  if (!Number.isFinite(until) || until <= Date.now()) {
    localStorage.removeItem(key);
    return false;
  }

  return true;
};

const snoozeScheduledRide = (captainId, rideId) => {
  if (!captainId || !rideId) return;

  const until = Date.now() + 30 * 60 * 1000;

  localStorage.setItem(
    getRideSnoozeKey(captainId, rideId),
    String(until)
  );
};

const LOCAL_VEHICLE_LABELS = {
  motorcycle: "Moto",
  car: "Carro",
  motocarro: "Motocarguero",
  pickup: "Pickup",
  van: "Van",
  truck: "Camión",
  light_cargo: "Carga liviana",
};

const LOCAL_CARGO_LABELS = {
  market: "Mercado",
  boxes: "Cajas",
  packages: "Paquetes",
  sacks: "Bultos",
  baskets: "Canastillas",
  general_merchandise: "Mercancía general",
  other: "Otro",
};

const formatScheduledWindow = (ride) => {
  const startRaw = ride?.schedule?.pickupStartAt;
  const endRaw = ride?.schedule?.pickupEndAt;

  if (!startRaw) return "Fecha programada";

  const start = new Date(startRaw);
  const end = endRaw ? new Date(endRaw) : null;

  if (Number.isNaN(start.getTime())) return "Fecha programada";

  const dateText = new Intl.DateTimeFormat("es-CO", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "America/Bogota",
  }).format(start);

  const timeText = new Intl.DateTimeFormat("es-CO", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Bogota",
  }).format(start);

  if (end && !Number.isNaN(end.getTime())) {
    const endText = new Intl.DateTimeFormat("es-CO", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "America/Bogota",
    }).format(end);

    return `${dateText} · ${timeText} - ${endText}`;
  }

  return `${dateText} · ${timeText}`;
};

const CaptainSpaceOffers = () => {
  const navigate = useNavigate();

  const token = getCaptainToken();

  const [offers, setOffers] = useState([]);
  const [myBids, setMyBids] = useState([]);

  const [scheduledRides, setScheduledRides] = useState([]);
  const [loadingScheduledRides, setLoadingScheduledRides] = useState(false);
  const [processingScheduledRideId, setProcessingScheduledRideId] =
    useState("");
  const [scheduledOfferRide, setScheduledOfferRide] = useState(null);
  const [scheduledOfferPrice, setScheduledOfferPrice] = useState("");
  const [scheduledOfferMessage, setScheduledOfferMessage] = useState("");

  const [loading, setLoading] = useState(false);
  const [loadingMyBids, setLoadingMyBids] =
    useState(false);

  const [pageError, setPageError] = useState("");
  const [successMessage, setSuccessMessage] =
    useState("");

  const [filters, setFilters] = useState({
    origin: "",
    destination: "",
    requiredVehicleType: "",
    requiredBodyType: "",
    maxWeightKg: "",
  });

  const [selectedOffer, setSelectedOffer] =
    useState(null);

  const [bidModalOpen, setBidModalOpen] =
    useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [quickAcceptOfferId, setQuickAcceptOfferId] =
    useState("");

  const [bidForm, setBidForm] = useState({
    offeredPrice: "",
    message: "",
    proposedVehicleType: "",
    proposedVehicleBrand: "",
    proposedVehicleReference: "",
    proposedVehicleModel: "",
    proposedVehiclePlate: "",
    proposedBodyType: "no_especificada",
    proposedVehicleCapacity: "",
    proposedVehicleCapacityUnit: "kg",
    availablePickupTime: "",
    estimatedDeliveryTime: "",
    estimatedDurationHours: "",
    includesLoading: false,
    includesUnloading: false,
    includesAssistant: false,
    includesTolls: true,
    includesFuel: true,
    includesInsurance: false,
  });

  const activeBidOfferIds = useMemo(() => {
    const ids = new Set();

    myBids.forEach((bid) => {
      if (
        ["pending", "countered", "accepted"].includes(
          bid.status
        )
      ) {
        const id =
          bid?.spaceOffer?._id || bid?.spaceOffer;

        if (id) {
          ids.add(String(id));
        }
      }
    });

    return ids;
  }, [myBids]);

  const buildQuery = () => {
    const params = new URLSearchParams();

    if (filters.origin.trim()) {
      params.set("origin", filters.origin.trim());
    }

    if (filters.destination.trim()) {
      params.set(
        "destination",
        filters.destination.trim()
      );
    }

    if (filters.requiredVehicleType) {
      params.set(
        "requiredVehicleType",
        filters.requiredVehicleType
      );
    }

    if (filters.requiredBodyType) {
      params.set(
        "requiredBodyType",
        filters.requiredBodyType
      );
    }

    if (
      Number(filters.maxWeightKg) > 0
    ) {
      params.set(
        "maxWeightKg",
        String(Number(filters.maxWeightKg))
      );
    }

    const query = params.toString();

    return query ? `?${query}` : "";
  };

  const fetchOffers = async () => {
    try {
      setLoading(true);
      setPageError("");

      const response = await axios.get(
        `${getApiBaseUrl()}/offers/space/list${buildQuery()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setOffers(
        Array.isArray(response?.data?.offers)
          ? response.data.offers
          : []
      );
    } catch (error) {
      console.error(
        "Error cargando cargas disponibles:",
        error
      );

      setPageError(
        error?.response?.data?.message ||
          "No se pudieron cargar las cargas disponibles."
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchScheduledRides = async () => {
    try {
      setLoadingScheduledRides(true);

      const response = await axios.get(
        `${getApiBaseUrl()}/rides/available-for-captain?marketplace=1`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const captainId =
        response?.data?.captainId ||
        getStoredCaptainId();

      if (captainId) {
        localStorage.setItem("captainId", String(captainId));
      }

      const rides = Array.isArray(response?.data?.rides)
        ? response.data.rides
        : [];

      const visible = rides.filter((ride) => {
        if (!ride?._id) return false;

        return !isRideSnoozed(
          captainId,
          String(ride._id)
        );
      });

      setScheduledRides(visible);
    } catch (error) {
      console.error(
        "Error cargando domicilios programados:",
        error
      );
    } finally {
      setLoadingScheduledRides(false);
    }
  };

  const openScheduledOfferModal = (ride) => {
    if (!ride?._id) return;

    const publishedPrice = Number(
      ride?.offeredFare ??
      ride?.fare ??
      ride?.suggestedFare ??
      0
    );

    setScheduledOfferRide(ride);
    setScheduledOfferPrice(
      publishedPrice > 0 ? String(publishedPrice) : ""
    );
    setScheduledOfferMessage(
      "Tengo disponibilidad para realizar este domicilio programado."
    );
    setPageError("");
    setSuccessMessage("");
  };

  const closeScheduledOfferModal = () => {
    if (processingScheduledRideId) return;

    setScheduledOfferRide(null);
    setScheduledOfferPrice("");
    setScheduledOfferMessage("");
  };

  const submitScheduledOffer = async () => {
    try {
      if (!scheduledOfferRide?._id) return;

      const price = Number(scheduledOfferPrice);

      if (!Number.isFinite(price) || price <= 0) {
        setPageError("Ingresa el valor de tu oferta.");
        return;
      }

      setProcessingScheduledRideId(
        String(scheduledOfferRide._id)
      );
      setPageError("");
      setSuccessMessage("");

      await axios.post(
        `${getApiBaseUrl()}/rides/captain-offer`,
        {
          rideId: scheduledOfferRide._id,
          price,
          message:
            String(scheduledOfferMessage || "").trim() ||
            "Oferta del conductor para domicilio programado.",
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setScheduledRides((previous) =>
        previous.filter(
          (item) =>
            String(item?._id) !==
            String(scheduledOfferRide._id)
        )
      );

      setSuccessMessage(
        `Oferta por ${formatCOP(price)} enviada al usuario.`
      );

      setScheduledOfferRide(null);
      setScheduledOfferPrice("");
      setScheduledOfferMessage("");
    } catch (error) {
      setPageError(
        error?.response?.data?.message ||
          "No se pudo enviar la oferta."
      );
    } finally {
      setProcessingScheduledRideId("");
    }
  };

  const hideScheduledRide = (ride) => {
    if (!ride?._id) return;

    const captainId = getStoredCaptainId();

    if (captainId) {
      snoozeScheduledRide(
        captainId,
        String(ride._id)
      );
    }

    setScheduledRides((previous) =>
      previous.filter(
        (item) => String(item?._id) !== String(ride._id)
      )
    );
  };

  const refreshMarketplace = async () => {
    await Promise.allSettled([
      fetchOffers(),
      fetchScheduledRides(),
    ]);
  };

  const fetchMyBids = async () => {
    try {
      setLoadingMyBids(true);

      const response = await axios.get(
        `${getApiBaseUrl()}/offers/space/bid/my-sent`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setMyBids(
        Array.isArray(response?.data?.bids)
          ? response.data.bids
          : []
      );
    } catch (error) {
      console.error(
        "Error cargando mis propuestas:",
        error
      );
    } finally {
      setLoadingMyBids(false);
    }
  };

  useEffect(() => {
    if (!token) {
      navigate("/captain-login");
      return;
    }

    refreshMarketplace();
    fetchMyBids();

    const scheduledRefreshInterval = setInterval(() => {
      fetchScheduledRides();
    }, 30000);

    return () => {
      clearInterval(scheduledRefreshInterval);
    };
  }, []);

  const handleFilterChange = (event) => {
    const { name, value } = event.target;

    setFilters((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const clearFilters = () => {
    setFilters({
      origin: "",
      destination: "",
      requiredVehicleType: "",
      requiredBodyType: "",
      maxWeightKg: "",
    });

    setTimeout(() => {
      refreshMarketplace();
    }, 0);
  };

  const resetBidForm = () => {
    setBidForm({
      offeredPrice: "",
      message: "",
      proposedVehicleType: "",
      proposedVehicleBrand: "",
      proposedVehicleReference: "",
      proposedVehicleModel: "",
      proposedVehiclePlate: "",
      proposedBodyType: "no_especificada",
      proposedVehicleCapacity: "",
      proposedVehicleCapacityUnit: "kg",
      availablePickupTime: "",
      estimatedDeliveryTime: "",
      estimatedDurationHours: "",
      includesLoading: false,
      includesUnloading: false,
      includesAssistant: false,
      includesTolls: true,
      includesFuel: true,
      includesInsurance: false,
    });
  };

  const openBidModal = (offer) => {
    setSelectedOffer(offer);

    setBidForm((previous) => ({
      ...previous,

      offeredPrice:
        Number(offer?.suggestedPrice) > 0
          ? String(offer.suggestedPrice)
          : "",

      proposedVehicleType:
        offer?.requiredVehicleType ||
        offer?.suggestedVehicleType ||
        "",

      proposedBodyType:
        offer?.requiredBodyType ||
        "no_especificada",

      proposedVehicleCapacity:
        offer?.recommendedMinCapacityKg
          ? String(offer.recommendedMinCapacityKg)
          : "",

      proposedVehicleCapacityUnit: "kg",

      message:
        `Tengo disponibilidad para transportar la carga ` +
        `${offer?.origin || "desde el origen"} hacia ` +
        `${offer?.destination || "el destino"}.`,
    }));

    setPageError("");
    setSuccessMessage("");
    setBidModalOpen(true);
  };

  const closeBidModal = () => {
    setBidModalOpen(false);
    setSelectedOffer(null);
    setPageError("");
    setSuccessMessage("");
    resetBidForm();
  };

  const handleBidChange = (event) => {
    const {
      name,
      value,
      type,
      checked,
    } = event.target;

    setBidForm((previous) => ({
      ...previous,
      [name]:
        type === "checkbox"
          ? checked
          : value,
    }));
  };

  const validateBid = () => {
    const price = Number(bidForm.offeredPrice);
    const capacity = Number(
      bidForm.proposedVehicleCapacity
    );

    if (!selectedOffer?._id) {
      return "No se encontró la carga seleccionada.";
    }

    if (
      !Number.isFinite(price) ||
      price <= 0
    ) {
      return "Ingresa un precio mayor que cero.";
    }

    if (!bidForm.proposedVehicleType) {
      return "Selecciona el tipo de vehículo.";
    }

    if (
      !Number.isFinite(capacity) ||
      capacity <= 0
    ) {
      return "Ingresa la capacidad real del vehículo.";
    }

    const capacityKg =
      bidForm.proposedVehicleCapacityUnit ===
      "toneladas"
        ? capacity * 1000
        : capacity;

    const requiredCapacity =
      Number(
        selectedOffer.recommendedMinCapacityKg
      ) || 0;

    if (
      requiredCapacity > 0 &&
      capacityKg < requiredCapacity
    ) {
      return (
        `La capacidad debe ser mínimo de ` +
        `${formatNumber(requiredCapacity)} kg.`
      );
    }

    if (
      bidForm.availablePickupTime &&
      bidForm.estimatedDeliveryTime
    ) {
      const pickup = new Date(
        bidForm.availablePickupTime
      ).getTime();

      const delivery = new Date(
        bidForm.estimatedDeliveryTime
      ).getTime();

      if (delivery < pickup) {
        return (
          "La entrega no puede ser anterior " +
          "a la fecha de recogida."
        );
      }
    }

    return "";
  };

  const submitBid = async (event) => {
    event.preventDefault();

    setPageError("");
    setSuccessMessage("");

    const validation = validateBid();

    if (validation) {
      setPageError(validation);
      return;
    }

    try {
      setSubmitting(true);

      await axios.post(
        `${getApiBaseUrl()}/offers/space/bid/create`,
        {
          listingId: selectedOffer._id,

          offeredPrice: Number(
            bidForm.offeredPrice
          ),

          message:
            bidForm.message.trim(),

          proposedVehicleType:
            bidForm.proposedVehicleType,

          proposedVehicleBrand:
            bidForm.proposedVehicleBrand.trim(),

          proposedVehicleReference:
            bidForm.proposedVehicleReference.trim(),

          proposedVehicleModel:
            bidForm.proposedVehicleModel.trim(),

          proposedVehiclePlate:
            bidForm.proposedVehiclePlate
              .trim()
              .toUpperCase(),

          proposedBodyType:
            bidForm.proposedBodyType,

          proposedVehicleCapacity:
            Number(
              bidForm.proposedVehicleCapacity
            ),

          proposedVehicleCapacityUnit:
            bidForm.proposedVehicleCapacityUnit,

          availablePickupTime:
            bidForm.availablePickupTime
              ? new Date(
                  bidForm.availablePickupTime
                ).toISOString()
              : null,

          estimatedDeliveryTime:
            bidForm.estimatedDeliveryTime
              ? new Date(
                  bidForm.estimatedDeliveryTime
                ).toISOString()
              : null,

          estimatedDurationHours:
            bidForm.estimatedDurationHours
              ? Number(
                  bidForm.estimatedDurationHours
                )
              : null,

          includesLoading:
            bidForm.includesLoading,

          includesUnloading:
            bidForm.includesUnloading,

          includesAssistant:
            bidForm.includesAssistant,

          includesTolls:
            bidForm.includesTolls,

          includesFuel:
            bidForm.includesFuel,

          includesInsurance:
            bidForm.includesInsurance,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setSuccessMessage(
        "Propuesta enviada correctamente."
      );

      await Promise.all([
        fetchOffers(),
        fetchMyBids(),
      ]);

      setTimeout(() => {
        closeBidModal();
      }, 1000);
    } catch (error) {
      console.error(
        "Error enviando propuesta:",
        error
      );

      const errors =
        error?.response?.data?.errors;

      if (
        Array.isArray(errors) &&
        errors.length > 0
      ) {
        setPageError(
          errors[0]?.msg ||
            "No se pudo enviar la propuesta."
        );
      } else {
        setPageError(
          error?.response?.data?.message ||
            "No se pudo enviar la propuesta."
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const acceptPublishedPrice = async (offer) => {
    if (!offer?._id) {
      setPageError("No se encontró la carga seleccionada.");
      return;
    }

    const publishedPrice = Number(offer.suggestedPrice) || 0;
    const vehicleType =
      offer.requiredVehicleType ||
      offer.suggestedVehicleType ||
      "";
    const capacity =
      Number(offer.recommendedMinCapacityKg) ||
      Number(offer.weight) ||
      0;

    if (publishedPrice <= 0) {
      openBidModal(offer);
      setPageError(
        "Esta carga no tiene un precio publicado. Envía una propuesta personalizada."
      );
      return;
    }

    if (!vehicleType || capacity <= 0) {
      openBidModal(offer);
      setPageError(
        "Completa los datos del vehículo para enviar la propuesta."
      );
      return;
    }

    const confirmed = window.confirm(
      `¿Confirmas que deseas aceptar el valor publicado de ${formatCOP(
        publishedPrice
      )}? El cliente deberá aprobar tu propuesta para asignarte la carga.`
    );

    if (!confirmed) return;

    try {
      setQuickAcceptOfferId(String(offer._id));
      setPageError("");
      setSuccessMessage("");

      await axios.post(
        `${getApiBaseUrl()}/offers/space/bid/create`,
        {
          listingId: offer._id,
          offeredPrice: publishedPrice,
          message:
            "Acepto el valor publicado y tengo disponibilidad para realizar el transporte.",
          proposedVehicleType: vehicleType,
          proposedVehicleBrand: "",
          proposedVehicleReference: "",
          proposedVehicleModel: "",
          proposedVehiclePlate: "",
          proposedBodyType:
            offer.requiredBodyType || "no_especificada",
          proposedVehicleCapacity: capacity,
          proposedVehicleCapacityUnit: "kg",
          availablePickupTime: offer.pickupTime || null,
          estimatedDeliveryTime:
            offer.deliveryDeadline || null,
          estimatedDurationHours: null,
          includesLoading: false,
          includesUnloading: false,
          includesAssistant: false,
          includesTolls: true,
          includesFuel: true,
          includesInsurance: false,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setSuccessMessage(
        "Aceptaste el valor publicado. La propuesta fue enviada al cliente para su aprobación."
      );

      await Promise.all([
        fetchOffers(),
        fetchMyBids(),
      ]);
    } catch (error) {
      console.error(
        "Error aceptando valor publicado:",
        error
      );

      const errors = error?.response?.data?.errors;

      if (Array.isArray(errors) && errors.length > 0) {
        setPageError(
          errors[0]?.msg ||
            "No se pudo enviar la aceptación."
        );
      } else {
        setPageError(
          error?.response?.data?.message ||
            "No se pudo enviar la aceptación."
        );
      }
    } finally {
      setQuickAcceptOfferId("");
    }
  };

  const renderScheduledRideCard = (ride) => {
    const rideId = String(ride?._id || "");
    const processing =
      processingScheduledRideId === rideId;

    const vehicle =
      LOCAL_VEHICLE_LABELS[
        ride?.vehicleType || ride?.vehicle
      ] || "Vehículo";

    const cargo =
      LOCAL_CARGO_LABELS[
        ride?.cargo?.category
      ] || "Mercancía";

    const quantity = Math.max(
      1,
      Number(ride?.cargo?.quantity) || 1
    );

    const weight = ride?.cargo?.weightUnknown
      ? "Peso por confirmar"
      : Number(ride?.cargo?.approximateWeight) > 0
        ? `${ride.cargo.approximateWeight} ${ride?.cargo?.weightUnit || "kg"}`
        : "Peso no informado";

    const fare = Number(
      ride?.offeredFare ??
      ride?.fare ??
      ride?.suggestedFare ??
      0
    );

    return (
      <article
        key={`scheduled-${rideId}`}
        className="overflow-hidden rounded-[28px] border border-purple-200 bg-white shadow-[0_18px_50px_rgba(88,28,135,0.12)]"
      >
        <div className="h-2 bg-gradient-to-r from-purple-700 via-fuchsia-500 to-pink-400" />

        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-purple-100 text-purple-700 px-2.5 py-1 text-[11px] font-black">
                  PROGRAMADO
                </span>

                <span className="rounded-full bg-slate-100 text-slate-700 px-2.5 py-1 text-[11px] font-black">
                  {ride?.senderType === "business"
                    ? "EMPRESA"
                    : "PERSONAL"}
                </span>
              </div>

              <h2 className="text-lg font-black text-gray-950 mt-3">
                {cargo} · {quantity} entrega{quantity === 1 ? "" : "s"}
              </h2>

              <p className="text-sm text-gray-600 mt-1">
                {ride?.pickup || "Recogida"} →{" "}
                {ride?.destination || "Entrega"}
              </p>
            </div>

            <button
              type="button"
              onClick={() => hideScheduledRide(ride)}
              className="w-9 h-9 shrink-0 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center"
              aria-label="Ocultar por 30 minutos"
              title="Ocultar por 30 minutos"
            >
              <i className="ri-close-line text-xl" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="rounded-2xl bg-purple-50 border border-purple-200 p-3">
              <p className="text-[11px] font-bold text-purple-700">
                Recogida
              </p>
              <p className="text-sm font-black text-purple-950 mt-1">
                {formatScheduledWindow(ride)}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-950 text-white p-3">
              <p className="text-[11px] font-bold text-white/60">
                Valor
              </p>
              <p className="text-lg font-black mt-1">
                {fare > 0 ? formatCOP(fare) : "Por definir"}
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-gray-50 border border-gray-200 p-3 mt-3">
            <p className="text-sm text-gray-700">
              <span className="font-black">Vehículo:</span>{" "}
              {vehicle}
            </p>
            <p className="text-sm text-gray-700 mt-1">
              <span className="font-black">Carga:</span>{" "}
              {quantity} {cargo.toLowerCase()} · {weight}
            </p>
            <p className="text-sm text-gray-700 mt-1">
              <span className="font-black">Entregas:</span>{" "}
              {(Array.isArray(ride?.routeStops)
                ? ride.routeStops.length
                : 0) + 1}
            </p>
          </div>

          <button
            type="button"
            onClick={() => openScheduledOfferModal(ride)}
            disabled={processing}
            className="w-full mt-3 rounded-2xl bg-purple-700 text-white py-3 font-black disabled:opacity-50"
          >
            <i className="ri-price-tag-3-line mr-2" />
            Hacer oferta
          </button>

          <p className="mt-2 text-center text-[11px] text-gray-500">
            El valor publicado es una referencia. Tú decides cuánto ofertar.
          </p>
        </div>
      </article>
    );
  };

  const renderOfferCard = (offer) => {
    const alreadyBid =
      activeBidOfferIds.has(String(offer._id));

    const quickAccepting =
      quickAcceptOfferId === String(offer._id);

    const vehicle =
      offer.requiredVehicleLabel ||
      VEHICLE_LABELS[
        offer.requiredVehicleType
      ] ||
      offer.suggestedVehicleLabel ||
      VEHICLE_LABELS[
        offer.suggestedVehicleType
      ] ||
      "Por definir";

    const body =
      offer.requiredBodyLabel ||
      BODY_LABELS[
        offer.requiredBodyType
      ] ||
      "No especificada";

    return (
      <article
        key={offer._id}
        className="overflow-hidden rounded-[28px] border border-white bg-white shadow-[0_20px_55px_rgba(15,23,42,0.12)]"
      >
        <div className="h-2 bg-gradient-to-r from-blue-700 via-cyan-500 to-sky-400" />

        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-12 h-12 shrink-0 rounded-2xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center">
                <i className="ri-truck-line text-2xl" />
              </div>

              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-wide text-blue-700">
                  {offer.publicationCode ||
                    "Carga disponible"}
                </p>

                <h2 className="text-lg font-black text-gray-950 mt-1">
                  {offer.title ||
                    offer.cargoType ||
                    "Carga disponible"}
                </h2>

                <p className="text-sm text-gray-600 mt-1">
                  {offer.origin} →{" "}
                  {offer.destination}
                </p>
              </div>
            </div>

            <span className="shrink-0 rounded-full bg-emerald-100 text-emerald-700 px-3 py-1 text-xs font-black">
              Disponible
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="rounded-2xl bg-slate-950 text-white p-4">
              <p className="text-xs font-bold text-white/60">
                Peso
              </p>

              <p className="text-lg font-black mt-1">
                {offer.weightLabel ||
                  `${formatNumber(
                    offer.weight
                  )} ${offer.weightUnit || "kg"}`}
              </p>
            </div>

            <div className="rounded-2xl bg-blue-50 border border-blue-200 p-4">
              <p className="text-xs font-bold text-blue-700">
                Precio publicado
              </p>

              <p className="text-lg font-black text-blue-800 mt-1">
                {Number(offer.suggestedPrice) > 0
                  ? formatCOP(
                      offer.suggestedPrice
                    )
                  : "Recibe ofertas"}
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-gray-50 border border-gray-200 p-4 mt-3 space-y-2">
            <p className="text-sm text-gray-700">
              <span className="font-black">
                Cliente:
              </span>{" "}
              {getCustomerName(offer.customer)}
            </p>

            <p className="text-sm text-gray-700">
              <span className="font-black">
                Tipo de carga:
              </span>{" "}
              {offer.cargoType || "Carga general"}
            </p>

            <p className="text-sm text-gray-700">
              <span className="font-black">
                Vehículo sugerido:
              </span>{" "}
              {vehicle}
            </p>

            <p className="text-sm text-gray-700">
              <span className="font-black">
                Carrocería:
              </span>{" "}
              {body}
            </p>

            <p className="text-sm text-gray-700">
              <span className="font-black">
                Capacidad mínima:
              </span>{" "}
              {formatNumber(
                offer.recommendedMinCapacityKg
              )}{" "}
              kg
            </p>

            <p className="text-sm text-gray-700">
              <span className="font-black">
                Recogida:
              </span>{" "}
              {formatDate(offer.pickupTime)}
            </p>

            {offer.deliveryDeadline ? (
              <p className="text-sm text-gray-700">
                <span className="font-black">
                  Entrega máxima:
                </span>{" "}
                {formatDate(
                  offer.deliveryDeadline
                )}
              </p>
            ) : null}

            {Number(offer.volumeM3) > 0 ? (
              <p className="text-sm text-gray-700">
                <span className="font-black">
                  Volumen:
                </span>{" "}
                {offer.volumeM3} m³
              </p>
            ) : null}

            {offer.requiresRefrigeration ? (
              <p className="text-sm font-bold text-cyan-700">
                <i className="ri-snowflake-line mr-1" />
                Requiere refrigeración
              </p>
            ) : null}

            {offer.isFragile ? (
              <p className="text-sm font-bold text-amber-700">
                <i className="ri-alert-line mr-1" />
                Carga frágil
              </p>
            ) : null}

            {offer.description ? (
              <div className="rounded-2xl bg-white border border-gray-200 p-3">
                <p className="text-xs font-black text-gray-500">
                  Descripción
                </p>

                <p className="text-sm text-gray-700 mt-1">
                  {offer.description}
                </p>
              </div>
            ) : null}
          </div>

          {alreadyBid ? (
            <div className="mt-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 text-sm font-bold">
              <i className="ri-checkbox-circle-line mr-1" />
              Ya enviaste una propuesta para esta carga.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {Number(offer.suggestedPrice) > 0 ? (
                <button
                  type="button"
                  onClick={() =>
                    acceptPublishedPrice(offer)
                  }
                  disabled={quickAccepting}
                  className="w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 text-white py-4 font-black shadow-lg shadow-emerald-600/20 disabled:opacity-60"
                >
                  <i className="ri-checkbox-circle-line mr-1" />
                  {quickAccepting
                    ? "Enviando aceptación..."
                    : `Aceptar por ${formatCOP(
                        offer.suggestedPrice
                      )}`}
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => openBidModal(offer)}
                disabled={quickAccepting}
                className="w-full rounded-2xl bg-blue-600 text-white py-3.5 font-black shadow-lg shadow-blue-600/20 disabled:opacity-60"
              >
                <i className="ri-auction-line mr-1" />
                Enviar otra propuesta
              </button>

              <p className="text-[11px] text-center text-gray-500 leading-4">
                Aceptar el valor envía tu propuesta al cliente.
                La carga se asigna cuando el cliente te selecciona.
              </p>
            </div>
          )}
        </div>
      </article>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-gray-100 to-slate-200">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-xl border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              to="/captain-home"
              className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center shadow-lg"
            >
              <i className="ri-arrow-left-line text-xl" />
            </Link>

            <div>
              <h1 className="text-lg font-black text-gray-950">
                Cargas disponibles
              </h1>

              <p className="text-xs text-gray-600">
                Revisa cargas y envía propuestas
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              navigate("/captain/load-proposals")
            }
            className="rounded-2xl bg-black text-white px-3 h-10 text-sm font-bold"
          >
            Mis propuestas
          </button>
        </div>
      </header>

      <main className="p-4 space-y-4">
        <section className="rounded-[28px] bg-gradient-to-r from-blue-700 via-cyan-600 to-sky-500 p-5 text-white shadow-xl">
          <p className="text-xs font-black uppercase tracking-wider text-white/70">
            Marketplace logístico
          </p>

          <h2 className="text-2xl font-black mt-1">
            Encuentra viajes para tu vehículo
          </h2>

          <p className="text-sm text-white/85 mt-2">
            Filtra las cargas, revisa la capacidad requerida
            y envía tu mejor propuesta.
          </p>
        </section>

        <section className="rounded-[26px] bg-white border border-gray-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-black text-gray-950">
                Buscar cargas
              </h2>

              <p className="text-xs text-gray-500">
                Filtra según tu ruta y vehículo
              </p>
            </div>

            <button
              type="button"
              onClick={clearFilters}
              className="text-sm font-bold text-blue-700"
            >
              Limpiar
            </button>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                name="origin"
                value={filters.origin}
                onChange={handleFilterChange}
                placeholder="Origen"
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none"
              />

              <input
                type="text"
                name="destination"
                value={filters.destination}
                onChange={handleFilterChange}
                placeholder="Destino"
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none"
              />
            </div>

            <select
              name="requiredVehicleType"
              value={filters.requiredVehicleType}
              onChange={handleFilterChange}
              className="w-full rounded-2xl border border-gray-200 px-4 py-3 bg-white outline-none"
            >
              {VEHICLE_OPTIONS.map((item) => (
                <option
                  key={item.value || "all"}
                  value={item.value}
                >
                  {item.label}
                </option>
              ))}
            </select>

            <select
              name="requiredBodyType"
              value={filters.requiredBodyType}
              onChange={handleFilterChange}
              className="w-full rounded-2xl border border-gray-200 px-4 py-3 bg-white outline-none"
            >
              {BODY_OPTIONS.map((item) => (
                <option
                  key={item.value || "all"}
                  value={item.value}
                >
                  {item.label}
                </option>
              ))}
            </select>

            <input
              type="number"
              name="maxWeightKg"
              value={filters.maxWeightKg}
              onChange={handleFilterChange}
              min="1"
              placeholder="Peso máximo que puedes transportar en kg"
              className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none"
            />

            <button
              type="button"
              onClick={refreshMarketplace}
              className="w-full rounded-2xl bg-blue-600 text-white py-3 font-black"
            >
              Buscar cargas
            </button>
          </div>
        </section>

        {pageError && !bidModalOpen ? (
          <div className="rounded-2xl bg-red-50 border border-red-200 text-red-700 p-4 text-sm font-bold">
            {pageError}
          </div>
        ) : null}

        {successMessage && !bidModalOpen ? (
          <div className="rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 text-sm font-bold">
            {successMessage}
          </div>
        ) : null}

        <section className="rounded-[26px] bg-white border border-purple-200 shadow-sm p-4">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-purple-700">
                Domicilios programados
              </p>
              <h2 className="font-black text-gray-950 mt-1">
                Servicios que pasaron del Home
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Aparecen aquí automáticamente después de 5 minutos.
              </p>
            </div>

            <span className="rounded-full bg-purple-100 text-purple-700 px-3 py-1 text-xs font-black">
              {scheduledRides.length}
            </span>
          </div>

          {loadingScheduledRides && scheduledRides.length === 0 ? (
            <p className="text-sm text-gray-500">
              Actualizando programados...
            </p>
          ) : scheduledRides.length === 0 ? (
            <div className="rounded-2xl bg-purple-50 border border-purple-100 p-4 text-sm text-purple-800">
              No hay domicilios programados disponibles en este momento.
            </div>
          ) : (
            <div className="space-y-4">
              {scheduledRides.map(renderScheduledRideCard)}
            </div>
          )}
        </section>

        {loading ? (
          <div className="rounded-2xl bg-white border border-gray-200 p-5 text-sm text-gray-600">
            Cargando cargas disponibles...
          </div>
        ) : offers.length === 0 ? (
          <div className="rounded-[26px] bg-white border border-gray-200 p-7 text-center">
            <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
              <i className="ri-truck-line text-3xl" />
            </div>

            <h3 className="font-black text-gray-900 mt-3">
              No encontramos cargas
            </h3>

            <p className="text-sm text-gray-600 mt-2">
              Prueba cambiando los filtros o actualiza más
              tarde.
            </p>
          </div>
        ) : (
          <section className="space-y-5">
            {offers.map(renderOfferCard)}
          </section>
        )}

        {loadingMyBids ? (
          <p className="text-xs text-center text-gray-500">
            Actualizando tus propuestas...
          </p>
        ) : null}
      </main>

      {scheduledOfferRide ? (
        <div className="fixed inset-0 z-[110] bg-black/55 flex items-end">
          <div className="w-full max-h-[92vh] overflow-y-auto rounded-t-[30px] bg-white p-4 shadow-2xl">
            <div className="w-16 h-1.5 rounded-full bg-gray-300 mx-auto mb-4" />

            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-purple-700">
                  Domicilio programado
                </p>
                <h2 className="text-xl font-black text-gray-950 mt-1">
                  Haz tu oferta
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  El usuario recibirá tu precio y decidirá si lo acepta.
                </p>
              </div>

              <button
                type="button"
                onClick={closeScheduledOfferModal}
                className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center"
              >
                <i className="ri-close-line text-xl" />
              </button>
            </div>

            <div className="rounded-2xl bg-purple-50 border border-purple-200 p-4 mt-4">
              <p className="text-xs font-bold text-purple-700">
                Valor publicado por el usuario
              </p>
              <p className="text-xl font-black text-purple-950 mt-1">
                {formatCOP(
                  scheduledOfferRide?.offeredFare ??
                  scheduledOfferRide?.fare ??
                  scheduledOfferRide?.suggestedFare ??
                  0
                )}
              </p>
            </div>

            <label className="block mt-4">
              <span className="text-sm font-black text-gray-800">
                ¿Cuánto quieres cobrar?
              </span>
              <div className="mt-2 flex items-center rounded-2xl border border-gray-200 px-3">
                <span className="font-black text-gray-500">$</span>
                <input
                  type="number"
                  min="1"
                  step="500"
                  value={scheduledOfferPrice}
                  onChange={(event) =>
                    setScheduledOfferPrice(event.target.value)
                  }
                  className="w-full px-2 py-3.5 text-lg font-black outline-none"
                  placeholder="Ej. 22000"
                />
              </div>
            </label>

            <div className="grid grid-cols-3 gap-2 mt-3">
              {[0, 2000, 5000].map((extra) => {
                const base = Number(
                  scheduledOfferRide?.offeredFare ??
                  scheduledOfferRide?.fare ??
                  scheduledOfferRide?.suggestedFare ??
                  0
                );

                return (
                  <button
                    key={extra}
                    type="button"
                    onClick={() =>
                      setScheduledOfferPrice(
                        String(Math.max(0, base + extra))
                      )
                    }
                    className="rounded-xl bg-gray-100 py-2.5 text-[11px] font-black text-gray-700"
                  >
                    {extra === 0
                      ? "Mismo valor"
                      : `+ ${formatCOP(extra)}`}
                  </button>
                );
              })}
            </div>

            <label className="block mt-4">
              <span className="text-sm font-black text-gray-800">
                Mensaje al usuario
              </span>
              <textarea
                rows={3}
                maxLength={300}
                value={scheduledOfferMessage}
                onChange={(event) =>
                  setScheduledOfferMessage(event.target.value)
                }
                className="mt-2 w-full resize-none rounded-2xl border border-gray-200 px-3 py-3 text-sm outline-none"
                placeholder="Ej. Puedo recoger a la hora programada."
              />
            </label>

            <div className="grid grid-cols-2 gap-2 mt-5">
              <button
                type="button"
                onClick={closeScheduledOfferModal}
                disabled={Boolean(processingScheduledRideId)}
                className="rounded-2xl bg-gray-100 py-3.5 font-black text-gray-700 disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={submitScheduledOffer}
                disabled={
                  Boolean(processingScheduledRideId) ||
                  Number(scheduledOfferPrice) <= 0
                }
                className="rounded-2xl bg-purple-700 py-3.5 font-black text-white disabled:opacity-50"
              >
                {processingScheduledRideId
                  ? "Enviando..."
                  : "Enviar oferta"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {bidModalOpen ? (
        <div className="fixed inset-0 z-[100] bg-black/55 flex items-end">
          <div className="w-full max-h-[92vh] overflow-y-auto rounded-t-[30px] bg-white p-4 shadow-2xl">
            <div className="w-16 h-1.5 rounded-full bg-gray-300 mx-auto mb-4" />

            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-blue-700">
                  Nueva propuesta
                </p>

                <h2 className="text-xl font-black text-gray-950 mt-1">
                  {selectedOffer?.title ||
                    "Carga disponible"}
                </h2>

                <p className="text-sm text-gray-600 mt-1">
                  {selectedOffer?.origin} →{" "}
                  {selectedOffer?.destination}
                </p>
              </div>

              <button
                type="button"
                onClick={closeBidModal}
                className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center"
              >
                <i className="ri-close-line text-xl" />
              </button>
            </div>

            <div className="rounded-2xl bg-blue-50 border border-blue-200 p-4 mt-4 text-sm text-blue-900 space-y-1">
              <p>
                <strong>Peso:</strong>{" "}
                {selectedOffer?.weightLabel ||
                  `${selectedOffer?.weight || 0} ${
                    selectedOffer?.weightUnit || "kg"
                  }`}
              </p>

              <p>
                <strong>Capacidad mínima:</strong>{" "}
                {formatNumber(
                  selectedOffer?.recommendedMinCapacityKg
                )}{" "}
                kg
              </p>

              <p>
                <strong>Vehículo sugerido:</strong>{" "}
                {selectedOffer?.requiredVehicleLabel ||
                  selectedOffer?.suggestedVehicleLabel ||
                  VEHICLE_LABELS[
                    selectedOffer?.requiredVehicleType
                  ] ||
                  "Por definir"}
              </p>
            </div>

            <form
              onSubmit={submitBid}
              className="space-y-4 mt-4"
            >
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Precio total de tu propuesta
                </label>

                <input
                  type="number"
                  name="offeredPrice"
                  value={bidForm.offeredPrice}
                  onChange={handleBidChange}
                  min="1"
                  placeholder="Ej: 950000"
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none"
                  required
                />

                <p className="text-xs text-gray-500 mt-1">
                  Valor completo del viaje en pesos colombianos.
                </p>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Tipo de vehículo
                </label>

                <select
                  name="proposedVehicleType"
                  value={bidForm.proposedVehicleType}
                  onChange={handleBidChange}
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 bg-white outline-none"
                  required
                >
                  <option value="">
                    Selecciona el vehículo
                  </option>

                  {VEHICLE_OPTIONS.filter(
                    (item) => item.value
                  ).map((item) => (
                    <option
                      key={item.value}
                      value={item.value}
                    >
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  name="proposedVehicleBrand"
                  value={bidForm.proposedVehicleBrand}
                  onChange={handleBidChange}
                  placeholder="Marca"
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none"
                />

                <input
                  type="text"
                  name="proposedVehicleReference"
                  value={
                    bidForm.proposedVehicleReference
                  }
                  onChange={handleBidChange}
                  placeholder="Línea o referencia"
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  name="proposedVehicleModel"
                  value={bidForm.proposedVehicleModel}
                  onChange={handleBidChange}
                  placeholder="Modelo o año"
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none"
                />

                <input
                  type="text"
                  name="proposedVehiclePlate"
                  value={bidForm.proposedVehiclePlate}
                  onChange={handleBidChange}
                  placeholder="Placa"
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 uppercase outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Carrocería
                </label>

                <select
                  name="proposedBodyType"
                  value={bidForm.proposedBodyType}
                  onChange={handleBidChange}
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 bg-white outline-none"
                >
                  {BODY_OPTIONS.filter(
                    (item) => item.value
                  ).map((item) => (
                    <option
                      key={item.value}
                      value={item.value}
                    >
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    Capacidad
                  </label>

                  <input
                    type="number"
                    name="proposedVehicleCapacity"
                    value={
                      bidForm.proposedVehicleCapacity
                    }
                    onChange={handleBidChange}
                    min="0.01"
                    step="any"
                    className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    Unidad
                  </label>

                  <select
                    name="proposedVehicleCapacityUnit"
                    value={
                      bidForm.proposedVehicleCapacityUnit
                    }
                    onChange={handleBidChange}
                    className="w-full rounded-2xl border border-gray-200 px-4 py-3 bg-white outline-none"
                  >
                    <option value="kg">kg</option>
                    <option value="toneladas">
                      Toneladas
                    </option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Fecha disponible para recoger
                </label>

                <input
                  type="datetime-local"
                  name="availablePickupTime"
                  value={bidForm.availablePickupTime}
                  onChange={handleBidChange}
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Entrega estimada
                </label>

                <input
                  type="datetime-local"
                  name="estimatedDeliveryTime"
                  value={bidForm.estimatedDeliveryTime}
                  onChange={handleBidChange}
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Duración estimada en horas
                </label>

                <input
                  type="number"
                  name="estimatedDurationHours"
                  value={bidForm.estimatedDurationHours}
                  onChange={handleBidChange}
                  min="0"
                  step="0.5"
                  placeholder="Ej: 8"
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none"
                />
              </div>

              <div className="rounded-2xl bg-gray-50 border border-gray-200 p-4 space-y-3">
                <p className="text-sm font-black text-gray-900">
                  Servicios incluidos
                </p>

                {[
                  [
                    "includesLoading",
                    "Incluye cargue",
                  ],
                  [
                    "includesUnloading",
                    "Incluye descargue",
                  ],
                  [
                    "includesAssistant",
                    "Incluye ayudante",
                  ],
                  [
                    "includesTolls",
                    "Incluye peajes",
                  ],
                  [
                    "includesFuel",
                    "Incluye combustible",
                  ],
                  [
                    "includesInsurance",
                    "Incluye seguro",
                  ],
                ].map(([name, label]) => (
                  <label
                    key={name}
                    className="flex items-center gap-3"
                  >
                    <input
                      type="checkbox"
                      name={name}
                      checked={Boolean(
                        bidForm[name]
                      )}
                      onChange={handleBidChange}
                      className="w-4 h-4"
                    />

                    <span className="text-sm text-gray-700">
                      {label}
                    </span>
                  </label>
                ))}
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Mensaje para el cliente
                </label>

                <textarea
                  name="message"
                  value={bidForm.message}
                  onChange={handleBidChange}
                  rows={4}
                  maxLength={1500}
                  placeholder="Explica las condiciones de tu servicio..."
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 resize-none outline-none"
                />
              </div>

              {pageError ? (
                <div className="rounded-2xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm font-bold">
                  {pageError}
                </div>
              ) : null}

              {successMessage ? (
                <div className="rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 text-sm font-bold">
                  {successMessage}
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={closeBidModal}
                  className="rounded-2xl bg-gray-100 border border-gray-200 text-gray-800 py-3 font-black"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-2xl bg-blue-600 text-white py-3 font-black disabled:opacity-60"
                >
                  {submitting
                    ? "Enviando..."
                    : "Enviar propuesta"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default CaptainSpaceOffers;