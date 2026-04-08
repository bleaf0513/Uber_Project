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
import EnterpriseLogin from "./pages/EnterpriseLogin";
import EnterpriseSignup from "./pages/EnterpriseSignup";
import EnterpriseDashboard from "./pages/EnterpriseDashboard";
import EnterpriseDrivers from "./pages/EnterpriseDrivers";
import EnterpriseLogistics from "./pages/EnterpriseLogistics";
import EnterpriseDriverPanel from "./pages/EnterpriseDriverPanel";
import EnterpriseDriverLogin from "./pages/EnterpriseDriverLogin";
import EnterpriseDeliveryStats from "./pages/EnterpriseDeliveryStats";
import EnterpriseDeliveryHistory from "./pages/EnterpriseDeliveryHistory";

const App = () => {
  const [isMobileView, setIsMobileView] = useState(false);

  useEffect(() => {
    const checkMobileView = () => {
      setIsMobileView(window.innerWidth <= 768);
    };

    checkMobileView();
    window.addEventListener("resize", checkMobileView);

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
        className="w-72 mb-10 object-contain"
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

        <Route path="/enterprise-login" element={<EnterpriseLogin />} />
        <Route path="/enterprise-signup" element={<EnterpriseSignup />} />
        <Route path="/enterprise-dashboard" element={<EnterpriseDashboard />} />
        <Route path="/enterprise-drivers" element={<EnterpriseDrivers />} />
        <Route path="/enterprise-logistics" element={<EnterpriseLogistics />} />
        <Route
          path="/enterprise-driver-login"
          element={<EnterpriseDriverLogin />}
        />
        <Route
          path="/enterprise-driver-panel"
          element={<EnterpriseDriverPanel />}
        />
        <Route
          path="/enterprise-delivery-stats"
          element={<EnterpriseDeliveryStats />}
        />
        <Route
          path="/enterprise-delivery-history"
          element={<EnterpriseDeliveryHistory />}
        />

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
        />

        <Route path="/captain-riding" element={<CaptainRiding />} />

        <Route
          path="/captain-logout"
          element={
            <CaptainProtectedWrapper>
              <CaptainLogout />
            </CaptainProtectedWrapper>
          }
        />
      </Routes>

      <ToastContainer />
    </div>
  ) : (
    <DesktopMessage />
  );
};

export default App;
