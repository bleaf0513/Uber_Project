import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { getApiBaseUrl } from "../apiBase";

const TABS = [
  {
    key: "goods",
    label: "Mercancía",
    icon: "ri-shopping-basket-2-line",
  },
  {
    key: "space",
    label: "Cargas",
    icon: "ri-truck-line",
  },
  {
    key: "seat",
    label: "Cupos",
    icon: "ri-user-3-line",
  },
];

const PRICE_TYPE_LABELS = {
  por_kg: "por kg",
  por_gramo: "por gramo",
  por_libra: "por libra",
  por_bulto: "por bulto",
  por_paca: "por paca",
  por_caja: "por caja",
  por_canastilla: "por canastilla",
  por_tonelada: "por tonelada",
  por_unidad: "por unidad",
  por_m3: "por m³",
  precio_total: "precio total",
};

const UNIT_LABELS = {
  kg: "kg",
  gramos: "gramos",
  libras: "libras",
  bultos: "bultos",
  pacas: "pacas",
  cajas: "cajas",
  canastillas: "canastillas",
  toneladas: "toneladas",
  unidades: "unidades",
  m3: "m³",
  cupo: "cupo",
  cupos: "cupos",
  puesto: "puesto",
  puestos: "puestos",
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

const BODY_TYPE_LABELS = {
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

const LOAD_STATUS_LABELS = {
  borrador: "Borrador",
  active: "Publicada",
  paused: "Pausada",
  recibiendo_propuestas: "Recibiendo propuestas",
  assigned: "Transportador seleccionado",
  reserved: "Reservada",
  recogida: "Carga recogida",
  in_transit: "En camino",
  delivered: "Entregada",
  completed: "Finalizada",
  cancelled: "Cancelada",
};

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
  arrived_at_destination: "En el destino",
  unloading: "Descargando mercancía",
  delivered: "Carga entregada",
  completed: "Servicio finalizado",
  cancelled: "Servicio cancelado",
  disputed: "Servicio en disputa",
};

const formatCOP = (value) => {
  const number = Number(value) || 0;

  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(number);
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

const humanizeUnit = (unit) => {
  return UNIT_LABELS[unit] || unit || "";
};

const humanizePriceType = (priceType) => {
  return PRICE_TYPE_LABELS[priceType] || "precio";
};

const getTheme = (listingType) => {
  if (listingType === "goods") {
    return {
      label: "Mercancía",
      icon: "ri-shopping-basket-2-line",
      gradient: "from-orange-500 via-amber-500 to-yellow-400",
      softBg: "bg-orange-50",
      border: "border-orange-200",
      text: "text-orange-700",
      button: "bg-orange-600",
      buttonShadow: "shadow-orange-600/20",
      lightButton:
        "bg-orange-100 text-orange-700 border-orange-200",
    };
  }

  if (listingType === "space") {
    return {
      label: "Carga",
      icon: "ri-truck-line",
      gradient: "from-blue-600 via-cyan-500 to-sky-400",
      softBg: "bg-blue-50",
      border: "border-blue-200",
      text: "text-blue-700",
      button: "bg-blue-600",
      buttonShadow: "shadow-blue-600/20",
      lightButton:
        "bg-blue-100 text-blue-700 border-blue-200",
    };
  }

  return {
    label: "Cupos",
    icon: "ri-user-3-line",
    gradient: "from-emerald-600 via-teal-500 to-green-400",
    softBg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-700",
    button: "bg-emerald-600",
    buttonShadow: "shadow-emerald-600/20",
    lightButton:
      "bg-emerald-100 text-emerald-700 border-emerald-200",
  };
};

const buildPriceLabel = (offer, listingType) => {
  if (!offer) {
    return formatCOP(0);
  }

  if (offer.priceLabel) {
    return offer.priceLabel;
  }

  if (listingType === "seat") {
    return `${formatCOP(offer.suggestedPrice)} por ${humanizeUnit(
      offer.seatUnit || "cupo"
    )}`;
  }

  return `${formatCOP(
    offer.suggestedPrice
  )} ${humanizePriceType(offer.priceType)}`;
};

const getAvailableInfo = (offer, listingType) => {
  if (!offer) {
    return {
      quantity: 0,
      unit: "",
      label: "Sin disponibilidad",
    };
  }

  if (listingType === "goods") {
    const realAvailable =
      offer.availableReal ??
      offer.realAvailable ??
      offer.quantityAvailable ??
      0;

    return {
      quantity: Number(realAvailable) || 0,
      unit: offer.quantityUnit || "",
      label:
        offer.availableLabel ||
        `${realAvailable} ${humanizeUnit(
          offer.quantityUnit
        )} disponibles`,
    };
  }

  const realAvailable =
    offer.availableReal ??
    offer.realAvailable ??
    offer.seatsAvailable ??
    0;

  return {
    quantity: Number(realAvailable) || 0,
    unit: offer.seatUnit || "cupos",
    label:
      offer.availableLabel ||
      `${realAvailable} ${humanizeUnit(
        offer.seatUnit || "cupos"
      )} disponibles`,
  };
};

const getDriverName = (driver) => {
  if (!driver) {
    return "Transportador";
  }

  const first = driver?.fullname?.firstname || "";
  const last = driver?.fullname?.lastname || "";
  const full = `${first} ${last}`.trim();

  return full || "Transportador";
};

const getOfferTitle = (offer, listingType) => {
  if (listingType === "goods") {
    return offer?.productName || "Mercancía disponible";
  }

  const available = getAvailableInfo(offer, "seat");

  return `${available.quantity} ${humanizeUnit(
    available.unit
  )} disponibles`;
};

const AvailableOffers = () => {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("goods");

  const [loading, setLoading] = useState(false);
  const [goodsOffers, setGoodsOffers] = useState([]);
  const [spaceOffers, setSpaceOffers] = useState([]);
  const [seatOffers, setSeatOffers] = useState([]);

  const [trackingByOffer, setTrackingByOffer] = useState({});
  const [trackingActionId, setTrackingActionId] = useState("");
  const [trackingMessage, setTrackingMessage] = useState("");
  const [trackingError, setTrackingError] = useState("");

  const [pageError, setPageError] = useState("");

  const [bidModalOpen, setBidModalOpen] = useState(false);
  const [submittingBid, setSubmittingBid] = useState(false);
  const [bidError, setBidError] = useState("");
  const [bidSuccess, setBidSuccess] = useState("");

  const [selectedOffer, setSelectedOffer] = useState(null);
  const [selectedMode, setSelectedMode] = useState("offer");

  const [photoViewerOpen, setPhotoViewerOpen] = useState(false);
  const [photoViewerPhotos, setPhotoViewerPhotos] = useState([]);
  const [photoViewerIndex, setPhotoViewerIndex] = useState(0);

  const [bidForm, setBidForm] = useState({
    listingType: "",
    listingId: "",
    requestedQuantity: "",
    requestedUnit: "",
    offeredPrice: "",
    message: "",
  });

  const token = localStorage.getItem("token");

  const counts = useMemo(
    () => ({
      goods: goodsOffers.length,
      space: spaceOffers.length,
      seat: seatOffers.length,
    }),
    [goodsOffers, spaceOffers, seatOffers]
  );

  const fetchOffers = async () => {
    try {
      setLoading(true);
      setPageError("");

      const headers = token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : {};

      /*
       * IMPORTANTE:
       * Cada módulo se consulta por separado para evitar que un fallo
       * secundario (por ejemplo tracking o cargas) deje vacío TODO
       * el Marketplace.
       */
      const goodsPromise = axios.get(
        `${getApiBaseUrl()}/offers/goods/list`,
        { headers }
      );

      const seatPromise = axios.get(
        `${getApiBaseUrl()}/offers/seat/list`,
        { headers }
      );

      const spacePromise = token
        ? axios.get(
            `${getApiBaseUrl()}/offers/space/my-offers`,
            { headers }
          )
        : Promise.resolve({
            data: { offers: [] },
          });

      const trackingPromise = token
        ? axios.get(
            `${getApiBaseUrl()}/marketplace-load-tracking/customer/my-trackings`,
            { headers }
          )
        : Promise.resolve({
            data: { trackings: [] },
          });

      const [
        goodsResult,
        seatResult,
        spaceResult,
        trackingResult,
      ] = await Promise.allSettled([
        goodsPromise,
        seatPromise,
        spacePromise,
        trackingPromise,
      ]);

      let partialError = false;

      /*
       * MERCANCÍA
       */
      if (goodsResult.status === "fulfilled") {
        const offers = Array.isArray(
          goodsResult.value?.data?.offers
        )
          ? goodsResult.value.data.offers
          : [];

        setGoodsOffers(offers);
      } else {
        partialError = true;

        console.error(
          "Error cargando mercancía:",
          goodsResult.reason?.response?.data ||
            goodsResult.reason?.message ||
            goodsResult.reason
        );

        setGoodsOffers([]);
      }

      /*
       * CUPOS
       */
      if (seatResult.status === "fulfilled") {
        const offers = Array.isArray(
          seatResult.value?.data?.offers
        )
          ? seatResult.value.data.offers
          : [];

        setSeatOffers(offers);
      } else {
        partialError = true;

        console.error(
          "Error cargando cupos:",
          seatResult.reason?.response?.data ||
            seatResult.reason?.message ||
            seatResult.reason
        );

        setSeatOffers([]);
      }

      /*
       * CARGAS DEL USUARIO
       */
      if (spaceResult.status === "fulfilled") {
        const offers = Array.isArray(
          spaceResult.value?.data?.offers
        )
          ? spaceResult.value.data.offers
          : [];

        setSpaceOffers(offers);
      } else {
        partialError = true;

        console.error(
          "Error cargando cargas:",
          spaceResult.reason?.response?.data ||
            spaceResult.reason?.message ||
            spaceResult.reason
        );

        setSpaceOffers([]);
      }

      /*
       * TRACKING
       *
       * Si esto falla NO bloqueamos mercancía, cargas ni cupos.
       */
      if (trackingResult.status === "fulfilled") {
        const trackings = Array.isArray(
          trackingResult.value?.data?.trackings
        )
          ? trackingResult.value.data.trackings
          : [];

        const nextTrackingByOffer = {};

        trackings.forEach((tracking) => {
          const spaceOfferReference =
            tracking?.spaceOffer?._id ||
            tracking?.spaceOffer;

          if (spaceOfferReference) {
            nextTrackingByOffer[
              String(spaceOfferReference)
            ] = tracking;
          }
        });

        setTrackingByOffer(nextTrackingByOffer);
      } else {
        partialError = true;

        console.error(
          "Error cargando seguimiento:",
          trackingResult.reason?.response?.data ||
            trackingResult.reason?.message ||
            trackingResult.reason
        );

        setTrackingByOffer({});
      }

      if (partialError) {
        setPageError(
          "Algunos servicios del Marketplace no respondieron. Puedes seguir usando las secciones disponibles y volver a actualizar."
        );
      }
    } catch (error) {
      console.error(
        "Error general cargando Marketplace:",
        error
      );

      setPageError(
        "No se pudo conectar con el Marketplace. Intenta actualizar nuevamente."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOffers();
  }, []);

  useEffect(() => {
    if (!token) return undefined;

    const intervalId = window.setInterval(() => {
      fetchOffers();
    }, 10000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [token]);

  const currentList = useMemo(() => {
    if (activeTab === "goods") {
      return goodsOffers;
    }

    if (activeTab === "space") {
      return spaceOffers;
    }

    return seatOffers;
  }, [activeTab, goodsOffers, spaceOffers, seatOffers]);

  const openPhotoViewer = (offer, startIndex = 0) => {
    const photos = Array.isArray(offer?.photos)
      ? offer.photos.filter(
          (photo) =>
            typeof photo === "string" &&
            photo.trim().length > 0
        )
      : [];

    if (photos.length === 0) return;

    const safeIndex = Math.min(
      Math.max(Number(startIndex) || 0, 0),
      photos.length - 1
    );

    setPhotoViewerPhotos(photos);
    setPhotoViewerIndex(safeIndex);
    setPhotoViewerOpen(true);
  };

  const closePhotoViewer = () => {
    setPhotoViewerOpen(false);
    setPhotoViewerPhotos([]);
    setPhotoViewerIndex(0);
  };

  const showPreviousPhoto = () => {
    setPhotoViewerIndex((previous) => {
      if (photoViewerPhotos.length <= 1) return 0;

      return previous <= 0
        ? photoViewerPhotos.length - 1
        : previous - 1;
    });
  };

  const showNextPhoto = () => {
    setPhotoViewerIndex((previous) => {
      if (photoViewerPhotos.length <= 1) return 0;

      return previous >= photoViewerPhotos.length - 1
        ? 0
        : previous + 1;
    });
  };

  const closeBidModal = () => {
    setBidModalOpen(false);
    setSelectedOffer(null);
    setSelectedMode("offer");

    setBidForm({
      listingType: "",
      listingId: "",
      requestedQuantity: "",
      requestedUnit: "",
      offeredPrice: "",
      message: "",
    });

    setBidSuccess("");
    setBidError("");
  };

  const openBidModal = (offer, listingType, mode) => {
    if (listingType === "space") {
      return;
    }

    const available = getAvailableInfo(offer, listingType);

    let requestedQuantity = 1;

    if (
      available.quantity > 0 &&
      available.quantity < 1
    ) {
      requestedQuantity = available.quantity;
    }

    const offeredPrice =
      Number(offer?.suggestedPrice) || 0;

    let defaultMessage = "";

    if (listingType === "goods") {
      defaultMessage =
        mode === "buy"
          ? `Quiero comprar ${requestedQuantity} ${humanizeUnit(
              available.unit
            )} de ${
              offer?.productName || "esta mercancía"
            }.`
          : `Te envío una oferta por ${requestedQuantity} ${humanizeUnit(
              available.unit
            )} de ${
              offer?.productName || "esta mercancía"
            }.`;
    }

    if (listingType === "seat") {
      defaultMessage =
        mode === "reserve"
          ? `Quiero reservar ${requestedQuantity} ${humanizeUnit(
              available.unit
            )}.`
          : `Te envío una oferta por ${requestedQuantity} ${humanizeUnit(
              available.unit
            )}.`;
    }

    setSelectedOffer(offer);
    setSelectedMode(mode);

    setBidForm({
      listingType,
      listingId: offer?._id || "",
      requestedQuantity,
      requestedUnit: available.unit,
      offeredPrice,
      message: defaultMessage,
    });

    setBidSuccess("");
    setBidError("");
    setBidModalOpen(true);
  };

  const handleBidFormChange = (event) => {
    const { name, value } = event.target;

    setBidForm((previous) => {
      const next = {
        ...previous,
        [name]: value,
      };

      if (
        name === "requestedQuantity" &&
        selectedOffer
      ) {
        const quantity = Number(value) || 0;
        const unit = previous.requestedUnit || "";

        if (previous.listingType === "goods") {
          next.message = `Te envío una oferta por ${quantity} ${humanizeUnit(
            unit
          )} de ${
            selectedOffer?.productName ||
            "esta mercancía"
          }.`;
        }

        if (previous.listingType === "seat") {
          next.message = `Te envío una oferta por ${quantity} ${humanizeUnit(
            unit
          )}.`;
        }
      }

      return next;
    });
  };

  const getModalTitle = () => {
    if (selectedMode === "buy") {
      return "Comprar mercancía";
    }

    if (selectedMode === "reserve") {
      return "Reservar cupo";
    }

    return "Enviar oferta";
  };

  const validateBidBeforeSubmit = () => {
    const requestedQuantity = Number(
      bidForm.requestedQuantity
    );

    const offeredPrice = Number(bidForm.offeredPrice);

    const available = getAvailableInfo(
      selectedOffer,
      bidForm.listingType
    );

    if (!token) {
      return "Debes iniciar sesión para enviar una oferta.";
    }

    if (
      !["goods", "seat"].includes(bidForm.listingType)
    ) {
      return "El tipo de publicación no es válido.";
    }

    if (!bidForm.listingId) {
      return "No se encontró la publicación seleccionada.";
    }

    if (
      !Number.isFinite(requestedQuantity) ||
      requestedQuantity <= 0
    ) {
      return "La cantidad solicitada debe ser mayor que 0.";
    }

    if (!bidForm.requestedUnit) {
      return "La unidad de la oferta no es válida.";
    }

    if (bidForm.requestedUnit !== available.unit) {
      return `La unidad debe ser ${humanizeUnit(
        available.unit
      )}.`;
    }

    if (requestedQuantity > available.quantity) {
      return `No puedes solicitar más de lo disponible. Disponible: ${
        available.quantity
      } ${humanizeUnit(available.unit)}.`;
    }

    if (
      !Number.isFinite(offeredPrice) ||
      offeredPrice <= 0
    ) {
      return "Debes ingresar un valor mayor que 0.";
    }

    return "";
  };

  const handleSubmitBid = async (event) => {
    event.preventDefault();

    setBidError("");
    setBidSuccess("");

    const validationMessage =
      validateBidBeforeSubmit();

    if (validationMessage) {
      setBidError(validationMessage);
      return;
    }

    try {
      setSubmittingBid(true);

      await axios.post(
        `${getApiBaseUrl()}/offers/bid/create`,
        {
          listingType: bidForm.listingType,
          listingId: bidForm.listingId,
          requestedQuantity: Number(
            bidForm.requestedQuantity
          ),
          requestedUnit: bidForm.requestedUnit,
          offeredPrice: Number(bidForm.offeredPrice),
          message: bidForm.message?.trim() || "",
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setBidSuccess(
        "Solicitud enviada correctamente al transportador."
      );

      await fetchOffers();

      setTimeout(() => {
        closeBidModal();
      }, 900);
    } catch (error) {
      console.error("Error enviando oferta:", error);

      const apiErrors = error?.response?.data?.errors;
      const apiMessage = error?.response?.data?.message;

      if (
        Array.isArray(apiErrors) &&
        apiErrors.length > 0
      ) {
        setBidError(
          apiErrors[0]?.msg ||
            "No se pudo enviar la oferta."
        );
      } else {
        setBidError(
          apiMessage ||
            "No se pudo enviar la oferta."
        );
      }
    } finally {
      setSubmittingBid(false);
    }
  };

  const ensureTrackingForOffer = async (offer) => {
    if (!token || !offer?._id) {
      setTrackingError(
        "No se pudo identificar la sesión o la carga."
      );
      return;
    }

    try {
      setTrackingActionId(String(offer._id));
      setTrackingMessage("");
      setTrackingError("");

      const response = await axios.post(
        `${getApiBaseUrl()}/marketplace-load-tracking/customer/ensure/${offer._id}`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const tracking = response?.data?.tracking;

      if (tracking?._id) {
        setTrackingByOffer((previous) => ({
          ...previous,
          [String(offer._id)]: tracking,
        }));
      }

      setTrackingMessage(
        response?.data?.message ||
          "Seguimiento creado correctamente."
      );
    } catch (error) {
      console.error(
        "Error asegurando seguimiento:",
        error
      );

      setTrackingError(
        error?.response?.data?.message ||
          "No se pudo crear el seguimiento de esta carga."
      );
    } finally {
      setTrackingActionId("");
    }
  };

  const activateProfessionalTracking = async (
    offer,
    tracking
  ) => {
    if (!token || !tracking?._id) {
      setTrackingError(
        "No se encontró el seguimiento de la carga."
      );
      return;
    }

    try {
      setTrackingActionId(String(offer._id));
      setTrackingMessage("");
      setTrackingError("");

      const response = await axios.patch(
        `${getApiBaseUrl()}/marketplace-load-tracking/customer/${tracking._id}/activate-professional`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const updatedTracking =
        response?.data?.tracking;

      if (updatedTracking?._id) {
        setTrackingByOffer((previous) => ({
          ...previous,
          [String(offer._id)]:
            updatedTracking,
        }));
      }

      setTrackingMessage(
        response?.data?.message ||
          "Seguimiento profesional activado."
      );
    } catch (error) {
      console.error(
        "Error activando seguimiento profesional:",
        error
      );

      setTrackingError(
        error?.response?.data?.message ||
          "No se pudo activar el seguimiento profesional."
      );
    } finally {
      setTrackingActionId("");
    }
  };

  const renderTraditionalOfferCard = (
    offer,
    listingType
  ) => {
    const theme = getTheme(listingType);

    const available = getAvailableInfo(
      offer,
      listingType
    );

    const priceLabel = buildPriceLabel(
      offer,
      listingType
    );

    const primaryText =
      listingType === "goods"
        ? "Comprar"
        : "Reservar cupo";

    const primaryMode =
      listingType === "goods"
        ? "buy"
        : "reserve";

    return (
      <div
        key={offer._id}
        className="relative overflow-hidden rounded-[30px] border border-white bg-white shadow-[0_22px_60px_rgba(15,23,42,0.12)]"
      >
        <div
          className={`h-2 bg-gradient-to-r ${theme.gradient}`}
        />

        {listingType === "goods" &&
        Array.isArray(offer.photos) &&
        offer.photos.length > 0 ? (
          <div className="relative bg-slate-100">
            <button
              type="button"
              onClick={() => openPhotoViewer(offer, 0)}
              className="block w-full text-left"
            >
              <img
                src={offer.photos[0]}
                alt={offer.productName || "Mercancía"}
                className="h-56 w-full object-cover"
              />

              <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/55 to-transparent pointer-events-none" />
            </button>

            <div className="absolute left-3 top-3 flex items-center gap-2">
              <span className="rounded-full bg-black/70 px-3 py-1.5 text-[11px] font-black text-white backdrop-blur-md">
                <i className="ri-camera-3-fill mr-1" />
                {offer.photos.length} foto
                {offer.photos.length === 1 ? "" : "s"}
              </span>

              <span className="rounded-full bg-white/90 px-3 py-1.5 text-[10px] font-black text-orange-700 shadow-sm backdrop-blur-md">
                FOTO REAL
              </span>
            </div>

            {offer.photos.length > 1 ? (
              <div className="absolute bottom-3 right-3 flex items-center gap-2">
                {offer.photos.slice(0, 4).map((photo, index) => (
                  <button
                    key={`${offer._id}-photo-${index}`}
                    type="button"
                    onClick={() => openPhotoViewer(offer, index)}
                    className="h-11 w-11 overflow-hidden rounded-xl border-2 border-white bg-white shadow-lg"
                    aria-label={`Ver foto ${index + 1}`}
                  >
                    <img
                      src={photo}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : listingType === "goods" ? (
          <div className="flex h-36 items-center justify-center bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50">
            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-orange-400 shadow-sm">
                <i className="ri-image-line text-3xl" />
              </div>
              <p className="mt-2 text-xs font-bold text-orange-700/70">
                Publicación sin fotografías
              </p>
            </div>
          </div>
        ) : null}

        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div
                className={`w-12 h-12 rounded-2xl ${theme.softBg} ${theme.text} border ${theme.border} flex items-center justify-center shadow-sm`}
              >
                <i
                  className={`${theme.icon} text-2xl`}
                />
              </div>

              <div>
                <p
                  className={`text-xs font-black uppercase tracking-wide ${theme.text}`}
                >
                  {theme.label} disponible
                </p>

                <h3 className="text-lg font-black text-gray-950 mt-1 leading-tight">
                  {getOfferTitle(offer, listingType)}
                </h3>

                <p className="text-sm text-gray-500 mt-1">
                  {offer.origin} → {offer.destination}
                </p>
              </div>
            </div>

            <span
              className={`text-xs font-black px-3 py-1 rounded-full border ${theme.lightButton}`}
            >
              Activa
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-5">
            <div className="rounded-2xl bg-slate-950 text-white px-4 py-3 shadow-lg">
              <p className="text-xs text-white/60 font-bold">
                Disponible real
              </p>

              <p className="text-lg font-black mt-1">
                {available.label}
              </p>
            </div>

            <div
              className={`${theme.softBg} border ${theme.border} rounded-2xl px-4 py-3`}
            >
              <p
                className={`text-xs font-bold ${theme.text}`}
              >
                Precio publicado
              </p>

              <p
                className={`text-lg font-black mt-1 ${theme.text}`}
              >
                {priceLabel}
              </p>
            </div>
          </div>

          <div className="mt-3 rounded-2xl bg-gray-50 border border-gray-200 p-4 space-y-2">
            <p className="text-sm text-gray-700">
              <span className="font-black">
                Transportador:
              </span>{" "}
              {getDriverName(offer.driver)}
            </p>

            <p className="text-sm text-gray-700">
              <span className="font-black">
                Negociable:
              </span>{" "}
              {offer.isNegotiable
                ? "Sí, recibe ofertas"
                : "No negociable"}
            </p>

            {Array.isArray(offer.stops) &&
            offer.stops.length > 0 ? (
              <p className="text-sm text-gray-700">
                <span className="font-black">
                  Paradas:
                </span>{" "}
                {offer.stops.join(", ")}
              </p>
            ) : null}

            {offer.description ? (
              <div className="rounded-2xl bg-white border border-gray-200 px-4 py-3">
                <p className="text-xs font-black text-gray-500 mb-1">
                  Descripción
                </p>

                <p className="text-sm text-gray-700">
                  {offer.description}
                </p>
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <button
              type="button"
              onClick={() =>
                openBidModal(
                  offer,
                  listingType,
                  primaryMode
                )
              }
              className={`rounded-2xl ${theme.button} text-white py-3 font-black shadow-lg ${theme.buttonShadow}`}
            >
              {primaryText}
            </button>

            <button
              type="button"
              onClick={() =>
                openBidModal(
                  offer,
                  listingType,
                  "offer"
                )
              }
              className={`rounded-2xl py-3 font-black border ${theme.lightButton}`}
            >
              Enviar oferta
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderLoadCard = (offer) => {
    const theme = getTheme("space");

    const proposalCount =
      Number(offer.proposalsCount) || 0;

    const activeProposalCount =
      Number(offer.activeProposalsCount) || 0;

    const statusLabel =
      LOAD_STATUS_LABELS[offer.status] ||
      offer.status ||
      "Publicada";

    const vehicleLabel =
      offer.requiredVehicleLabel ||
      VEHICLE_LABELS[offer.requiredVehicleType] ||
      offer.suggestedVehicleLabel ||
      VEHICLE_LABELS[offer.suggestedVehicleType] ||
      "Por definir";

    const bodyLabel =
      offer.requiredBodyLabel ||
      BODY_TYPE_LABELS[offer.requiredBodyType] ||
      "No especificada";

    const priceLabel =
      Number(offer.suggestedPrice) > 0
        ? formatCOP(offer.suggestedPrice)
        : "Recibir propuestas";

    const tracking =
      trackingByOffer[String(offer._id)] || null;

    const isAssigned =
      offer.status === "assigned" ||
      Boolean(offer.selectedBid) ||
      Boolean(offer.selectedDriver);

    const isTrackingBusy =
      trackingActionId === String(offer._id);

    const trackingStatusLabel =
      TRACKING_STATUS_LABELS[tracking?.status] ||
      tracking?.status ||
      "Pendiente de creación";

    const liveLat = Number(
      tracking?.currentLocation?.lat
    );

    const liveLng = Number(
      tracking?.currentLocation?.lng
    );

    const hasLiveLocation =
      Number.isFinite(liveLat) &&
      Number.isFinite(liveLng);

    const trackingCaptainId =
      tracking?.captain?._id ||
      tracking?.captain ||
      "assigned-captain";

    const liveDriver = hasLiveLocation
      ? [
          {
            _id: trackingCaptainId,
            lat: liveLat,
            lng: liveLng,
            heading:
              tracking?.currentLocation?.heading ||
              0,
            fullname:
              tracking?.captain?.fullname ||
              "Transportador asignado",
          },
        ]
      : [];

    const pickupMapPosition =
      Number.isFinite(
        Number(tracking?.origin?.lat)
      ) &&
      Number.isFinite(
        Number(tracking?.origin?.lng)
      )
        ? {
            lat: Number(tracking.origin.lat),
            lng: Number(tracking.origin.lng),
            address:
              tracking?.origin?.address || "",
          }
        : null;

    const destinationMapPosition =
      Number.isFinite(
        Number(tracking?.destination?.lat)
      ) &&
      Number.isFinite(
        Number(tracking?.destination?.lng)
      )
        ? {
            lat: Number(
              tracking.destination.lat
            ),
            lng: Number(
              tracking.destination.lng
            ),
            address:
              tracking?.destination?.address ||
              "",
          }
        : null;

    return (
      <div
        key={offer._id}
        className="relative overflow-hidden rounded-[30px] border border-white bg-white shadow-[0_22px_60px_rgba(15,23,42,0.12)]"
      >
        <div
          className={`h-2 bg-gradient-to-r ${theme.gradient}`}
        />

        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div
                className={`w-12 h-12 shrink-0 rounded-2xl ${theme.softBg} ${theme.text} border ${theme.border} flex items-center justify-center shadow-sm`}
              >
                <i className="ri-truck-line text-2xl" />
              </div>

              <div className="min-w-0">
                <p
                  className={`text-xs font-black uppercase tracking-wide ${theme.text}`}
                >
                  {offer.publicationCode || "Carga publicada"}
                </p>

                <h3 className="text-lg font-black text-gray-950 mt-1 leading-tight">
                  {offer.title ||
                    offer.cargoType ||
                    "Carga disponible"}
                </h3>

                <p className="text-sm text-gray-500 mt-1">
                  {offer.origin} → {offer.destination}
                </p>
              </div>
            </div>

            <span
              className={`shrink-0 text-[11px] font-black px-3 py-1 rounded-full border ${theme.lightButton}`}
            >
              {statusLabel}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-5">
            <div className="rounded-2xl bg-slate-950 text-white px-4 py-3 shadow-lg">
              <p className="text-xs text-white/60 font-bold">
                Peso de la carga
              </p>

              <p className="text-lg font-black mt-1">
                {offer.weightLabel ||
                  `${offer.weight || 0} ${
                    offer.weightUnit || "kg"
                  }`}
              </p>
            </div>

            <div
              className={`${theme.softBg} border ${theme.border} rounded-2xl px-4 py-3`}
            >
              <p
                className={`text-xs font-bold ${theme.text}`}
              >
                Precio
              </p>

              <p
                className={`text-lg font-black mt-1 ${theme.text}`}
              >
                {priceLabel}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-3">
            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-3">
              <p className="text-xs font-bold text-emerald-700">
                Propuestas recibidas
              </p>

              <p className="text-2xl font-black text-emerald-800 mt-1">
                {proposalCount}
              </p>

              <p className="text-xs text-emerald-700 mt-1">
                {activeProposalCount} activas
              </p>
            </div>

            <div className="rounded-2xl bg-violet-50 border border-violet-200 px-4 py-3">
              <p className="text-xs font-bold text-violet-700">
                Recogida
              </p>

              <p className="text-sm font-black text-violet-800 mt-1">
                {formatDate(offer.pickupTime)}
              </p>
            </div>
          </div>

          <div className="mt-3 rounded-2xl bg-gray-50 border border-gray-200 p-4 space-y-2">
            <p className="text-sm text-gray-700">
              <span className="font-black">
                Tipo de carga:
              </span>{" "}
              {offer.cargoType || "Carga general"}
            </p>

            <p className="text-sm text-gray-700">
              <span className="font-black">
                Vehículo requerido:
              </span>{" "}
              {vehicleLabel}
            </p>

            <p className="text-sm text-gray-700">
              <span className="font-black">
                Carrocería:
              </span>{" "}
              {bodyLabel}
            </p>

            <p className="text-sm text-gray-700">
              <span className="font-black">
                Capacidad mínima recomendada:
              </span>{" "}
              {Number(
                offer.recommendedMinCapacityKg
              ).toLocaleString("es-CO")}{" "}
              kg
            </p>

            {Number(offer.volumeM3) > 0 ? (
              <p className="text-sm text-gray-700">
                <span className="font-black">
                  Volumen:
                </span>{" "}
                {offer.volumeM3} m³
              </p>
            ) : null}

            {offer.description ? (
              <div className="rounded-2xl bg-white border border-gray-200 px-4 py-3">
                <p className="text-xs font-black text-gray-500 mb-1">
                  Descripción
                </p>

                <p className="text-sm text-gray-700">
                  {offer.description}
                </p>
              </div>
            ) : null}
          </div>

          {isAssigned ? (
            <div className="mt-4 rounded-[24px] border border-cyan-200 bg-gradient-to-br from-cyan-50 via-blue-50 to-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg">
                    <i className="ri-map-pin-time-line text-xl" />
                  </div>

                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-blue-700">
                      Seguimiento del servicio
                    </p>

                    <h4 className="text-base font-black text-gray-950 mt-1">
                      {tracking
                        ? tracking.trackingPlan ===
                          "professional"
                          ? "Seguimiento profesional activo"
                          : "Seguimiento básico creado"
                        : "Seguimiento pendiente"}
                    </h4>

                    <p className="text-sm text-gray-600 mt-1">
                      Estado: {trackingStatusLabel}
                    </p>
                  </div>
                </div>

                {tracking ? (
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-black border ${
                      tracking.trackingPlan ===
                      "professional"
                        ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                        : "bg-blue-100 text-blue-700 border-blue-200"
                    }`}
                  >
                    {tracking.trackingPlan ===
                    "professional"
                      ? "PRO"
                      : "BÁSICO"}
                  </span>
                ) : null}
              </div>

              {tracking?.currentLocation?.updatedAt ? (
                <div className="mt-3 rounded-2xl bg-white border border-blue-100 px-4 py-3">
                  <p className="text-xs font-black text-gray-500">
                    Última ubicación recibida
                  </p>

                  <p className="text-sm font-bold text-gray-800 mt-1">
                    {formatDate(
                      tracking.currentLocation.updatedAt
                    )}
                  </p>
                </div>
              ) : null}

              {!tracking ? (
                <button
                  type="button"
                  disabled={isTrackingBusy}
                  onClick={() =>
                    ensureTrackingForOffer(offer)
                  }
                  className="w-full mt-3 rounded-2xl bg-blue-600 text-white py-3 font-black shadow-lg disabled:opacity-60"
                >
                  {isTrackingBusy
                    ? "Creando seguimiento..."
                    : "Crear seguimiento"}
                </button>
              ) : tracking.trackingPlan !==
                "professional" ? (
                <button
                  type="button"
                  disabled={isTrackingBusy}
                  onClick={() =>
                    activateProfessionalTracking(
                      offer,
                      tracking
                    )
                  }
                  className="w-full mt-3 rounded-2xl bg-slate-950 text-white py-3 font-black shadow-lg disabled:opacity-60"
                >
                  {isTrackingBusy
                    ? "Activando..."
                    : "Activar seguimiento profesional"}
                </button>
              ) : (
                <div className="mt-3 rounded-[24px] border border-purple-200 bg-gradient-to-br from-purple-50 via-white to-fuchsia-50 p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-purple-700">
                        Centro de seguimiento
                      </p>

                      <h5 className="text-base font-black text-gray-950 mt-1">
                        Ver servicio completo
                      </h5>

                      <p className="text-xs text-gray-600 mt-1 leading-5">
                        Consulta el mapa, transportador, ruta, estado e historial en una pantalla organizada.
                      </p>
                    </div>

                    <div className="w-12 h-12 rounded-2xl bg-purple-700 text-white flex items-center justify-center shrink-0 shadow-lg">
                      <i className="ri-route-line text-2xl" />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        `/load-tracking/${tracking._id}`
                      )
                    }
                    className="w-full mt-3 rounded-2xl bg-gradient-to-r from-purple-800 via-violet-700 to-fuchsia-600 text-white py-3.5 font-black shadow-lg"
                  >
                    <i className="ri-map-pin-time-line mr-1" />
                    Abrir seguimiento en vivo
                  </button>

                  <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-white border border-purple-100 px-3 py-2">
                    <span className="text-xs font-bold text-gray-600">
                      {hasLiveLocation
                        ? "Ubicación recibida"
                        : "Esperando ubicación"}
                    </span>

                    <span
                      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-black ${
                        hasLiveLocation
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          hasLiveLocation
                            ? "bg-emerald-500 animate-pulse"
                            : "bg-amber-500"
                        }`}
                      />

                      {hasLiveLocation
                        ? "EN VIVO"
                        : "PENDIENTE"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3 mt-4">
            <button
              type="button"
              onClick={() =>
                navigate("/my-load-offers")
              }
              className={`rounded-2xl ${theme.button} text-white py-3 font-black shadow-lg ${theme.buttonShadow}`}
            >
              Ver propuestas
            </button>

            <button
              type="button"
              onClick={() =>
                navigate("/create-load-offer")
              }
              className={`rounded-2xl py-3 font-black border ${theme.lightButton}`}
            >
              Publicar otra
            </button>
          </div>
        </div>
      </div>
    );
  };

  const selectedAvailable = getAvailableInfo(
    selectedOffer,
    bidForm.listingType
  );

  const selectedPriceLabel = buildPriceLabel(
    selectedOffer,
    bidForm.listingType
  );

  const selectedTheme = getTheme(
    bidForm.listingType || activeTab
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-gray-100 to-slate-200">
      <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to="/home"
              className="w-10 h-10 shrink-0 rounded-full bg-black text-white flex items-center justify-center shadow-lg"
            >
              <i className="ri-arrow-left-line text-xl" />
            </Link>

            <div className="min-w-0">
              <h1 className="text-lg font-black text-gray-950">
                Marketplace
              </h1>

              <p className="text-xs text-gray-600">
                Mercancía, cargas y cupos
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === "space" ? (
              <button
                type="button"
                onClick={() =>
                  navigate("/create-load-offer")
                }
                className="px-3 h-10 rounded-2xl bg-blue-600 text-white text-sm font-bold shadow-lg"
              >
                Publicar carga
              </button>
            ) : (
              <button
                type="button"
                onClick={() =>
                  navigate("/my-sent-bids")
                }
                className="px-3 h-10 rounded-2xl bg-black text-white text-sm font-bold shadow-lg"
              >
                Mis ofertas
              </button>
            )}

            <button
              type="button"
              onClick={fetchOffers}
              className="w-10 h-10 rounded-2xl bg-gray-100 border border-gray-200 flex items-center justify-center"
              aria-label="Actualizar"
            >
              <i className="ri-refresh-line text-lg" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-4">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            const theme = getTheme(tab.key);

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setActiveTab(tab.key);
                  setPageError("");
                }}
                className={`rounded-2xl px-3 py-3 text-sm font-black border transition ${
                  isActive
                    ? `text-white border-transparent bg-gradient-to-r ${theme.gradient} shadow-lg`
                    : "bg-white text-gray-700 border-gray-200"
                }`}
              >
                <div className="flex flex-col items-center justify-center gap-1">
                  <i className={`${tab.icon} text-lg`} />

                  <span>{tab.label}</span>

                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full ${
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {counts[tab.key] || 0}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-4">
        {trackingMessage ? (
          <div className="mb-4 rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm font-bold text-emerald-700">
            {trackingMessage}
          </div>
        ) : null}

        {trackingError ? (
          <div className="mb-4 rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-sm font-bold text-red-700">
            {trackingError}
          </div>
        ) : null}

        {activeTab === "space" ? (
          <div className="mb-4 rounded-[26px] bg-gradient-to-r from-blue-700 via-cyan-600 to-sky-500 text-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-white/70">
                  Marketplace logístico
                </p>

                <h2 className="text-xl font-black mt-1">
                  Publica tu carga
                </h2>

                <p className="text-sm text-white/85 mt-2 leading-relaxed">
                  Los transportadores podrán verla y
                  enviarte propuestas con precio, vehículo y
                  condiciones del servicio.
                </p>
              </div>

              <div className="w-14 h-14 shrink-0 rounded-2xl bg-white/15 flex items-center justify-center">
                <i className="ri-truck-line text-3xl" />
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                navigate("/create-load-offer")
              }
              className="w-full mt-4 rounded-2xl bg-white text-blue-700 py-3 font-black shadow-lg"
            >
              Crear nueva publicación
            </button>
          </div>
        ) : null}

        {pageError ? (
          <div className="mb-4 bg-amber-50 rounded-[24px] border border-amber-200 p-4 text-sm text-amber-800 font-semibold">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 shrink-0 rounded-xl bg-amber-100 flex items-center justify-center">
                <i className="ri-information-line text-xl" />
              </div>
              <div className="flex-1">
                <p className="font-black">Conexión parcial</p>
                <p className="mt-1 text-xs leading-5">{pageError}</p>
              </div>
            </div>
          </div>
        ) : null}

        {loading ? (
          <div className="bg-white rounded-[24px] border border-gray-200 p-5 text-sm text-gray-600 shadow-sm">
            Cargando publicaciones...
          </div>
        ) : currentList.length === 0 ? (
          <div className="bg-white rounded-[24px] border border-gray-200 p-6 text-sm text-gray-600 text-center shadow-sm">
            {activeTab === "space" ? (
              <>
                <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
                  <i className="ri-truck-line text-3xl" />
                </div>

                <p className="font-black text-gray-900">
                  Aún no has publicado cargas
                </p>

                <p className="mt-2">
                  Publica la primera para comenzar a recibir
                  propuestas de transportadores.
                </p>

                <button
                  type="button"
                  onClick={() =>
                    navigate("/create-load-offer")
                  }
                  className="mt-4 rounded-2xl bg-blue-600 text-white px-5 py-3 font-black shadow-lg"
                >
                  Publicar carga
                </button>
              </>
            ) : (
              "No hay publicaciones disponibles en esta categoría por ahora."
            )}
          </div>
        ) : (
          <div className="space-y-5">
            {activeTab === "goods" &&
              goodsOffers.map((offer) =>
                renderTraditionalOfferCard(
                  offer,
                  "goods"
                )
              )}

            {activeTab === "space" &&
              spaceOffers.map((offer) =>
                renderLoadCard(offer)
              )}

            {activeTab === "seat" &&
              seatOffers.map((offer) =>
                renderTraditionalOfferCard(
                  offer,
                  "seat"
                )
              )}
          </div>
        )}
      </div>

      {photoViewerOpen &&
      photoViewerPhotos.length > 0 ? (
        <div className="fixed inset-0 z-[140] flex flex-col bg-black">
          <div className="flex items-center justify-between px-4 pb-3 pt-4 text-white">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/50">
                Galería de mercancía
              </p>

              <p className="mt-1 text-sm font-black">
                Foto {photoViewerIndex + 1} de{" "}
                {photoViewerPhotos.length}
              </p>
            </div>

            <button
              type="button"
              onClick={closePhotoViewer}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md"
              aria-label="Cerrar galería"
            >
              <i className="ri-close-line text-2xl" />
            </button>
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
            <img
              src={photoViewerPhotos[photoViewerIndex]}
              alt={`Foto ${photoViewerIndex + 1}`}
              className="max-h-full max-w-full object-contain"
            />

            {photoViewerPhotos.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={showPreviousPhoto}
                  className="absolute left-3 flex h-12 w-12 items-center justify-center rounded-full bg-black/55 text-white shadow-lg backdrop-blur-md"
                  aria-label="Foto anterior"
                >
                  <i className="ri-arrow-left-s-line text-3xl" />
                </button>

                <button
                  type="button"
                  onClick={showNextPhoto}
                  className="absolute right-3 flex h-12 w-12 items-center justify-center rounded-full bg-black/55 text-white shadow-lg backdrop-blur-md"
                  aria-label="Foto siguiente"
                >
                  <i className="ri-arrow-right-s-line text-3xl" />
                </button>
              </>
            ) : null}
          </div>

          {photoViewerPhotos.length > 1 ? (
            <div className="flex gap-2 overflow-x-auto px-4 pb-5 pt-3">
              {photoViewerPhotos.map((photo, index) => (
                <button
                  key={`viewer-thumb-${index}`}
                  type="button"
                  onClick={() => setPhotoViewerIndex(index)}
                  className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 ${
                    index === photoViewerIndex
                      ? "border-white"
                      : "border-white/20"
                  }`}
                >
                  <img
                    src={photo}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {bidModalOpen ? (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-end">
          <div className="w-full bg-white rounded-t-[30px] p-4 shadow-2xl max-h-[90vh] overflow-auto">
            <div className="flex justify-center pb-2">
              <div className="w-16 h-1.5 rounded-full bg-gray-300" />
            </div>

            <div
              className={`h-2 rounded-full bg-gradient-to-r ${selectedTheme.gradient} mb-4`}
            />

            <div className="flex items-start justify-between gap-3">
              <div>
                <p
                  className={`text-xs font-black uppercase tracking-wide ${selectedTheme.text}`}
                >
                  Nueva solicitud
                </p>

                <h2 className="text-xl font-black text-gray-950">
                  {getModalTitle()}
                </h2>

                <p className="text-sm text-gray-600 mt-1">
                  {selectedOffer?.origin || "Origen"} →{" "}
                  {selectedOffer?.destination || "Destino"}
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

            {bidForm.listingType === "goods" &&
            Array.isArray(selectedOffer?.photos) &&
            selectedOffer.photos.length > 0 ? (
              <div className="mt-4 overflow-hidden rounded-[24px] border border-orange-100 bg-orange-50">
                <button
                  type="button"
                  onClick={() => openPhotoViewer(selectedOffer, 0)}
                  className="relative block w-full"
                >
                  <img
                    src={selectedOffer.photos[0]}
                    alt={selectedOffer?.productName || "Mercancía"}
                    className="h-52 w-full object-cover"
                  />

                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/70 to-transparent p-3 pt-12">
                    <div className="text-left text-white">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/70">
                        Fotografías del producto
                      </p>
                      <p className="text-sm font-black">
                        Ver galería completa
                      </p>
                    </div>

                    <span className="rounded-full bg-white px-3 py-1.5 text-[10px] font-black text-orange-700">
                      {selectedOffer.photos.length} FOTO
                      {selectedOffer.photos.length === 1 ? "" : "S"}
                    </span>
                  </div>
                </button>

                {selectedOffer.photos.length > 1 ? (
                  <div className="grid grid-cols-4 gap-2 p-3">
                    {selectedOffer.photos.slice(0, 4).map((photo, index) => (
                      <button
                        key={`selected-offer-photo-${index}`}
                        type="button"
                        onClick={() =>
                          openPhotoViewer(selectedOffer, index)
                        }
                        className="overflow-hidden rounded-xl border-2 border-white bg-white shadow-sm"
                      >
                        <img
                          src={photo}
                          alt=""
                          className="h-16 w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="mt-4 rounded-2xl bg-gray-50 border border-gray-200 p-4 text-sm text-gray-700 space-y-2">
              <p>
                <span className="font-black">
                  Publicación:
                </span>{" "}
                {getOfferTitle(
                  selectedOffer,
                  bidForm.listingType
                )}
              </p>

              <p>
                <span className="font-black">
                  Precio publicado:
                </span>{" "}
                {selectedPriceLabel}
              </p>

              <p>
                <span className="font-black">
                  Disponible real:
                </span>{" "}
                {selectedAvailable.quantity}{" "}
                {humanizeUnit(selectedAvailable.unit)}
              </p>

              <p>
                <span className="font-black">
                  Transportador:
                </span>{" "}
                {getDriverName(selectedOffer?.driver)}
              </p>
            </div>

            <form
              onSubmit={handleSubmitBid}
              className="space-y-4 mt-4"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-bold text-gray-700 block mb-1">
                    Cantidad
                  </label>

                  <input
                    type="number"
                    name="requestedQuantity"
                    value={bidForm.requestedQuantity}
                    onChange={handleBidFormChange}
                    min="0.01"
                    step="any"
                    max={
                      selectedAvailable.quantity ||
                      undefined
                    }
                    className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none"
                    required
                  />

                  <p className="text-xs text-gray-500 mt-1">
                    Máximo: {selectedAvailable.quantity}{" "}
                    {humanizeUnit(
                      selectedAvailable.unit
                    )}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-bold text-gray-700 block mb-1">
                    Unidad
                  </label>

                  <input
                    type="text"
                    value={humanizeUnit(
                      bidForm.requestedUnit
                    )}
                    readOnly
                    className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none bg-gray-100 text-gray-700"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-bold text-gray-700 block mb-1">
                  Valor total que ofreces
                </label>

                <input
                  type="number"
                  name="offeredPrice"
                  value={bidForm.offeredPrice}
                  onChange={handleBidFormChange}
                  min="1"
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none"
                  required
                />
              </div>

              <div className="rounded-2xl bg-slate-950 text-white px-4 py-3 text-sm shadow-lg">
                <p className="font-black">
                  Resumen
                </p>

                <p className="text-white/80 mt-1">
                  Solicitas{" "}
                  {bidForm.requestedQuantity || 0}{" "}
                  {humanizeUnit(
                    bidForm.requestedUnit
                  )}{" "}
                  por{" "}
                  {formatCOP(
                    bidForm.offeredPrice
                  )}
                  .
                </p>
              </div>

              <div>
                <label className="text-sm font-bold text-gray-700 block mb-1">
                  Mensaje
                </label>

                <textarea
                  name="message"
                  value={bidForm.message}
                  onChange={handleBidFormChange}
                  rows={4}
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none resize-none"
                  placeholder="Escribe los detalles..."
                />
              </div>

              {bidError ? (
                <div className="rounded-2xl bg-red-50 text-red-700 px-4 py-3 text-sm font-semibold border border-red-200">
                  {bidError}
                </div>
              ) : null}

              {bidSuccess ? (
                <div className="rounded-2xl bg-emerald-50 text-emerald-700 px-4 py-3 text-sm font-semibold border border-emerald-200">
                  {bidSuccess}
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={closeBidModal}
                  className="rounded-2xl bg-gray-100 text-gray-800 py-3 font-black border border-gray-200"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={submittingBid}
                  className={`rounded-2xl ${selectedTheme.button} text-white py-3 font-black disabled:opacity-60 shadow-lg ${selectedTheme.buttonShadow}`}
                >
                  {submittingBid
                    ? "Enviando..."
                    : "Confirmar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AvailableOffers;