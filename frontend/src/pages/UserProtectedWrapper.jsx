import React, {
  useContext,
  useEffect,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";
import axios from "axios";

import { UserDataContext } from "../context/UserContext";
import { getApiBaseUrl } from "../apiBase";

/*
 * =========================================================
 * TOKEN ESPECÍFICO DEL USUARIO
 * =========================================================
 *
 * userToken:
 * - Sesión del cliente/usuario.
 *
 * token:
 * - Se mantiene temporalmente como respaldo para no romper
 *   partes antiguas de Central Go.
 *
 * Nunca usamos captainToken para validar usuarios.
 */

const getUserToken = () => {
  return (
    localStorage.getItem("userToken") ||
    localStorage.getItem("token") ||
    ""
  );
};

const UserProtectedWrapper = ({ children }) => {
  const navigate = useNavigate();

  const {
    user,
    setUser,
  } = useContext(UserDataContext);

  const [isLoading, setIsLoading] =
    useState(true);

  const [authorized, setAuthorized] =
    useState(false);

  useEffect(() => {
    let cancelled = false;

    const validateUserSession = async () => {
      const userToken =
        getUserToken();

      if (!userToken) {
        if (!cancelled) {
          setAuthorized(false);
          setIsLoading(false);

          navigate(
            "/login",
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
            `${getApiBaseUrl()}/users/profile`,
            {
              headers: {
                Authorization:
                  `Bearer ${userToken}`,
              },
            }
          );

        const userData =
          response?.data?.user;

        if (!userData?._id) {
          throw new Error(
            "La respuesta no contiene un usuario válido."
          );
        }

        /*
         * Migramos la sesión antigua a la llave específica
         * del usuario.
         *
         * No eliminamos "token" todavía porque otros archivos
         * antiguos pueden seguir utilizándolo.
         */
        localStorage.setItem(
          "userToken",
          userToken
        );

        if (!cancelled) {
          setUser(userData);
          setAuthorized(true);
          setIsLoading(false);
        }
      } catch (error) {
        console.warn(
          "[UserProtectedWrapper] Sesión de usuario inválida:",
          error?.response?.data?.message ||
            error?.message
        );

        /*
         * Eliminamos únicamente la sesión específica del
         * usuario.
         *
         * No eliminamos:
         * - token
         * - captainToken
         *
         * Así evitamos cerrar accidentalmente la sesión
         * del conductor.
         */
        localStorage.removeItem(
          "userToken"
        );

        if (!cancelled) {
          setUser(null);
          setAuthorized(false);
          setIsLoading(false);

          navigate(
            "/login",
            {
              replace: true,
            }
          );
        }
      }
    };

    validateUserSession();

    return () => {
      cancelled = true;
    };
  }, [
    navigate,
    setUser,
  ]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="rounded-2xl bg-white border border-gray-200 shadow-lg px-6 py-5 text-center">
          <div className="w-10 h-10 rounded-full border-4 border-gray-200 border-t-black animate-spin mx-auto" />

          <p className="text-sm font-bold text-gray-700 mt-4">
            Validando sesión del usuario...
          </p>
        </div>
      </div>
    );
  }

  if (
    !authorized ||
    !user?._id
  ) {
    return null;
  }

  return <>{children}</>;
};

export default UserProtectedWrapper;