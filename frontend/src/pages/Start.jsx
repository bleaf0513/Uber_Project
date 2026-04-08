import React from "react";
import { Link } from "react-router-dom";

const Start = () => {
  return (
    <div className="h-screen w-full flex justify-between flex-col bg-gradient-to-b from-sky-500 to-blue-600 pt-7">
      <img
        className="w-48 ml-7"
        src="/logo-centralgo.png"
        alt="Central Go"
      />

      <img
        className="w-full object-contain px-6"
        src="https://dropinblog.net/34254033/files/featured/Storyboard_Images/City_driver-rafiki.png"
        alt="banner"
      />

      <div className="bg-white py-9 pb-10 text-center rounded-t-3xl shadow-2xl px-5">
        <h2 className="text-3xl font-bold text-gray-900">
          Bienvenido a Central Go
        </h2>

        <p className="text-gray-600 mt-2">
          Tu forma rápida y segura de moverte por la ciudad.
        </p>

        <Link
          to="/login"
          className="flex items-center justify-center w-full bg-black text-white py-3 rounded-xl mt-6 text-xl font-semibold"
        >
          Continuar
        </Link>

        <div className="mt-6 border border-gray-200 rounded-2xl p-4 bg-gray-50 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900">
            Panel Empresarial
          </h3>

          <p className="text-sm text-gray-600 mt-2">
            Supervisa conductores, rutas y servicios en tiempo real para tu
            empresa.
          </p>

          <Link
            to="/enterprise-login"
            className="flex items-center justify-center w-full bg-blue-600 text-white py-3 rounded-xl mt-4 text-base font-semibold"
          >
            Ingresar como empresa
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Start;
