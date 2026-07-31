import React from "react";
import {
  Route,
  Routes,
  useLocation,
  Navigate,
} from "react-router-dom";

import { ToastContainer } from "react-toastify";

/*
 * =========================================================
 * PÁGINAS GENERALES
 * =========================================================
 */

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
import CaptainWallet from "./pages/CaptainWallet";

/*
 * =========================================================
 * EMPRESAS
 * =========================================================
 */

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

/*
 * =========================================================
 * SUPERADMIN
 * =========================================================
 */

import SuperAdminLogin from "./pages/SuperAdminLogin";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";

/*
 * =========================================================
 * MARKETPLACE DEL CONDUCTOR
 * =========================================================
 */

import CaptainGoodsOffers from "./pages/CaptainGoodsOffers";
import CaptainSpaceOffers from "./pages/CaptainSpaceOffers";
import CaptainSeatOffers from "./pages/CaptainSeatOffers";
import CaptainReceivedBids from "./pages/CaptainReceivedBids";

/*
 * Propuestas enviadas por el conductor para cargas.
 */
import CaptainLoadProposals from "./pages/CaptainLoadProposals";
import CaptainLoadService from "./pages/CaptainLoadService";

/*
 * =========================================================
 * MARKETPLACE DEL USUARIO
 * =========================================================
 */

import AvailableOffers from "./pages/AvailableOffers";
import UserSentBids from "./pages/UserSentBids";

import CreateLoadOffer from "./pages/CreateLoadOffer";
import UserLoadTracking from "./pages/UserLoadTracking";

/*
 * Cargas publicadas y propuestas recibidas.
 */
import MyLoadOffers from "./pages/MyLoadOffers";

const App = () => {
  const location = useLocation();

  return (
    <div>
      <Routes
        location={location}
        key={location.pathname}
      >
        {/*
         * ===================================================
         * INICIO Y AUTENTICACIÓN
         * ===================================================
         */}

        <Route
          path="/"
          element={<Start />}
        />

        <Route
          path="/login"
          element={<UserLogin />}
        />

        <Route
          path="/signup"
          element={<UserSignup />}
        />

        <Route
          path="/captain-login"
          element={<CaptainLogin />}
        />

        <Route
          path="/captain-signup"
          element={<CaptainSignup />}
        />

        <Route
          path="/riding"
          element={<RideStarted />}
        />

        {/*
         * ===================================================
         * SUPERADMIN
         * ===================================================
         */}

        <Route
          path="/centralgo-admin-root"
          element={<SuperAdminLogin />}
        />

        <Route
          path="/centralgo-admin-root/dashboard"
          element={<SuperAdminDashboard />}
        />

        {/*
         * ===================================================
         * EMPRESAS
         * ===================================================
         */}

        <Route
          path="/enterprise-access"
          element={<EnterpriseAccess />}
        />

        <Route
          path="/enterprise-login"
          element={<EnterpriseLogin />}
        />

        <Route
          path="/enterprise-signup"
          element={<EnterpriseSignup />}
        />

        <Route
          path="/enterprise-dashboard"
          element={<EnterpriseDashboard />}
        />

        <Route
          path="/enterprise-drivers"
          element={<EnterpriseDrivers />}
        />

        <Route
          path="/enterprise-logistics"
          element={<EnterpriseLogistics />}
        />

        <Route
          path="/enterprise-clients"
          element={<EnterpriseClients />}
        />

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

        {/*
         * ===================================================
         * USUARIO
         * ===================================================
         */}

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

        {/*
         * Formulario para publicar una carga.
         */}
        <Route
          path="/create-load-offer"
          element={
            <UserProtectedWrapper>
              <CreateLoadOffer />
            </UserProtectedWrapper>
          }
        />

        <Route
          path="/load-tracking/:trackingId"
          element={
            <UserProtectedWrapper>
              <UserLoadTracking />
            </UserProtectedWrapper>
          }
        />

        {/*
         * Cargas publicadas por el usuario y propuestas
         * recibidas de los transportadores.
         */}
        <Route
          path="/my-load-offers"
          element={
            <UserProtectedWrapper>
              <MyLoadOffers />
            </UserProtectedWrapper>
          }
        />

        {/*
         * Ofertas enviadas por el usuario para Mercancía
         * y Cupos.
         */}
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

        {/*
         * ===================================================
         * CONDUCTOR
         * ===================================================
         */}

        <Route
          path="/captain-home"
          element={
            <CaptainProtectedWrapper>
              <CaptainHome />
            </CaptainProtectedWrapper>
          }
        />

        <Route
          path="/captain-wallet"
          element={
            <CaptainProtectedWrapper>
              <CaptainWallet />
            </CaptainProtectedWrapper>
          }
        />

        {/*
         * El conductor publica mercancía.
         */}
        <Route
          path="/captain/offers/goods"
          element={
            <CaptainProtectedWrapper>
              <CaptainGoodsOffers />
            </CaptainProtectedWrapper>
          }
        />

        {/*
         * El conductor ve cargas publicadas por usuarios
         * y envía propuestas.
         */}
        <Route
          path="/captain/offers/space"
          element={
            <CaptainProtectedWrapper>
              <CaptainSpaceOffers />
            </CaptainProtectedWrapper>
          }
        />

        {/*
         * Alias más claro para abrir el marketplace de cargas.
         */}
        <Route
          path="/captain/load-marketplace"
          element={
            <CaptainProtectedWrapper>
              <CaptainSpaceOffers />
            </CaptainProtectedWrapper>
          }
        />

        {/*
         * Propuestas que el conductor ha enviado para cargas.
         */}
        <Route
          path="/captain/load-proposals"
          element={
            <CaptainProtectedWrapper>
              <CaptainLoadProposals />
            </CaptainProtectedWrapper>
          }
        />

        <Route
          path="/captain/load-service/:trackingId"
          element={
            <CaptainProtectedWrapper>
              <CaptainLoadService />
            </CaptainProtectedWrapper>
          }
        />

        {/*
         * El conductor publica cupos.
         */}
        <Route
          path="/captain/offers/seats"
          element={
            <CaptainProtectedWrapper>
              <CaptainSeatOffers />
            </CaptainProtectedWrapper>
          }
        />

        {/*
         * Solicitudes recibidas para Mercancía y Cupos.
         */}
        <Route
          path="/captain/offers/received"
          element={
            <CaptainProtectedWrapper>
              <CaptainReceivedBids />
            </CaptainProtectedWrapper>
          }
        />

        <Route
          path="/captain-riding"
          element={
            <CaptainProtectedWrapper>
              <CaptainRiding />
            </CaptainProtectedWrapper>
          }
        />

        <Route
          path="/captain-logout"
          element={
            <CaptainProtectedWrapper>
              <CaptainLogout />
            </CaptainProtectedWrapper>
          }
        />

        {/*
         * ===================================================
         * RUTA DESCONOCIDA
         * ===================================================
         */}

        <Route
          path="*"
          element={
            <Navigate
              to="/"
              replace
            />
          }
        />
      </Routes>

      <ToastContainer />
    </div>
  );
};

export default App;