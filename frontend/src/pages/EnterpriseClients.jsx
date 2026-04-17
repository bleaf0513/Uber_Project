import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { getApiBaseUrl } from "../apiBase";
import { useGoogleMapsScript } from "../context/GoogleMapsLoadContext";

const API_BASE = getApiBaseUrl();

const emptyForm = {
  name: "",
  address: "",
  phone: "",
  neighborhood: "",
  reference: "",
  notes: "",
  placeId: "",
  isActive: true,
};

const EnterpriseClients = () => {
  const [clients, setClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [savingClient, setSavingClient] = useState(false);
  const [deletingClientId, setDeletingClientId] = useState("");
  const [editingClientId, setEditingClientId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");

  const [formData, setFormData] = useState(emptyForm);
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [addressSelected, setAddressSelected] = useState(false);
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressTouched, setAddressTouched] = useState(false);
  const [addressNoResults, setAddressNoResults] = useState(false);

  const suggestionTimerRef = useRef(null);
  const suggestionSeqRef = useRef(0);
  const addressBoxRef = useRef(null);

  const { isLoaded: mapsApiLoaded } = useGoogleMapsScript();

  const parseJsonSafe = async (response, label = "API") => {
    const text = await response.text();
    console.log(`${label} raw response:`, text);

    try {
      return text ? JSON.parse(text) : {};
    } catch (error) {
      throw new Error(
        `La API no devolvió JSON válido en ${label}. Respuesta: ${text.slice(0, 150)}`
      );
    }
  };

  const fetchClients = useCallback(async () => {
    try {
      setLoadingClients(true);

      const response = await fetch(`${API_BASE}/enterprise-clients`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      const data = await parseJsonSafe(response, "GET /enterprise-clients");

      if (!response.ok) {
        throw new Error(data.message || "No se pudieron cargar los clientes.");
      }

      const incomingClients = Array.isArray(data.clients) ? data.clients : [];
      setClients(incomingClients);
    } catch (error) {
      console.error("Error cargando clientes:", error);
      alert(error.message || "No se pudieron cargar los clientes.");
    } finally {
      setLoadingClients(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (addressBoxRef.current && !addressBoxRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    return () => {
      if (suggestionTimerRef.current) {
        clearTimeout(suggestionTimerRef.current);
      }
    };
  }, []);

  const runFetchSuggestions = useCallback(
    async (query) => {
      const seq = ++suggestionSeqRef.current;

      try {
        setAddressLoading(true);
        setAddressNoResults(false);

        if (!mapsApiLoaded || !window.google?.maps) {
          if (seq === suggestionSeqRef.current) {
            setAddressSuggestions([]);
            setShowSuggestions(true);
            setAddressNoResults(true);
          }
          return;
        }

        const { AutocompleteSuggestion } = await google.maps.importLibrary("places");

        const request = {
          input: query,
        };

        const response = await AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
        const raw = response?.suggestions || [];

        const mapped = raw
          .map((item) => item?.placePrediction)
          .filter(Boolean)
          .map((prediction) => {
            const description =
              prediction?.text?.text ||
              [prediction?.mainText?.text, prediction?.secondaryText?.text]
                .filter(Boolean)
                .join(", ");

            return {
              description: description || "",
              place_id: prediction?.placeId || "",
            };
          })
          .filter((item) => item.description);

        if (seq !== suggestionSeqRef.current) return;

        setAddressSuggestions(mapped.slice(0, 8));
        setShowSuggestions(true);
        setAddressNoResults(mapped.length === 0);
      } catch (error) {
        console.error("Error consultando Google Places:", error);

        if (seq === suggestionSeqRef.current) {
          setAddressSuggestions([]);
          setAddressNoResults(true);
          setShowSuggestions(true);
        }
      } finally {
        if (seq === suggestionSeqRef.current) {
          setAddressLoading(false);
        }
      }
    },
    [mapsApiLoaded]
  );

  const fetchSuggestions = (query) => {
    const clean = String(query || "").trim();

    if (clean.length < 3) {
      if (suggestionTimerRef.current) {
        clearTimeout(suggestionTimerRef.current);
        suggestionTimerRef.current = null;
      }

      setAddressSuggestions([]);
      setShowSuggestions(false);
      setAddressLoading(false);
      setAddressNoResults(false);
      return;
    }

    if (suggestionTimerRef.current) {
      clearTimeout(suggestionTimerRef.current);
    }

    suggestionTimerRef.current = setTimeout(() => {
      suggestionTimerRef.current = null;
      runFetchSuggestions(clean);
    }, 280);
  };

  const resetForm = () => {
    setFormData(emptyForm);
    setEditingClientId("");
    setAddressSuggestions([]);
    setShowSuggestions(false);
    setAddressSelected(false);
    setAddressLoading(false);
    setAddressTouched(false);
    setAddressNoResults(false);
  };

  const handleAddressSelect = (suggestion) => {
    setFormData((prev) => ({
      ...prev,
      address: suggestion.description || "",
      placeId: suggestion.place_id || "",
    }));

    setAddressSelected(true);
    setAddressTouched(true);
    setAddressSuggestions([]);
    setAddressNoResults(false);
    setShowSuggestions(false);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setFormData((prev) => {
      const next = {
        ...prev,
        [name]: type === "checkbox" ? checked : value,
      };

      if (name === "address") {
        next.placeId = "";
        setAddressSelected(false);
        setAddressTouched(true);
        setAddressNoResults(false);
        fetchSuggestions(value);
      }

      return next;
    });
  };

  const handleEditClient = (client) => {
    setEditingClientId(String(client?._id || client?.id || ""));
    setFormData({
      name: client?.name || "",
      address: client?.address || "",
      phone: client?.phone || "",
      neighborhood: client?.neighborhood || "",
      reference: client?.reference || "",
      notes: client?.notes || "",
      placeId: client?.placeId || "",
      isActive: Boolean(client?.isActive ?? true),
    });
    setAddressSelected(Boolean(client?.address && client?.placeId));
    setAddressTouched(Boolean(client?.address));
    setAddressSuggestions([]);
    setShowSuggestions(false);
    setAddressLoading(false);
    setAddressNoResults(false);

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSaveClient = async (e) => {
    e.preventDefault();

    const payload = {
      name: String(formData.name || "").trim(),
      address: String(formData.address || "").trim(),
      phone: String(formData.phone || "").trim(),
      neighborhood: String(formData.neighborhood || "").trim(),
      reference: String(formData.reference || "").trim(),
      notes: String(formData.notes || "").trim(),
      placeId: String(formData.placeId || "").trim(),
      isActive: Boolean(formData.isActive),
    };

    if (!payload.name || !payload.address || !payload.phone) {
      alert("Nombre, dirección y teléfono son obligatorios.");
      return;
    }

    if (!addressSelected && !payload.placeId) {
      alert("Debes escoger la dirección desde la lista de Google Maps.");
      return;
    }

    try {
      setSavingClient(true);

      const isEditing = Boolean(editingClientId);
      const endpoint = isEditing
        ? `${API_BASE}/enterprise-clients/${editingClientId}`
        : `${API_BASE}/enterprise-clients`;

      const response = await fetch(endpoint, {
        method: isEditing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = await parseJsonSafe(
        response,
        isEditing ? "PUT /enterprise-clients/:id" : "POST /enterprise-clients"
      );

      if (!response.ok) {
        throw new Error(data.message || "No fue posible guardar el cliente.");
      }

      resetForm();
      await fetchClients();

      alert(isEditing ? "Cliente actualizado correctamente." : "Cliente creado correctamente.");
    } catch (error) {
      console.error("Error guardando cliente:", error);
      alert(error.message || "No fue posible guardar el cliente.");
    } finally {
      setSavingClient(false);
    }
  };

  const handleDeleteClient = async (clientId) => {
    const confirmed = window.confirm(
      "¿Seguro que deseas eliminar este cliente? Esta acción puede afectar búsquedas futuras."
    );

    if (!confirmed) return;

    try {
      setDeletingClientId(String(clientId));

      const response = await fetch(`${API_BASE}/enterprise-clients/${clientId}`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await parseJsonSafe(response, "DELETE /enterprise-clients/:id");

      if (!response.ok) {
        throw new Error(data.message || "No fue posible eliminar el cliente.");
      }

      if (String(editingClientId) === String(clientId)) {
        resetForm();
      }

      await fetchClients();
      alert("Cliente eliminado correctamente.");
    } catch (error) {
      console.error("Error eliminando cliente:", error);
      alert(error.message || "No fue posible eliminar el cliente.");
    } finally {
      setDeletingClientId("");
    }
  };

  const filteredClients = useMemo(() => {
    const term = String(searchTerm || "").trim().toLowerCase();

    return clients
      .filter((client) => {
        const matchesSearch =
          !term ||
          String(client?.name || "").toLowerCase().includes(term) ||
          String(client?.phone || "").toLowerCase().includes(term) ||
          String(client?.address || "").toLowerCase().includes(term) ||
          String(client?.neighborhood || "").toLowerCase().includes(term);

        const matchesStatus =
          statusFilter === "Todos" ||
          (statusFilter === "Activos" && Boolean(client?.isActive ?? true)) ||
          (statusFilter === "Inactivos" && !Boolean(client?.isActive ?? true));

        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        const aUpdated = a?.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const bUpdated = b?.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return bUpdated - aUpdated;
      });
  }, [clients, searchTerm, statusFilter]);

  const activeClientsCount = useMemo(() => {
    return clients.filter((client) => Boolean(client?.isActive ?? true)).length;
  }, [clients]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-br from-slate-950 via-fuchsia-900 to-pink-700 text-white">
        <div className="absolute inset-0 opacity-25">
          <div className="absolute -top-16 -left-10 h-48 w-48 rounded-full bg-pink-400 blur-3xl" />
          <div className="absolute top-8 right-0 h-56 w-56 rounded-full bg-fuchsia-400 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-7xl px-5 py-8 lg:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-pink-100 backdrop-blur">
                <span>👥</span>
                <span>Central Go Empresas</span>
              </div>

              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-pink-200">
                Base de datos de clientes
              </p>

              <h1 className="mt-2 text-3xl font-extrabold tracking-tight md:text-5xl">
                Clientes en línea
              </h1>

              <p className="mt-3 max-w-2xl text-sm text-pink-100 md:text-base">
                Administra clientes, direcciones y teléfonos desde cualquier dispositivo.
                Luego podrás seleccionar un cliente y autollenar las nuevas entregas.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                to="/enterprise-dashboard"
                className="inline-flex items-center justify-center rounded-2xl border border-white/20 bg-white px-5 py-3 font-semibold text-fuchsia-800 shadow-lg transition duration-200 hover:scale-[1.03] hover:shadow-2xl"
              >
                Volver
              </Link>
            </div>
          </div>

          <div className="mt-7 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-[0_12px_30px_rgba(0,0,0,0.18)] backdrop-blur">
              <p className="text-sm text-white/80">Total clientes</p>
              <p className="mt-3 text-4xl font-extrabold">{loadingClients ? "..." : clients.length}</p>
              <p className="mt-2 text-sm text-white/70">Registros disponibles en la nube</p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-[0_12px_30px_rgba(0,0,0,0.18)] backdrop-blur">
              <p className="text-sm text-white/80">Clientes activos</p>
              <p className="mt-3 text-4xl font-extrabold">{loadingClients ? "..." : activeClientsCount}</p>
              <p className="mt-2 text-sm text-white/70">Listos para usar en nuevas entregas</p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-[0_12px_30px_rgba(0,0,0,0.18)] backdrop-blur">
              <p className="text-sm text-white/80">Búsqueda rápida</p>
              <p className="mt-3 text-2xl font-extrabold">Nombre · Teléfono · Dirección</p>
              <p className="mt-2 text-sm text-white/70">Conectado a Google Maps</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-5 py-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
          <div className="xl:col-span-2">
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.08)]">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900">
                    {editingClientId ? "Editar cliente" : "Nuevo cliente"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Dirección tomada directamente de Google Maps.
                  </p>
                </div>

                {editingClientId ? (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700"
                  >
                    Cancelar edición
                  </button>
                ) : null}
              </div>

              <form onSubmit={handleSaveClient} className="grid grid-cols-1 gap-4">
                <input
                  name="name"
                  type="text"
                  placeholder="Nombre del cliente"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
                />

                <div className="relative" ref={addressBoxRef}>
                  <input
                    name="address"
                    type="text"
                    placeholder="Buscar dirección en Google Maps"
                    value={formData.address}
                    onChange={handleChange}
                    onFocus={() => {
                      if (addressSuggestions.length > 0 || addressLoading || addressNoResults) {
                        setShowSuggestions(true);
                      }
                    }}
                    autoComplete="off"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
                  />

                  {showSuggestions && (
                    <div className="absolute z-50 mt-2 max-h-80 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
                      {addressLoading ? (
                        <div className="px-4 py-4 text-sm text-slate-500">
                          Buscando en Google Maps...
                        </div>
                      ) : addressSuggestions.length > 0 ? (
                        addressSuggestions.map((suggestion, index) => (
                          <button
                            key={`${suggestion.place_id || suggestion.description}-${index}`}
                            type="button"
                            onClick={() => handleAddressSelect(suggestion)}
                            className="w-full border-b px-4 py-4 text-left last:border-b-0 hover:bg-slate-50"
                          >
                            <div className="flex items-start gap-3">
                              <div className="mt-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-slate-100">
                                📍
                              </div>
                              <div className="text-sm text-slate-800">
                                {suggestion.description}
                              </div>
                            </div>
                          </button>
                        ))
                      ) : addressNoResults ? (
                        <div className="px-4 py-4 text-sm text-slate-500">
                          Google Maps no devolvió resultados para esa búsqueda.
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>

                {addressSelected ? (
                  <p className="text-xs font-medium text-green-600">
                    Dirección seleccionada correctamente desde Google Maps.
                  </p>
                ) : addressTouched ? (
                  <p className="text-xs font-medium text-orange-600">
                    Escribe mínimo 3 letras y selecciona una opción de Google Maps.
                  </p>
                ) : (
                  <p className="text-xs font-medium text-slate-500">
                    Empieza escribiendo la dirección para ver sugerencias reales.
                  </p>
                )}

                <input
                  name="phone"
                  type="text"
                  placeholder="Teléfono"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
                />

                <input
                  name="neighborhood"
                  type="text"
                  placeholder="Barrio"
                  value={formData.neighborhood}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
                />

                <input
                  name="reference"
                  type="text"
                  placeholder="Referencia de llegada"
                  value={formData.reference}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
                />

                <textarea
                  name="notes"
                  placeholder="Observaciones del cliente"
                  value={formData.notes}
                  onChange={handleChange}
                  rows="4"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
                />

                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <input
                    name="isActive"
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={handleChange}
                  />
                  <span className="text-sm font-medium text-slate-700">Cliente activo</span>
                </label>

                <button
                  type="submit"
                  disabled={savingClient}
                  className="w-full rounded-2xl bg-fuchsia-600 py-3 text-lg font-semibold text-white disabled:opacity-60"
                >
                  {savingClient
                    ? "Guardando..."
                    : editingClientId
                    ? "Actualizar cliente"
                    : "Guardar cliente"}
                </button>
              </form>
            </div>
          </div>

          <div className="xl:col-span-3">
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.08)]">
              <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900">
                    Clientes registrados
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Busca, edita o elimina clientes guardados en línea.
                  </p>
                </div>

                <div className="text-sm font-medium text-slate-600">
                  Total mostrados: {filteredClients.length}
                </div>
              </div>

              <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
                <input
                  type="text"
                  placeholder="Buscar por nombre, teléfono o dirección"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none md:col-span-2"
                />

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
                >
                  <option value="Todos">Todos</option>
                  <option value="Activos">Activos</option>
                  <option value="Inactivos">Inactivos</option>
                </select>
              </div>

              {loadingClients ? (
                <p className="text-slate-500">Cargando clientes...</p>
              ) : filteredClients.length === 0 ? (
                <p className="text-slate-500">No hay clientes para este filtro.</p>
              ) : (
                <div className="space-y-4">
                  {filteredClients.map((client) => {
                    const clientId = String(client?._id || client?.id || "");
                    const isDeleting = deletingClientId === clientId;
                    const isActive = Boolean(client?.isActive ?? true);

                    return (
                      <div
                        key={clientId}
                        className="rounded-3xl border border-slate-200 p-5 transition hover:shadow-md"
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-lg font-extrabold text-slate-900">
                                {client?.name || "Sin nombre"}
                              </h3>

                              <span
                                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                                  isActive
                                    ? "bg-green-100 text-green-700"
                                    : "bg-slate-200 text-slate-700"
                                }`}
                              >
                                {isActive ? "Activo" : "Inactivo"}
                              </span>
                            </div>

                            <p className="mt-2 text-sm text-slate-600">
                              📍 {client?.address || "Sin dirección"}
                            </p>
                            <p className="mt-1 text-sm text-slate-600">
                              📞 {client?.phone || "Sin teléfono"}
                            </p>

                            {client?.neighborhood ? (
                              <p className="mt-1 text-sm text-slate-600">
                                🏘️ Barrio: {client.neighborhood}
                              </p>
                            ) : null}

                            {client?.reference ? (
                              <p className="mt-1 text-sm text-slate-600">
                                📌 Referencia: {client.reference}
                              </p>
                            ) : null}

                            {client?.notes ? (
                              <p className="mt-1 text-sm text-slate-500">
                                Observaciones: {client.notes}
                              </p>
                            ) : null}

                            <div className="mt-2 text-xs text-slate-400">
                              Actualizado:{" "}
                              {client?.updatedAt
                                ? new Date(client.updatedAt).toLocaleString()
                                : "Sin fecha"}
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleEditClient(client)}
                              className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
                            >
                              Editar
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteClient(clientId)}
                              disabled={isDeleting}
                              className="rounded-2xl bg-red-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                            >
                              {isDeleting ? "Eliminando..." : "Eliminar"}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnterpriseClients;