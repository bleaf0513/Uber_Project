import React, {
  useContext,
  useEffect,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";
import axios from "axios";

import { CaptainDataContext } from "../context/CaptainContext";
import { getApiBaseUrl } from "../apiBase";

const getCaptainToken = () => {
  return (
    localStorage.getItem("captainToken") ||
    localStorage.getItem("token") ||
    ""
  );
};

const CaptainProtectedWrapper = ({ children }) => {
  const navigate = useNavigate();

  const {
    captain,
    setCaptain,
  } = useContext(CaptainDataContext);

  const [isLoading, setIsLoading] =
    useState(true);

  const [authorized, setAuthorized] =
    useState(false);

  useEffect(() => {
    let cancelled = false;

    const validateCaptainSession = async () => {
      const captainToken =
        getCaptainToken();

      if (!captainToken) {
        if (!cancelled) {
          setAuthorized(false);
          setIsLoading(false);
          navigate(
            "/captain-login",
            {
              replace: true,
            }
          );
        }

        return;
      }

      try {
        const response =
          await axios.get(
            `${getApiBaseUrl()}/captain/profile`,
            {
              headers: {
                Authorization:
                  `Bearer ${captainToken}`,
              },
            }
          );

        const captainData =
          response?.data?.captain;

        if (!captainData?._id) {
          throw new Error(
            "La respuesta no contiene un conductor válido."
          );
        }

        /*
         * Guardamos el token específico del conductor.
         *
         * La llave general "token" se conserva por
         * compatibilidad con partes antiguas de la app,
         * pero captainToken será la fuente principal.
         */
        localStorage.setItem(
          "captainToken",
          captainToken
        );

        if (!cancelled) {
          setCaptain(captainData);
          setAuthorized(true);
          setIsLoading(false);
        }
      } catch (error) {
        console.warn(
          "[CaptainProtectedWrapper] Sesión de conductor inválida:",
          error?.response?.data?.message ||
            error?.message
        );

        /*
         * Solo eliminamos captainToken.
         *
         * No eliminamos "token" porque podría pertenecer
         * a una sesión de usuario abierta en otra parte.
         */
        localStorage.removeItem(
          "captainToken"
        );

        if (!cancelled) {
          setCaptain(null);
          setAuthorized(false);
          setIsLoading(false);

          navigate(
            "/captain-login",
            {
              replace: true,
            }
          );
        }
      }
    };

    validateCaptainSession();

    return () => {
      cancelled = true;
    };
  }, [
    navigate,
    setCaptain,
  ]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="rounded-2xl bg-white border border-gray-200 shadow-lg px-6 py-5 text-center">
          <div className="w-10 h-10 rounded-full border-4 border-gray-200 border-t-black animate-spin mx-auto" />

          <p className="text-sm font-bold text-gray-700 mt-4">
            Validando sesión del conductor...
          </p>
        </div>
      </div>
    );
  }

  if (
    !authorized ||
    !captain?._id
  ) {
    return null;
  }

  return <>{children}</>;
};

export default CaptainProtectedWrapper;