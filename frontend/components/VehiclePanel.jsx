import React from "react";

function VehicleThumb({ name, label }) {
  const src = `${import.meta.env.BASE_URL}vehicles/${name}.png`;

  return (
    <div className="h-[92px] w-[120px] rounded-2xl bg-white shadow-sm border border-gray-100 flex items-center justify-center overflow-hidden shrink-0">
      <img
        src={src}
        alt={label}
        className="h-full w-full object-contain object-center p-2"
        loading="lazy"
        decoding="async"
        width={160}
        height={92}
      />
    </div>
  );
}

const formatDuration = (duration) => {
  const safeDuration = Number(duration) || 0;

  if (safeDuration <= 0) return "Calculando";

  const hours = Math.floor(safeDuration / 3600);
  const minutes = Math.max(1, Math.round((safeDuration % 3600) / 60));

  if (hours <= 0) return `${minutes} min`;
  return `${hours} h ${minutes} min`;
};

const formatDistance = (meters) => {
  const safeMeters = Number(meters) || 0;

  if (safeMeters <= 0) return "";

  const km = safeMeters / 1000;

  if (km >= 10) return `${km.toFixed(0)} km`;
  return `${km.toFixed(1)} km`;
};

const formatCOP = (value) => {
  const number = Number(value) || 0;

  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Math.ceil(number));
};

const normalizePrice = (...values) => {
  for (const value of values) {
    const number = Number(value);

    if (Number.isFinite(number) && number > 0) {
      return number;
    }
  }

  return 0;
};

const VehiclePanel = (props) => {
  const closePanel = () => {
    props.setVehiclePanel(false);
  };

  if (props.pricingError) {
    return (
      <div className="w-full min-h-[45vw] flex flex-col justify-center items-center gap-4 px-6 py-8 bg-white rounded-t-[28px]">
        <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
          <i className="ri-error-warning-line text-3xl text-red-600"></i>
        </div>

        <div className="text-center">
          <p className="text-lg font-black text-gray-900">
            No pudimos calcular la tarifa
          </p>
          <p className="text-sm text-red-600 mt-1">{props.pricingError}</p>
        </div>

        <button
          type="button"
          onClick={closePanel}
          className="rounded-full bg-gradient-to-r from-purple-700 to-purple-950 text-white text-sm font-bold px-6 py-3"
        >
          Volver
        </button>
      </div>
    );
  }

  if (props.distance?.status !== "OK") {
    return (
      <div className="w-full h-[70vw] flex flex-col justify-center items-center bg-white rounded-t-[28px]">
        <div role="status">
          <svg
            aria-hidden="true"
            className="w-9 h-9 text-gray-200 animate-spin fill-purple-700"
            viewBox="0 0 100 101"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
              fill="currentColor"
            />
            <path
              d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
              fill="currentFill"
            />
          </svg>
          <span className="sr-only">Cargando...</span>
        </div>

        <p className="mt-4 text-sm font-semibold text-gray-600">
          Calculando ruta y tarifas...
        </p>
      </div>
    );
  }

  const baseDuration = Number(props.distance?.duration?.value) || 0;
  const baseDistance = Number(props.distance?.distance?.value) || 0;

  const routeDurationText = formatDuration(baseDuration);
  const routeDistanceText = formatDistance(baseDistance);

  const resolvedPrices = {
    motorcycle: normalizePrice(
      props.prices?.motorcycle,
      props.prices?.moto
    ),
    car: normalizePrice(props.prices?.car),
    light_cargo: normalizePrice(
      props.prices?.light_cargo,
      props.prices?.auto
    ),
    van: normalizePrice(props.prices?.van),
    truck: normalizePrice(props.prices?.truck),
  };

  const vehicleOptions = [
    {
      key: "car",
      image: "car",
      title: "Carro",
      seats: "4",
      subtitle: "Cómodo y espacioso",
      description: "Ideal para viajes urbanos y trayectos familiares.",
      price: resolvedPrices.car,
      enabled: Number(resolvedPrices.car) > 0,
      accent: "from-purple-700 to-purple-950",
    },
    {
      key: "motorcycle",
      image: "moto",
      title: "Moto",
      seats: "1",
      subtitle: "Rápida y económica",
      description: "Buena opción para llegar más ágil en ciudad.",
      price: resolvedPrices.motorcycle,
      enabled: Number(resolvedPrices.motorcycle) > 0,
      accent: "from-violet-600 to-purple-900",
    },
    {
      key: "light_cargo",
      image: "auto",
      title: "Carga liviana",
      seats: "Carga",
      subtitle: "Paquetes y bultos pequeños",
      description: "Pensado para entregas rápidas de bajo volumen.",
      price: resolvedPrices.light_cargo,
      enabled: Number(resolvedPrices.light_cargo) > 0,
      accent: "from-purple-800 to-indigo-950",
    },
    {
      key: "van",
      image: "van",
      title: "Furgón / Camioneta",
      seats: "Carga",
      subtitle: "Más espacio para mercancía",
      description: "Útil para pedidos grandes o mudanzas pequeñas.",
      price: resolvedPrices.van,
      enabled: Number(resolvedPrices.van) > 0,
      accent: "from-purple-700 to-slate-950",
    },
    {
      key: "truck",
      image: "truck",
      title: "Camión",
      seats: "Carga",
      subtitle: "Carga pesada y logística",
      description: "Para operaciones de mayor volumen.",
      price: resolvedPrices.truck,
      enabled: Number(resolvedPrices.truck) > 0,
      accent: "from-purple-950 to-black",
    },
  ];

  const handleSelectVehicle = (vehicle) => {
    if (!vehicle.enabled) return;

    props.setSelectedVehicle(vehicle.key);
    props.setSelectedPrice(vehicle.price);
    props.setConfirmRidePanel(true);
    props.setVehiclePanel(false);
  };

  return (
    <div className="bg-white rounded-t-[28px] overflow-hidden">
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="flex justify-center pt-3 pb-2">
          <button
            type="button"
            onClick={closePanel}
            className="w-12 h-1.5 rounded-full bg-gray-300"
            aria-label="Cerrar panel"
          />
        </div>

        <div className="px-5 pb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-purple-700">
              Central Go
            </p>

            <h2 className="text-2xl font-black text-gray-950 leading-tight">
              Elige tu servicio
            </h2>

            <p className="text-sm text-gray-500 mt-1">
              {routeDurationText}
              {routeDistanceText ? ` · ${routeDistanceText}` : ""} de ruta estimada
            </p>
          </div>

          <button
            type="button"
            onClick={closePanel}
            className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center shrink-0"
            aria-label="Volver"
          >
            <i className="ri-arrow-down-s-line text-3xl text-gray-900"></i>
          </button>
        </div>
      </div>

      <div className="px-4 pt-4 pb-6 space-y-3">
        {vehicleOptions.map((vehicle) => {
          return (
            <button
              key={vehicle.key}
              type="button"
              onClick={() => handleSelectVehicle(vehicle)}
              disabled={!vehicle.enabled}
              className={`w-full text-left rounded-[24px] border transition-all ${
                vehicle.enabled
                  ? "bg-white border-gray-100 shadow-[0_10px_30px_rgba(15,23,42,0.08)] active:scale-[0.99]"
                  : "bg-gray-50 border-gray-200 opacity-60"
              }`}
            >
              <div className="p-3 flex items-center gap-4">
                <VehicleThumb name={vehicle.image} label={vehicle.title} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-xl font-black text-gray-950">
                          {vehicle.title}
                        </h3>

                        <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 text-purple-900 px-2.5 py-1 text-xs font-black">
                          <i className="ri-user-fill text-sm"></i>
                          {vehicle.seats}
                        </span>
                      </div>

                      <p className="text-sm font-semibold text-gray-600 mt-1">
                        {vehicle.subtitle}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      {vehicle.enabled ? (
                        <>
                          <p className="text-xs font-bold text-gray-400">
                            Sugerida
                          </p>
                          <p className="text-xl font-black text-gray-950">
                            {formatCOP(vehicle.price)}
                          </p>
                        </>
                      ) : (
                        <p className="text-sm font-bold text-gray-500">
                          Sin tarifa
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <i className="ri-route-line text-purple-700 text-lg"></i>
                      <span>
                        {routeDurationText}
                        {routeDistanceText ? ` · ${routeDistanceText}` : ""}
                      </span>
                    </div>

                    {vehicle.enabled ? (
                      <span
                        className={`rounded-full bg-gradient-to-r ${vehicle.accent} text-white px-3 py-1.5 text-xs font-black shadow-sm`}
                      >
                        Seleccionar
                      </span>
                    ) : (
                      <span className="rounded-full bg-gray-200 text-gray-600 px-3 py-1.5 text-xs font-black">
                        Próximamente
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                    {vehicle.description}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default VehiclePanel;