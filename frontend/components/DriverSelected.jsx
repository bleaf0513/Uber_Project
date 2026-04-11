import React from "react";

const DriverSelected = (props) => {
  const ride = props?.ride || null;

  const formatAddress = (address = "") => {
    const safeAddress = String(address || "").trim();

    if (!safeAddress) {
      return { firstPart: "Punto de recogida", secondPart: "" };
    }

    const firstCommaIndex = safeAddress.indexOf(",");

    if (firstCommaIndex === -1) {
      return { firstPart: safeAddress, secondPart: "" };
    }

    const firstPart = safeAddress.substring(0, firstCommaIndex).trim();
    const secondPart = safeAddress.substring(firstCommaIndex + 1).trim();

    return { firstPart, secondPart };
  };

  if (!ride) {
    return (
      <div className="bg-white rounded-t-[24px] p-6">
        <div className="flex items-center justify-center">
          <h1 className="text-xl font-semibold">Cargando conductor...</h1>
        </div>
      </div>
    );
  }

  const { firstPart, secondPart } = formatAddress(ride?.pickup);

  const captain = ride?.captain || {};
  const fullName = captain?.fullname || {};
  const vehicle = captain?.vehicle || {};

  const driverName =
    [fullName?.firstname, fullName?.lastname].filter(Boolean).join(" ") ||
    "Conductor asignado";

  const plate = vehicle?.plate || "Sin placa";
  const color = vehicle?.color || "Color no disponible";
  const otp = ride?.otp || "----";

  return (
    <div className="bg-white rounded-t-[24px] pb-6">
      <div
        style={{ padding: "15px" }}
        className="flex flex-row justify-between items-center"
      >
        <h2 className="text-2xl font-semibold font-sans px-2.5">OTP</h2>
        <h2 className="text-2xl font-semibold font-sans px-2.5">{otp}</h2>
      </div>

      <div
        className="mb-2"
        style={{ height: "2px", width: "100%", background: "#D6D6D6" }}
      ></div>

      <div
        style={{ padding: "15px" }}
        className="flex flex-row justify-between items-center"
      >
        <div style={{ width: "25%" }} className="w-[25%]">
          <img
            style={{ width: "70px", height: "70px" }}
            className="rounded-full object-cover"
            src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRV-zbJg0P98SwYoQJCjzTONpVf1dB9pB9VCQ&s"
            alt="Conductor"
          />
        </div>

        <div style={{ textAlign: "right" }}>
          <h3 className="text-sm font-semibold">{driverName}</h3>
          <h2 className="text-xl font-semibold">{plate}</h2>
          <h3 className="text-sm font-light">{color}</h3>

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

      <div className="mt-5 mb-5">
        <div className="flex flex-row justify-start w-full ml-2">
          <div className="flex items-center justify-center w-[20%]">
            <i className="ri-map-pin-range-fill ri-xl"></i>
          </div>

          <div className="flex flex-col justify-start items-start w-full mr-5">
            <h2 className="text-2xl font-semibold">{firstPart}</h2>
            <h4 className="text-sm text-gray-600">
              {secondPart || "Esperando más detalles del punto de recogida"}
            </h4>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DriverSelected;
