import React from "react";

const DriverSelected = (props) => {
  const ride = props?.ride || null;

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

  const getDriverPhoto = (captain) =>
    captain?.profileImage ||
    captain?.photo ||
    captain?.avatar ||
    captain?.image ||
    captain?.profilePic ||
    "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRV-zbJg0P98SwYoQJCjzTONpVf1dB9pB9VCQ&s";

  const getVehicleTypeLabel = (vehicleType) => {
    const labels = {
      motorcycle: "Moto",
      car: "Carro",
      light_cargo: "Carga liviana",
      van: "Furgón / Camioneta",
      truck: "Camión",
    };

    return labels[vehicleType] || "Vehículo";
  };

  if (!ride) {
    return (
      <div className="bg-white rounded-t-[24px] p-6">
        <div className="flex items-center justify-center">
          <h1 className="text-xl font-semibold">Cargando información del conductor...</h1>
        </div>
      </div>
    );
  }

  const pickupAddress = formatAddress(ride?.pickup);
  const destinationAddress = formatAddress(ride?.destination);

  const captain = ride?.captain || {};
  const fullName = captain?.fullname || {};
  const vehicle = captain?.vehicle || {};

  const driverName =
    [fullName?.firstname, fullName?.lastname].filter(Boolean).join(" ") ||
    "Conductor asignado";

  const plate = vehicle?.plate || captain?.plate || "Sin placa";
  const color = vehicle?.color || captain?.vehicleColor || "Color no disponible";
  const vehicleType =
    vehicle?.vehicleType || captain?.vehicleType || ride?.vehicleType || "car";

  const vehicleLabel = getVehicleTypeLabel(vehicleType);
  const driverPhoto = getDriverPhoto(captain);
  const securityCode = ride?.otp || "----";
  const finalFare = ride?.fare ?? ride?.offeredFare ?? 0;

  return (
    <div className="bg-white rounded-t-[24px] pb-6">
      <div className="flex items-center justify-center pt-3 pb-2">
        <div className="w-14 h-1.5 rounded-full bg-gray-300"></div>
      </div>

      <div className="px-5">
        <div className="rounded-[28px] bg-gradient-to-r from-emerald-500 to-emerald-300 p-5 text-white shadow-lg">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <img
                src={driverPhoto}
                alt={driverName}
                className="w-16 h-16 rounded-2xl object-cover bg-white/20"
              />

              <div className="min-w-0">
                <p className="text-2xl font-extrabold truncate">{driverName}</p>
                <p className="text-sm text-white/90 mt-1">
                  {vehicleLabel} · {color}
                </p>
                <p className="text-sm text-white/90 mt-1">Placa: {plate}</p>
              </div>
            </div>

            <div className="text-right shrink-0">
              <p className="text-xs uppercase tracking-wide text-white/80">
                Valor final
              </p>
              <p className="text-3xl font-extrabold">{formatCOP(finalFare)}</p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl bg-white/15 px-4 py-3">
            <p className="text-sm font-semibold text-white/90">
              Estado del servicio
            </p>
            <p className="text-lg font-bold mt-1">Tu conductor va en camino</p>
          </div>
        </div>
      </div>

      <div className="px-5 mt-5">
        <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-800">
            Código de seguridad
          </p>
          <p className="text-xs text-amber-700 mt-1">
            Compártelo con el conductor solo cuando llegue al punto de recogida para iniciar el servicio.
          </p>

          <div className="mt-3 rounded-2xl bg-white border border-amber-200 py-4 text-center">
            <span className="text-4xl font-extrabold tracking-[0.35em] text-gray-900 ml-[0.35em]">
              {securityCode}
            </span>
          </div>
        </div>
      </div>

      <div className="px-5 mt-5">
        <div className="rounded-[24px] border border-gray-200 bg-gray-50 p-4">
          <p className="text-base font-bold text-gray-900 mb-4">
            Detalles del recorrido
          </p>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center shadow-sm">
                <i className="ri-map-pin-range-fill text-lg"></i>
              </div>

              <div className="min-w-0">
                <p className="text-lg font-bold text-gray-900">
                  {pickupAddress.firstPart || "Punto de recogida"}
                </p>
                <p className="text-sm text-gray-600">
                  {pickupAddress.secondPart || "Ubicación de recogida"}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center shadow-sm">
                <i className="ri-square-fill text-lg"></i>
              </div>

              <div className="min-w-0">
                <p className="text-lg font-bold text-gray-900">
                  {destinationAddress.firstPart || "Destino"}
                </p>
                <p className="text-sm text-gray-600">
                  {destinationAddress.secondPart || "Ubicación de destino"}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center shadow-sm">
                <i className="ri-car-fill text-lg"></i>
              </div>

              <div className="min-w-0">
                <p className="text-lg font-bold text-gray-900">{vehicleLabel}</p>
                <p className="text-sm text-gray-600">
                  {color} · {plate}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center shadow-sm">
                <i className="ri-bank-card-fill text-lg"></i>
              </div>

              <div className="min-w-0">
                <p className="text-lg font-bold text-gray-900">
                  {formatCOP(finalFare)}
                </p>
                <p className="text-sm text-gray-600">Pago contra servicio</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DriverSelected;