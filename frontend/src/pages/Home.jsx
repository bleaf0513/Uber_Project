import React, { useEffect, useContext, useState, useRef, useCallback } from "react";
import { useGSAP } from "@gsap/react";
import { Link, useNavigate } from "react-router-dom";
import gsap from "gsap";
import "remixicon/fonts/remixicon.css";
import LocationSearchPanel from "../../components/LocationSearchPanel";
import VehiclePanel from "../../components/VehiclePanel";
import ConfirmedRide from "../../components/ConfirmedRide";
import FindingDriver from "../../components/FindingDriver";
import DriverSelected from "../../components/DriverSelected";
import axios from "axios";
import { SocketContext } from "../context/SocketContext";
import { UserDataContext } from "../context/UserContext";
import LiveTracking from "../../components/LiveTracking";
import { useGoogleMapsScript } from "../context/GoogleMapsLoadContext";
import { getApiBaseUrl } from "../apiBase";

function Home() {
  const submitHandler = (e) => {
    e.preventDefault();
  };

  const [pickup, setPickup] = useState("");
  const [destination, setDestination] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [vehiclePanel, setVehiclePanel] = useState(false);
  const [confirmRidePanel, setConfirmRidePanel] = useState(false);
  const [vehicleFound, setVehicleFound] = useState(false);
  const [driverSelected, setDriverSelected] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [activeInput, setActiveInput] = useState(null);
  const [prices, setPrices] = useState(null);
  const [distance, setDistance] = useState(null);
  const [pricingError, setPricingError] = useState(null);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [selectedPrice, setSelectedPrice] = useState(null);
  const [offeredPrice, setOfferedPrice] = useState(null);
  const [ride, setRide] = useState(null);

  const panelRef = useRef(null);
  const titleRef = useRef(null);
  const searchRef = useRef(null);
  const vehicleRef = useRef(null);
  const arrowRef = useRef(null);
  const vehicleFoundRef = useRef(null);
  const driverSelectedRef = useRef(null);
  const confirmRidePanelRef = useRef(null);
  const suggestionTimerRef = useRef(null);
  const suggestionSeqRef = useRef(0);

  const { socket } = useContext(SocketContext);
  const { user } = useContext(UserDataContext);
  const { isLoaded: mapsApiLoaded } = useGoogleMapsScript();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user?._id) return;
    socket.emit("join", { userType: "user", userId: user._id });
  }, [user?._id, socket]);

  useEffect(() => {
    const onRideStarted = (rideData) => {
      setDriverSelected(false);
      setVehicleFound(false);
      setConfirmRidePanel(false);
      setVehiclePanel(false);
      navigate("/riding", { state: { ride: rideData } });
    };

    const onRideConfirmed = (rideData) => {
      setVehicleFound(false);
      setConfirmRidePanel(false);
      setVehiclePanel(false);
      setDriverSelected(true);
      setRide(rideData || null);
    };

    socket.on("ride-started", onRideStarted);
    socket.on("ride-confirmed", onRideConfirmed);

    return () => {
      socket.off("ride-started", onRideStarted);
      socket.off("ride-confirmed", onRideConfirmed);
    };
  }, [socket, navigate]);

  const normalizeSuggestionRows = (rows) =>
    (Array.isArray(rows) ? rows : [])
      .map((row) => ({
        description:
          row.description ||
          row.structured_formatting?.main_text ||
          row.formatted_address ||
          "",
        place_id: row.place_id || "",
      }))
      .filter((item) => item.description);

  const runFetchSuggestions = useCallback(
    async (query) => {
      const seq = ++suggestionSeqRef.current;

      if (mapsApiLoaded && window.google?.maps) {
        try {
          const { AutocompleteSuggestion } = await google.maps.importLibrary("places");
          const { suggestions: raw } =
            await AutocompleteSuggestion.fetchAutocompleteSuggestions({
              input: query,
            });

          const mapped = (raw ?? [])
            .map((item) => item.placePrediction)
            .filter(Boolean)
            .map((prediction) => {
              const description =
                prediction.text?.text ??
                [prediction.mainText?.text, prediction.secondaryText?.text]
                  .filter(Boolean)
                  .join(", ");

              return {
                description: description || "",
                place_id: prediction.placeId || "",
              };
            })
            .filter((item) => item.description);

          if (seq !== suggestionSeqRef.current) return;

          if (mapped.length > 0) {
            setSuggestions(mapped);
            return;
          }
        } catch (error) {
          console.warn(
            "Places autocomplete failed, using server fallback:",
            error?.message || error
          );
        }
      }

      try {
        const { data } = await axios.get(`${getApiBaseUrl()}/maps/get-suggestions`, {
          params: { address: query },
          timeout: 18000,
        });

        if (seq !== suggestionSeqRef.current) return;
        setSuggestions(normalizeSuggestionRows(data));
      } catch (error) {
        console.error("Error fetching suggestions:", error);
        if (seq === suggestionSeqRef.current) {
          setSuggestions([]);
        }
      }
    },
    [mapsApiLoaded]
  );

  const fetchSuggestions = (query) => {
    if (query.length < 3) {
      if (suggestionTimerRef.current) {
        clearTimeout(suggestionTimerRef.current);
        suggestionTimerRef.current = null;
      }
      setSuggestions([]);
      return;
    }

    if (suggestionTimerRef.current) {
      clearTimeout(suggestionTimerRef.current);
    }

    suggestionTimerRef.current = setTimeout(() => {
      suggestionTimerRef.current = null;
      runFetchSuggestions(query);
    }, 280);
  };

  useEffect(() => {
    return () => {
      if (suggestionTimerRef.current) {
        clearTimeout(suggestionTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setPrices(null);
    setDistance(null);
    setPricingError(null);
    setSelectedVehicle(null);
    setSelectedPrice(null);
    setOfferedPrice(null);
    setRide(null);
    setVehicleFound(false);
    setDriverSelected(false);
    setConfirmRidePanel(false);
  }, [pickup, destination]);

  useEffect(() => {
    if (!vehiclePanel || !pickup || !destination || prices != null) {
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) return;

    let cancelled = false;

    (async () => {
      try {
        setPricingError(null);

        const [pricesRes, distRes] = await Promise.all([
          axios.get(`${getApiBaseUrl()}/maps/get-prices`, {
            params: { origin: pickup, destination },
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get(`${getApiBaseUrl()}/maps/get-distance`, {
            params: { origin: pickup, destination },
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (!cancelled) {
          setPrices(pricesRes.data ?? null);
          setDistance(distRes.data ?? null);
          setPricingError(null);
        }
      } catch (error) {
        if (!cancelled) {
          const apiMsg = error?.response?.data?.message;
          const detail =
            typeof apiMsg === "string" && apiMsg.trim()
              ? apiMsg
              : error?.message || "No se pudieron cargar los precios para esta ruta.";

          console.error("Error fetching fare or distance:", detail, error);
          setPrices(null);
          setDistance(null);
          setPricingError(detail);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [vehiclePanel, pickup, destination, prices]);

  const logoutUser = async () => {
    try {
      const token = localStorage.getItem("token");
      await axios.get(`${getApiBaseUrl()}/users/logout`, {
        params: { origin: pickup, destination },
        headers: { Authorization: `Bearer ${token}` },
      });
      navigate("/login");
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  const handleSuggestionSelect = (suggestion) => {
    const selectedText =
      typeof suggestion === "string"
        ? suggestion
        : suggestion?.description || "";

    if (!selectedText) return;

    if (activeInput === "pickup") {
      setPickup(selectedText);
    } else {
      setDestination(selectedText);
    }

    setSuggestions([]);
    setPanelOpen(false);

    const nextPickup = activeInput === "pickup" ? selectedText : pickup;
    const nextDestination =
      activeInput === "destination" ? selectedText : destination;

    if (nextPickup && nextDestination) {
      setVehiclePanel(true);
    }
  };

  const createRide = async (offeredFare) => {
    const token = localStorage.getItem("token");

    if (!token) {
      throw new Error("No hay sesión activa.");
    }

    if (!pickup || !destination) {
      throw new Error("Debes ingresar origen y destino.");
    }

    if (!selectedVehicle) {
      console.error("No vehicle selected");
      throw new Error("No has seleccionado un vehículo.");
    }

    try {
      const finalOfferedFare =
        Number(offeredFare) || Number(selectedPrice) || 0;

      const response = await axios.post(
        `${getApiBaseUrl()}/rides/create`,
        {
          pickup,
          destination,
          vehicle: selectedVehicle,
          offeredFare: finalOfferedFare,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const rideData = response?.data ?? null;

      if (!rideData) {
        throw new Error("El servidor no devolvió la solicitud creada.");
      }

      setOfferedPrice(finalOfferedFare);
      setRide(rideData);

      setVehiclePanel(false);
      setConfirmRidePanel(false);
      setDriverSelected(false);

      return rideData;
    } catch (error) {
      console.error("Error creating ride:", error);
      alert(
        error?.response?.data?.message ||
          error?.message ||
          "No se pudo crear la solicitud."
      );
      setVehicleFound(false);
      setConfirmRidePanel(true);
      throw error;
    }
  };

  useGSAP(
    () => {
      if (vehiclePanel) {
        gsap.to(vehicleRef.current, {
          y: "0%",
          delay: 0.3,
        });
      } else {
        gsap.to(vehicleRef.current, {
          y: "100%",
        });
      }
    },
    [vehiclePanel]
  );

  useGSAP(
    () => {
      if (driverSelected) {
        gsap.to(driverSelectedRef.current, {
          y: "0%",
          delay: 0.3,
        });
      } else {
        gsap.to(driverSelectedRef.current, {
          y: "100%",
        });
      }
    },
    [driverSelected]
  );

  useGSAP(
    () => {
      if (vehicleFound) {
        gsap.to(vehicleFoundRef.current, {
          y: "0%",
          delay: 0.3,
        });
      } else {
        gsap.to(vehicleFoundRef.current, {
          y: "100%",
        });
      }
    },
    [vehicleFound]
  );

  useGSAP(
    () => {
      if (confirmRidePanel) {
        gsap.to(confirmRidePanelRef.current, {
          y: "0%",
          delay: 0.3,
        });
      } else {
        gsap.to(confirmRidePanelRef.current, {
          y: "100%",
        });
      }
    },
    [confirmRidePanel]
  );

  useGSAP(
    () => {
      if (panelOpen) {
        gsap.to(titleRef.current, {
          display: "none",
          duration: 0.3,
        });
        gsap.to(panelRef.current, {
          height: "68%",
          display: "flex",
          duration: 0.5,
          delay: 0.2,
          opacity: 1,
        });
        gsap.to(arrowRef.current, {
          display: "block",
          duration: 0.5,
          delay: 0.5,
        });
      } else {
        gsap.to(arrowRef.current, {
          display: "none",
          duration: 0.3,
        });
        gsap.to(panelRef.current, {
          height: "0%",
          display: "none",
          duration: 0.5,
          delay: 0.2,
          opacity: 0,
        });
        gsap.to(titleRef.current, {
          display: "block",
          duration: 0.5,
          delay: 0.3,
        });
      }
    },
    [panelOpen]
  );

  useEffect(() => {
    if (!user?._id || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        socket.emit("update-location-user", {
          userId: user._id,
          location: {
            ltd: position.coords.latitude,
            lng: position.coords.longitude,
          },
        });
      },
      (error) => {
        console.warn("No se pudo obtener la ubicación del usuario:", error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 20000,
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [user?._id, socket]);

  return (
    <div className="h-screen position-relative w-screen">
      <div>
        <img
          className="absolute w-20 ml-7 pt-7 z-30"
          src="/logo-centralgo.png"
          alt="Central Go"
        />
      </div>

      <Link
        onClick={logoutUser}
        className="absolute top-3 right-3 w-12 h-12 rounded-full bg-black flex items-center justify-center z-50"
      >
        <i
          style={{ color: "white" }}
          className="ri-logout-box-line ri-xl mb mr-0.5"
        ></i>
      </Link>

      <div
        className="absolute w-screen h-[100%] top-0 z-20"
        onClick={() => {
          setPanelOpen(false);
          setSuggestions([]);
        }}
      >
        <LiveTracking />
      </div>

      <div
        ref={searchRef}
        className="absolute flex flex-col justify-end top-0 h-screen w-full rounded-t-lg"
      >
        <div className="h-[32%] bg-white p-5 flex flex-col justify-around z-50">
          <h4 ref={titleRef} className="text-3xl font-semibold ml-1">
            Buscar un servicio
          </h4>

          <i
            onClick={() => {
              setPanelOpen(false);
            }}
            ref={arrowRef}
            className="ri-arrow-down-s-line text-2xl hidden"
          ></i>

          <form className="relative" onSubmit={submitHandler}>
            <div className="line absolute self-center h-[51%] w-1 bottom-1/4 ml-8 bg-black rounded-3xl">
              <div className="circle absolute h-3 w-3 bg-black rounded-full top-0 ml-[-4px]"></div>
              <div className="circle absolute h-3 w-3 bg-black rounded-full bottom-0 ml-[-4px]"></div>
            </div>

            <input
              value={pickup}
              onClick={() => {
                setPanelOpen(true);
                setActiveInput("pickup");
              }}
              onChange={(e) => {
                setPickup(e.target.value);
                fetchSuggestions(e.target.value);
              }}
              className="bg-[#eee] rounded-lg px-3 py-3 text-lg w-full mt-2 mb-2 pl-16"
              type="text"
              placeholder="Agregar punto de recogida"
            />

            <input
              value={destination}
              onClick={() => {
                setPanelOpen(true);
                setActiveInput("destination");
              }}
              onChange={(e) => {
                setDestination(e.target.value);
                fetchSuggestions(e.target.value);
              }}
              className="bg-[#eee] rounded-lg px-3 py-3 text-lg w-full mt-2 mb-2 pl-16"
              type="text"
              placeholder="Ingresa tu destino"
            />
          </form>
        </div>

        <div
          ref={panelRef}
          className="opacity-0 bg-white flex flex-col justify-start pl-5 pr-2 z-50"
        >
          <LocationSearchPanel
            vehiclePanel={vehiclePanel}
            setVehiclePanel={setVehiclePanel}
            panelOpen={panelOpen}
            setPanelOpen={setPanelOpen}
            setConfirmRidePanel={setConfirmRidePanel}
            suggestions={suggestions}
            onSuggestionSelect={handleSuggestionSelect}
          />
        </div>
      </div>

      <div
        ref={vehicleRef}
        className="fixed min-h-[35%] bottom-0 w-screen translate-y-full max-h-[50%] rounded-t-lg bg-white overflow-auto z-50"
      >
        <VehiclePanel
          setVehiclePanel={setVehiclePanel}
          setConfirmRidePanel={setConfirmRidePanel}
          prices={prices}
          distance={distance}
          pricingError={pricingError}
          setSelectedPrice={setSelectedPrice}
          setSelectedVehicle={setSelectedVehicle}
        />
      </div>

      <div
        ref={confirmRidePanelRef}
        className="fixed bottom-0 w-screen translate-y-full rounded-t-lg bg-white overflow-hidden z-50"
      >
        <ConfirmedRide
          setConfirmRidePanel={setConfirmRidePanel}
          setVehicleFound={setVehicleFound}
          vehicleFound={vehicleFound}
          selectedPrice={selectedPrice}
          selectedVehicle={selectedVehicle}
          destination={destination}
          pickup={pickup}
          createRide={createRide}
        />
      </div>

      <div
        ref={vehicleFoundRef}
        className="fixed z-50 bottom-0 w-screen translate-y-full rounded-t-lg bg-white overflow-hidden"
      >
        <FindingDriver
          setConfirmRidePanel={setConfirmRidePanel}
          setVehicleFound={setVehicleFound}
          vehicleFound={vehicleFound}
          selectedPrice={offeredPrice ?? selectedPrice}
          selectedVehicle={selectedVehicle}
          destination={destination}
          pickup={pickup}
          ride={ride}
        />
      </div>

      <div
        ref={driverSelectedRef}
        className="fixed z-50 bottom-0 w-screen translate-y-full rounded-t-lg bg-white overflow-hidden"
      >
        <DriverSelected ride={ride} />
      </div>
    </div>
  );
}

export default Home;
