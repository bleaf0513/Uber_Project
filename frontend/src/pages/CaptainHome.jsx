import React, { useState, useEffect, useContext, useRef } from "react";
import { Link } from "react-router-dom";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import "remixicon/fonts/remixicon.css";
import CaptainDetails from "../../components/CaptainDetails";
import RidePopup from "../../components/RidePopup";
import ConfirmRidePickup from "../../components/ConfirmRidePickup";
import { CaptainDataContext } from "../context/CaptainContext";
import { SocketContext } from "../context/SocketContext";
import axios from "axios";
import { getApiBaseUrl } from "../apiBase";
import LiveTracking from "../../components/LiveTracking";

const CaptainHome = () => {
  const ridePopupRef = useRef(null);
  const confirmRidePickupRef = useRef(null);

  const { captain } = useContext(CaptainDataContext);
  const { socket } = useContext(SocketContext);

  const [ridePopup, setRidePopup] = useState(false);
  const [ride, setRide] = useState(null);
  const [confirmRidePickup, setConfirmRidePickup] = useState(false);

  useEffect(() => {
    if (!captain?._id) return;

    socket.emit("join", {
      userId: captain._id,
      userType: "captain",
    });
  }, [captain?._id, socket]);

  useEffect(() => {
    if (!captain?._id || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        socket.emit("update-location-captain", {
          userId: captain._id,
          location: {
            ltd: position.coords.latitude,
            lng: position.coords.longitude,
          },
        });
      },
      (error) => {
        console.error("Error obteniendo ubicación del transportador:", error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 15000,
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [captain?._id, socket]);

  useEffect(() => {
    const onNewRide = (rideData) => {
      setRide(rideData);
      setConfirmRidePickup(false);
      setRidePopup(true);
    };

    socket.on("new-ride", onNewRide);

    return () => {
      socket.off("new-ride", onNewRide);
    };
  }, [socket]);

  const confirmRide = async () => {
    try {
      if (!ride?._id) {
        console.error("No hay servicio seleccionado para confirmar.");
        return;
      }

      await axios.post(
        `${getApiBaseUrl()}/rides/confirm`,
        {
          rideId: ride._id,
          captainId: captain?._id,
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      setRidePopup(false);
      setConfirmRidePickup(true);
    } catch (error) {
      console.error("Error confirmando servicio:", error);
      alert(
        error?.response?.data?.message ||
          "No se pudo confirmar el servicio. Intenta nuevamente."
      );
    }
  };

  useGSAP(
    () => {
      if (ridePopup) {
        gsap.to(ridePopupRef.current, {
          y: "0%",
          delay: 0.3,
        });
      } else {
        gsap.to(ridePopupRef.current, {
          y: "100%",
        });
      }
    },
    [ridePopup]
  );

  useGSAP(
    () => {
      if (confirmRidePickup) {
        gsap.to(confirmRidePickupRef.current, {
          y: "0%",
          delay: 0.3,
        });
      } else {
        gsap.to(confirmRidePickupRef.current, {
          y: "100%",
        });
      }
    },
    [confirmRidePickup]
  );

  return (
    <div className="overflow-hidden h-screen w-screen bg-gray-50">
      <div className="absolute top-0 left-0 ml-7 py-7 z-30">
        <Link to="/">
          <img
            className="w-40"
            src="/logo-centralgo.png"
            alt="Central Go"
          />
        </Link>
      </div>

      <Link
        to="/captain-logout"
        className="absolute top-3 right-3 w-12 h-12 rounded-full bg-black flex items-center justify-center z-50"
      >
        <i
          style={{ color: "white" }}
          className="ri-logout-box-line ri-xl mb mr-0.5"
        ></i>
      </Link>

      <div className="absolute w-screen h-[100%] top-0 z-20">
        <LiveTracking />
      </div>

      <div className="bg-white absolute bottom-0 w-screen rounded-t-[24px] overflow-y-auto overflow-x-hidden z-50 shadow-2xl">
        <div className="pt-2">
          <div className="flex justify-center py-2">
            <div className="w-16 h-1.5 rounded-full bg-gray-300"></div>
          </div>

          <div className="px-5 pb-2">
            <p className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 px-4 py-2 text-sm font-semibold">
              Panel del transportador
            </p>
          </div>

          <CaptainDetails />
        </div>

        <div
          ref={ridePopupRef}
          className="fixed z-[60] bottom-0 w-screen translate-y-full rounded-t-[24px] bg-white overflow-scroll shadow-2xl"
        >
          <RidePopup
            setConfirmRidePickup={setConfirmRidePickup}
            setRidePopup={setRidePopup}
            ride={ride}
            confirmRide={confirmRide}
          />
        </div>

        <div
          ref={confirmRidePickupRef}
          className="fixed z-[70] bottom-0 w-screen h-screen translate-y-full rounded-t-[24px] bg-white overflow-scroll shadow-2xl"
        >
          <ConfirmRidePickup
            setConfirmRidePickup={setConfirmRidePickup}
            setRidePopup={setRidePopup}
            ride={ride}
          />
        </div>
      </div>
    </div>
  );
};

export default CaptainHome;
