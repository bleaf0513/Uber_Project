import { useEffect, useState, useContext } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { SocketContext } from "../context/SocketContext";
import LiveTracking from "../../components/LiveTracking";

const RideStarted = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { socket } = useContext(SocketContext);

  const { ride } = location.state || {};

  useEffect(() => {
    if (!ride || !socket) return;

    socket.emit("join", { userType: "user", userId: ride.user?._id });

    const handleRideEnded = () => {
      navigate("/home");
    };

    socket.on("ride-ended", handleRideEnded);

    return () => {
      socket.off("ride-ended", handleRideEnded);
    };
  }, [ride, socket, navigate]);

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
    }).format(number);
  };

  if (!ride) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">No hay viaje activo</h2>
          <Link
            to="/home"
            className="inline-block mt-2 bg-black text-white px-5 py-2 rounded-lg"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  const { firstPart, secondPart } = formatAddress(ride.destination);

  return (
    <div className="h-screen w-screen relative">
      <Link
        to="/home"
        className="absolute top-2 right-2 w-12 h-12 rounded-full bg-black flex items-center justify-center z-30"
      >
        <i style={{ color: "white" }} className="ri-home-line ri-xl mb-1"></i>
      </Link>

      <div className="absolute w-screen h-[100%] top-0 z-20">
        <LiveTracking />
      </div>

      <div className="bg-white absolute bottom-0 w-screen h-[50%] rounded-t-lg z-50">
        <div
          style={{ padding: "15px" }}
          className="flex flex-row justify-between items-center"
        >
          <div style={{ width: "25%" }} className="w-[25%]">
            <img
              style={{ width: "70px", height: "70px" }}
              className="rounded-full object-cover"
              src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRV-zbJg0P98SwYoQJCjzTONpVf1dB9pB9VCQ&s"
              alt="Usuario"
            />
          </div>

          <div style={{ textAlign: "right" }}>
            <h3 className="text-2xl font-semibold">
              {ride.user?.fullname?.firstname} {ride.user?.fullname?.lastname}
            </h3>

            <h2 className="text-xl font-semibold">
              Viaje en curso
            </h2>

            <h3 className="text-sm font-light">
              Pago pendiente
            </h3>

            <div className="flex flex-row justify-end items-center">
              <i className="ri-star-fill ri-xs"></i>
              <h4 className="text-sm font-semibold ml-1">4.9</h4>
            </div>
          </div>
        </div>

        <div
          className="mb-2"
          style={{ height: "2px", width: "100%", background: "#D6D6D6" }}
        ></div>

        <div className="flex flex-row justify-start w-screen ml-2">
          <div className="flex items-center justify-center w-[20%]">
            <i className="ri-map-pin-range-fill ri-xl"></i>
          </div>

          <div className="flex flex-col justify-start items-start w-full mr-5">
            <h2 className="text-xl font-semibold">{firstPart}</h2>
            <h4 className="text-sm">{secondPart}</h4>

            <div
              className="my-2"
              style={{ height: "2px", width: "100%", background: "#D6D6D6" }}
            ></div>
          </div>
        </div>

        <div className="flex flex-row justify-start w-screen ml-2">
          <div className="flex items-center justify-center w-[20%]">
            <i className="ri-bank-card-2-fill"></i>
          </div>

          <div className="flex flex-col justify-start items-start w-full mr-5">
            <h2 className="text-xl font-semibold">{formatCOP(ride.fare)}</h2>
            <h4 className="text-sm">Efectivo</h4>

            <div
              className="my-2"
              style={{ height: "2px", width: "100%", background: "#D6D6D6" }}
            ></div>
          </div>
        </div>

        <div className="flex items-center justify-center mt-3">
          <button
            onClick={() => {
              console.log("Asked for payment");
            }}
            style={{ width: "60%", padding: "5px", paddingBottom: "8px" }}
            className="bg-black text-white text-xl rounded-lg"
          >
            Pagar ahora
          </button>
        </div>
      </div>
    </div>
  );
};

export default RideStarted;
