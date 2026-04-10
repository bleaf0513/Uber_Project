import React from "react";
import "remixicon/fonts/remixicon.css";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { getApiBaseUrl } from "../src/apiBase";

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

const ConfirmRidePickup = (props) => {
  const navigate = useNavigate();
  const [otp, setOtp] = React.useState("");

  if (props.ride == null) {
    return <div className="p-6 text-center text-gray-600">Cargando servicio...</div>;
  }

  const formatCOP = (value) => {
    const number = Number(value) || 0;
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(Math.ceil(number));
  };

  const formatAddress = (address = "") => {
    const firstCommaIndex = address.indexOf(",");

    if (firstCommaIndex === -1) {
      return { firstPart: address, secondPart: "" };
    }

    const firstPart = address.substring(0, firstCommaIndex);
    const secondPart = address.substring(firstCommaIndex + 1).trim();

    return { firstPart, secondPart };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await axios.get(`${getApiBaseUrl()}/rides/start-ride`, {
        params: {
          rideId: props.ride._id,
          otp,
        },
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (response.status === 200) {
        navigate("/captain-riding", { state: { ride: response.data } });
      }
    } catch (error) {
      console.error("Error al iniciar el servicio:", error);
      alert(
        error?.response?.data?.message ||
          "No se pudo iniciar el servicio. Verifica el OTP."
      );
    }
  };

  const { firstPart, secondPart } = formatAddress(props.ride?.pickup);
  const { firstPart: firstPartDest, secondPart: secondPartDest } =
    formatAddress(props.ride?.destination);

  const customerName = `${props.ride?.user?.fullname?.firstname || ""} ${
    props.ride?.user?.fullname?.lastname || ""
  }`.trim();

  const vehicleType = props.ride?.vehicleType || "car";
  const vehicleInfo = VEHICLE_META[vehicleType] || VEHICLE_META.car;

  return (
    <form onSubmit={handleSubmit} className="min-h-screen bg-white flex flex-col">
      <div className="flex-1">
        <div className="flex flex-col justify-center items-center py-4 px-4">
          <p className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 px-4 py-2 text-sm font-semibold mb-3">
            Confirmación de recogida
          </p>

          <h2 className="text-2xl font-semibold text-center">
            Confirmar para iniciar el servicio
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

        <div
          style={{
            background: "linear-gradient(to right, #0f9b0f, #38ef7d)",
          }}
          className="flex flex-row justify-between items-center m-[15px] p-3 rounded-2xl text-white"
        >
          <div className="flex flex-row justify-start items-center min-w-0">
            <div className="w-[55px] h-[55px] rounded-full bg-white/20 flex items-center justify-center text-2xl shrink-0">
              👤
            </div>

            <div className="pl-3 min-w-0">
              <h2 className="text-lg font-semibold truncate">
                {customerName || "Cliente"}
              </h2>
              <p className="text-sm text-white/90">{vehicleInfo.label}</p>
            </div>
          </div>

          <div className="text-right pl-3">
            <h2 className="text-lg font-bold">{formatCOP(props.ride.fare)}</h2>
          </div>
        </div>

        <div className="w-full flex justify-center items-center px-[15px] mb-4">
          <div className="w-full max-w-md">
            <label className="block text-sm font-semibold text-gray-700 mb-2 text-center">
              Ingresa el código OTP para comenzar
            </label>
            <input
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className="text-center w-full bg-gray-100 border border-gray-200 py-3 rounded-2xl text-lg font-semibold font-mono outline-none focus:ring-2 focus:ring-emerald-500"
              type="text"
              inputMode="numeric"
              maxLength={6}
              required
              placeholder="Ingresa OTP"
            />
          </div>
        </div>

        <div className="flex flex-col justify-start items-start mx-3">
          <div className="flex flex-row justify-start w-full ml-2">
            <div className="flex items-center justify-center w-[20%]">
              <i className="ri-map-pin-range-fill ri-xl"></i>
            </div>
            <div className="flex flex-col justify-start items-start w-full mr-5">
              <h2 className="text-xl font-semibold">{firstPart}</h2>
              <h4 className="text-sm text-gray-600">{secondPart || "Punto de recogida"}</h4>
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
              <h2 className="text-xl font-semibold">{firstPartDest}</h2>
              <h4 className="text-sm text-gray-600">{secondPartDest || "Destino"}</h4>
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
              <h2 className="text-xl font-semibold">{formatCOP(props.ride.fare)}</h2>
              <h4 className="text-sm text-gray-600">Pago contra servicio</h4>
              <div
                className="my-2"
                style={{ height: "2px", width: "100%", background: "#D6D6D6" }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full px-5 pb-6 pt-2">
        <div className="flex flex-row items-center justify-around gap-3">
          <button
            type="submit"
            className="w-full py-3 text-white text-lg font-semibold rounded-2xl text-center"
            style={{
              background: "linear-gradient(to right, #1d976c, #93f9b9)",
            }}
          >
            Confirmar
          </button>

          <button
            type="button"
            onClick={() => {
              props.setConfirmRidePickup(false);
            }}
            className="w-full py-3 text-white font-semibold text-lg rounded-2xl"
            style={{
              background: "linear-gradient(to right, #cb2d3e, #ef473a)",
            }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </form>
  );
};

export default ConfirmRidePickup;
