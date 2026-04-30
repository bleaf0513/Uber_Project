import { useEffect, useState, useContext } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { SocketContext } from "../context/SocketContext";
import LiveTracking from "../../components/LiveTracking";
import { getApiBaseUrl } from "../apiBase";
import "remixicon/fonts/remixicon.css";

const PURPLE_GRADIENT = "linear-gradient(135deg, #6D28D9, #A855F7, #D946EF)";
const PURPLE_SOFT = "linear-gradient(135deg, #F3E8FF, #FAE8FF)";

const RideStarted = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { socket } = useContext(SocketContext);

  const initialRide = location.state?.ride || null;

  const [currentRide, setCurrentRide] = useState(initialRide);
  const [rideEnded, setRideEnded] = useState(
    initialRide?.status === "completed"
  );

  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingValue, setRatingValue] = useState(5);
  const [ratingComment, setRatingComment] = useState("");
  const [sendingRating, setSendingRating] = useState(false);
  const [ratingSent, setRatingSent] = useState(
    Boolean(initialRide?.userRatingToCaptain?.rating)
  );

  useEffect(() => {
    if (!currentRide || !socket) return;

    const userId =
      currentRide?.user?._id ||
      currentRide?.user ||
      localStorage.getItem("userId") ||
      null;

    if (userId) {
      socket.emit("join", {
        userType: "user",
        userId,
      });
    }

    const handleRideEnded = (payload) => {
      const nextRide = payload?.ride || payload || currentRide;
      const rideId = String(payload?.rideId || nextRide?._id || "");

      if (rideId && String(rideId) !== String(currentRide?._id)) return;

      setCurrentRide(nextRide);
      setRideEnded(true);

      if (!nextRide?.userRatingToCaptain?.rating) {
        setShowRatingModal(true);
      }
    };

    const handleUserRated = (payload) => {
      const nextRide = payload?.ride || currentRide;
      const rideId = String(payload?.rideId || nextRide?._id || "");

      if (rideId && String(rideId) !== String(currentRide?._id)) return;

      setCurrentRide(nextRide);
      setRatingSent(true);
    };

    socket.on("ride-ended", handleRideEnded);
    socket.on("user-rated", handleUserRated);

    return () => {
      socket.off("ride-ended", handleRideEnded);
      socket.off("user-rated", handleUserRated);
    };
  }, [currentRide, socket]);

  const formatAddress = (address = "") => {
    const safeAddress = String(address || "").trim();

    if (!safeAddress) {
      return {
        firstPart: "Dirección no disponible",
        secondPart: "",
      };
    }

    const firstCommaIndex = safeAddress.indexOf(",");

    if (firstCommaIndex === -1) {
      return {
        firstPart: safeAddress,
        secondPart: "",
      };
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

  const getCaptainName = () => {
    const captain = currentRide?.captain || {};
    const fullname = captain?.fullname || {};

    return (
      [fullname?.firstname, fullname?.lastname].filter(Boolean).join(" ") ||
      captain?.name ||
      "Conductor"
    );
  };

  const getCaptainPhoto = () => {
    const captain = currentRide?.captain || {};

    return (
      captain?.profileImage ||
      captain?.photo ||
      captain?.avatar ||
      captain?.image ||
      captain?.profilePic ||
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRV-zbJg0P98SwYoQJCjzTONpVf1dB9pB9VCQ&s"
    );
  };

  const getVehicleLabel = () => {
    const captain = currentRide?.captain || {};
    const vehicle = captain?.vehicle || {};
    const type =
      vehicle?.vehicleType ||
      captain?.vehicleType ||
      currentRide?.vehicleType ||
      "car";

    const labels = {
      motorcycle: "Moto",
      car: "Carro",
      motocarro: "Motocarro",
      pickup: "Camioneta",
      light_cargo: "Carga liviana",
      van: "Van / Furgón",
      truck: "Camión",
      moving: "Mudanza",
    };

    return labels[type] || "Vehículo";
  };

  const getVehicleInfo = () => {
    const captain = currentRide?.captain || {};
    const vehicle = captain?.vehicle || {};

    const plate = vehicle?.plate || captain?.plate || "Sin placa";
    const color = vehicle?.color || captain?.vehicleColor || "Color no disponible";

    return `${getVehicleLabel()} · ${color} · ${plate}`;
  };

  const handleRateCaptain = async () => {
    if (!currentRide?._id || sendingRating) return;

    const token = localStorage.getItem("token");

    if (!token) {
      alert("No hay sesión activa.");
      return;
    }

    try {
      setSendingRating(true);

      const response = await axios.post(
        `${getApiBaseUrl()}/rides/rate-captain`,
        {
          rideId: currentRide._id,
          rating: ratingValue,
          comment: ratingComment,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response?.data?.ride) {
        setCurrentRide(response.data.ride);
      }

      setRatingSent(true);
      setShowRatingModal(false);

      alert("Gracias por calificar al conductor.");
    } catch (error) {
      console.error("Error calificando conductor:", error);

      alert(
        error?.response?.data?.message ||
          "No se pudo enviar la calificación."
      );
    } finally {
      setSendingRating(false);
    }
  };

  if (!currentRide) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-white px-6">
        <div className="text-center">
          <div
            className="w-16 h-16 mx-auto rounded-3xl flex items-center justify-center"
            style={{ background: PURPLE_GRADIENT }}
          >
            <i className="ri-route-line text-4xl text-white"></i>
          </div>

          <h2 className="text-2xl font-black text-gray-950 mt-4">
            No hay viaje activo
          </h2>

          <Link
            to="/home"
            className="inline-block mt-5 bg-black text-white px-6 py-3 rounded-2xl font-bold"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  const pickupAddress = formatAddress(currentRide.pickup);
  const destinationAddress = formatAddress(currentRide.destination);
  const fare = currentRide?.fare ?? currentRide?.offeredFare ?? 0;

  const statusTitle = rideEnded
    ? "Viaje finalizado"
    : "Viaje en curso";

  const statusSubtitle = rideEnded
    ? ratingSent
      ? "Gracias por usar Central Go."
      : "Califica al conductor para cerrar tu experiencia."
    : "Vas camino a tu destino. Sigue el recorrido en tiempo real.";

  return (
    <div className="h-screen w-screen relative overflow-hidden bg-gray-100">
      <div className="absolute w-screen h-full top-0 z-10">
        <LiveTracking
          pickup={currentRide?.pickup || ""}
          destination={currentRide?.destination || ""}
          selectedCaptainId={currentRide?.captain?._id || null}
          showRouteToPickup={false}
          showPickupRadar={false}
          autoFetchNearbyDrivers={false}
        />
      </div>

      <Link
        to="/home"
        className="absolute top-3 right-3 w-12 h-12 rounded-full bg-black flex items-center justify-center z-30 shadow-xl"
      >
        <i className="ri-home-line text-2xl text-white"></i>
      </Link>

      <div className="absolute inset-x-0 bottom-0 z-40 px-3 pb-3">
        <div className="rounded-[30px] bg-white shadow-2xl border border-gray-200 overflow-hidden max-h-[76vh] overflow-y-auto">
          <div
            className="px-5 py-5 text-white"
            style={{
              background: rideEnded
                ? "linear-gradient(135deg, #111827, #374151)"
                : PURPLE_GRADIENT,
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wide text-white/80 font-black">
                  Central Go
                </p>

                <h1 className="text-3xl font-black mt-1">
                  {statusTitle}
                </h1>

                <p className="text-sm text-white/85 mt-2 leading-5">
                  {statusSubtitle}
                </p>
              </div>

              <div className="w-16 h-16 rounded-3xl bg-white/15 flex items-center justify-center shrink-0">
                <i
                  className={`${
                    rideEnded ? "ri-checkbox-circle-fill" : "ri-road-map-fill"
                  } text-4xl text-white`}
                ></i>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-5">
              <div className="rounded-2xl bg-white/15 border border-white/10 p-3">
                <p className="text-xs text-white/70 font-bold">
                  Valor acordado
                </p>
                <p className="text-2xl font-black mt-1">
                  {formatCOP(fare)}
                </p>
              </div>

              <div className="rounded-2xl bg-white/15 border border-white/10 p-3">
                <p className="text-xs text-white/70 font-bold">
                  Estado
                </p>
                <p className="text-lg font-black mt-1">
                  {rideEnded ? "Finalizado" : "En curso"}
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 space-y-4">
            <div className="rounded-[24px] border border-purple-100 bg-purple-50 p-4 flex items-center gap-3">
              <img
                src={getCaptainPhoto()}
                alt={getCaptainName()}
                className="w-16 h-16 rounded-2xl object-cover border-2 border-white shadow-sm"
              />

              <div className="min-w-0 flex-1">
                <p className="text-lg font-black text-gray-950 truncate">
                  {getCaptainName()}
                </p>

                <p className="text-sm font-bold text-purple-700 truncate mt-1">
                  {getVehicleInfo()}
                </p>

                <div className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 mt-2">
                  <i className="ri-star-fill text-yellow-500"></i>
                  <span className="text-xs font-black text-gray-800">4.94</span>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-base font-black text-gray-950 mb-4">
                Detalles del recorrido
              </p>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-100 flex items-center justify-center shrink-0">
                  <i className="ri-map-pin-range-fill text-lg text-purple-700"></i>
                </div>

                <div className="min-w-0">
                  <p className="text-base font-black text-gray-950">
                    {pickupAddress.firstPart}
                  </p>
                  <p className="text-sm text-gray-500">
                    {pickupAddress.secondPart || "Punto de recogida"}
                  </p>
                </div>
              </div>

              <div className="h-6 w-px bg-gray-200 ml-5 my-2"></div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-fuchsia-100 flex items-center justify-center shrink-0">
                  <i className="ri-square-fill text-lg text-fuchsia-700"></i>
                </div>

                <div className="min-w-0">
                  <p className="text-base font-black text-gray-950">
                    {destinationAddress.firstPart}
                  </p>
                  <p className="text-sm text-gray-500">
                    {destinationAddress.secondPart || "Destino"}
                  </p>
                </div>
              </div>
            </div>

            {rideEnded && !ratingSent && (
              <button
                type="button"
                onClick={() => setShowRatingModal(true)}
                className="w-full rounded-2xl py-4 text-white font-black shadow-lg"
                style={{ background: PURPLE_GRADIENT }}
              >
                Calificar conductor
              </button>
            )}

            {rideEnded && ratingSent && (
              <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-white flex items-center justify-center shrink-0">
                    <i className="ri-checkbox-circle-fill text-2xl text-emerald-600"></i>
                  </div>

                  <div>
                    <p className="text-base font-black text-emerald-900">
                      Calificación enviada
                    </p>
                    <p className="text-sm text-emerald-700 mt-1">
                      Tu experiencia quedó registrada correctamente.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => navigate("/home")}
              className="w-full rounded-2xl bg-black text-white py-4 font-black"
            >
              {rideEnded ? "Cerrar" : "Volver al inicio"}
            </button>
          </div>
        </div>
      </div>

      {showRatingModal && (
        <div className="fixed inset-0 z-[1000] bg-black/50 flex items-end">
          <div className="w-full rounded-t-[30px] bg-white p-5 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex justify-center mb-3">
              <div className="w-14 h-1.5 rounded-full bg-gray-300"></div>
            </div>

            <div className="text-center">
              <div
                className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center"
                style={{ background: PURPLE_GRADIENT }}
              >
                <i className="ri-star-smile-line text-4xl text-white"></i>
              </div>

              <h3 className="text-2xl font-black text-gray-950 mt-4">
                Califica a tu conductor
              </h3>

              <p className="text-sm text-gray-500 mt-2 leading-5">
                Tu opinión ayuda a mejorar la experiencia de Central Go.
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 mt-6">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRatingValue(star)}
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                >
                  <i
                    className={`${
                      star <= ratingValue ? "ri-star-fill" : "ri-star-line"
                    } text-4xl ${
                      star <= ratingValue ? "text-yellow-500" : "text-gray-300"
                    }`}
                  ></i>
                </button>
              ))}
            </div>

            <div className="mt-5">
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Comentario opcional
              </label>

              <textarea
                rows={4}
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
                placeholder="Ejemplo: conductor amable, llegó rápido, buen servicio..."
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 mt-5">
              <button
                type="button"
                onClick={() => setShowRatingModal(false)}
                className="w-full rounded-2xl border border-gray-300 bg-white py-3.5 font-black text-gray-700"
              >
                Omitir
              </button>

              <button
                type="button"
                onClick={handleRateCaptain}
                disabled={sendingRating}
                className="w-full rounded-2xl py-3.5 font-black text-white disabled:opacity-60"
                style={{ background: PURPLE_GRADIENT }}
              >
                {sendingRating ? "Enviando..." : "Enviar calificación"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RideStarted;