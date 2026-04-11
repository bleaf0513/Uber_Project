import React, { useState } from "react";
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
  const [cancelling, setCancelling] = useState(false);

  const formatAddress = (address = "") => {
    const safeAddress = String(address || "").trim();

    if (!safeAddress) {
      return { firstPart: "", secondPart: "" };
    }

    const firstCommaIndex = safeAddress.indexOf(",");

    if (firstCommaIndex === -1) {
      return { firstPart: safeAddress, secondPart: "" };
    }

    const firstPart = safeAddress.substring(0, firstCommaIndex).trim();
    const secondPart = safeAddress.substring(firstCommaIndex + 1).trim();

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

  const closePanelsSafely = () => {
    if (typeof props.setVehicleFound === "function") {
      props.setVehicleFound(false);
    }

    if (typeof props.setConfirmRidePanel === "function") {
      props.setConfirmRidePanel(false);
    }
  };

  const cancelRideRequest = async () => {
    if (cancelling) return;

    try {
      setCancelling(true);
      const token = localStorage.getItem("token");

      if (!props?.ride?._id) {
        closePanelsSafely();
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

      closePanelsSafely();
    } catch (error) {
      console.error("Error cancelando solicitud:", error);
      alert(
        error?.response?.data?.message ||
          error?.message ||
          "No se pudo cancelar la solicitud."
      );
    } finally {
      setCancelling(false);
    }
  };

  const { firstPart, secondPart } = formatAddress(props?.pickup);
  const { firstPart: destFirstPart } = formatAddress(props?.destination);

  const selectedVehicleKey = VEHICLE_META[props?.selectedVehicle]
    ? props.selectedVehicle
    : "car";

  const selectedVehicle = VEHICLE_META[selectedVehicleKey];
  const vehicleImg = `${import.meta.env.BASE_URL}vehicles/${selectedVehicle.image}.png`;

  const displayedFare =
    props?.ride?.offeredFare ??
    props?.ride?.fare ??
    props?.selectedPrice ??
    0;

  return (
    <div className="bg-white rounded-t-[24px] h-full flex flex-col">
      <div className="flex items-center justify-center pt-3 pb-2">
        <div className="w-14 h-1.5 rounded-full bg-gray-300"></div>
      </div>

      <div className="px-4 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-blue-700">
              Buscando transportador
            </p>
            <h2 className="text-xl font-bold text-gray-900">
              Buscando conductores
            </h2>
          </div>

          <div role="status">
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
      </div>

      <div className="px-4 pb-3">
        <div className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-3 flex items-center gap-3">
          <img
            src={vehicleImg}
            alt={selectedVehicle.label}
            className="w-20 h-14 object-contain"
          />

          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-gray-900">
              {selectedVehicle.label}
            </h3>
            <p className="text-sm text-gray-600 truncate">
              {firstPart || "Origen"} → {destFirstPart || "Destino"}
            </p>
            <p className="text-sm font-semibold text-gray-900 mt-1">
              {formatCOP(displayedFare)}
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 flex-1 overflow-auto">
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <i className="ri-map-pin-range-fill ri-lg mt-1"></i>
            <div className="min-w-0">
              <p className="text-base font-semibold text-gray-900">
                {firstPart || "Origen"}
              </p>
              <p className="text-sm text-gray-600 truncate">
                {secondPart || "Punto de recogida"}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <i className="ri-square-fill ri-lg mt-1"></i>
            <div className="min-w-0">
              <p className="text-base font-semibold text-gray-900">
                {destFirstPart || "Destino"}
              </p>
              <p className="text-sm text-gray-600">
                Servicio {selectedVehicle.label.toLowerCase()}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pt-3 pb-4 border-t border-gray-100">
        <button
          type="button"
          onClick={cancelRideRequest}
          disabled={cancelling}
          className="w-full py-3 text-white text-base font-semibold rounded-2xl disabled:opacity-60"
          style={{
            background: "linear-gradient(to right, #cb2d3e, #ef473a)",
          }}
        >
          {cancelling ? "Cancelando..." : "Cancelar solicitud"}
        </button>
      </div>
    </div>
  );
};

export default FindingDriver;
