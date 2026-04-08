import React from "react";

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

  const { firstPart, secondPart } = formatAddress(props.pickup);
  const { firstPart: destFirstPart, secondPart: destSecondPart } =
    formatAddress(props.destination);

  const selected = ["car", "moto", "auto"].includes(props.selectedVehicle)
    ? props.selectedVehicle
    : "car";

  const vehicleImg = `${import.meta.env.BASE_URL}vehicles/${selected}.png`;

  return (
    <div>
      <div className="flex flex-col justify-center items-center py-3">
        <h2 className="text-2xl font-semibold">{firstPart}</h2>
        <div
          className="mt-2"
          style={{
            background: "linear-gradient(to right, #00dbde, #fc00ff)",
            height: "3px",
            width: "80%",
            borderRadius: "50px",
            clipPath: "polygon(0% 100%, 0% 55%, 55% 0%, 100% 55%, 100% 100%)",
          }}
        ></div>
      </div>

      <div className="flex justify-center items-center">
        <img
          style={{ width: "50%" }}
          className="w-[50%] mb-3"
          src={vehicleImg}
          alt="Vehículo seleccionado"
        />
      </div>

      <div className="flex flex-col justify-start items-start mx-2">
        <div
          className="my-2"
          style={{ height: "2px", width: "100%", background: "#D6D6D6" }}
        ></div>

        <div className="flex flex-row justify-start w-screen ml-2">
          <div className="flex items-center justify-center w-[20%]">
            <i className="ri-map-pin-range-fill ri-xl"></i>
          </div>

          <div className="flex flex-col justify-start items-start w-full mr-5">
            <h2 className="text-xl font-semibold">{firstPart}</h2>
            <h4 className="text-sm pr-2">
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

        <div className="flex flex-row justify-start w-screen ml-2">
          <div className="flex items-center justify-center w-[20%]">
            <i className="ri-square-fill"></i>
          </div>

          <div className="flex flex-col justify-start items-start w-full mr-5">
            <h2 className="text-xl font-semibold">{destFirstPart}</h2>
            <h4 className="text-sm pr-2">
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

        <div className="flex flex-row justify-start w-screen ml-2">
          <div className="flex items-center justify-center w-[20%]">
            <i className="ri-bank-card-2-fill"></i>
          </div>

          <div className="flex flex-col justify-start items-start w-full mr-5">
            <h2 className="text-xl font-semibold">
              {formatCOP(props.selectedPrice)}
            </h2>
            <h4 className="text-sm">Solo efectivo</h4>
            <div
              className="my-2"
              style={{ height: "2px", width: "100%", background: "#D6D6D6" }}
            ></div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center mt-4">
        <button
          onClick={() => {
            props.setVehicleFound(true);
            props.setConfirmRidePanel(false);
            props.createRide();
          }}
          style={{ width: "60%", padding: "5px", paddingBottom: "8px" }}
          className="bg-black text-white text-xl rounded-lg mb-5"
        >
          Confirmar viaje
        </button>
      </div>
    </div>
  );
};

export default ConfirmedRide;
