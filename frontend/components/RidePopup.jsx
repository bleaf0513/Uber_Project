import React, { useState } from "react";

const VEHICLE_META = {
  motorcycle: {
    label: "Moto",
    description: "Servicio rápido y económico",
    icon: "ri-motorbike-fill",
  },
  car: {
    label: "Carro",
    description: "Servicio cómodo y espacioso",
    icon: "ri-taxi-fill",
  },
  light_cargo: {
    label: "Carga liviana",
    description: "Ideal para paquetes y carga pequeña",
    icon: "ri-box-3-fill",
  },
  van: {
    label: "Furgón / Camioneta",
    description: "Más espacio para mercancía y mudanzas pequeñas",
    icon: "ri-truck-fill",
  },
  truck: {
    label: "Camión",
    description: "Servicio para carga pesada y trayectos logísticos",
    icon: "ri-truck-fill",
  },
};

const RidePopup = (props) => {
  const [showCounterOffer, setShowCounterOffer] = useState(false);
  const [counterValue, setCounterValue] = useState("");
  const [counterMessage, setCounterMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const formatAddress = (address = "") => {
    const firstCommaIndex = address.indexOf(",");

    if (firstCommaIndex === -1) {
      return { firstPart: address, secondPart: "" };
    }

    const firstPart = address.substring(0, firstCommaIndex);
    const secondPart = address.substring(firstCommaIndex + 1).trim();

    return { firstPart, secondPart };
  };

  const formatCOP = (value) => {
    const number = Number(value) || 0;
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(Math.ceil(number));
  };

  const parseMoney = (value) => {
    const clean = String(value || "").replace(/[^\d]/g, "");
    return Number(clean || 0);
  };

  const handleMoneyChange = (e) => {
    const raw = e.target.value;
    const numeric = parseMoney(raw);

    if (!numeric) {
      setCounterValue("");
      return;
    }

    setCounterValue(
      new Intl.NumberFormat("es-CO", {
        maximumFractionDigits: 0,
      }).format(numeric)
    );
  };

  const numericCounterValue = parseMoney(counterValue);
  const isCounterValid = numericCounterValue > 0;

  if (!props.ride) {
    return (
      <div className="p-6 text-center text-gray-600">
        Cargando servicio...
      </div>
    );
  }

  const pickupAd = props.ride?.pickup || "";
  const destinationAd = props.ride?.destination || "";
  const fare = props.ride?.offeredFare ?? props.ride?.fare ?? 0;
  const vehicleType = props.ride?.vehicleType || props.ride?.vehicle || "car";

  const vehicleInfo = VEHICLE_META[vehicleType] || VEHICLE_META.car;

  const { firstPart: pickupMain, secondPart: pickupDetail } =
    formatAddress(pickupAd);

  const { firstPart: destinationMain, secondPart: destinationDetail } =
    formatAddress(destinationAd);

  const handleAccept = async () => {
    try {
      setSubmitting(true);
      await props.confirmRide?.();
    } finally {
      setSubmitting(false);
    }
  };

  const handleIgnore = () => {
    setShowCounterOffer(false);
    setCounterValue("");
    setCounterMessage("");
    props.onIgnoreRide?.();
    props.setRidePopup?.(false);
  };

  const handleCounterOffer = async () => {
    if (!isCounterValid) {
      alert("Ingresa un valor válido para la contraoferta.");
      return;
    }

    if (!props.onCounterOffer) {
      alert("La función de contraoferta aún no está conectada.");
      return;
    }

    try {
      setSubmitting(true);

      await props.onCounterOffer({
        ride: props.ride,
        value: numericCounterValue,
        message: counterMessage || "Contraoferta del conductor.",
      });

      setShowCounterOffer(false);
      setCounterValue("");
      setCounterMessage("");
    } catch (error) {
      console.error("[RidePopup] error enviando contraoferta:", error);
      alert(
        error?.response?.data?.message ||
          "No se pudo enviar la contraoferta."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-t-[24px]">
      <div className="flex flex-col justify-center items-center py-4 px-4">
        <p className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 px-4 py-2 text-sm font-semibold mb-3">
          Nueva solicitud disponible
        </p>

        <h2 className="text-2xl font-semibold text-center">
          Nuevo servicio disponible
        </h2>

        <div
          className="mt-3"
          style={{
            background: "linear-gradient(to right, #00dbde, #fc00ff)",
            height: "3px",
            width: "80%",
            borderRadius: "50px",
            clipPath: "polygon(0% 100%, 0% 55%, 55% 0%, 100% 55%, 100% 100%)",
          }}
        ></div>
      </div>

      <div className="mx-4 mb-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Oferta del usuario
            </p>
            <h3 className="text-2xl font-extrabold text-emerald-900">
              {formatCOP(fare)}
            </h3>
          </div>

          <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center shadow-sm">
            <i className={`${vehicleInfo.icon} text-2xl text-emerald-700`}></i>
          </div>
        </div>
      </div>

      <div className="flex flex-col justify-start items-start mx-3">
        <div className="flex flex-row justify-start w-full ml-2">
          <div className="flex items-center justify-center w-[20%]">
            <i className="ri-map-pin-range-fill ri-xl"></i>
          </div>

          <div className="flex flex-col justify-start items-start w-full mr-5">
            <h2 className="text-xl font-semibold">{pickupMain}</h2>
            <h4 className="text-sm text-gray-600">
              {pickupDetail || "Punto de recogida"}
            </h4>
            <div
              className="my-2"
              style={{ height: "2px", width: "100%", background: "#D6D6D6" }}
            ></div>
          </div>
        </div>

        <div className="flex flex-row justify-start w-full ml-2">
          <div className="flex items-center justify-center w-[20%]">
            <i className="ri-square-fill"></i>
          </div>

          <div className="flex flex-col justify-start items-start w-full mr-5">
            <h2 className="text-xl font-semibold">{destinationMain}</h2>
            <h4 className="text-sm text-gray-600">
              {destinationDetail || "Destino"}
            </h4>
            <div
              className="my-2"
              style={{ height: "2px", width: "100%", background: "#D6D6D6" }}
            ></div>
          </div>
        </div>

        <div className="flex flex-row justify-start w-full ml-2">
          <div className="flex items-center justify-center w-[20%]">
            <i className={`${vehicleInfo.icon} ri-xl`}></i>
          </div>

          <div className="flex flex-col justify-start items-start w-full mr-5">
            <h2 className="text-xl font-semibold">{vehicleInfo.label}</h2>
            <h4 className="text-sm text-gray-600">{vehicleInfo.description}</h4>
            <div
              className="my-2"
              style={{ height: "2px", width: "100%", background: "#D6D6D6" }}
            ></div>
          </div>
        </div>

        <div className="flex flex-row justify-start w-full ml-2">
          <div className="flex items-center justify-center w-[20%]">
            <i className="ri-bank-card-2-fill ri-xl"></i>
          </div>

          <div className="flex flex-col justify-start items-start w-full mr-5">
            <h2 className="text-xl font-semibold">{formatCOP(fare)}</h2>
            <h4 className="text-sm text-gray-600">Oferta actual del usuario</h4>
            <div
              className="my-2"
              style={{ height: "2px", width: "100%", background: "#D6D6D6" }}
            ></div>
          </div>
        </div>
      </div>

      <div className="px-5 pt-1">
        {!showCounterOffer ? (
          <button
            type="button"
            onClick={() => setShowCounterOffer(true)}
            disabled={submitting}
            className="w-full py-3 text-black text-base font-semibold rounded-2xl border border-gray-300 bg-white"
          >
            Contraofertar
          </button>
        ) : (
          <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
            <p className="text-sm font-semibold text-orange-800 mb-2">
              Ingresa tu contraoferta
            </p>

            <input
              type="text"
              inputMode="numeric"
              value={counterValue}
              onChange={handleMoneyChange}
              placeholder="Ej: 28.000"
              className="w-full rounded-xl border border-orange-200 bg-white px-4 py-3 text-lg font-semibold outline-none"
            />

            <textarea
              rows={3}
              value={counterMessage}
              onChange={(e) => setCounterMessage(e.target.value)}
              placeholder="Mensaje opcional para el usuario"
              className="w-full rounded-xl border border-orange-200 bg-white px-4 py-3 text-sm outline-none resize-none mt-3"
            />

            <div className="flex items-center justify-between mt-3 text-sm">
              <span className="text-gray-600">Tu valor:</span>
              <span className="font-bold text-orange-700">
                {numericCounterValue > 0
                  ? formatCOP(numericCounterValue)
                  : "$ 0"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <button
                type="button"
                onClick={() => {
                  setShowCounterOffer(false);
                  setCounterValue("");
                  setCounterMessage("");
                }}
                disabled={submitting}
                className="w-full py-3 text-gray-700 text-base font-semibold rounded-2xl border border-gray-300 bg-white"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleCounterOffer}
                disabled={submitting || !isCounterValid}
                className="w-full py-3 text-white text-base font-semibold rounded-2xl"
                style={{
                  background:
                    submitting || !isCounterValid
                      ? "#9CA3AF"
                      : "linear-gradient(to right, #f7971e, #ffd200)",
                }}
              >
                Enviar oferta
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="px-5 pt-4 pb-6 flex flex-row items-center justify-around gap-3">
        <button
          onClick={handleAccept}
          disabled={submitting}
          className="w-full py-3 text-white text-lg font-semibold rounded-2xl"
          style={{
            background: submitting
              ? "#9CA3AF"
              : "linear-gradient(to right, #1d976c, #93f9b9)",
          }}
        >
          {submitting ? "Procesando..." : "Aceptar"}
        </button>

        <button
          onClick={handleIgnore}
          disabled={submitting}
          className="w-full py-3 text-white text-lg font-semibold rounded-2xl"
          style={{
            background: "linear-gradient(to right, #cb2d3e, #ef473a)",
          }}
        >
          Ignorar
        </button>
      </div>
    </div>
  );
};

export default RidePopup;