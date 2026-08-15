import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { CaptainDataContext } from "../context/CaptainContext";
import { getApiBaseUrl } from "../apiBase";

const GOODS_UNITS = [
  "kg",
  "gramos",
  "libras",
  "bultos",
  "pacas",
  "cajas",
  "canastillas",
  "toneladas",
  "unidades",
];

const GOODS_PRICE_TYPES = [
  { value: "por_kg", label: "Por kg", unit: "kg" },
  { value: "por_gramo", label: "Por gramo", unit: "gramos" },
  { value: "por_libra", label: "Por libra", unit: "libras" },
  { value: "por_bulto", label: "Por bulto", unit: "bultos" },
  { value: "por_paca", label: "Por paca", unit: "pacas" },
  { value: "por_caja", label: "Por caja", unit: "cajas" },
  { value: "por_canastilla", label: "Por canastilla", unit: "canastillas" },
  { value: "por_tonelada", label: "Por tonelada", unit: "toneladas" },
  { value: "por_unidad", label: "Por unidad", unit: "unidades" },
  { value: "precio_total", label: "Precio total", unit: "" },
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
  precio_total: "precio total",
};

const VEHICLE_TYPES = [
  { value: "", label: "Selecciona vehículo" },
  { value: "motorcycle", label: "Moto" },
  { value: "car", label: "Carro" },
  { value: "light_cargo", label: "Carga liviana" },
  { value: "van", label: "Furgón / Camioneta" },
  { value: "truck", label: "Camión" },
];

const formatCOP = (value) => {
  const number = Number(value) || 0;

  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(number);
};

const humanizePriceType = (priceType) => {
  return PRICE_TYPE_LABELS[priceType] || "precio";
};

const getPriceTypeConfig = (priceType) => {
  return (
    GOODS_PRICE_TYPES.find((item) => item.value === priceType) ||
    GOODS_PRICE_TYPES[0]
  );
};

const buildPriceLabel = (offerOrForm) => {
  if (!offerOrForm) return formatCOP(0);

  if (offerOrForm.priceLabel) return offerOrForm.priceLabel;

  return `${formatCOP(offerOrForm.suggestedPrice)} ${humanizePriceType(
    offerOrForm.priceType
  )}`;
};

const getStatusStyle = (status) => {
  if (status === "sold_out") return "bg-red-100 text-red-700 border-red-200";
  if (status === "paused")
    return "bg-yellow-100 text-yellow-700 border-yellow-200";
  if (status === "cancelled")
    return "bg-gray-200 text-gray-700 border-gray-300";
  if (status === "completed")
    return "bg-blue-100 text-blue-700 border-blue-200";

  return "bg-emerald-100 text-emerald-700 border-emerald-200";
};

const getStatusText = (status) => {
  if (status === "sold_out") return "Agotada";
  if (status === "paused") return "Pausada";
  if (status === "cancelled") return "Cancelada";
  if (status === "completed") return "Completada";

  return "Activa";
};

const getNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};


const MAX_PRODUCT_PHOTOS = 4;
const MAX_IMAGE_FILE_SIZE = 8 * 1024 * 1024;
const IMAGE_MAX_DIMENSION = 1280;
const IMAGE_JPEG_QUALITY = 0.78;

const fileToCompressedDataUrl = (file) =>
  new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error("No se recibió ninguna imagen."));
      return;
    }

    if (!String(file.type || "").startsWith("image/")) {
      reject(new Error("Selecciona únicamente archivos de imagen."));
      return;
    }

    if (file.size > MAX_IMAGE_FILE_SIZE) {
      reject(
        new Error(
          "Cada foto debe pesar máximo 8 MB antes de comprimir."
        )
      );
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const image = new Image();

      image.onload = () => {
        try {
          const originalWidth = image.naturalWidth || image.width;
          const originalHeight = image.naturalHeight || image.height;

          if (!originalWidth || !originalHeight) {
            reject(new Error("No se pudo leer el tamaño de la imagen."));
            return;
          }

          const scale = Math.min(
            1,
            IMAGE_MAX_DIMENSION / Math.max(originalWidth, originalHeight)
          );

          const width = Math.max(1, Math.round(originalWidth * scale));
          const height = Math.max(1, Math.round(originalHeight * scale));

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;

          const context = canvas.getContext("2d");

          if (!context) {
            reject(new Error("No se pudo preparar la imagen."));
            return;
          }

          context.drawImage(image, 0, 0, width, height);

          resolve(
            canvas.toDataURL(
              "image/jpeg",
              IMAGE_JPEG_QUALITY
            )
          );
        } catch (error) {
          reject(error);
        }
      };

      image.onerror = () => {
        reject(new Error("No se pudo abrir la imagen seleccionada."));
      };

      image.src = String(reader.result || "");
    };

    reader.onerror = () => {
      reject(new Error("No se pudo leer la imagen seleccionada."));
    };

    reader.readAsDataURL(file);
  });

const CaptainGoodsOffers = () => {
  const { captain } = useContext(CaptainDataContext);

  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  const [productPhotos, setProductPhotos] = useState([]);
  const [processingPhotos, setProcessingPhotos] = useState(false);

  const [loading, setLoading] = useState(false);
  const [loadingMine, setLoadingMine] = useState(false);
  const [myOffers, setMyOffers] = useState([]);
  const [message, setMessage] = useState("");

  const [form, setForm] = useState({
    productName: "",
    quantityAvailable: "",
    quantityUnit: "kg",
    suggestedPrice: "",
    priceType: "por_kg",
    origin: "",
    destination: "",
    departureTime: "",
    vehicleType: "",
    description: "",
    notes: "",
    isNegotiable: true,
  });

  const token = localStorage.getItem("token");

  const priceTypeConfig = useMemo(() => {
    return getPriceTypeConfig(form.priceType);
  }, [form.priceType]);

  const preview = useMemo(() => {
    const product = form.productName.trim() || "Producto";
    const quantity = Number(form.quantityAvailable) || 0;
    const unit = form.quantityUnit || "kg";
    const suggestedPrice = Number(form.suggestedPrice) || 0;

    return {
      product,
      availableLabel: `${quantity} ${unit} disponibles`,
      priceLabel: `${formatCOP(suggestedPrice)} ${humanizePriceType(
        form.priceType
      )}`,
    };
  }, [form]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setForm((prev) => {
      const next = {
        ...prev,
        [name]: type === "checkbox" ? checked : value,
      };

      if (name === "priceType") {
        const config = getPriceTypeConfig(value);

        if (value !== "precio_total" && config.unit) {
          next.quantityUnit = config.unit;
        }
      }

      return next;
    });
  };

  const addProductPhotos = async (fileList) => {
    const files = Array.from(fileList || []);

    if (files.length === 0) return;

    const remainingSlots =
      MAX_PRODUCT_PHOTOS - productPhotos.length;

    if (remainingSlots <= 0) {
      setMessage(
        `Puedes publicar máximo ${MAX_PRODUCT_PHOTOS} fotos por producto.`
      );
      return;
    }

    const selectedFiles = files.slice(0, remainingSlots);

    try {
      setProcessingPhotos(true);
      setMessage("");

      const compressed = [];

      for (const file of selectedFiles) {
        const dataUrl = await fileToCompressedDataUrl(file);
        compressed.push(dataUrl);
      }

      setProductPhotos((previous) => [
        ...previous,
        ...compressed,
      ]);

      if (files.length > remainingSlots) {
        setMessage(
          `Solo agregamos ${remainingSlots} foto(s). El máximo es ${MAX_PRODUCT_PHOTOS}.`
        );
      }
    } catch (error) {
      console.error(
        "Error preparando foto de mercancía:",
        error
      );

      setMessage(
        error?.message ||
          "No se pudo preparar la imagen."
      );
    } finally {
      setProcessingPhotos(false);

      if (cameraInputRef.current) {
        cameraInputRef.current.value = "";
      }

      if (galleryInputRef.current) {
        galleryInputRef.current.value = "";
      }
    }
  };

  const removeProductPhoto = (indexToRemove) => {
    setProductPhotos((previous) =>
      previous.filter(
        (_, index) => index !== indexToRemove
      )
    );
  };

  const movePhotoToCover = (indexToMove) => {
    setProductPhotos((previous) => {
      if (
        indexToMove <= 0 ||
        indexToMove >= previous.length
      ) {
        return previous;
      }

      const next = [...previous];
      const [selected] = next.splice(
        indexToMove,
        1
      );

      next.unshift(selected);
      return next;
    });
  };

  const resetForm = () => {
    setProductPhotos([]);

    setForm({
      productName: "",
      quantityAvailable: "",
      quantityUnit: "kg",
      suggestedPrice: "",
      priceType: "por_kg",
      origin: "",
      destination: "",
      departureTime: "",
      vehicleType: "",
      description: "",
      notes: "",
      isNegotiable: true,
    });
  };

  const fetchMyGoodsOffers = async () => {
    try {
      setLoadingMine(true);
      setMessage("");

      const statuses = ["active", "sold_out", "paused", "completed"];

      const responses = await Promise.all(
        statuses.map((status) =>
          axios.get(`${getApiBaseUrl()}/offers/goods/list?status=${status}`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          })
        )
      );

      const allOffers = responses.flatMap((response) =>
        Array.isArray(response?.data?.offers) ? response.data.offers : []
      );

      const uniqueOffersMap = new Map();

      allOffers.forEach((offer) => {
        if (offer?._id) {
          uniqueOffersMap.set(String(offer._id), offer);
        }
      });

      const mine = Array.from(uniqueOffersMap.values()).filter(
        (offer) =>
          String(offer?.driver?._id || offer?.driver) === String(captain?._id)
      );

      setMyOffers(mine);
    } catch (error) {
      console.error("Error cargando mis ofertas de mercancía:", error);
      setMessage(
        error?.response?.data?.message ||
          "No se pudieron cargar tus publicaciones."
      );
    } finally {
      setLoadingMine(false);
    }
  };

  useEffect(() => {
    if (!captain?._id || !token) return;
    fetchMyGoodsOffers();
  }, [captain?._id, token]);

  const validateForm = () => {
    const productName = form.productName.trim();
    const origin = form.origin.trim();
    const destination = form.destination.trim();
    const quantityAvailable = Number(form.quantityAvailable);
    const suggestedPrice = Number(form.suggestedPrice);

    if (!productName || productName.length < 2) {
      return "Debes ingresar un producto válido.";
    }

    if (!Number.isFinite(quantityAvailable) || quantityAvailable <= 0) {
      return "La cantidad disponible debe ser mayor que 0.";
    }

    if (!form.quantityUnit) {
      return "Debes seleccionar una unidad.";
    }

    if (!Number.isFinite(suggestedPrice) || suggestedPrice <= 0) {
      return "Debes ingresar un precio mayor que 0.";
    }

    if (!form.priceType) {
      return "Debes seleccionar el tipo de precio.";
    }

    if (form.priceType !== "precio_total" && priceTypeConfig.unit) {
      if (form.quantityUnit !== priceTypeConfig.unit) {
        return `Para evitar confusiones, si el precio es ${priceTypeConfig.label.toLowerCase()}, la unidad disponible debe ser ${priceTypeConfig.unit}.`;
      }
    }

    if (!origin || origin.length < 3) {
      return "Debes ingresar un origen válido.";
    }

    if (!destination || destination.length < 3) {
      return "Debes ingresar un destino válido.";
    }

    if (productPhotos.length === 0) {
      return "Agrega al menos una foto real de la mercancía.";
    }

    return "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    const validationError = validateForm();

    if (validationError) {
      setMessage(validationError);
      return;
    }

    try {
      setLoading(true);

      await axios.post(
        `${getApiBaseUrl()}/offers/goods/create`,
        {
          productName: form.productName.trim(),
          quantityAvailable: Number(form.quantityAvailable),
          quantityUnit: form.quantityUnit,
          suggestedPrice: Number(form.suggestedPrice),
          priceType: form.priceType,
          origin: form.origin.trim(),
          destination: form.destination.trim(),
          departureTime: form.departureTime
            ? new Date(form.departureTime).toISOString()
            : null,
          vehicleType: form.vehicleType || null,
          description: form.description.trim(),
          notes: form.notes.trim(),
          isNegotiable: form.isNegotiable,
          photos: productPhotos,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setMessage("Oferta de mercancía publicada correctamente.");
      resetForm();
      await fetchMyGoodsOffers();
    } catch (error) {
      console.error("Error publicando oferta de mercancía:", error);

      const apiErrors = error?.response?.data?.errors;
      const apiMessage = error?.response?.data?.message;

      if (Array.isArray(apiErrors) && apiErrors.length > 0) {
        setMessage(apiErrors[0]?.msg || "Datos inválidos para publicar.");
      } else {
        setMessage(apiMessage || "No se pudo publicar la oferta de mercancía.");
      }
    } finally {
      setLoading(false);
    }
  };

  const renderSalesBlock = (offer) => {
    const sales = Array.isArray(offer.sales) ? offer.sales : [];
    const soldQuantity = getNumber(offer.soldQuantity);
    const soldMoney = getNumber(offer.soldMoney);
    const unit = offer.quantityUnit || "";

    if (sales.length === 0) {
      return (
        <div className="rounded-2xl bg-white border border-gray-200 px-4 py-3">
          <p className="text-sm text-gray-500">
            Aún no hay ventas aceptadas para esta publicación.
          </p>
        </div>
      );
    }

    return (
      <div className="rounded-2xl bg-white border border-emerald-100 px-4 py-3">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <p className="text-xs font-black text-emerald-700 uppercase">
              Ventas realizadas
            </p>
            <p className="text-sm text-gray-600">
              {soldQuantity} {unit} vendidos · {formatCOP(soldMoney)}
            </p>
          </div>

          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
            <i className="ri-money-dollar-circle-line text-xl" />
          </div>
        </div>

        <div className="space-y-3">
          {sales.map((sale) => (
            <div
              key={sale.bidId || `${sale.customerName}-${sale.date}`}
              className="rounded-2xl bg-emerald-50 border border-emerald-100 p-3"
            >
              <p className="text-sm font-black text-gray-950">
                {sale.customerName || "Cliente"}
              </p>

              {sale.customerEmail ? (
                <p className="text-xs text-gray-500">{sale.customerEmail}</p>
              ) : null}

              <div className="grid grid-cols-2 gap-2 mt-3">
                <div className="rounded-xl bg-white px-3 py-2 border border-emerald-100">
                  <p className="text-[11px] text-gray-500 font-bold">
                    Compró
                  </p>
                  <p className="text-sm font-black text-gray-950">
                    {getNumber(sale.quantity)} {sale.unit || unit}
                  </p>
                </div>

                <div className="rounded-xl bg-white px-3 py-2 border border-emerald-100">
                  <p className="text-[11px] text-gray-500 font-bold">Valor</p>
                  <p className="text-sm font-black text-emerald-800">
                    {formatCOP(sale.price)}
                  </p>
                </div>
              </div>

              {sale.date ? (
                <p className="text-[11px] text-gray-500 mt-2">
                  {new Date(sale.date).toLocaleString("es-CO")}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderOfferCard = (offer) => {
    const unit = offer.quantityUnit || "";

    const availableReal = getNumber(
      offer.availableReal ?? offer.realAvailable ?? offer.quantityAvailable
    );

    const soldQuantity = getNumber(offer.soldQuantity);

    const publishedQuantityFromBackend = getNumber(offer.publishedQuantity);
    const quantityAvailableFromBackend = getNumber(offer.quantityAvailable);

    const publishedQuantity =
      publishedQuantityFromBackend > 0
        ? publishedQuantityFromBackend
        : availableReal + soldQuantity > 0
        ? availableReal + soldQuantity
        : quantityAvailableFromBackend;

    const availableLabel = `${availableReal} ${unit} disponibles`;
    const publishedLabel = `${publishedQuantity} ${unit} publicados`;
    const soldLabel = `${soldQuantity} ${unit} vendidos`;

    const soldMoney = getNumber(offer.soldMoney);
    const priceLabel = buildPriceLabel(offer);

    return (
      <div
        key={offer._id}
        className="relative overflow-hidden rounded-[30px] border border-orange-100 bg-white shadow-[0_22px_60px_rgba(15,23,42,0.12)]"
      >
        <div className="h-2 bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-400" />

        {Array.isArray(offer.photos) &&
        offer.photos.length > 0 ? (
          <div className="relative bg-slate-100">
            <img
              src={offer.photos[0]}
              alt={offer.productName || "Mercancía"}
              className="h-52 w-full object-cover"
            />

            <div className="absolute left-3 top-3 rounded-full bg-black/70 px-3 py-1.5 text-[11px] font-black text-white backdrop-blur-md">
              <i className="ri-camera-3-line mr-1" />
              {offer.photos.length} foto
              {offer.photos.length === 1 ? "" : "s"}
            </div>

            {offer.photos.length > 1 ? (
              <div className="absolute bottom-3 right-3 flex -space-x-2">
                {offer.photos
                  .slice(1, 4)
                  .map((photo, index) => (
                    <img
                      key={`${offer._id}-thumb-${index}`}
                      src={photo}
                      alt=""
                      className="h-10 w-10 rounded-xl border-2 border-white object-cover shadow-md"
                    />
                  ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-700 border border-orange-200 flex items-center justify-center shadow-sm">
                <i className="ri-shopping-basket-2-line text-2xl" />
              </div>

              <div>
                <p className="text-xs font-black text-orange-700 uppercase tracking-wide">
                  Mercancía publicada
                </p>

                <h3 className="text-lg font-black text-gray-950 mt-1 leading-tight">
                  {offer.productName}
                </h3>

                <p className="text-sm text-gray-500 mt-1">
                  {offer.origin} → {offer.destination}
                </p>
              </div>
            </div>

            <span
              className={`text-xs font-black px-3 py-1 rounded-full border ${getStatusStyle(
                offer.status
              )}`}
            >
              {getStatusText(offer.status)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-5">
            <div className="rounded-2xl bg-slate-950 text-white px-4 py-3 shadow-lg">
              <p className="text-xs text-white/60 font-bold">
                Disponible real
              </p>
              <p className="text-lg font-black mt-1">{availableLabel}</p>
            </div>

            <div className="rounded-2xl bg-orange-50 border border-orange-100 px-4 py-3">
              <p className="text-xs text-orange-700 font-bold">
                Precio publicado
              </p>
              <p className="text-lg font-black text-orange-800 mt-1">
                {priceLabel}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-3">
            <div className="rounded-2xl bg-gray-50 border border-gray-200 px-4 py-3">
              <p className="text-xs text-gray-500 font-bold">
                Cantidad publicada
              </p>
              <p className="text-base font-black text-gray-900 mt-1">
                {publishedLabel}
              </p>
            </div>

            <div className="rounded-2xl bg-emerald-50 border border-emerald-100 px-4 py-3">
              <p className="text-xs text-emerald-700 font-bold">
                Total vendido
              </p>
              <p className="text-base font-black text-emerald-800 mt-1">
                {soldLabel}
              </p>
              <p className="text-xs text-emerald-700 font-bold mt-1">
                {formatCOP(soldMoney)}
              </p>
            </div>
          </div>

          <div className="mt-3 rounded-2xl bg-gray-50 border border-gray-200 p-4 space-y-2">
            <p className="text-sm text-gray-700">
              <span className="font-black">Negociable:</span>{" "}
              {offer.isNegotiable ? "Sí, recibe ofertas" : "No negociable"}
            </p>

            {offer.departureTime ? (
              <p className="text-sm text-gray-700">
                <span className="font-black">Salida:</span>{" "}
                {new Date(offer.departureTime).toLocaleString("es-CO")}
              </p>
            ) : null}

            {offer.description ? (
              <div className="rounded-2xl bg-white border border-gray-200 px-4 py-3">
                <p className="text-xs font-black text-gray-500 mb-1">
                  Descripción
                </p>
                <p className="text-sm text-gray-700">{offer.description}</p>
              </div>
            ) : null}

            {offer.notes ? (
              <div className="rounded-2xl bg-white border border-gray-200 px-4 py-3">
                <p className="text-xs font-black text-gray-500 mb-1">Notas</p>
                <p className="text-sm text-gray-700">{offer.notes}</p>
              </div>
            ) : null}

            {renderSalesBlock(offer)}
          </div>

          <div className="mt-4">
            <button
              type="button"
              onClick={fetchMyGoodsOffers}
              className="w-full rounded-2xl bg-gray-100 text-gray-800 py-3 font-black border border-gray-200"
            >
              Actualizar disponibilidad y ventas
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-gray-100 to-slate-200">
      <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/captain-home"
            className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center shadow-lg"
          >
            <i className="ri-arrow-left-line text-xl"></i>
          </Link>

          <div>
            <h1 className="text-lg font-black text-gray-950">
              Publicar mercancía
            </h1>
            <p className="text-xs text-gray-600">
              Vende productos que llevas en ruta
            </p>
          </div>
        </div>

        <div className="w-10 h-10 rounded-2xl bg-orange-100 border border-orange-200 flex items-center justify-center">
          <i className="ri-shopping-basket-2-line text-xl text-orange-600"></i>
        </div>
      </div>

      <div className="p-4 space-y-5">
        <div className="bg-white rounded-[24px] shadow-[0_16px_45px_rgba(15,23,42,0.08)] border border-white p-4">
          <div className="mb-4">
            <p className="inline-flex items-center rounded-full bg-orange-50 text-orange-700 px-3 py-1 text-xs font-bold border border-orange-100">
              Nueva publicación
            </p>

            <p className="text-sm text-gray-600 mt-3">
              Llena la cantidad total que tienes disponible y especifica si el
              precio es por kg, por caja, por bulto, por unidad o por el total.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1">
                Producto
              </label>
              <input
                type="text"
                name="productName"
                value={form.productName}
                onChange={handleChange}
                placeholder="Ej: Papa capira, tomate, cebolla..."
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none"
                required
              />
            </div>

            <div className="overflow-hidden rounded-[26px] border border-purple-100 bg-gradient-to-br from-purple-50 via-white to-orange-50 shadow-sm">
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-purple-700">
                      Fotos de la mercancía
                    </p>

                    <h3 className="mt-1 text-lg font-black text-gray-950">
                      Muestra lo que estás vendiendo
                    </h3>

                    <p className="mt-1 text-xs leading-5 text-gray-600">
                      Agrega hasta {MAX_PRODUCT_PHOTOS} fotos reales.
                      La primera será la portada que verá el comprador.
                    </p>
                  </div>

                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-purple-700 text-white shadow-lg shadow-purple-700/20">
                    <i className="ri-camera-3-line text-2xl" />
                  </div>
                </div>

                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(event) =>
                    addProductPhotos(
                      event.target.files
                    )
                  }
                />

                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(event) =>
                    addProductPhotos(
                      event.target.files
                    )
                  }
                />

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={
                      processingPhotos ||
                      productPhotos.length >=
                        MAX_PRODUCT_PHOTOS
                    }
                    onClick={() =>
                      cameraInputRef.current?.click()
                    }
                    className="rounded-2xl bg-purple-700 px-3 py-4 text-white shadow-lg shadow-purple-700/15 transition active:scale-[0.98] disabled:opacity-50"
                  >
                    <i className="ri-camera-fill text-2xl" />
                    <span className="mt-1 block text-sm font-black">
                      Tomar foto
                    </span>
                    <span className="mt-0.5 block text-[10px] text-white/70">
                      Usar cámara
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={
                      processingPhotos ||
                      productPhotos.length >=
                        MAX_PRODUCT_PHOTOS
                    }
                    onClick={() =>
                      galleryInputRef.current?.click()
                    }
                    className="rounded-2xl border border-orange-200 bg-white px-3 py-4 text-orange-700 shadow-sm transition active:scale-[0.98] disabled:opacity-50"
                  >
                    <i className="ri-image-add-fill text-2xl" />
                    <span className="mt-1 block text-sm font-black">
                      Galería
                    </span>
                    <span className="mt-0.5 block text-[10px] text-orange-600/70">
                      Elegir imágenes
                    </span>
                  </button>
                </div>

                {processingPhotos ? (
                  <div className="mt-3 flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-xs font-bold text-purple-700">
                    <i className="ri-loader-4-line animate-spin text-lg" />
                    Optimizando fotografía...
                  </div>
                ) : null}

                {productPhotos.length > 0 ? (
                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-black text-gray-700">
                        Vista previa
                      </p>

                      <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-gray-500 shadow-sm">
                        {productPhotos.length}/{MAX_PRODUCT_PHOTOS}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {productPhotos.map(
                        (photo, index) => (
                          <div
                            key={`product-photo-${index}`}
                            className={`relative overflow-hidden rounded-[20px] border bg-white shadow-sm ${
                              index === 0
                                ? "border-purple-400 ring-2 ring-purple-100"
                                : "border-gray-200"
                            }`}
                          >
                            <img
                              src={photo}
                              alt={`Mercancía ${index + 1}`}
                              className="h-36 w-full object-cover"
                            />

                            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/80 to-transparent p-2 pt-8">
                              <span className="rounded-full bg-white/90 px-2 py-1 text-[9px] font-black text-gray-900">
                                {index === 0
                                  ? "PORTADA"
                                  : `FOTO ${index + 1}`}
                              </span>

                              <button
                                type="button"
                                onClick={() =>
                                  removeProductPhoto(
                                    index
                                  )
                                }
                                className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white shadow-lg"
                                aria-label="Eliminar foto"
                              >
                                <i className="ri-delete-bin-6-line" />
                              </button>
                            </div>

                            {index > 0 ? (
                              <button
                                type="button"
                                onClick={() =>
                                  movePhotoToCover(
                                    index
                                  )
                                }
                                className="absolute left-2 top-2 rounded-full bg-black/70 px-2.5 py-1.5 text-[9px] font-black text-white backdrop-blur-md"
                              >
                                Hacer portada
                              </button>
                            ) : null}
                          </div>
                        )
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-dashed border-purple-200 bg-white/80 p-5 text-center">
                    <i className="ri-image-line text-3xl text-purple-300" />
                    <p className="mt-2 text-sm font-black text-gray-800">
                      Aún no has agregado fotos
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Una buena foto aumenta la confianza del comprador.
                    </p>
                  </div>
                )}

                <div className="mt-3 flex items-start gap-2 rounded-2xl bg-white/80 px-3 py-2.5">
                  <i className="ri-shield-check-line mt-0.5 text-emerald-600" />
                  <p className="text-[11px] leading-4 text-gray-500">
                    Central Go comprime las imágenes antes de enviarlas para ahorrar datos y mejorar la velocidad de publicación.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[22px] border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs font-bold text-gray-700 uppercase mb-3">
                Cantidad total disponible
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1">
                    Cantidad
                  </label>
                  <input
                    type="number"
                    name="quantityAvailable"
                    value={form.quantityAvailable}
                    onChange={handleChange}
                    placeholder="Ej: 200"
                    min="1"
                    className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none bg-white"
                    required
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1">
                    Unidad
                  </label>
                  <select
                    name="quantityUnit"
                    value={form.quantityUnit}
                    onChange={handleChange}
                    className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none bg-white"
                    required
                  >
                    {GOODS_UNITS.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <p className="text-xs text-gray-500 mt-2">
                Ejemplo: si traes 200 kilos, coloca cantidad 200 y unidad kg.
              </p>
            </div>

            <div className="rounded-[22px] border border-orange-100 bg-orange-50 p-3">
              <p className="text-xs font-bold text-orange-700 uppercase mb-3">
                Precio de venta
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1">
                    Precio
                  </label>
                  <input
                    type="number"
                    name="suggestedPrice"
                    value={form.suggestedPrice}
                    onChange={handleChange}
                    placeholder="Ej: 20000"
                    min="1"
                    className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none bg-white"
                    required
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1">
                    El precio es
                  </label>
                  <select
                    name="priceType"
                    value={form.priceType}
                    onChange={handleChange}
                    className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none bg-white"
                    required
                  >
                    {GOODS_PRICE_TYPES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="rounded-2xl bg-white border border-orange-100 px-4 py-3 mt-3 overflow-hidden">
                {productPhotos[0] ? (
                  <img
                    src={productPhotos[0]}
                    alt="Portada de la mercancía"
                    className="mb-3 h-40 w-full rounded-2xl object-cover"
                  />
                ) : null}

                <p className="text-xs text-orange-700 font-bold">
                  Así verá el usuario tu publicación
                </p>
                <p className="text-base font-black text-gray-900 mt-1">
                  {preview.product}
                </p>
                <p className="text-sm text-gray-700 mt-1">
                  Disponible:{" "}
                  <span className="font-bold">{preview.availableLabel}</span>
                </p>
                <p className="text-sm text-gray-700 mt-1">
                  Precio publicado:{" "}
                  <span className="font-bold">{preview.priceLabel}</span>
                </p>
              </div>

              {form.priceType !== "precio_total" ? (
                <p className="text-xs text-orange-700 mt-2">
                  Para evitar confusiones, al elegir{" "}
                  <strong>{priceTypeConfig.label.toLowerCase()}</strong>, la
                  unidad disponible debe coincidir con{" "}
                  <strong>{priceTypeConfig.unit}</strong>.
                </p>
              ) : (
                <p className="text-xs text-orange-700 mt-2">
                  Precio total significa que el valor publicado corresponde a
                  toda la mercancía disponible.
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1">
                Origen
              </label>
              <input
                type="text"
                name="origin"
                value={form.origin}
                onChange={handleChange}
                placeholder="Ej: Central Mayorista"
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none"
                required
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1">
                Destino
              </label>
              <input
                type="text"
                name="destination"
                value={form.destination}
                onChange={handleChange}
                placeholder="Ej: Itagüí, Sabaneta, Envigado..."
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none"
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">
                  Hora de salida
                </label>
                <input
                  type="datetime-local"
                  name="departureTime"
                  value={form.departureTime}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">
                  Vehículo
                </label>
                <select
                  name="vehicleType"
                  value={form.vehicleType}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none bg-white"
                >
                  {VEHICLE_TYPES.map((item) => (
                    <option key={item.value || "none"} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1">
                Descripción
              </label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="Ej: Papa recién cargada, buen estado, lista para entrega..."
                rows={3}
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none resize-none"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1">
                Notas adicionales
              </label>
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleChange}
                placeholder="Ej: Negociable, entrego en ruta, recibo llamadas..."
                rows={3}
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none resize-none"
              />
            </div>

            <label className="flex items-center gap-3 rounded-2xl bg-gray-50 px-4 py-3">
              <input
                type="checkbox"
                name="isNegotiable"
                checked={form.isNegotiable}
                onChange={handleChange}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium text-gray-700">
                Permitir negociación
              </span>
            </label>

            {message ? (
              <div
                className={`rounded-2xl px-4 py-3 text-sm font-semibold ${
                  message.includes("correctamente")
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-red-50 text-red-700"
                }`}
              >
                {message}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading || processingPhotos}
              className="w-full rounded-2xl bg-black text-white py-3.5 text-base font-bold disabled:opacity-60"
            >
              {loading
                ? "Publicando..."
                : processingPhotos
                ? "Preparando fotos..."
                : "Publicar mercancía"}
            </button>
          </form>
        </div>

        <div className="rounded-[30px] bg-white/90 backdrop-blur-xl shadow-[0_22px_65px_rgba(15,23,42,0.10)] border border-white p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-black text-gray-950">
                Mis publicaciones
              </h2>
              <p className="text-sm text-gray-600">
                Controla tu mercancía activa, disponibilidad real, ventas y
                compradores
              </p>
            </div>

            <button
              type="button"
              onClick={fetchMyGoodsOffers}
              className="w-10 h-10 rounded-2xl bg-gray-100 flex items-center justify-center border border-gray-200"
            >
              <i className="ri-refresh-line text-lg"></i>
            </button>
          </div>

          {loadingMine ? (
            <div className="text-sm text-gray-600">
              Cargando publicaciones...
            </div>
          ) : myOffers.length === 0 ? (
            <div className="rounded-2xl bg-gray-50 px-4 py-6 text-sm text-gray-600 text-center border border-gray-200">
              Aún no has publicado mercancía.
            </div>
          ) : (
            <div className="space-y-5">
              {myOffers.map((offer) => renderOfferCard(offer))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CaptainGoodsOffers;