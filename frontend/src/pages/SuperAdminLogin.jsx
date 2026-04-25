import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getApiBaseUrl } from "../apiBase";

const API_BASE = getApiBaseUrl();

const SuperAdminLogin = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email.trim() || !password.trim()) {
      alert("Ingresa correo y contraseña.");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(`${API_BASE}/super-admin/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      const text = await response.text();
      let data = {};

      try {
        data = text ? JSON.parse(text) : {};
      } catch (error) {
        throw new Error(`Respuesta inválida del backend: ${text}`);
      }

      if (!response.ok) {
        throw new Error(data.message || "No fue posible iniciar sesión.");
      }

      if (!data.token) {
        throw new Error("El backend no devolvió token de Super Admin.");
      }

      localStorage.setItem("superAdminToken", data.token);
      localStorage.setItem("superAdminData", JSON.stringify(data.admin || {}));

      navigate("/centralgo-admin-root/dashboard");
    } catch (error) {
      console.error("Error login Super Admin:", error);
      alert(error.message || "No fue posible iniciar sesión.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-5">
      <div className="absolute inset-0 overflow-hidden opacity-30">
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-blue-500 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-emerald-500 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md rounded-[32px] border border-white/10 bg-white/10 p-7 shadow-2xl backdrop-blur">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-white text-3xl">
            🛡️
          </div>

          <h1 className="text-3xl font-extrabold">Central Go Root</h1>
          <p className="mt-2 text-sm text-slate-300">
            Acceso privado al panel maestro administrativo.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-200">
              Correo administrador
            </label>
            <input
              type="email"
              value={email}
              placeholder="admin@centralgo.com"
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white px-4 py-3 text-slate-900 outline-none focus:ring-4 focus:ring-blue-500/30"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-200">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              placeholder="••••••••"
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white px-4 py-3 text-slate-900 outline-none focus:ring-4 focus:ring-blue-500/30"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-emerald-500 px-5 py-3 font-bold text-slate-950 shadow-lg transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Ingresando..." : "Entrar al Super Admin"}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-slate-400">
          Ruta oculta. No aparece en el menú público de la aplicación.
        </p>
      </div>
    </div>
  );
};

export default SuperAdminLogin;