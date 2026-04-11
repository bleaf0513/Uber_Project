import React from "react";
import axios from "axios";
import { getApiBaseUrl } from "../src/apiBase";

const VEHICLE_META = {
  motorcycle: {
    label: "Moto",
    image: "moto",
    description: "Rápida y económica",
  },
  car: {
    label: "Carro",
    image: "car",
    description: "Cómodo y espacioso",
  },
  light_cargo: {
    label: "Carga liviana",
    image: "auto",
    description: "Ideal para paquetes y bultos pequeños",
  },
  van: {
    label: "Furgón / Camioneta",
    image: "van",
    description: "Más espacio para mercancía y mudanzas pequeñas",
  },
  truck: {
    label: "Camión",
    image: "truck",
    description: "Para carga pesada y trayectos logísticos",
  },
};

const FindingDriver = (props) => {
  const formatAddress = (address = "") => {
    if (!address) return { firstPart: "", secondPart: "" };

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

  const cancelRideRequest = async () => {
    try {
      const token = localStorage.getItem("token");

      if (!props.ride?._id) {
        props.setVehicleFound(false);
        props.setConfirmRidePanel(false);
        return;
      }

      await axios.post(
        `${getApiBaseUrl()}/rides/cancel`,
        { rideId: props.ride._id },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      props.setVehicleFound(false);
      props.setConfirmRidePanel(false);
    } catch (error) {
      console.error("Error cancelando solicitud:", error);
      alert(
        error?.response?.data?.message ||
          "No se pudo cancelar la solicitud."
      );
    }
  };

  const { firstPart, secondPart } = formatAddress(props.pickup);
  const { firstPart: destFirstPart, secondPart: destSecondPart } =
    formatAddress(props.destination);

  const selectedVehicleKey = VEHICLE_META[props.selectedVehicle]
    ? props.selectedVehicle
    : "car";

  const selectedVehicle = VEHICLE_META[selectedVehicleKey];
  const vehicleImg = `${import.meta.env.BASE_URL}vehicles/${selectedVehicle.image}.png`;

  const displayedFare = props.ride?.fare ?? props.selectedPrice;

  return (
    <div className="bg-white rounded-t-[24px]">
      <div className="flex flex-col justify-center items-center py-4 px-4">
        <p className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 px-4 py-2 text-sm font-semibold mb-3">
          Buscando transportador
        </p>

        <div className="flex flex-row justify-center items-center">
          <h2 className="text-2xl font-semibold text-center">
            Buscando conductores
          </h2>

          <div className="mx-2" role="status">
            <svg
              aria-hidden="true"
              className="inline w-6 h-6 text-gray-200 animate-spin fill-blue-600"
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
                : secondPart || "Punto de recogida"}
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
                : destSecondPart || "Destino"}
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

        <div className="flex flex-row justify-start w-full ml-2">
          <div className="flex items-center justify-center w-[20%]">
            <i className="ri-bank-card-2-fill ri-xl"></i>
          </div>
          <div className="flex flex-col justify-start items-start w-full mr-5">
            <h2 className="text-xl font-semibold">
              {formatCOP(displayedFare)}
            </h2>
            <h4 className="text-sm text-gray-600">Pago contra servicio</h4>
            <div
              className="my-2"
              style={{ height: "2px", width: "100%", background: "#D6D6D6" }}
            ></div>
          </div>
        </div>
      </div>

      <div className="px-5 pt-2 pb-6">
        <button
          type="button"
          onClick={cancelRideRequest}
          className="w-full py-3 text-white text-lg font-semibold rounded-2xl"
          style={{
            background: "linear-gradient(to right, #cb2d3e, #ef473a)",
          }}
        >
          Cancelar solicitud
        </button>
      </div>
    </div>
  );
};

export default FindingDriver;
