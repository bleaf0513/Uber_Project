import React from "react";
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
import EnterpriseAccess from "./pages/EnterpriseAccess";
import EnterpriseClients from "./pages/EnterpriseClients";

import SuperAdminLogin from "./pages/SuperAdminLogin";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";

import CaptainGoodsOffers from "./pages/CaptainGoodsOffers";
import CaptainSpaceOffers from "./pages/CaptainSpaceOffers";
import CaptainSeatOffers from "./pages/CaptainSeatOffers";
import CaptainReceivedBids from "./pages/CaptainReceivedBids";

import AvailableOffers from "./pages/AvailableOffers";
import UserSentBids from "./pages/UserSentBids";

import GlobalOfferNotifications from "./components/GlobalOfferNotifications";

const App = () => {
  return (
    <div>
      <GlobalOfferNotifications />

      <Routes>
        <Route path="/" element={<Start />} />
        <Route path="/login" element={<UserLogin />} />
        <Route path="/signup" element={<UserSignup />} />
        <Route path="/captain-login" element={<CaptainLogin />} />
        <Route path="/captain-signup" element={<CaptainSignup />} />
        <Route path="/riding" element={<RideStarted />} />

        <Route path="/centralgo-admin-root" element={<SuperAdminLogin />} />
        <Route
          path="/centralgo-admin-root/dashboard"
          element={<SuperAdminDashboard />}
        />

        <Route path="/enterprise-access" element={<EnterpriseAccess />} />
        <Route path="/enterprise-login" element={<EnterpriseLogin />} />
        <Route path="/enterprise-signup" element={<EnterpriseSignup />} />
        <Route path="/enterprise-dashboard" element={<EnterpriseDashboard />} />
        <Route path="/enterprise-drivers" element={<EnterpriseDrivers />} />
        <Route path="/enterprise-logistics" element={<EnterpriseLogistics />} />
        <Route path="/enterprise-clients" element={<EnterpriseClients />} />
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
          path="/captain/offers/goods"
          element={
            <CaptainProtectedWrapper>
              <CaptainGoodsOffers />
            </CaptainProtectedWrapper>
          }
        />

        <Route
          path="/captain/offers/space"
          element={
            <CaptainProtectedWrapper>
              <CaptainSpaceOffers />
            </CaptainProtectedWrapper>
          }
        />

        <Route
          path="/captain/offers/seats"
          element={
            <CaptainProtectedWrapper>
              <CaptainSeatOffers />
            </CaptainProtectedWrapper>
          }
        />

        <Route
          path="/captain/offers/received"
          element={
            <CaptainProtectedWrapper>
              <CaptainReceivedBids />
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
          path="/available-offers"
          element={
            <UserProtectedWrapper>
              <AvailableOffers />
            </UserProtectedWrapper>
          }
        />

        <Route
          path="/my-sent-bids"
          element={
            <UserProtectedWrapper>
              <UserSentBids />
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
  );
};

export default App;