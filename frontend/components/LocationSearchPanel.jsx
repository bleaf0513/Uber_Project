import React from "react";

const LocationSearchPanel = ({ suggestions = [], onSuggestionSelect }) => {
  const safeSuggestions = Array.isArray(suggestions) ? suggestions : [];

  const handleSelect = (suggestion) => {
    if (typeof onSuggestionSelect !== "function") return;

    /*
     * IMPORTANTE:
     * Antes se enviaba solo suggestion.description.
     * Eso perdía el place_id y cualquier dato extra.
     *
     * Ahora enviamos el objeto completo:
     * {
     *   description,
     *   place_id,
     *   structured_formatting,
     *   source
     * }
     *
     * Así Home.jsx puede guardar texto bonito y también coordenadas/place_id
     * sin tener que usar Geocoding.
     */
    onSuggestionSelect(suggestion);
  };

  return (
    <div className="w-full">
      {safeSuggestions.length > 0 ? (
        <div className="space-y-1">
          {safeSuggestions.map((suggestion, index) => {
            const description = suggestion?.description || "";
            const mainText =
              suggestion?.structured_formatting?.main_text ||
              description.split(",")[0] ||
              "Ubicación";

            const secondaryText =
              suggestion?.structured_formatting?.secondary_text ||
              description
                .split(",")
                .slice(1)
                .join(",")
                .trim();

            const isLocal = suggestion?.source === "local";

            return (
              <button
                type="button"
                onClick={() => handleSelect(suggestion)}
                key={suggestion?.place_id || `${description}-${index}`}
                className="w-full flex items-center gap-3 py-3 px-2 rounded-2xl text-left hover:bg-purple-50 active:bg-purple-100 transition"
              >
                <div className="w-11 h-11 rounded-2xl bg-purple-100 flex items-center justify-center shrink-0">
                  <i className="ri-map-pin-fill text-xl text-purple-800"></i>
                </div>

                <div className="min-w-0 flex-1 border-b border-gray-100 pb-3">
                  <div className="flex items-center gap-2">
                    <h4 className="text-[16px] font-bold text-gray-900 truncate">
                      {mainText}
                    </h4>

                    {isLocal && (
                      <span className="text-[10px] font-black uppercase tracking-wide text-purple-800 bg-purple-100 px-2 py-0.5 rounded-full">
                        Local
                      </span>
                    )}
                  </div>

                  {secondaryText ? (
                    <p className="text-sm text-gray-500 truncate mt-0.5">
                      {secondaryText}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-500 truncate mt-0.5">
                      Toca para seleccionar esta ubicación
                    </p>
                  )}
                </div>

                <i className="ri-arrow-right-s-line text-2xl text-gray-400"></i>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="p-6 text-center">
          <div className="w-14 h-14 rounded-3xl bg-purple-50 mx-auto flex items-center justify-center">
            <i className="ri-search-line text-2xl text-purple-800"></i>
          </div>

          <h4 className="text-base font-bold text-gray-900 mt-3">
            Busca una ubicación
          </h4>

          <p className="text-sm text-gray-500 mt-1">
            Escribe una dirección, barrio o punto de referencia.
          </p>
        </div>
      )}
    </div>
  );
};

export default LocationSearchPanel;