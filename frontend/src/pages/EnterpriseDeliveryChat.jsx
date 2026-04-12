import React, { useEffect, useMemo, useRef, useState } from "react";
import { getApiBaseUrl } from "../apiBase";

const API_BASE = getApiBaseUrl();

const EnterpriseDeliveryChat = ({
  delivery,
  selectedDriver,
  logisticsName = "Logística",
}) => {
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [text, setText] = useState("");
  const [showIncomingBanner, setShowIncomingBanner] = useState(false);

  const chatBodyRef = useRef(null);
  const pollingBusyRef = useRef(false);
  const previousMessageIdsRef = useRef([]);
  const nearBottomRef = useRef(true);
  const initialLoadDoneRef = useRef(false);
  const audioContextRef = useRef(null);
  const lastPlayedMessageRef = useRef("");
  const bannerTimerRef = useRef(null);

  const deliveryId = useMemo(
    () => String(delivery?._id || delivery?.id || ""),
    [delivery?._id, delivery?.id]
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

  const isNearBottom = () => {
    const el = chatBodyRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  const scrollChatToBottom = (behavior = "auto") => {
    const el = chatBodyRef.current;
    if (!el) return;

    el.scrollTo({
      top: el.scrollHeight,
      behavior,
    });
  };

  const sameMessages = (prev, next) => {
    if (!Array.isArray(prev) || !Array.isArray(next)) return false;
    if (prev.length !== next.length) return false;

    for (let i = 0; i < prev.length; i += 1) {
      const a = prev[i];
      const b = next[i];

      if (
        String(a?._id || "") !== String(b?._id || "") ||
        String(a?.text || "") !== String(b?.text || "") ||
        String(a?.senderType || "") !== String(b?.senderType || "") ||
        String(a?.senderName || "") !== String(b?.senderName || "") ||
        String(a?.createdAt || "") !== String(b?.createdAt || "")
      ) {
        return false;
      }
    }

    return true;
  };

  const normalizeSender = (msg) =>
    String(
      msg?.senderType ||
        msg?.senderRole ||
        msg?.sender ||
        msg?.role ||
        ""
    )
      .trim()
      .toLowerCase();

  const isIncomingForLogistics = (msg) => {
    const sender = normalizeSender(msg);
    return sender === "driver" || sender === "conductor";
  };

  const playIncomingMessageSound = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtx();
      }

      const ctx = audioContextRef.current;

      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }

      const now = ctx.currentTime;

      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.0001, now);
      masterGain.gain.exponentialRampToValueAtTime(0.28, now + 0.02);
      masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.58);
      masterGain.connect(ctx.destination);

      const tone1 = ctx.createOscillator();
      tone1.type = "square";
      tone1.frequency.setValueAtTime(950, now);
      tone1.connect(masterGain);
      tone1.start(now);
      tone1.stop(now + 0.16);

      const tone2 = ctx.createOscillator();
      tone2.type = "square";
      tone2.frequency.setValueAtTime(1250, now + 0.18);
      tone2.connect(masterGain);
      tone2.start(now + 0.18);
      tone2.stop(now + 0.36);

      const tone3 = ctx.createOscillator();
      tone3.type = "triangle";
      tone3.frequency.setValueAtTime(1450, now + 0.38);
      tone3.connect(masterGain);
      tone3.start(now + 0.38);
      tone3.stop(now + 0.54);
    } catch (error) {
      console.error("No se pudo reproducir el sonido del mensaje:", error);
    }
  };

  const showIncomingNotification = () => {
    setShowIncomingBanner(true);

    if (bannerTimerRef.current) {
      clearTimeout(bannerTimerRef.current);
    }

    bannerTimerRef.current = setTimeout(() => {
      setShowIncomingBanner(false);
    }, 3000);
  };

  const fetchMessages = async (silent = false) => {
    if (!deliveryId) {
      setMessages([]);
      return;
    }

    if (silent && pollingBusyRef.current) return;

    try {
      if (silent) {
        pollingBusyRef.current = true;
      } else {
        setLoadingMessages(true);
      }

      const response = await fetch(`${API_BASE}/enterprise-chat/${deliveryId}`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      const data = await parseJsonSafe(response, "GET /enterprise-chat/:deliveryId");

      if (!response.ok) {
        throw new Error(data.message || "No se pudieron cargar los mensajes.");
      }

      const incomingMessages = Array.isArray(data.messages) ? data.messages : [];

      setMessages((prev) => {
        if (sameMessages(prev, incomingMessages)) {
          return prev;
        }
        return incomingMessages;
      });
    } catch (error) {
      console.error("Error cargando mensajes:", error);
      if (!silent) {
        alert(error.message || "No se pudieron cargar los mensajes.");
      }
    } finally {
      if (silent) {
        pollingBusyRef.current = false;
      } else {
        setLoadingMessages(false);
      }
    }
  };

  useEffect(() => {
    if (!deliveryId) {
      setMessages([]);
      previousMessageIdsRef.current = [];
      initialLoadDoneRef.current = false;
      lastPlayedMessageRef.current = "";
      setShowIncomingBanner(false);
      return;
    }

    fetchMessages(false);

    const interval = setInterval(() => {
      fetchMessages(true);
    }, 3000);

    return () => clearInterval(interval);
  }, [deliveryId]);

  useEffect(() => {
    const el = chatBodyRef.current;
    if (!el) return;

    const handleScroll = () => {
      nearBottomRef.current = isNearBottom();
    };

    nearBottomRef.current = isNearBottom();
    el.addEventListener("scroll", handleScroll);

    return () => {
      el.removeEventListener("scroll", handleScroll);
    };
  }, [deliveryId]);

  useEffect(() => {
    const currentIds = messages.map((msg) =>
      String(msg?._id || `${msg?.senderType}-${msg?.createdAt}-${msg?.text}`)
    );

    const previousIds = previousMessageIdsRef.current;
    const hasNewMessage =
      currentIds.length > previousIds.length &&
      currentIds.some((id) => !previousIds.includes(id));

    if (!initialLoadDoneRef.current) {
      scrollChatToBottom("auto");
      initialLoadDoneRef.current = true;
    } else if (hasNewMessage && nearBottomRef.current) {
      scrollChatToBottom("smooth");
    }

    previousMessageIdsRef.current = currentIds;
  }, [messages]);

  useEffect(() => {
    if (!Array.isArray(messages) || messages.length === 0) return;
    if (!initialLoadDoneRef.current) return;

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) return;

    const signature = JSON.stringify({
      id: lastMessage?._id || "",
      text: lastMessage?.text || "",
      createdAt: lastMessage?.createdAt || "",
      sender: normalizeSender(lastMessage),
    });

    if (signature === lastPlayedMessageRef.current) return;

    const isLogisticsMessage = normalizeSender(lastMessage) === "logistics";

    if (!isLogisticsMessage && isIncomingForLogistics(lastMessage)) {
      playIncomingMessageSound();
      showIncomingNotification();
    }

    lastPlayedMessageRef.current = signature;
  }, [messages]);

  useEffect(() => {
    return () => {
      if (audioContextRef.current && typeof audioContextRef.current.close === "function") {
        audioContextRef.current.close().catch(() => {});
      }
      if (bannerTimerRef.current) {
        clearTimeout(bannerTimerRef.current);
      }
    };
  }, []);

  const handleSend = async (e) => {
    e.preventDefault();

    const cleaned = String(text || "").trim();

    if (!deliveryId) {
      alert("Debes seleccionar una entrega para usar el chat.");
      return;
    }

    if (!cleaned) {
      return;
    }

    const optimisticMessage = {
      _id: `temp-${Date.now()}`,
      senderType: "logistics",
      senderName: logisticsName,
      text: cleaned,
      createdAt: new Date().toISOString(),
    };

    const previousMessages = messages;
    const shouldStickToBottom = isNearBottom();

    try {
      setSendingMessage(true);
      setMessages((prev) => [...prev, optimisticMessage]);
      setText("");

      if (shouldStickToBottom) {
        requestAnimationFrame(() => {
          scrollChatToBottom("smooth");
        });
      }

      const response = await fetch(`${API_BASE}/enterprise-chat/${deliveryId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          text: cleaned,
          senderName: logisticsName,
        }),
      });

      const data = await parseJsonSafe(response, "POST /enterprise-chat/:deliveryId");

      if (!response.ok) {
        throw new Error(data.message || "No se pudo enviar el mensaje.");
      }

      const newMessage = data.chatMessage;
      if (newMessage) {
        setMessages((prev) => {
          const withoutTemp = prev.filter((msg) => msg._id !== optimisticMessage._id);
          return [...withoutTemp, newMessage];
        });
      } else {
        await fetchMessages(true);
      }
    } catch (error) {
      console.error("Error enviando mensaje:", error);
      setMessages(previousMessages);
      setText(cleaned);
      alert(error.message || "No se pudo enviar el mensaje.");
    } finally {
      setSendingMessage(false);
    }
  };

  if (!deliveryId) {
    return (
      <div className="bg-white rounded-2xl shadow p-5">
        <h3 className="text-lg font-bold text-gray-900 mb-2">Chat operativo</h3>
        <p className="text-sm text-gray-500">
          Selecciona una entrega activa o una entrega reciente del conductor para abrir el chat.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Chat operativo</h3>
          <p className="text-sm text-gray-500 mt-1">
            Conversación entre logística y conductor
          </p>
        </div>

        <div className="text-sm text-gray-600">
          <div>
            <span className="font-semibold">Entrega:</span>{" "}
            {delivery.invoiceNumber ? `#${delivery.invoiceNumber}` : deliveryId}
          </div>
          <div>
            <span className="font-semibold">Conductor:</span>{" "}
            {selectedDriver?.name || "Sin conductor"}
          </div>
        </div>
      </div>

      {showIncomingBanner ? (
        <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">
          Nuevo mensaje del conductor
        </div>
      ) : null}

      <div
        ref={chatBodyRef}
        className="bg-gray-50 border rounded-2xl p-4 h-[360px] overflow-y-auto space-y-3"
      >
        {loadingMessages && messages.length === 0 ? (
          <p className="text-sm text-gray-500">Cargando mensajes...</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-gray-500">
            Aún no hay mensajes en esta entrega.
          </p>
        ) : (
          messages.map((msg) => {
            const isLogistics = normalizeSender(msg) === "logistics";

            return (
              <div
                key={msg._id || `${msg.senderType}-${msg.createdAt}-${msg.text}`}
                className={`flex ${isLogistics ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${
                    isLogistics
                      ? "bg-blue-600 text-white"
                      : "bg-white border text-gray-900"
                  }`}
                >
                  <div
                    className={`text-xs mb-1 ${
                      isLogistics ? "text-blue-100" : "text-gray-500"
                    }`}
                  >
                    {msg.senderName || (isLogistics ? "Logística" : "Conductor")}
                  </div>

                  <div className="text-sm whitespace-pre-wrap break-words">
                    {msg.text}
                  </div>

                  <div
                    className={`text-[11px] mt-2 ${
                      isLogistics ? "text-blue-100" : "text-gray-400"
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
      </div>

      <form onSubmit={handleSend} className="mt-4 flex gap-3">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escribe un mensaje para el conductor..."
          className="flex-1 bg-gray-100 rounded-xl px-4 py-3 outline-none border border-gray-200"
          maxLength={1500}
        />

        <button
          type="submit"
          disabled={sendingMessage}
          className="bg-blue-600 text-white px-5 py-3 rounded-xl font-semibold disabled:opacity-60"
        >
          {sendingMessage ? "Enviando..." : "Enviar"}
        </button>
      </form>
    </div>
  );
};

export default EnterpriseDeliveryChat;
