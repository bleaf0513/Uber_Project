import React from "react";

    function VehicleThumb({ name, label }) {
      const src = `${import.meta.env.BASE_URL}vehicles/${name}.png`;

      return (
        <div className="w-[78px] h-[58px] rounded-2xl bg-gradient-to-br from-purple-50 to-white border border-purple-100 flex items-center justify-center overflow-hidden shrink-0">
          <img
            src={src}
            alt={label}
            className="w-full h-full object-contain p-1.5"
            loading="lazy"
            decoding="async"
            width={120}
            height={80}
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
          <div className="w-full min-h-[230px] flex flex-col justify-center items-center gap-4 px-6 py-7 bg-white rounded-t-[26px]">
            <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center">
              <i className="ri-error-warning-line text-2xl text-red-600"></i>
            </div>

            <div className="text-center">
              <p className="text-base font-black text-gray-900">
                No pudimos calcular la tarifa
              </p>
              <p className="text-sm text-red-600 mt-1">{props.pricingError}</p>
            </div>

            <button
              type="button"
              onClick={closePanel}
              className="rounded-full bg-purple-800 text-white text-sm font-bold px-6 py-2.5"
            >
              Volver
            </button>
          </div>
        );
      }

      if (props.distance?.status !== "OK") {
        return (
          <div className="w-full h-[260px] flex flex-col justify-center items-center bg-white rounded-t-[26px]">
            <div role="status">
              <svg
                aria-hidden="true"
                className="w-8 h-8 text-gray-200 animate-spin fill-purple-700"
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

            <p className="mt-3 text-sm font-semibold text-gray-600">
              Calculando servicios...
            </p>
          </div>
        );
      }

      const baseDuration = Number(props.distance?.duration?.value) || 0;
      const baseDistance = Number(props.distance?.distance?.value) || 0;

      const routeDurationText = formatDuration(baseDuration);
      const routeDistanceText = formatDistance(baseDistance);

      const resolvedPrices = {
        motorcycle: normalizePrice(props.prices?.motorcycle, props.prices?.moto),
        car: normalizePrice(props.prices?.car),
        motocarro: normalizePrice(props.prices?.motocarro),
        pickup: normalizePrice(props.prices?.pickup),
        van: normalizePrice(props.prices?.van),
        truck: normalizePrice(props.prices?.truck),
      };

      const vehicleOptions = [
        {
          key: "motorcycle",
          image: "moto",
          title: "Moto",
          cargoLabel: "Carga pequeña",
          subtitle: "Paquetes, documentos y compras pequeñas",
          price: resolvedPrices.motorcycle,
          enabled: Number(resolvedPrices.motorcycle) > 0,
          badge: "Ágil",
        },
        {
          key: "car",
          image: "car",
          title: "Carro",
          cargoLabel: "Carga ligera",
          subtitle: "Mercado, paquetes y cajas pequeñas",
          price: resolvedPrices.car,
          enabled: Number(resolvedPrices.car) > 0,
          badge: "Práctico",
        },
        {
          key: "motocarro",
          image: "motocarro",
          title: "Motocarguero",
          cargoLabel: "Carga compacta",
          subtitle: "Cajas, bultos y varias entregas",
          price: resolvedPrices.motocarro,
          enabled: Number(resolvedPrices.motocarro) > 0,
          badge: "Carga",
        },
        {
          key: "pickup",
          image: "pickup",
          title: "Pickup",
          cargoLabel: "Carga mediana",
          subtitle: "Bultos, canastillas y mercancía mediana",
          price: resolvedPrices.pickup,
          enabled: Number(resolvedPrices.pickup) > 0,
          badge: "Versátil",
        },
        {
          key: "van",
          image: "van",
          title: "Van",
          cargoLabel: "Mayor volumen",
          subtitle: "Cajas y mercancía de mayor volumen",
          price: resolvedPrices.van,
          enabled: Number(resolvedPrices.van) > 0,
          badge: "Amplia",
        },
        {
          key: "truck",
          image: "truck",
          title: "Camión",
          cargoLabel: "Carga pesada",
          subtitle: "Grandes volúmenes y carga pesada",
          price: resolvedPrices.truck,
          enabled: Number(resolvedPrices.truck) > 0,
          badge: "Pesado",
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
        <div className="bg-[#f6f3fa] rounded-t-[26px] overflow-hidden max-h-[58vh]">
          <div className="sticky top-0 z-10 bg-[#f6f3fa]/95 backdrop-blur border-b border-purple-100">
            <div className="flex justify-center pt-2 pb-1">
              <button
                type="button"
                onClick={closePanel}
                className="w-12 h-1.5 rounded-full bg-purple-200"
                aria-label="Cerrar panel"
              />
            </div>

            <div className="px-4 pb-3 flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-700"></span>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-purple-800">
                    Servicios disponibles
                  </p>
                </div>

                <h2 className="text-xl font-black text-gray-950 leading-tight mt-1">
                  Elige el vehículo para tu envío
                </h2>

                <p className="text-xs text-gray-500 mt-0.5">
                  Ruta estimada: {routeDurationText}
                  {routeDistanceText ? ` · ${routeDistanceText}` : ""}
                </p>
              </div>

              <button
                type="button"
                onClick={closePanel}
                className="w-10 h-10 rounded-full bg-white shadow-sm border border-purple-100 flex items-center justify-center shrink-0"
                aria-label="Volver"
              >
                <i className="ri-arrow-down-s-line text-2xl text-purple-900"></i>
              </button>
            </div>
          </div>

          <div className="px-3 pt-3 pb-5 space-y-2.5 overflow-y-auto max-h-[calc(58vh-92px)]">
            {vehicleOptions.map((vehicle) => {
              return (
                <button
                  key={vehicle.key}
                  type="button"
                  onClick={() => handleSelectVehicle(vehicle)}
                  disabled={!vehicle.enabled}
                  className={`w-full text-left rounded-[22px] border overflow-hidden transition-all ${
                    vehicle.enabled
                      ? "bg-white border-purple-100 shadow-[0_8px_22px_rgba(76,29,149,0.10)] active:scale-[0.99]"
                      : "bg-gray-100 border-gray-200 opacity-60"
                  }`}
                >
                  <div className="flex items-center gap-3 p-2.5">
                    <VehicleThumb name={vehicle.image} label={vehicle.title} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <h3 className="text-[17px] font-black text-gray-950 truncate">
                          {vehicle.title}
                        </h3>

                        <span className="shrink-0 rounded-full bg-purple-100 text-purple-900 px-2 py-0.5 text-[10px] font-black">
                          {vehicle.badge}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mt-0.5 text-[12px] text-gray-500">
                        <span className="inline-flex items-center gap-1">
                          <i className="ri-box-3-fill text-purple-700"></i>
                          {vehicle.cargoLabel}
                        </span>

                        <span className="w-1 h-1 rounded-full bg-gray-300"></span>

                        <span className="truncate">{vehicle.subtitle}</span>
                      </div>

                      <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-[#f4ecff] text-purple-900 px-2.5 py-1 text-[11px] font-bold">
                        <i className="ri-route-line text-sm"></i>
                        {routeDurationText}
                        {routeDistanceText ? ` · ${routeDistanceText}` : ""}
                      </div>
                    </div>

                    <div className="shrink-0 text-right pr-1">
                      {vehicle.enabled ? (
                        <>
                          <p className="text-[10px] font-bold text-purple-500">
                            Sugerida
                          </p>
                          <p className="text-[18px] leading-tight font-black text-gray-950">
                            {formatCOP(vehicle.price)}
                          </p>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            Toca para elegir
                          </p>
                        </>
                      ) : (
                        <p className="text-xs font-bold text-gray-500">
                          Sin tarifa
                        </p>
                      )}
                    </div>
                  </div>

                  {vehicle.enabled && (
                    <div className="h-1 w-full bg-gradient-to-r from-purple-700 via-fuchsia-600 to-purple-950"></div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      );
    };

    export default VehiclePanel;
