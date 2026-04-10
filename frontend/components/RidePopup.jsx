import React from "react";

const VEHICLE_META = {
  motorcycle: {
    label: "Moto",
    description: "Servicio rápido y económico",
  },
  car: {
    label: "Carro",
    description: "Servicio cómodo y espacioso",
  },
  light_cargo: {
    label: "Carga liviana",
    description: "Ideal para paquetes y carga pequeña",
  },
  van: {
    label: "Furgón / Camioneta",
    description: "Más espacio para mercancía y mudanzas pequeñas",
  },
  truck: {
    label: "Camión",
    description: "Servicio para carga pesada y trayectos logísticos",
  },
};

const RidePopup = (props) => {
  if (!props.ride) {
    return (
      <div className="p-6 text-center text-gray-600">
        Cargando servicio...
      </div>
    );
  }

  const pickupAd = props.ride?.pickup || "";
  const destinationAd = props.ride?.destination || "";
  const fare = props.ride?.fare || 0;
  const vehicleType = props.ride?.vehicleType || "car";

  const vehicleInfo = VEHICLE_META[vehicleType] || VEHICLE_META.car;

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

  const { firstPart: pickupMain, secondPart: pickupDetail } =
    formatAddress(pickupAd);

  const { firstPart: destinationMain, secondPart: destinationDetail } =
    formatAddress(destinationAd);

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
            <i className="ri-truck-fill ri-xl"></i>
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
            <h4 className="text-sm text-gray-600">Pago contra servicio</h4>
            <div
              className="my-2"
              style={{ height: "2px", width: "100%", background: "#D6D6D6" }}
            ></div>
          </div>
        </div>
      </div>

      <div className="px-5 pt-2 pb-6 flex flex-row items-center justify-around gap-3">
        <button
          onClick={() => {
            props.confirmRide();
          }}
          className="w-full py-3 text-white text-lg font-semibold rounded-2xl"
          style={{
            background: "linear-gradient(to right, #1d976c, #93f9b9)",
          }}
        >
          Aceptar
        </button>

        <button
          onClick={() => {
            props.setRidePopup(false);
          }}
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
