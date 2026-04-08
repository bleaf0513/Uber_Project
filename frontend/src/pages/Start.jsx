import React from "react";
import { Link } from "react-router-dom";

const Start = () => {
  return (
    <div className="min-h-screen w-full flex flex-col justify-between bg-gradient-to-b from-sky-500 to-blue-600 pt-7">
      <img
        className="w-48 ml-7"
        src="/logo-centralgo.png"
        alt="Central Go"
      />

      <img
        className="w-full object-contain px-6 mt-2"
        src="https://dropinblog.net/34254033/files/featured/Storyboard_Images/City_driver-rafiki.png"
        alt="banner"
      />

      <div className="bg-white py-8 pb-10 text-center rounded-t-3xl shadow-2xl px-5 mt-4">
        <h2 className="text-3xl font-bold text-gray-900">
          ¿Cómo quieres usar Central Go?
        </h2>

        <p className="text-gray-600 mt-3 text-base leading-relaxed">
          Elige una opción según tu perfil para continuar.
        </p>

        <div className="mt-6 border border-gray-200 rounded-2xl p-5 bg-gray-50 shadow-sm">
          <h3 className="text-2xl font-bold text-gray-900">
            Solicitar un viaje
          </h3>

          <p className="text-sm text-gray-600 mt-2 leading-relaxed">
            Pide un carro o servicio de transporte de forma rápida y segura.
          </p>

          <Link
            to="/login"
            className="flex items-center justify-center w-full bg-black text-white py-3 rounded-xl mt-5 text-lg font-semibold"
          >
            Pedir un carro
          </Link>
        </div>

        <div className="mt-7">
          <div className="flex items-center gap-3">
            <div className="h-px bg-gray-300 flex-1"></div>
            <p className="text-sm font-semibold text-gray-500">
              ACCESOS DE TRABAJO
            </p>
            <div className="h-px bg-gray-300 flex-1"></div>
          </div>

          <p className="text-sm text-gray-500 mt-3">
            Solo para conductores y empresas registradas.
          </p>
        </div>

        <div className="mt-5 border border-gray-200 rounded-2xl p-4 bg-gray-50 shadow-sm text-left">
          <h3 className="text-lg font-bold text-gray-900">
            Conductor empresarial
          </h3>

          <p className="text-sm text-gray-600 mt-2 leading-relaxed">
            Accede a tus asignaciones, inicia entregas y finaliza recorridos.
          </p>

          <Link
            to="/enterprise-driver-login"
            className="flex items-center justify-center w-full bg-green-600 text-white py-3 rounded-xl mt-4 text-base font-semibold"
          >
            Ingresar como conductor
          </Link>
        </div>

        <div className="mt-4 border border-gray-200 rounded-2xl p-4 bg-gray-50 shadow-sm text-left">
          <h3 className="text-lg font-bold text-gray-900">
            Panel empresarial
          </h3>

          <p className="text-sm text-gray-600 mt-2 leading-relaxed">
            Supervisa conductores, rutas, entregas y operación logística de tu
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
