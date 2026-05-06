import React from "react";

const VEHICLE_META = {
  motorcycle: {
    label: "Moto",
    image: "moto",
    description: "Rápida y económica",
    icon: "ri-motorbike-fill",
    minFactor: 0.85,
  },
  car: {
    label: "Carro",
    image: "car",
    description: "Cómodo y espacioso",
    icon: "ri-car-fill",
    minFactor: 0.85,
  },
  light_cargo: {
    label: "Carga liviana",
    image: "auto",
    description: "Ideal para paquetes y carga pequeña",
    icon: "ri-box-3-fill",
    minFactor: 0.85,
  },
  van: {
    label: "Furgón / Camioneta",
    image: "van",
    description: "Más espacio para mercancía",
    icon: "ri-truck-fill",
    minFactor: 0.9,
  },
  truck: {
    label: "Camión",
    image: "truck",
    description: "Para carga pesada y trayectos logísticos",
    icon: "ri-truck-fill",
    minFactor: 0.9,
  },
};

const OFFER_STEP_BY_VEHICLE = {
  motorcycle: 500,
  car: 1000,
  light_cargo: 1000,
  van: 2000,
  truck: 5000,
};

const ConfirmedRide = (props) => {
  const [submitting, setSubmitting] = React.useState(false);

  const formatAddress = (address = "") => {
    const clean = String(address || "").trim();
    const firstCommaIndex = clean.indexOf(",");

    if (firstCommaIndex === -1) {
      return { firstPart: clean, secondPart: "" };
    }

    const firstPart = clean.substring(0, firstCommaIndex);
    const secondPart = clean.substring(firstCommaIndex + 1).trim();

    return { firstPart, secondPart };
  };

  const formatShortAddress = (address = "", limit = 52) => {
    const clean = String(address || "").trim();

    if (clean.length <= limit) return clean;

    return `${clean.substring(0, limit)}...`;
  };

  const formatCOP = (value) => {
    const number = Number(value) || 0;

    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(Math.ceil(number));
  };

  const parseCurrencyInput = (value) => {
    const cleaned = String(value || "").replace(/[^\d]/g, "");
    return Number(cleaned || 0);
  };

  const selectedVehicleKey = VEHICLE_META[props.selectedVehicle]
    ? props.selectedVehicle
    : "car";

  const selectedVehicle = VEHICLE_META[selectedVehicleKey];

  const vehicleImg = `${import.meta.env.BASE_URL}vehicles/${selectedVehicle.image}.png`;

  const suggestedPrice = Number(props.selectedPrice) || 0;
  const step = OFFER_STEP_BY_VEHICLE[selectedVehicleKey] || 1000;

  const minOffer = Math.max(
    step,
    Math.ceil(suggestedPrice * (selectedVehicle.minFactor || 0.85))
  );

  const [offerPrice, setOfferPrice] = React.useState(suggestedPrice);

  React.useEffect(() => {
    setOfferPrice(suggestedPrice);
  }, [suggestedPrice, selectedVehicleKey]);

  const { firstPart, secondPart } = formatAddress(props.pickup);
  const { firstPart: destFirstPart, secondPart: destSecondPart } =
    formatAddress(props.destination);

  const routeStops = Array.isArray(props.routeStops)
    ? props.routeStops.filter(Boolean)
    : [];

  const applyOffer = (nextValue) => {
    const normalized = Math.max(minOffer, Math.ceil(Number(nextValue) || 0));
    setOfferPrice(normalized);
  };

  const handleDecrease = () => {
    applyOffer(offerPrice - step);
  };

  const handleIncrease = () => {
    applyOffer(offerPrice + step);
  };

  const handleChangeOffer = (e) => {
    const parsed = parseCurrencyInput(e.target.value);
    setOfferPrice(parsed);
  };

  const handleBlurOffer = () => {
    applyOffer(offerPrice);
  };

  const handleBack = () => {
    props.setConfirmRidePanel(false);

    if (typeof props.setVehiclePanel === "function") {
      props.setVehiclePanel(true);
    }
  };

  const handleConfirm = async () => {
    try {
      setSubmitting(true);

      await props.createRide(offerPrice);

      props.setConfirmRidePanel(false);
      props.setVehicleFound(true);
    } catch (error) {
      console.error("Error confirmando servicio:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const isOfferBelowMin = offerPrice < minOffer;

  return (
    <div className="bg-[#f7f3fb] rounded-t-[28px] overflow-hidden max-h-[86vh] flex flex-col">
      <div className="sticky top-0 z-20 bg-[#f7f3fb]/95 backdrop-blur border-b border-purple-100">
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-12 h-1.5 rounded-full bg-purple-200"></div>
        </div>

        <div className="px-4 pb-3 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleBack}
            disabled={submitting}
            className="w-11 h-11 rounded-full bg-white shadow-sm border border-purple-100 flex items-center justify-center disabled:opacity-60"
            aria-label="Volver"
          >
            <i className="ri-arrow-left-line text-2xl text-purple-900"></i>
          </button>

          <div className="text-center min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-purple-700">
              Confirmar servicio
            </p>
            <h2 className="text-xl font-black text-gray-950 leading-tight truncate">
              {selectedVehicle.label}
            </h2>
          </div>

          <button
            type="button"
            onClick={() => props.setConfirmRidePanel(false)}
            disabled={submitting}
            className="w-11 h-11 rounded-full bg-white shadow-sm border border-purple-100 flex items-center justify-center disabled:opacity-60"
            aria-label="Cerrar"
          >
            <i className="ri-close-line text-2xl text-purple-900"></i>
          </button>
        </div>
      </div>

      <div className="overflow-y-auto px-4 pt-4 pb-5">
        <div className="relative rounded-[26px] overflow-hidden bg-gradient-to-br from-purple-700 via-purple-800 to-purple-950 shadow-[0_16px_36px_rgba(76,29,149,0.28)]">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_20%_20%,white,transparent_30%),radial-gradient(circle_at_80%_30%,white,transparent_20%)]"></div>

          <div className="relative p-4 flex items-center gap-3">
            <div className="w-[112px] h-[86px] rounded-3xl bg-white/95 shadow-lg flex items-center justify-center overflow-hidden shrink-0">
              <img
                src={vehicleImg}
                alt={selectedVehicle.label}
                className="w-full h-full object-contain p-2"
                loading="lazy"
                decoding="async"
              />
            </div>

            <div className="min-w-0 flex-1 text-white">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-black">
                <i className={`${selectedVehicle.icon} text-sm`}></i>
                Servicio seleccionado
              </div>

              <h3 className="text-2xl font-black mt-2 leading-tight">
                {selectedVehicle.label}
              </h3>

              <p className="text-sm text-white/80 mt-1 leading-snug">
                {selectedVehicle.description}
              </p>

              <p className="text-xs text-white/70 mt-2">
                Puedes ajustar tu oferta antes de enviarla.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-[24px] bg-white border border-purple-100 shadow-[0_10px_28px_rgba(15,23,42,0.06)] overflow-hidden">
          <div className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-50 flex items-center justify-center shrink-0">
                <i className="ri-map-pin-user-fill text-xl text-purple-800"></i>
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-gray-400">
                  Recogida
                </p>
                <p className="text-base font-black text-gray-950 truncate">
                  {firstPart || "Punto de recogida"}
                </p>
                {secondPart ? (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {formatShortAddress(secondPart)}
                  </p>
                ) : null}
              </div>
            </div>

            {routeStops.length > 0 && (
              <div className="mt-3 pl-5 border-l-2 border-dashed border-purple-200 space-y-2">
                {routeStops.map((stop, index) => (
                  <div key={`${stop}-${index}`} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-900 flex items-center justify-center text-xs font-black shrink-0">
                      {index + 1}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-purple-700">
                        Parada {index + 1}
                      </p>
                      <p className="text-sm font-bold text-gray-900 truncate">
                        {stop}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gray-100 flex items-center justify-center shrink-0">
                <i className="ri-flag-2-fill text-xl text-gray-900"></i>
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-gray-400">
                  Destino
                </p>
                <p className="text-base font-black text-gray-950 truncate">
                  {destFirstPart || "Destino"}
                </p>
                {destSecondPart ? (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {formatShortAddress(destSecondPart)}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-[26px] bg-white border border-purple-100 shadow-[0_10px_28px_rgba(15,23,42,0.06)] overflow-hidden">
          <div className="p-4 bg-gradient-to-r from-purple-50 to-white border-b border-purple-100">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.12em] text-purple-700">
                  Tarifa sugerida
                </p>
                <h3 className="text-2xl font-black text-gray-950 mt-1">
                  {formatCOP(suggestedPrice)}
                </h3>
              </div>

              <div className="text-right">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-gray-400">
                  Mínimo
                </p>
                <h4 className="text-xl font-black text-gray-800 mt-1">
                  {formatCOP(minOffer)}
                </h4>
              </div>
            </div>
          </div>

          <div className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-base font-black text-gray-950">Tu oferta</p>
                <p className="text-xs text-gray-500">
                  Ajusta el valor para negociar con conductores.
                </p>
              </div>

              <button
                type="button"
                onClick={() => applyOffer(suggestedPrice)}
                disabled={submitting}
                className="rounded-full bg-purple-50 text-purple-900 px-3 py-2 text-xs font-black border border-purple-100 disabled:opacity-60"
              >
                Sugerida
              </button>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={handleDecrease}
                disabled={submitting}
                className="w-11 h-11 rounded-2xl bg-gray-100 border border-gray-200 text-2xl font-black text-gray-900 disabled:opacity-50"
              >
                -
              </button>

              <div className="flex-1 h-12 rounded-2xl bg-[#f8f5fc] border border-purple-100 flex items-center px-3">
                <span className="text-lg font-black text-purple-800 mr-1">$</span>

                <input
                  value={offerPrice ? String(offerPrice) : ""}
                  onChange={handleChangeOffer}
                  onBlur={handleBlurOffer}
                  inputMode="numeric"
                  disabled={submitting}
                  className="w-full bg-transparent text-center text-xl font-black text-gray-950 outline-none disabled:opacity-50"
                  placeholder="0"
                />
              </div>

              <button
                type="button"
                onClick={handleIncrease}
                disabled={submitting}
                className="w-11 h-11 rounded-2xl bg-purple-700 text-white text-2xl font-black shadow-lg disabled:opacity-50"
              >
                +
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-3">
              <button
                type="button"
                onClick={() => applyOffer(offerPrice + step)}
                disabled={submitting}
                className="rounded-2xl bg-gray-100 text-gray-900 py-2.5 text-sm font-black disabled:opacity-50"
              >
                +{formatCOP(step)}
              </button>

              <button
                type="button"
                onClick={() => applyOffer(offerPrice + step * 2)}
                disabled={submitting}
                className="rounded-2xl bg-gray-100 text-gray-900 py-2.5 text-sm font-black disabled:opacity-50"
              >
                +{formatCOP(step * 2)}
              </button>
            </div>

            {isOfferBelowMin ? (
              <div className="mt-3 rounded-2xl bg-red-50 border border-red-100 px-3 py-2">
                <p className="text-xs font-bold text-red-700">
                  La oferta no puede ser menor a {formatCOP(minOffer)}.
                </p>
              </div>
            ) : (
              <div className="mt-3 rounded-2xl bg-purple-50 border border-purple-100 px-3 py-2">
                <p className="text-xs font-semibold text-purple-900">
                  Los conductores podrán aceptar tu oferta o enviarte una contraoferta.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 z-20 bg-white border-t border-purple-100 px-4 py-3">
        <button
          onClick={handleConfirm}
          disabled={isOfferBelowMin || !offerPrice || submitting}
          className="w-full rounded-[22px] bg-gradient-to-r from-purple-700 via-purple-800 to-purple-950 text-white text-lg font-black py-4 shadow-[0_12px_28px_rgba(76,29,149,0.30)] disabled:opacity-50"
        >
          {submitting ? "Enviando solicitud..." : "Confirmar servicio"}
        </button>
      </div>
    </div>
  );
};

export default ConfirmedRide;