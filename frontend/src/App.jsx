import React, { useState, useEffect } from "react";
import { Route, Routes } from "react-router-dom";
import Start from "./pages/Start";
import UserLogin from "./pages/UserLogin";
import UserSignup from "./pages/UserSignup";
import CaptainLogin from "./pages/CaptainLogin";
import CaptainSignup from "./pages/CaptainSignup";
import Home from "./pages/Home";
import UserProtectedWrapper from "./pages/UserProtectedWrapper";
import UserLogout from "./pages/UserLogout";
import CaptainHome from "./pages/CaptainHome";
import CaptainProtectedWrapper from "./pages/CaptainProtectWrapper";
import CaptainLogout from "./pages/CaptainLogout";
import RideStarted from "./pages/RideStarted";
import CaptainRiding from "./pages/CaptainRiding";
import { ToastContainer } from "react-toastify";

const App = () => {
  const [isMobileView, setIsMobileView] = useState(false);

  useEffect(() => {
    const checkMobileView = () => {
      setIsMobileView(window.innerWidth <= 768);
    };

    // Check initially
    checkMobileView();

    // Add resize listener
    window.addEventListener("resize", checkMobileView);

    // Cleanup
    return () => window.removeEventListener("resize", checkMobileView);
  }, []);

  const DesktopMessage = () => (
  <div
    className="text-white flex flex-col justify-center items-center"
    style={{
      height: "100vh",
      textAlign: "center",
      padding: "20px",
      background: "linear-gradient(to right, #00c6ff, #0072ff)",
    }}
  >
    <img
      className="w-40 mb-6 object-contain"
      src="/logo-centralgo.png"
      alt="Central Go"
    />
    <h1 className="text-3xl font-bold mb-3">
      Central Go está diseñado para verse mejor en celular
    </h1>
    <p className="text-lg max-w-xl">
      Por favor abre la aplicación en modo móvil o desde tu teléfono.
    </p>
  </div>
);

  return isMobileView ? (
    <div>
      <Routes>
        <Route path="/" element={<Start />} />
        <Route path="/login" element={<UserLogin />} />
        <Route path="/signup" element={<UserSignup />} />
        <Route path="/captain-login" element={<CaptainLogin />} />
        <Route path="/captain-signup" element={<CaptainSignup />} />
        <Route path="/riding" element={<RideStarted />} />
        <Route
          path="/captain-home"
          element={
            <CaptainProtectedWrapper>
              <CaptainHome />
            </CaptainProtectedWrapper>
          }
        />
        <Route
          path="/home"
          element={
            <UserProtectedWrapper>
              <Home />
            </UserProtectedWrapper>
          }
        />
        <Route
          path="/user-logout"
          element={
            <UserProtectedWrapper>
              <UserLogout />
            </UserProtectedWrapper>
          }
        ></Route>
        <Route path="/captain-riding" element={<CaptainRiding />}></Route>
        <Route
          path="/captain-logout"
          element={
            <CaptainProtectedWrapper>
              <CaptainLogout />
            </CaptainProtectedWrapper>
          }
        ></Route>
      </Routes>
      <ToastContainer />
    </div>
  ) : (
    <DesktopMessage />
  );
};

export default App;
