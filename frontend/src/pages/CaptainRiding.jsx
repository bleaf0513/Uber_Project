import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import axios from "axios";
import "remixicon/fonts/remixicon.css";
import LiveTracking from "../../components/LiveTracking";
import { ToastContainer, toast } from "react-toastify";
import { getApiBaseUrl } from "../apiBase";

const CANCEL_REASONS = [
  "Usuario no contesta",
  "Usuario no aparece",
  "Dirección incorrecta",
  "Zona insegura",
  "Problema con el vehículo",
  "Tráfico o cierre de vía",
  "El usuario canceló verbalmente",
  "Otro motivo",
];

const CaptainRiding = () => {
  const [showCancelModal, setShowCancelModal] = React.useState(false);
  const [selectedReason, setSelectedReason] = React.useState("");
  const [cancelNotes, setCancelNotes] = React.useState("");
  const [sendingArrived, setSendingArrived] = React.useState(false);
  const [sendingCancel, setSendingCancel] = React.useState(false);
  const [finishingRide, setFinishingRide] = React.useState(false);
  const [driverArrived, setDriverArrived] = React.useState(false);
  const [etaInfo, setEtaInfo] = React.useState({
    etaText: "",
    distanceText: "",
  });

  const cancelModalRef = React.useRef(null);

  const location = useLocation();
  const navigate = useNavigate();
  const rideData = location.state?.ride || null;

  useGSAP(
    () => {
      if (showCancelModal) {
        gsap.to(cancelModalRef.current, {
          y: "0%",
          opacity: 1,
          duration: 0.25,
          ease: "power2.out",
        });
      } else {
        gsap.to(cancelModalRef.current, {
          y: "100%",
          opacity: 0,
          duration: 0.2,
          ease: "power2.inOut",
        });
      }
    },
    [showCancelModal]
  );

  const formatCOP = (value) => {
    const number = Number(value) || 0;
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(Math.ceil(number));
  };

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

  const getDriverPhoto = () => {
    return (
      rideData?.captain?.profileImage ||
      rideData?.captain?.photo ||
      rideData?.captain?.avatar ||
      rideData?.captain?.image ||
      rideData?.captain?.profilePic ||
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRV-zbJg0P98SwYoQJCjzTONpVf1dB9pB9VCQ&s"
    );
  };

  const getVehicleLabel = (vehicleType) => {
    const labels = {
      motorcycle: "Moto",
      car: "Carro",
      light_cargo: "Carga liviana",
      van: "Furgón / Camioneta",
      truck: "Camión",
    };

    return labels[vehicleType] || "Vehículo";
  };

  const handleArrived = async () => {
    if (!rideData?._id || sendingArrived) return;

    try {
      setSendingArrived(true);

      await axios.post(
        `${getApiBaseUrl()}/rides/arrived`,
        {
          rideId: rideData._id,
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      setDriverArrived(true);
      toast.success("Se notificó al usuario que ya llegaste.");
    } catch (error) {
      console.error("Error notificando llegada:", error);
      toast.error(
        error?.response?.data?.message ||
          "No se pudo notificar al usuario que ya llegaste."
      );
    } finally {
      setSendingArrived(false);
    }
  };

  const handleCancelRide = async () => {
    if (!rideData?._id || sendingCancel) return;

    if (!selectedReason) {
      toast.error("Selecciona un motivo de cancelación.");
      return;
    }

    try {
      setSendingCancel(true);

      await axios.post(
        `${getApiBaseUrl()}/rides/cancel-by-captain`,
        {
          rideId: rideData._id,
          reason: selectedReason,
          notes: cancelNotes || "",
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      toast.success("Solicitud cancelada correctamente.");
      setShowCancelModal(false);
      navigate("/captain-home");
    } catch (error) {
      console.error("Error cancelando solicitud:", error);
      toast.error(
        error?.response?.data?.message ||
          "No se pudo cancelar la solicitud."
      );
    } finally {
      setSendingCancel(false);
    }
  };

  const handleFinishRide = async () => {
    if (!rideData?._id || finishingRide) return;

    try {
      setFinishingRide(true);

      const response = await axios.post(
        `${getApiBaseUrl()}/rides/end-ride`,
        {
          rideId: rideData._id,
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      toast.success("Recorrido finalizado correctamente.");
      navigate("/captain-home", { state: { finishedRide: response.data } });
    } catch (error) {
      console.error("Error finalizando recorrido:", error);
      toast.error(
        error?.response?.data?.message ||
          "No se pudo finalizar el recorrido."
      );
    } finally {
      setFinishingRide(false);
    }
  };

  if (!rideData) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">
            No hay información del servicio
          </h1>
          <p className="text-sm text-gray-600 mt-2">
            Vuelve al panel del conductor e intenta nuevamente.
          </p>
          <Link
            to="/captain-home"
            className="inline-flex mt-5 rounded-2xl bg-black text-white px-5 py-3 font-semibold"
          >
            Volver al panel
          </Link>
        </div>
      </div>
    );
  }

  const pickupAddress = formatAddress(rideData?.pickup);
  const destinationAddress = formatAddress(rideData?.destination);

  const userFullName =
    `${rideData?.user?.fullname?.firstname || ""} ${
      rideData?.user?.fullname?.lastname || ""
    }`.trim() || "Usuario";

  const userPhone =
    rideData?.user?.phone ||
    rideData?.user?.phoneNumber ||
    rideData?.user?.mobile ||
    "Sin teléfono";

  const vehicleType =
    rideData?.captain?.vehicle?.vehicleType ||
    rideData?.captain?.vehicleType ||
    rideData?.vehicleType ||
    "car";

  const vehicleLabel = getVehicleLabel(vehicleType);
  const plate =
    rideData?.captain?.vehicle?.plate ||
    rideData?.captain?.plate ||
    "Sin placa";

  const color =
    rideData?.captain?.vehicle?.color ||
    rideData?.captain?.vehicleColor ||
    "Color no disponible";

  const fare = rideData?.fare ?? rideData?.offeredFare ?? 0;

  const headerStatus = driverArrived
    ? "Llegaste al punto"
    : "En camino a recoger";

  const headerSubtext = driverArrived
    ? "El usuario ya fue notificado."
    : etaInfo?.etaText
    ? `Tiempo estimado: ${etaInfo.etaText}${
        etaInfo?.distanceText ? ` · ${etaInfo.distanceText}` : ""
      }`
    : "Dirígete al punto de recogida del usuario.";

  return (
    <div className="overflow-hidden h-screen w-screen bg-gray-50">
      <div className="absolute top-0 left-0 ml-7 py-7 z-30">
        <Link to="/captain-home">
          <img className="w-32" src="/logo-centralgo.png" alt="Central Go" />
        </Link>
      </div>

      <Link
        to="/captain-logout"
        className="absolute top-3 right-3 w-12 h-12 rounded-full bg-black flex items-center justify-center z-40"
      >
        <i
          style={{ color: "white" }}
          className="ri-logout-box-line ri-xl mb mr-0.5"
        ></i>
      </Link>

      <div className="absolute w-screen h-[100%] top-0 z-10">
        <LiveTracking
          pickup={rideData?.pickup || ""}
          selectedCaptainId={rideData?.captain?._id || null}
          showRouteToPickup={true}
          showPickupRadar={true}
          autoFetchNearbyDrivers={true}
          onEtaUpdate={setEtaInfo}
        />
      </div>

      <div className="absolute inset-x-0 top-24 px-4 z-30">
        <div className="rounded-[28px] bg-white/95 backdrop-blur shadow-2xl border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-500 to-emerald-300 px-5 py-4 text-white">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-white/85">
                  Servicio en curso
                </p>
                <h2 className="text-2xl font-extrabold mt-1">
                  {headerStatus}
                </h2>
                <p className="text-sm text-white/90 mt-1">{headerSubtext}</p>
              </div>

              <div className="text-right shrink-0">
                <p className="text-xs uppercase tracking-wide text-white/85">
                  Valor
                </p>
                <p className="text-2xl font-extrabold">{formatCOP(fare)}</p>
              </div>
            </div>
          </div>

          <div className="p-5 space-y-4">
            <div className="flex items-center gap-4 rounded-3xl border border-gray-200 bg-gray-50 p-4">
              <img
                src={getDriverPhoto()}
                alt="Conductor"
                className="w-16 h-16 rounded-2xl object-cover"
              />

              <div className="flex-1 min-w-0">
                <p className="text-lg font-bold text-gray-900 truncate">
                  {userFullName}
                </p>
                <p className="text-sm text-gray-600 mt-1">{userPhone}</p>
                <p className="text-sm text-gray-600 mt-1">
                  {vehicleLabel} · {color} · {plate}
                </p>
              </div>
            </div>

            <div className="rounded-3xl border border-gray-200 bg-white p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gray-100 flex items-center justify-center shrink-0">
                  <i className="ri-map-pin-range-fill text-lg"></i>
                </div>
                <div className="min-w-0">
                  <p className="text-base font-bold text-gray-900">
                    {pickupAddress.firstPart || "Punto de recogida"}
                  </p>
                  <p className="text-sm text-gray-600">
                    {pickupAddress.secondPart || "Ubicación del usuario"}
                  </p>
                </div>
              </div>

              <div className="h-6 w-px bg-gray-200 ml-5 my-2"></div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gray-100 flex items-center justify-center shrink-0">
                  <i className="ri-square-fill text-lg"></i>
                </div>
                <div className="min-w-0">
                  <p className="text-base font-bold text-gray-900">
                    {destinationAddress.firstPart || "Destino"}
                  </p>
                  <p className="text-sm text-gray-600">
                    {destinationAddress.secondPart || "Destino del servicio"}
                  </p>
                </div>
              </div>
            </div>

            {etaInfo?.etaText || etaInfo?.distanceText ? (
              <div className="rounded-3xl border border-violet-200 bg-violet-50 px-4 py-3">
                <p className="text-sm font-bold text-violet-900">
                  Seguimiento en tiempo real
                </p>
                <p className="text-sm text-violet-800 mt-1">
                  {etaInfo?.etaText ? `Llegas en ${etaInfo.etaText}` : ""}
                  {etaInfo?.etaText && etaInfo?.distanceText ? " · " : ""}
                  {etaInfo?.distanceText || ""}
                </p>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleArrived}
                disabled={sendingArrived || driverArrived}
                className="w-full rounded-2xl py-3.5 text-white font-bold disabled:opacity-60"
                style={{
                  background: "linear-gradient(to right, #1d976c, #93f9b9)",
                }}
              >
                {driverArrived
                  ? "Usuario notificado"
                  : sendingArrived
                  ? "Notificando..."
                  : "Llegué"}
              </button>

              <button
                type="button"
                onClick={() => setShowCancelModal(true)}
                className="w-full rounded-2xl py-3.5 text-white font-bold"
                style={{
                  background: "linear-gradient(to right, #cb2d3e, #ef473a)",
                }}
              >
                Cancelar solicitud
              </button>
            </div>

            <button
              type="button"
              onClick={handleFinishRide}
              disabled={finishingRide}
              className="w-full rounded-2xl py-3.5 text-white font-bold disabled:opacity-60"
              style={{
                background: "linear-gradient(to right, #f2994a, #f2c94c)",
              }}
            >
              {finishingRide ? "Finalizando..." : "Finalizar recorrido"}
            </button>
          </div>
        </div>
      </div>

      {showCancelModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end">
          <div
            ref={cancelModalRef}
            className="w-full translate-y-full opacity-0 rounded-t-[28px] bg-white p-5 shadow-2xl max-h-[85vh] overflow-y-auto"
          >
            <div className="flex justify-center mb-3">
              <div className="w-14 h-1.5 rounded-full bg-gray-300"></div>
            </div>

            <h3 className="text-2xl font-extrabold text-gray-900">
              Cancelar solicitud
            </h3>
            <p className="text-sm text-gray-600 mt-2">
              Selecciona el motivo para registrar la cancelación correctamente.
            </p>

            <div className="mt-5 space-y-3">
              {CANCEL_REASONS.map((reason) => {
                const selected = selectedReason === reason;

                return (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setSelectedReason(reason)}
                    className={`w-full text-left rounded-2xl border px-4 py-4 transition ${
                      selected
                        ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                        : "border-gray-200 bg-white text-gray-800"
                    }`}
                  >
                    <span className="font-semibold">{reason}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Nota adicional
              </label>
              <textarea
                rows={4}
                value={cancelNotes}
                onChange={(e) => setCancelNotes(e.target.value)}
                placeholder="Escribe un detalle adicional si es necesario..."
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 mt-5">
              <button
                type="button"
                onClick={() => {
                  setShowCancelModal(false);
                  setSelectedReason("");
                  setCancelNotes("");
                }}
                className="w-full rounded-2xl border border-gray-300 bg-white py-3.5 font-bold text-gray-700"
              >
                Cerrar
              </button>

              <button
                type="button"
                onClick={handleCancelRide}
                disabled={sendingCancel}
                className="w-full rounded-2xl py-3.5 font-bold text-white disabled:opacity-60"
                style={{
                  background: "linear-gradient(to right, #cb2d3e, #ef473a)",
                }}
              >
                {sendingCancel ? "Cancelando..." : "Confirmar cancelación"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer />
    </div>
  );
};

export default CaptainRiding;