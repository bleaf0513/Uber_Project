import React, { useEffect, useMemo, useRef, useState } from "react";
import { getApiBaseUrl } from "../apiBase";

const API_BASE = getApiBaseUrl();

const EnterpriseDriverDeliveryChat = ({
  delivery,
  selectedDriver,
}) => {
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [text, setText] = useState("");
  const messagesEndRef = useRef(null);

  const deliveryId = useMemo(
    () => String(delivery?._id || delivery?.id || ""),
    [delivery]
  );

  const parseJsonSafe = async (response, label = "API") => {
    const textResponse = await response.text();
    console.log(`${label} raw response:`, textResponse);

    try {
      return textResponse ? JSON.parse(textResponse) : {};
    } catch (error) {
      throw new Error(
        `La API no devolvió JSON válido en ${label}. Respuesta: ${textResponse.slice(
          0,
          150
        )}`
      );
    }
  };

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  const fetchMessages = async (silent = false) => {
    if (!deliveryId) {
      setMessages([]);
      return;
    }

    try {
      if (!silent) setLoadingMessages(true);

      const response = await fetch(
        `${API_BASE}/enterprise-driver-chat/${deliveryId}`,
        {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        }
      );

      const data = await parseJsonSafe(
        response,
        "GET /enterprise-driver-chat/:deliveryId"
      );

      if (!response.ok) {
        throw new Error(data.message || "No se pudieron cargar los mensajes.");
      }

      setMessages(Array.isArray(data.messages) ? data.messages : []);
    } catch (error) {
      console.error("Error cargando mensajes del conductor:", error);
      if (!silent) {
        alert(error.message || "No se pudieron cargar los mensajes.");
      }
    } finally {
      if (!silent) setLoadingMessages(false);
    }
  };

  useEffect(() => {
    fetchMessages(false);

    if (!deliveryId) return;

    const interval = setInterval(() => {
      fetchMessages(true);
    }, 3000);

    return () => clearInterval(interval);
  }, [deliveryId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();

    const cleaned = String(text || "").trim();

    if (!deliveryId) {
      alert("No hay una entrega activa para usar el chat.");
      return;
    }

    if (!cleaned) return;

    try {
      setSendingMessage(true);

      const response = await fetch(
        `${API_BASE}/enterprise-driver-chat/${deliveryId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            text: cleaned,
            senderName: selectedDriver?.name || "Conductor",
          }),
        }
      );

      const data = await parseJsonSafe(
        response,
        "POST /enterprise-driver-chat/:deliveryId"
      );

      if (!response.ok) {
        throw new Error(data.message || "No se pudo enviar el mensaje.");
      }

      const newMessage = data.chatMessage;
      if (newMessage) {
        setMessages((prev) => [...prev, newMessage]);
      } else {
        await fetchMessages(true);
      }

      setText("");
    } catch (error) {
      console.error("Error enviando mensaje del conductor:", error);
      alert(error.message || "No se pudo enviar el mensaje.");
    } finally {
      setSendingMessage(false);
    }
  };

  if (!deliveryId) {
    return (
      <div className="bg-white rounded-2xl shadow p-5">
        <h3 className="text-lg font-bold text-gray-900 mb-2">Chat con logística</h3>
        <p className="text-sm text-gray-500">
          Cuando tengas una entrega en curso, aquí podrás hablar con logística.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Chat con logística</h3>
          <p className="text-sm text-gray-500 mt-1">
            Soporte directo para esta entrega
          </p>
        </div>

        <div className="text-sm text-gray-600">
          <div>
            <span className="font-semibold">Entrega:</span>{" "}
            {delivery.invoiceNumber ? `#${delivery.invoiceNumber}` : deliveryId}
          </div>
          <div>
            <span className="font-semibold">Cliente:</span>{" "}
            {delivery.clientName || "Sin nombre"}
          </div>
        </div>
      </div>

      <div className="bg-gray-50 border rounded-2xl p-4 h-[360px] overflow-y-auto space-y-3">
        {loadingMessages ? (
          <p className="text-sm text-gray-500">Cargando mensajes...</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-gray-500">
            Aún no hay mensajes en esta entrega.
          </p>
        ) : (
          messages.map((msg) => {
            const isDriver = msg.senderType === "driver";

            return (
              <div
                key={msg._id || `${msg.senderType}-${msg.createdAt}-${msg.text}`}
                className={`flex ${isDriver ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${
                    isDriver
                      ? "bg-green-600 text-white"
                      : "bg-white border text-gray-900"
                  }`}
                >
                  <div
                    className={`text-xs mb-1 ${
                      isDriver ? "text-green-100" : "text-gray-500"
                    }`}
                  >
                    {msg.senderName || (isDriver ? "Conductor" : "Logística")}
                  </div>

                  <div className="text-sm whitespace-pre-wrap break-words">
                    {msg.text}
                  </div>

                  <div
                    className={`text-[11px] mt-2 ${
                      isDriver ? "text-green-100" : "text-gray-400"
                    }`}
                  >
                    {msg.createdAt
                      ? new Date(msg.createdAt).toLocaleString()
                      : "Sin fecha"}
                  </div>
                </div>
              </div>
            );
          })
        )}

        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSend} className="mt-4 flex gap-3">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escribe un mensaje para logística..."
          className="flex-1 bg-gray-100 rounded-xl px-4 py-3 outline-none border border-gray-200"
          maxLength={1500}
        />

        <button
          type="submit"
          disabled={sendingMessage}
          className="bg-green-600 text-white px-5 py-3 rounded-xl font-semibold disabled:opacity-60"
        >
          {sendingMessage ? "Enviando..." : "Enviar"}
        </button>
      </form>
    </div>
  );
};

export default EnterpriseDriverDeliveryChat;
