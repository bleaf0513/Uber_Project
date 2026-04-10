import React from "react";

function VehicleThumb({ name, label }) {
  const src = `${import.meta.env.BASE_URL}vehicles/${name}.png`;
  return (
    <img
      src={src}
      alt={label}
      className="h-[88px] w-full object-cover object-center rounded-lg bg-gray-200"
      loading="lazy"
      decoding="async"
      width={160}
      height={88}
    />
  );
}

const formatDuration = (duration) => {
  const safeDuration = Number(duration) || 0;
  const hours = Math.floor(safeDuration / 3600);
  const minutes = Math.floor((safeDuration % 3600) / 60);

  if (hours <= 0) return `${minutes} min`;
  return `${hours}h ${minutes} min`;
};

const formatArrivalTime = (durationInSeconds) => {
  const safeDuration = Number(durationInSeconds) || 0;
  return new Date(Date.now() + safeDuration * 1000).toLocaleTimeString(
    "es-CO",
    {
      hour: "2-digit",
      minute: "2-digit",
    }
  );
};

const formatCOP = (value) => {
  const number = Number(value) || 0;
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Math.ceil(number));
};

const VehiclePanel = (props) => {
  if (props.pricingError) {
    return (
      <div className="w-full min-h-[40vw] flex flex-col justify-center items-center gap-4 px-6 py-8">
        <p className="text-center text-sm text-red-600">{props.pricingError}</p>
        <button
          type="button"
          onClick={() => props.setVehiclePanel(false)}
          className="rounded-full bg-gray-900 text-white text-sm px-5 py-2"
        >
          Cerrar
        </button>
      </div>
    );
  }

  if (props.distance?.status !== "OK") {
    return (
      <div className="w-full h-[70vw] flex flex-col justify-center items-center">
        <div role="status">
          <svg
            aria-hidden="true"
            className="w-8 h-8 text-gray-200 animate-spin dark:text-gray-600 fill-blue-600"
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
      </div>
    );
  }

  const baseDuration = Number(props.distance?.duration?.value) || 0;

  const resolvedPrices = {
    motorcycle:
      props.prices?.motorcycle ??
      props.prices?.moto ??
      0,
    car:
      props.prices?.car ??
      0,
    light_cargo:
      props.prices?.light_cargo ??
      props.prices?.auto ??
      0,
    van:
      props.prices?.van ??
      0,
    truck:
      props.prices?.truck ??
      0,
  };

  const vehicleOptions = [
    {
      key: "car",
      image: "car",
      title: "Carro",
      seats: "4",
      subtitle: "Cómodo y espacioso",
      durationMultiplier: 1,
      price: resolvedPrices.car,
      enabled: Number(resolvedPrices.car) > 0,
    },
    {
      key: "motorcycle",
      image: "moto",
      title: "Moto",
      seats: "1",
      subtitle: "Rápida y económica",
      durationMultiplier: 0.85,
      price: resolvedPrices.motorcycle,
      enabled: Number(resolvedPrices.motorcycle) > 0,
    },
    {
      key: "light_cargo",
      image: "auto",
      title: "Carga liviana",
      seats: "Carga",
      subtitle: "Ideal para paquetes y bultos pequeños",
      durationMultiplier: 0.94,
      price: resolvedPrices.light_cargo,
      enabled: Number(resolvedPrices.light_cargo) > 0,
    },
    {
      key: "van",
      image: "van",
      title: "Furgón / Camioneta",
      seats: "Carga",
      subtitle: "Más espacio para mercancía y mudanzas pequeñas",
      durationMultiplier: 1.08,
      price: resolvedPrices.van,
      enabled: Number(resolvedPrices.van) > 0,
    },
    {
      key: "truck",
      image: "truck",
      title: "Camión",
      seats: "Carga",
      subtitle: "Para carga pesada y trayectos logísticos",
      durationMultiplier: 1.18,
      price: resolvedPrices.truck,
      enabled: Number(resolvedPrices.truck) > 0,
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
    <div>
      <div
        onClick={() => {
          props.setVehiclePanel(false);
        }}
        className="flex justify-center items-center w-full mt-5"
      >
        <div
          style={{ height: "35px" }}
          className="bg-white flex justify-center items-center w-1/2 h-5 rounded-3xl"
        >
          <i className="ri-arrow-down-wide-fill ri-2x"></i>
        </div>
      </div>

      <div className="m-2.5 mt-3">
        {vehicleOptions.map((vehicle) => {
          const adjustedDuration = Math.max(
            60,
            Math.round(baseDuration * vehicle.durationMultiplier)
          );

          return (
            <div
              key={vehicle.key}
              onClick={() => handleSelectVehicle(vehicle)}
              className={`flex flex-row justify-start w-full min-h-[96px] py-1 rounded-xl my-2 border ${
                vehicle.enabled
                  ? "bg-gray-100 border-transparent cursor-pointer"
                  : "bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed"
              }`}
            >
              <div className="w-[30%] shrink-0 flex items-center justify-center px-1.5 py-1">
                <VehicleThumb name={vehicle.image} label={vehicle.title} />
              </div>

              <div className="flex-1 min-w-0 flex flex-col justify-center items-start py-2 px-1">
                <div className="flex flex-row justify-start items-center flex-wrap">
                  <h1 className="text-xl font-semibold">{vehicle.title}</h1>

                  <div className="mx-2 flex items-center justify-center text-sm text-gray-700">
                    <i className="ri-user-fill ri-sm"></i>
                    <h4>{vehicle.seats}</h4>
                  </div>
                </div>

                <h2 className="text-sm font-light text-gray-700">
                  {formatDuration(adjustedDuration)} |{" "}
                  {formatArrivalTime(adjustedDuration)}
                </h2>

                <h2 className="text-sm font-light text-gray-700">
                  {vehicle.subtitle}
                </h2>

                {!vehicle.enabled ? (
                  <p className="text-xs text-orange-600 mt-1">
                    Próximamente disponible
                  </p>
                ) : null}
              </div>

              <div className="shrink-0 w-[28%] text-lg py-2 flex flex-col justify-center items-center pr-2">
                {vehicle.enabled ? (
                  <h2 className="text-xl font-semibold text-center">
                    {formatCOP(vehicle.price)}
                  </h2>
                ) : (
                  <h2 className="text-sm font-semibold text-center text-gray-500">
                    Sin tarifa
                  </h2>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default VehiclePanel;
