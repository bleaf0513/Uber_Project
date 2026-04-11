import React from "react";

const VEHICLE_META = {
  motorcycle: {
    label: "Moto",
    image: "moto",
    description: "Rápida y económica",
    minFactor: 0.85,
  },
  car: {
    label: "Carro",
    image: "car",
    description: "Cómodo y espacioso",
    minFactor: 0.85,
  },
  light_cargo: {
    label: "Carga liviana",
    image: "auto",
    description: "Ideal para paquetes y carga pequeña",
    minFactor: 0.85,
  },
  van: {
    label: "Furgón / Camioneta",
    image: "van",
    description: "Más espacio para mercancía y mudanzas pequeñas",
    minFactor: 0.9,
  },
  truck: {
    label: "Camión",
    image: "truck",
    description: "Para carga pesada y trayectos logísticos",
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

  const parseCurrencyInput = (value) => {
    const cleaned = String(value || "").replace(/[^\d]/g, "");
    return Number(cleaned || 0);
  };

  const { firstPart, secondPart } = formatAddress(props.pickup);
  const { firstPart: destFirstPart, secondPart: destSecondPart } =
    formatAddress(props.destination);

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

  const handleConfirm = () => {
    props.setVehicleFound(true);
    props.setConfirmRidePanel(false);
    props.createRide(offerPrice);
  };

  const isOfferBelowMin = offerPrice < minOffer;

  return (
    <div>
      <div className="flex flex-col justify-center items-center py-3 px-4">
        <p className="inline-flex items-center rounded-full bg-gray-100 text-gray-700 px-4 py-2 text-sm font-semibold mb-3">
          Confirmación del servicio
        </p>

        <h2 className="text-2xl font-semibold text-center">{firstPart}</h2>

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

      <div className="flex justify-center items-center px-4">
        <div className="w-full max-w-sm bg-gray-50 border border-gray-200 rounded-3xl p-4 flex flex-col items-center">
          <img
            style={{ width: "56%" }}
            className="mb-3"
            src={vehicleImg}
            alt={selectedVehicle.label}
          />

          <h3 className="text-xl font-bold text-gray-900">
            {selectedVehicle.label}
          </h3>
          <p className="text-sm text-gray-600 mt-1 text-center">
            {selectedVehicle.description}
          </p>
        </div>
      </div>

      <div className="flex flex-col justify-start items-start mx-3 mt-4">
        <div
          className="my-2"
          style={{ height: "2px", width: "100%", background: "#D6D6D6" }}
        ></div>

        <div className="flex flex-row justify-start w-full ml-2">
          <div className="flex items-center justify-center w-[20%]">
            <i className="ri-map-pin-range-fill ri-xl"></i>
          </div>

          <div className="flex flex-col justify-start items-start w-full mr-5">
            <h2 className="text-xl font-semibold">{firstPart}</h2>
            <h4 className="text-sm pr-2 text-gray-600">
              {secondPart.length > 60
                ? `${secondPart.substring(0, 60)}...`
                : secondPart}
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
            <h2 className="text-xl font-semibold">{destFirstPart}</h2>
            <h4 className="text-sm pr-2 text-gray-600">
              {destSecondPart.length > 60
                ? `${destSecondPart.substring(0, 60)}...`
                : destSecondPart}
            </h4>
            <div
              className="my-2"
              style={{ height: "2px", width: "100%", background: "#D6D6D6" }}
            ></div>
          </div>
        </div>

        <div className="flex flex-row justify-start w-full ml-2">
          <div className="flex items-center justify-center w-[20%]">
            <i className="ri-truck-fill"></i>
          </div>

          <div className="flex flex-col justify-start items-start w-full mr-5">
            <h2 className="text-xl font-semibold">{selectedVehicle.label}</h2>
            <h4 className="text-sm text-gray-600">
              Tipo de servicio seleccionado
            </h4>
            <div
              className="my-2"
              style={{ height: "2px", width: "100%", background: "#D6D6D6" }}
            ></div>
          </div>
        </div>

        <div className="w-full px-2 py-2">
          <div className="bg-gray-50 border border-gray-200 rounded-3xl p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-gray-500">Tarifa sugerida</p>
                <h3 className="text-2xl font-bold text-gray-900">
                  {formatCOP(suggestedPrice)}
                </h3>
              </div>

              <div className="text-right">
                <p className="text-sm text-gray-500">Mínimo permitido</p>
                <h4 className="text-lg font-semibold text-gray-800">
                  {formatCOP(minOffer)}
                </h4>
              </div>
            </div>

            <div className="mt-4">
              <p className="text-sm font-semibold text-gray-700 mb-2">
                Tu oferta
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDecrease}
                  className="w-12 h-12 rounded-2xl bg-gray-200 text-xl font-bold"
                >
                  -
                </button>

                <input
                  value={offerPrice ? String(offerPrice) : ""}
                  onChange={handleChangeOffer}
                  onBlur={handleBlurOffer}
                  inputMode="numeric"
                  className="flex-1 h-12 rounded-2xl border border-gray-200 px-4 text-center text-lg font-semibold outline-none focus:ring-2 focus:ring-black"
                  placeholder="Ingresa tu oferta"
                />

                <button
                  type="button"
                  onClick={handleIncrease}
                  className="w-12 h-12 rounded-2xl bg-gray-200 text-xl font-bold"
                >
                  +
                </button>
              </div>

              <div className="flex gap-2 mt-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => applyOffer(offerPrice + step)}
                  className="px-3 py-2 rounded-2xl bg-gray-100 text-sm font-semibold"
                >
                  +{formatCOP(step)}
                </button>
                <button
                  type="button"
                  onClick={() => applyOffer(offerPrice + step * 2)}
                  className="px-3 py-2 rounded-2xl bg-gray-100 text-sm font-semibold"
                >
                  +{formatCOP(step * 2)}
                </button>
                <button
                  type="button"
                  onClick={() => applyOffer(suggestedPrice)}
                  className="px-3 py-2 rounded-2xl bg-black text-white text-sm font-semibold"
                >
                  Usar sugerida
                </button>
              </div>

              {isOfferBelowMin ? (
                <p className="text-sm text-red-600 mt-3">
                  La oferta no puede ser menor a {formatCOP(minOffer)}.
                </p>
              ) : (
                <p className="text-sm text-gray-500 mt-3">
                  Puedes negociar el valor antes de enviar la solicitud.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center mt-4 px-4">
        <button
          onClick={handleConfirm}
          disabled={isOfferBelowMin || !offerPrice}
          className="bg-black text-white text-xl rounded-2xl mb-5 py-3 px-6 w-full max-w-sm disabled:opacity-50"
        >
          Confirmar servicio
        </button>
      </div>
    </div>
  );
};

export default ConfirmedRide;
