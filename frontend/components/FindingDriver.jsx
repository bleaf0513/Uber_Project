import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { getApiBaseUrl } from "../src/apiBase";

const VEHICLE_META = {
  motorcycle: {
    label: "Moto",
    image: "moto",
    description: "Rápida y económica",
    accent: "from-purple-600 to-purple-950",
  },
  car: {
    label: "Carro",
    image: "car",
    description: "Cómodo y espacioso",
    accent: "from-purple-700 to-purple-950",
  },
  light_cargo: {
    label: "Carga liviana",
    image: "auto",
    description: "Ideal para paquetes y bultos pequeños",
    accent: "from-violet-700 to-purple-950",
  },
  van: {
    label: "Furgón / Camioneta",
    image: "van",
    description: "Más espacio para mercancía",
    accent: "from-purple-800 to-slate-950",
  },
  truck: {
    label: "Camión",
    image: "truck",
    description: "Para carga pesada",
    accent: "from-purple-950 to-black",
  },
};

const OFFER_STEPS = [500, 1000, 2000];

const roundToHundred = (value) => {
  const number = Number(value) || 0;
  return Math.ceil(number / 100) * 100;
};

const FindingDriver = (props) => {
  const [cancelling, setCancelling] = useState(false);
  const [updatingFare, setUpdatingFare] = useState(false);
  const [localFare, setLocalFare] = useState(0);
  const [lastSavedFare, setLastSavedFare] = useState(0);
  const [fareMessage, setFareMessage] = useState("");

  const formatAddress = (address = "") => {
    const safeAddress = String(address || "").trim();

    if (!safeAddress) {
      return { firstPart: "", secondPart: "" };
    }

    const firstCommaIndex = safeAddress.indexOf(",");

    if (firstCommaIndex === -1) {
      return { firstPart: safeAddress, secondPart: "" };
    }

    return {
      firstPart: safeAddress.substring(0, firstCommaIndex).trim(),
      secondPart: safeAddress.substring(firstCommaIndex + 1).trim(),
    };
  };

  const formatCOP = (value) => {
    const number = Number(value) || 0;

    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(Math.ceil(number));
  };

  const selectedVehicleKey = VEHICLE_META[props?.selectedVehicle]
    ? props.selectedVehicle
    : "car";

  const selectedVehicle = VEHICLE_META[selectedVehicleKey];
  const vehicleImg = `${import.meta.env.BASE_URL}vehicles/${selectedVehicle.image}.png`;

  const serverFare = useMemo(() => {
    return Number(
      props?.ride?.offeredFare ??
        props?.ride?.fare ??
        props?.selectedPrice ??
        0
    );
  }, [props?.ride?.offeredFare, props?.ride?.fare, props?.selectedPrice]);

  useEffect(() => {
    const normalizedFare = roundToHundred(serverFare);
    setLocalFare(normalizedFare);
    setLastSavedFare(normalizedFare);
  }, [serverFare]);

  const hasFareChanged = Number(localFare) > Number(lastSavedFare);

  const { firstPart, secondPart } = formatAddress(props?.pickup);
  const { firstPart: destFirstPart, secondPart: destSecondPart } = formatAddress(
    props?.destination
  );

  const routeStops = Array.isArray(props.routeStops)
    ? props.routeStops.filter(Boolean)
    : [];

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

  const increaseLocalFare = (amount) => {
    setFareMessage("");

    setLocalFare((prev) => {
      const base = Number(prev) || Number(lastSavedFare) || 0;
      return roundToHundred(base + Number(amount || 0));
    });
  };

  const resetFare = () => {
    setLocalFare(lastSavedFare);
    setFareMessage("");
  };

  const updateOfferFare = async () => {
    if (updatingFare) return;

    if (!props?.ride?._id) {
      alert("No se encontró la solicitud activa.");
      return;
    }

    const nextFare = roundToHundred(localFare);

    if (!nextFare || nextFare <= lastSavedFare) {
      setFareMessage("Sube tu oferta para atraer más conductores.");
      return;
    }

    try {
      setUpdatingFare(true);
      setFareMessage("");

      const token = localStorage.getItem("token");

      const response = await axios.patch(
        `${getApiBaseUrl()}/rides/update-offer`,
        {
          rideId: props.ride._id,
          offeredFare: nextFare,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const updatedRide = response?.data?.ride || response?.data || null;

      setLastSavedFare(nextFare);
      setLocalFare(nextFare);
      setFareMessage("Oferta actualizada. Los conductores verán el nuevo valor.");

      if (typeof props.onRideUpdated === "function" && updatedRide?._id) {
        props.onRideUpdated(updatedRide);
      }
    } catch (error) {
      console.error("Error actualizando oferta:", error);

      alert(
        error?.response?.data?.message ||
          error?.message ||
          "No se pudo actualizar la oferta."
      );
    } finally {
      setUpdatingFare(false);
    }
  };

  return (
    <div className="bg-[#f7f3fb] rounded-t-[26px] h-full flex flex-col overflow-hidden">
      <div className="shrink-0 bg-[#f7f3fb]">
        <div className="flex items-center justify-center pt-3 pb-2">
          <div className="w-14 h-1.5 rounded-full bg-purple-200"></div>
        </div>

        <div className="px-4 pb-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-purple-700">
                Buscando transportador
              </p>

              <h2 className="text-[22px] font-black text-gray-950 leading-tight">
                Buscando conductores
              </h2>

              <p className="text-xs text-gray-500 mt-0.5">
                Puedes mejorar tu oferta mientras esperas.
              </p>
            </div>

            <div className="w-11 h-11 rounded-full bg-white border border-purple-100 shadow-sm flex items-center justify-center shrink-0">
              <svg
                aria-hidden="true"
                className="w-6 h-6 text-purple-100 animate-spin fill-purple-700"
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
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4 space-y-3">
        <div className="rounded-[24px] overflow-hidden bg-white border border-purple-100 shadow-[0_10px_28px_rgba(76,29,149,0.10)]">
          <div className={`h-1.5 bg-gradient-to-r ${selectedVehicle.accent}`}></div>

          <div className="px-3 py-3 flex items-center gap-3">
            <div className="w-[86px] h-[66px] rounded-2xl bg-gradient-to-br from-purple-50 to-white border border-purple-100 flex items-center justify-center overflow-hidden shrink-0">
              <img
                src={vehicleImg}
                alt={selectedVehicle.label}
                className="w-full h-full object-contain p-1.5"
              />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-lg font-black text-gray-950">
                  {selectedVehicle.label}
                </h3>

                <span className="rounded-full bg-purple-50 text-purple-900 px-2.5 py-1 text-xs font-black">
                  {formatCOP(lastSavedFare)}
                </span>
              </div>

              <p className="text-sm text-gray-600 truncate mt-0.5">
                {firstPart || "Origen"} → {destFirstPart || "Destino"}
              </p>

              <p className="text-xs text-gray-400 mt-1">
                {selectedVehicle.description}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-[24px] bg-gradient-to-br from-purple-700 via-purple-800 to-purple-950 text-white shadow-[0_14px_34px_rgba(76,29,149,0.24)] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-purple-100">
                Mejorar mi oferta
              </p>

              <h3 className="text-3xl font-black mt-1">
                {formatCOP(localFare)}
              </h3>

              <p className="text-xs text-white/75 mt-1">
                Subir la oferta puede ayudarte a recibir respuestas más rápido.
              </p>
            </div>

            {hasFareChanged ? (
              <button
                type="button"
                onClick={resetFare}
                disabled={updatingFare}
                className="rounded-full bg-white/15 px-3 py-2 text-xs font-black text-white disabled:opacity-60"
              >
                Deshacer
              </button>
            ) : (
              <span className="rounded-full bg-white/15 px-3 py-2 text-xs font-black text-white">
                Actual
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 mt-4">
            {OFFER_STEPS.map((step) => (
              <button
                key={step}
                type="button"
                onClick={() => increaseLocalFare(step)}
                disabled={updatingFare}
                className="rounded-2xl bg-white text-purple-900 py-2.5 text-sm font-black shadow-sm disabled:opacity-60"
              >
                +{formatCOP(step)}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={updateOfferFare}
            disabled={!hasFareChanged || updatingFare}
            className="w-full mt-3 rounded-2xl bg-black text-white py-3 text-sm font-black shadow-lg disabled:opacity-45"
          >
            {updatingFare ? "Actualizando oferta..." : "Actualizar oferta"}
          </button>

          {fareMessage ? (
            <p className="text-xs font-semibold text-white/85 mt-3">
              {fareMessage}
            </p>
          ) : null}
        </div>

        <div className="rounded-[22px] bg-white border border-purple-100 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-50 flex items-center justify-center shrink-0">
              <i className="ri-map-pin-user-fill text-xl text-purple-800"></i>
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-base font-black text-gray-950 truncate">
                {firstPart || "Origen"}
              </p>

              <p className="text-sm text-gray-600 truncate">
                {secondPart || "Punto de recogida"}
              </p>
            </div>
          </div>

          {routeStops.map((stop, index) => (
            <div key={`${stop}-${index}`} className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-100 flex items-center justify-center shrink-0">
                <span className="text-sm font-black text-purple-900">
                  {index + 1}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-purple-900">
                  Parada {index + 1}
                </p>

                <p className="text-sm text-gray-700 truncate">{stop}</p>
              </div>
            </div>
          ))}

          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gray-100 flex items-center justify-center shrink-0">
              <i className="ri-flag-2-fill text-xl text-gray-900"></i>
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-base font-black text-gray-950 truncate">
                {destFirstPart || "Destino"}
              </p>

              <p className="text-sm text-gray-600 truncate">
                {destSecondPart || `Servicio ${selectedVehicle.label.toLowerCase()}`}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-dashed border-purple-200 bg-purple-50 p-3">
            <p className="text-sm font-black text-purple-900">
              Esperando respuestas
            </p>

            <p className="text-xs text-purple-800 mt-1">
              Las contraofertas aparecerán arriba del mapa. Puedes aceptar la mejor opción.
            </p>
          </div>
        </div>

        <div className="h-2"></div>
      </div>

      <div className="shrink-0 px-4 pt-3 pb-4 border-t border-purple-100 bg-white">
        <button
          type="button"
          onClick={cancelRideRequest}
          disabled={cancelling || updatingFare}
          className="w-full py-3.5 text-white text-base font-black rounded-2xl disabled:opacity-60 shadow-lg"
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