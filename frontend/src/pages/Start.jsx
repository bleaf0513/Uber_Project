import React from "react";
import { Link } from "react-router-dom";

const Start = () => {
  return (
    <div className="h-screen w-full flex justify-between flex-col bg-gradient-to-b from-sky-500 to-blue-600 pt-7">
      <img
        className="w-28 ml-7"
        src="/logo-centralgo.png"
        alt="Central Go"
      />

      <img
        className="w-full object-contain px-6"
        src="https://dropinblog.net/34254033/files/featured/Storyboard_Images/City_driver-rafiki.png"
        alt="banner"
      />

      <div className="bg-white py-9 pb-10 text-center rounded-t-3xl shadow-2xl">
        <h2 className="text-3xl font-bold text-gray-900">
          Bienvenido a Central Go
        </h2>

        <p className="text-gray-600 mt-2 px-6">
          Tu forma rápida y segura de moverte por la ciudad.
        </p>

        <Link
          to="/login"
          className="flex items-center justify-center mx-5 bg-black text-white py-3 rounded-xl mt-6 text-xl font-semibold"
        >
          Continuar
        </Link>
      </div>
    </div>
  );
};

export default Start;
