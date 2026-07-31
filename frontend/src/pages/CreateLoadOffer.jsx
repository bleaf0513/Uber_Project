import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { getApiBaseUrl } from "../apiBase";

const VEHICLE_OPTIONS = [
  { value: "", label: "Dejar que el sistema sugiera" },
  { value: "moto", label: "Moto" },
  { value: "carro", label: "Carro" },
  { value: "motocarro", label: "Motocarro" },
  { value: "camioneta", label: "Camioneta" },
  { value: "van", label: "Van" },
  { value: "camion_ultraliviano", label: "Camión ultraliviano" },
  { value: "camion_liviano", label: "Camión liviano" },
  { value: "camion_mediano", label: "Camión mediano" },
  { value: "camion_pesado", label: "Camión pesado" },
  { value: "camion_sencillo", label: "Camión sencillo" },
  { value: "doble_troque", label: "Doble troque" },
  { value: "volqueta", label: "Volqueta" },
  { value: "minimula", label: "Minimula" },
  { value: "tractomula", label: "Tractomula" },
  { value: "cama_baja", label: "Cama baja" },
  { value: "vehiculo_especial", label: "Vehículo especial" },
  { value: "otro", label: "Otro" },
];

const BODY_OPTIONS = [
  { value: "no_especificada", label: "No especificada" },
  { value: "furgon_cerrado", label: "Furgón cerrado" },
  { value: "estacas", label: "Estacas" },
  { value: "plataforma", label: "Plataforma" },
  { value: "refrigerada", label: "Refrigerada" },
  { value: "volco", label: "Volco" },
  { value: "tanque", label: "Tanque" },
  { value: "portacontenedor", label: "Portacontenedor" },
  { value: "cama_baja", label: "Cama baja" },
  { value: "carroceria_abierta", label: "Carrocería abierta" },
  { value: "otro", label: "Otro" },
];

const PACKAGE_OPTIONS = [
  { value: "unidades", label: "Unidades" },
  { value: "cajas", label: "Cajas" },
  { value: "bultos", label: "Bultos" },
  { value: "pacas", label: "Pacas" },
  { value: "canastillas", label: "Canastillas" },
  { value: "sacos", label: "Sacos" },
  { value: "rollos", label: "Rollos" },
  { value: "tambores", label: "Tambores" },
  { value: "estibas", label: "Estibas" },
  { value: "contenedores", label: "Contenedores" },
  { value: "otro", label: "Otro" },
];

const PRICE_MODE_OPTIONS = [
  { value: "recibir_ofertas", label: "Recibir propuestas" },
  { value: "precio_fijo", label: "Precio fijo" },
  { value: "carga_retorno", label: "Carga de retorno" },
  { value: "por_acordar", label: "Por acordar" },
];

const PAYMENT_OPTIONS = [
  { value: "por_acordar", label: "Por acordar" },
  { value: "efectivo", label: "Efectivo" },
  { value: "transferencia", label: "Transferencia" },
  { value: "pago_anticipado", label: "Pago anticipado" },
  { value: "contra_entrega", label: "Contra entrega" },
  { value: "credito", label: "Crédito" },
];

const formatCOP = (value) => {
  const number = Number(value) || 0;

  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(number);
};

const getSuggestedVehicle = (weightKg) => {
  const weight = Number(weightKg) || 0;

  if (weight <= 0) {
    return {
      vehicle: "Ingresa el peso",
      capacity: 0,
    };
  }

  if (weight <= 120) {
    return {
      vehicle: "Moto",
      capacity: 150,
    };
  }

  if (weight <= 500) {
    return {
      vehicle: "Motocarro o carro de carga",
      capacity: 600,
    };
  }

  if (weight <= 1200) {
    return {
      vehicle: "Camioneta",
      capacity: 1400,
    };
  }

  if (weight <= 2500) {
    return {
      vehicle: "Camión ultraliviano",
      capacity: 2800,
    };
  }

  if (weight <= 4500) {
    return {
      vehicle: "Camión liviano",
      capacity: 5000,
    };
  }

  if (weight <= 8000) {
    return {
      vehicle: "Camión mediano",
      capacity: 9000,
    };
  }

  if (weight <= 12000) {
    return {
      vehicle: "Camión sencillo",
      capacity: 13000,
    };
  }

  if (weight <= 20000) {
    return {
      vehicle: "Doble troque",
      capacity: 22000,
    };
  }

  return {
    vehicle: "Tractomula",
    capacity: 35000,
  };
};

const CreateLoadOffer = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const [form, setForm] = useState({
    title: "",
    cargoType: "",
    weight: "",
    weightUnit: "kg",
    volumeM3: "",
    lengthMeters: "",
    widthMeters: "",
    heightMeters: "",
    packageQuantity: "",
    packageUnit: "cajas",
    palletCount: "",
    origin: "",
    originCity: "",
    originDepartment: "",
    destination: "",
    destinationCity: "",
    destinationDepartment: "",
    pickupTime: "",
    deliveryDeadline: "",
    pickupIsFlexible: false,
    requiredVehicleType: "",
    requiredBodyType: "no_especificada",
    requiresRefrigeration: false,
    isFragile: false,
    isHazardous: false,
    requiresTarp: false,
    requiresLoading: false,
    requiresUnloading: false,
    requiresAssistant: false,
    loadingIncludedInPrice: false,
    unloadingIncludedInPrice: false,
    priceMode: "recibir_ofertas",
    suggestedPrice: "",
    isNegotiable: true,
    paymentMethod: "por_acordar",
    paymentTermDays: "",
    includesTolls: true,
    includesFuel: true,
    description: "",
    notes: "",
    contactInstructions: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const weightKg = useMemo(() => {
    const weight = Number(form.weight) || 0;

    return form.weightUnit === "toneladas"
      ? weight * 1000
      : weight;
  }, [form.weight, form.weightUnit]);

  const suggestion = useMemo(() => {
    return getSuggestedVehicle(weightKg);
  }, [weightKg]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const validateForm = () => {
    if (!token) {
      return "Debes iniciar sesión para publicar una carga.";
    }

    if (form.title.trim().length < 3) {
      return "Escribe un título de mínimo 3 caracteres.";
    }

    if (form.cargoType.trim().length < 2) {
      return "Indica el tipo de carga.";
    }

    if (!Number.isFinite(Number(form.weight)) || Number(form.weight) <= 0) {
      return "El peso debe ser mayor que cero.";
    }

    if (form.origin.trim().length < 3) {
      return "Escribe un origen válido.";
    }

    if (form.destination.trim().length < 3) {
      return "Escribe un destino válido.";
    }

    if (!form.pickupTime) {
      return "Selecciona la fecha de recogida.";
    }

    const pickup = new Date(form.pickupTime).getTime();

    if (!Number.isFinite(pickup)) {
      return "La fecha de recogida no es válida.";
    }

    if (form.deliveryDeadline) {
      const delivery = new Date(form.deliveryDeadline).getTime();

      if (delivery < pickup) {
        return "La entrega límite no puede ser anterior a la recogida.";
      }
    }

    if (
      form.priceMode === "precio_fijo" &&
      Number(form.suggestedPrice) <= 0
    ) {
      return "Ingresa un precio mayor que cero.";
    }

    return "";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setMessage("");
    setIsError(false);

    const validation = validateForm();

    if (validation) {
      setMessage(validation);
      setIsError(true);
      return;
    }

    try {
      setSubmitting(true);

      await axios.post(
        `${getApiBaseUrl()}/offers/space/create`,
        {
          title: form.title.trim(),
          cargoType: form.cargoType.trim(),
          weight: Number(form.weight),
          weightUnit: form.weightUnit,
          volumeM3: form.volumeM3
            ? Number(form.volumeM3)
            : 0,
          lengthMeters: form.lengthMeters
            ? Number(form.lengthMeters)
            : 0,
          widthMeters: form.widthMeters
            ? Number(form.widthMeters)
            : 0,
          heightMeters: form.heightMeters
            ? Number(form.heightMeters)
            : 0,
          packageQuantity: form.packageQuantity
            ? Number(form.packageQuantity)
            : 0,
          packageUnit: form.packageUnit,
          palletCount: form.palletCount
            ? Number(form.palletCount)
            : 0,
          origin: form.origin.trim(),
          originCity: form.originCity.trim(),
          originDepartment: form.originDepartment.trim(),
          destination: form.destination.trim(),
          destinationCity: form.destinationCity.trim(),
          destinationDepartment: form.destinationDepartment.trim(),
          stops: [],
          pickupTime: new Date(form.pickupTime).toISOString(),
          deliveryDeadline: form.deliveryDeadline
            ? new Date(form.deliveryDeadline).toISOString()
            : null,
          pickupIsFlexible: form.pickupIsFlexible,
          requiredVehicleType:
            form.requiredVehicleType || null,
          requiredBodyType: form.requiredBodyType,
          vehicleSuggestionOverridden: Boolean(
            form.requiredVehicleType
          ),
          requiresRefrigeration: form.requiresRefrigeration,
          isFragile: form.isFragile,
          isHazardous: form.isHazardous,
          requiresTarp: form.requiresTarp,
          requiresLoading: form.requiresLoading,
          requiresUnloading: form.requiresUnloading,
          requiresAssistant: form.requiresAssistant,
          loadingIncludedInPrice:
            form.loadingIncludedInPrice,
          unloadingIncludedInPrice:
            form.unloadingIncludedInPrice,
          priceMode: form.priceMode,
          suggestedPrice: form.suggestedPrice
            ? Number(form.suggestedPrice)
            : 0,
          isNegotiable: form.isNegotiable,
          paymentMethod: form.paymentMethod,
          paymentTermDays: form.paymentTermDays
            ? Number(form.paymentTermDays)
            : 0,
          includesTolls: form.includesTolls,
          includesFuel: form.includesFuel,
          description: form.description.trim(),
          notes: form.notes.trim(),
          contactInstructions:
            form.contactInstructions.trim(),
          photos: [],
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setMessage("Carga publicada correctamente.");
      setIsError(false);

      setTimeout(() => {
        navigate("/my-load-offers");
      }, 800);
    } catch (error) {
      console.error("Error publicando carga:", error);

      const apiErrors = error?.response?.data?.errors;

      setMessage(
        Array.isArray(apiErrors) && apiErrors.length > 0
          ? apiErrors[0]?.msg
          : error?.response?.data?.message ||
              "No se pudo publicar la carga."
      );

      setIsError(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-gray-100 to-slate-200">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-xl border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-3">
          <Link
            to="/available-offers"
            className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center shadow-lg"
          >
            <i className="ri-arrow-left-line text-xl" />
          </Link>

          <div>
            <h1 className="text-lg font-black text-gray-950">
              Publicar carga
            </h1>

            <p className="text-xs text-gray-600">
              Recibe propuestas de transportadores
            </p>
          </div>
        </div>
      </header>

      <main className="p-4 pb-10">
        <section className="rounded-[28px] bg-gradient-to-r from-blue-700 via-cyan-600 to-sky-500 text-white p-5 shadow-xl">
          <p className="text-xs font-black uppercase tracking-wider text-white/70">
            Marketplace logístico
          </p>

          <h2 className="text-2xl font-black mt-1">
            Describe la carga
          </h2>

          <p className="text-sm text-white/85 mt-2">
            El sistema sugerirá un vehículo según el peso y los
            transportadores podrán enviarte sus propuestas.
          </p>
        </section>

        <form
          onSubmit={handleSubmit}
          className="mt-4 space-y-4"
        >
          <section className="rounded-[26px] bg-white border border-gray-200 p-4 shadow-sm space-y-4">
            <div>
              <h3 className="font-black text-gray-950">
                Información principal
              </h3>
              <p className="text-xs text-gray-500">
                Datos básicos de la carga
              </p>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                Título
              </label>

              <input
                type="text"
                name="title"
                value={form.title}
                onChange={handleChange}
                placeholder="Ej: 20 cajas de alimentos"
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                Tipo de carga
              </label>

              <input
                type="text"
                name="cargoType"
                value={form.cargoType}
                onChange={handleChange}
                placeholder="Ej: Alimentos, muebles, materiales..."
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Peso
                </label>

                <input
                  type="number"
                  name="weight"
                  value={form.weight}
                  onChange={handleChange}
                  min="0.01"
                  step="any"
                  placeholder="Ej: 1000"
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Unidad
                </label>

                <select
                  name="weightUnit"
                  value={form.weightUnit}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 bg-white outline-none"
                >
                  <option value="kg">kg</option>
                  <option value="toneladas">
                    Toneladas
                  </option>
                </select>
              </div>
            </div>

            <div className="rounded-2xl bg-blue-50 border border-blue-200 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-blue-700">
                Sugerencia automática
              </p>

              <p className="text-lg font-black text-blue-900 mt-1">
                {suggestion.vehicle}
              </p>

              {suggestion.capacity > 0 ? (
                <p className="text-sm text-blue-700 mt-1">
                  Capacidad recomendada:{" "}
                  {suggestion.capacity.toLocaleString("es-CO")} kg
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Cantidad de empaques
                </label>

                <input
                  type="number"
                  name="packageQuantity"
                  value={form.packageQuantity}
                  onChange={handleChange}
                  min="0"
                  placeholder="Ej: 20"
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Tipo de empaque
                </label>

                <select
                  name="packageUnit"
                  value={form.packageUnit}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 bg-white outline-none"
                >
                  {PACKAGE_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                Número de estibas
              </label>

              <input
                type="number"
                name="palletCount"
                value={form.palletCount}
                onChange={handleChange}
                min="0"
                placeholder="Opcional"
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                name="volumeM3"
                value={form.volumeM3}
                onChange={handleChange}
                min="0"
                step="any"
                placeholder="Volumen m³"
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none"
              />

              <input
                type="number"
                name="lengthMeters"
                value={form.lengthMeters}
                onChange={handleChange}
                min="0"
                step="any"
                placeholder="Largo en metros"
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                name="widthMeters"
                value={form.widthMeters}
                onChange={handleChange}
                min="0"
                step="any"
                placeholder="Ancho en metros"
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none"
              />

              <input
                type="number"
                name="heightMeters"
                value={form.heightMeters}
                onChange={handleChange}
                min="0"
                step="any"
                placeholder="Alto en metros"
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none"
              />
            </div>
          </section>

          <section className="rounded-[26px] bg-white border border-gray-200 p-4 shadow-sm space-y-4">
            <div>
              <h3 className="font-black text-gray-950">
                Ruta
              </h3>
              <p className="text-xs text-gray-500">
                Origen, destino y fechas
              </p>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                Origen
              </label>

              <input
                type="text"
                name="origin"
                value={form.origin}
                onChange={handleChange}
                placeholder="Dirección o lugar de recogida"
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                name="originCity"
                value={form.originCity}
                onChange={handleChange}
                placeholder="Ciudad de origen"
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none"
              />

              <input
                type="text"
                name="originDepartment"
                value={form.originDepartment}
                onChange={handleChange}
                placeholder="Departamento"
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                Destino
              </label>

              <input
                type="text"
                name="destination"
                value={form.destination}
                onChange={handleChange}
                placeholder="Dirección o lugar de entrega"
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                name="destinationCity"
                value={form.destinationCity}
                onChange={handleChange}
                placeholder="Ciudad de destino"
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none"
              />

              <input
                type="text"
                name="destinationDepartment"
                value={form.destinationDepartment}
                onChange={handleChange}
                placeholder="Departamento"
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                Fecha de recogida
              </label>

              <input
                type="datetime-local"
                name="pickupTime"
                value={form.pickupTime}
                onChange={handleChange}
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                Fecha límite de entrega
              </label>

              <input
                type="datetime-local"
                name="deliveryDeadline"
                value={form.deliveryDeadline}
                onChange={handleChange}
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none"
              />
            </div>

            <label className="flex items-center gap-3 rounded-2xl bg-gray-50 border border-gray-200 px-4 py-3">
              <input
                type="checkbox"
                name="pickupIsFlexible"
                checked={form.pickupIsFlexible}
                onChange={handleChange}
                className="w-4 h-4"
              />

              <span className="text-sm font-medium text-gray-700">
                La fecha de recogida es flexible
              </span>
            </label>
          </section>

          <section className="rounded-[26px] bg-white border border-gray-200 p-4 shadow-sm space-y-4">
            <div>
              <h3 className="font-black text-gray-950">
                Vehículo y condiciones
              </h3>
              <p className="text-xs text-gray-500">
                Opcionalmente puedes exigir un tipo específico
              </p>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                Vehículo requerido
              </label>

              <select
                name="requiredVehicleType"
                value={form.requiredVehicleType}
                onChange={handleChange}
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 bg-white outline-none"
              >
                {VEHICLE_OPTIONS.map((item) => (
                  <option key={item.value || "auto"} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                Carrocería
              </label>

              <select
                name="requiredBodyType"
                value={form.requiredBodyType}
                onChange={handleChange}
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 bg-white outline-none"
              >
                {BODY_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-2xl bg-gray-50 border border-gray-200 p-4 space-y-3">
              {[
                ["requiresRefrigeration", "Requiere refrigeración"],
                ["isFragile", "Es carga frágil"],
                ["isHazardous", "Es carga peligrosa"],
                ["requiresTarp", "Requiere carpa"],
                ["requiresLoading", "Requiere servicio de cargue"],
                ["requiresUnloading", "Requiere servicio de descargue"],
                ["requiresAssistant", "Requiere ayudante"],
              ].map(([name, label]) => (
                <label
                  key={name}
                  className="flex items-center gap-3"
                >
                  <input
                    type="checkbox"
                    name={name}
                    checked={Boolean(form[name])}
                    onChange={handleChange}
                    className="w-4 h-4"
                  />

                  <span className="text-sm text-gray-700">
                    {label}
                  </span>
                </label>
              ))}
            </div>
          </section>

          <section className="rounded-[26px] bg-white border border-gray-200 p-4 shadow-sm space-y-4">
            <div>
              <h3 className="font-black text-gray-950">
                Precio y pago
              </h3>
              <p className="text-xs text-gray-500">
                Define cómo deseas recibir propuestas
              </p>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                Modalidad
              </label>

              <select
                name="priceMode"
                value={form.priceMode}
                onChange={handleChange}
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 bg-white outline-none"
              >
                {PRICE_MODE_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                Precio sugerido
              </label>

              <input
                type="number"
                name="suggestedPrice"
                value={form.suggestedPrice}
                onChange={handleChange}
                min="0"
                placeholder="Ej: 150000"
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none"
              />

              <p className="text-xs text-gray-500 mt-1">
                {form.suggestedPrice
                  ? formatCOP(form.suggestedPrice)
                  : "Puedes dejarlo vacío para recibir propuestas."}
              </p>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                Forma de pago
              </label>

              <select
                name="paymentMethod"
                value={form.paymentMethod}
                onChange={handleChange}
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 bg-white outline-none"
              >
                {PAYMENT_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            {form.paymentMethod === "credito" ? (
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Plazo de pago en días
                </label>

                <input
                  type="number"
                  name="paymentTermDays"
                  value={form.paymentTermDays}
                  onChange={handleChange}
                  min="0"
                  placeholder="Ej: 15"
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none"
                />
              </div>
            ) : null}

            <label className="flex items-center gap-3 rounded-2xl bg-gray-50 border border-gray-200 px-4 py-3">
              <input
                type="checkbox"
                name="isNegotiable"
                checked={form.isNegotiable}
                onChange={handleChange}
                className="w-4 h-4"
              />

              <span className="text-sm text-gray-700">
                Permitir negociación
              </span>
            </label>

            <label className="flex items-center gap-3 rounded-2xl bg-gray-50 border border-gray-200 px-4 py-3">
              <input
                type="checkbox"
                name="includesTolls"
                checked={form.includesTolls}
                onChange={handleChange}
                className="w-4 h-4"
              />

              <span className="text-sm text-gray-700">
                El valor incluye peajes
              </span>
            </label>

            <label className="flex items-center gap-3 rounded-2xl bg-gray-50 border border-gray-200 px-4 py-3">
              <input
                type="checkbox"
                name="includesFuel"
                checked={form.includesFuel}
                onChange={handleChange}
                className="w-4 h-4"
              />

              <span className="text-sm text-gray-700">
                El valor incluye combustible
              </span>
            </label>
          </section>

          <section className="rounded-[26px] bg-white border border-gray-200 p-4 shadow-sm space-y-4">
            <div>
              <h3 className="font-black text-gray-950">
                Detalles adicionales
              </h3>
            </div>

            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={4}
              maxLength={2000}
              placeholder="Descripción de la carga"
              className="w-full rounded-2xl border border-gray-200 px-4 py-3 resize-none outline-none"
            />

            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              rows={3}
              maxLength={2000}
              placeholder="Notas adicionales"
              className="w-full rounded-2xl border border-gray-200 px-4 py-3 resize-none outline-none"
            />

            <textarea
              name="contactInstructions"
              value={form.contactInstructions}
              onChange={handleChange}
              rows={3}
              maxLength={1000}
              placeholder="Instrucciones de contacto o acceso"
              className="w-full rounded-2xl border border-gray-200 px-4 py-3 resize-none outline-none"
            />
          </section>

          {message ? (
            <div
              className={`rounded-2xl border p-4 text-sm font-bold ${
                isError
                  ? "bg-red-50 border-red-200 text-red-700"
                  : "bg-emerald-50 border-emerald-200 text-emerald-700"
              }`}
            >
              {message}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-2xl bg-blue-600 text-white py-4 text-base font-black shadow-lg shadow-blue-600/20 disabled:opacity-60"
          >
            {submitting
              ? "Publicando carga..."
              : "Publicar carga"}
          </button>
        </form>
      </main>
    </div>
  );
};

export default CreateLoadOffer;