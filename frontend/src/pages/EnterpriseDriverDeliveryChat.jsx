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

  const isIncomingForDriver = (msg) => {
    const sender = normalizeSender(msg);
    return (
      sender === "logistica" ||
      sender === "logistics" ||
      sender === "empresa" ||
      sender === "enterprise" ||
      sender === "admin" ||
      sender === "operator"
    );
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

      const oscillator1 = ctx.createOscillator();
      const oscillator2 = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator1.type = "sine";
      oscillator2.type = "triangle";

      oscillator1.frequency.setValueAtTime(880, now);
      oscillator1.frequency.exponentialRampToValueAtTime(740, now + 0.16);

      oscillator2.frequency.setValueAtTime(1320, now);
      oscillator2.frequency.exponentialRampToValueAtTime(1040, now + 0.16);

      gainNode.gain.setValueAtTime(0.0001, now);
      gainNode.gain.exponentialRampToValueAtTime(0.14, now + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);

      oscillator1.connect(gainNode);
      oscillator2.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator1.start(now);
      oscillator2.start(now);
      oscillator1.stop(now + 0.26);
      oscillator2.stop(now + 0.26);
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

      const incomingMessages = Array.isArray(data.messages) ? data.messages : [];

      setMessages((prev) => {
        if (sameMessages(prev, incomingMessages)) {
          return prev;
        }
        return incomingMessages;
      });
    } catch (error) {
      console.error("Error cargando mensajes del conductor:", error);
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

    const isDriverMessage = normalizeSender(lastMessage) === "driver";

    if (!isDriverMessage && isIncomingForDriver(lastMessage)) {
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
      alert("No hay una entrega activa para usar el chat.");
      return;
    }

    if (!cleaned) return;

    const optimisticMessage = {
      _id: `temp-${Date.now()}`,
      senderType: "driver",
      senderName: selectedDriver?.name || "Conductor",
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
        setMessages((prev) => {
          const withoutTemp = prev.filter((msg) => msg._id !== optimisticMessage._id);
          return [...withoutTemp, newMessage];
        });
      } else {
        await fetchMessages(true);
      }
    } catch (error) {
      console.error("Error enviando mensaje del conductor:", error);
      setMessages(previousMessages);
      setText(cleaned);
      alert(error.message || "No se pudo enviar el mensaje.");
    } finally {
      setSendingMessage(false);
    }
  };

  if (!deliveryId) {
    return (
      <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.08)]">
        <div className="border-b border-slate-100 bg-gradient-to-r from-white via-slate-50 to-green-50 px-5 py-4">
          <h3 className="text-lg font-extrabold text-slate-900">Chat con logística</h3>
          <p className="mt-1 text-sm text-slate-500">
            Cuando tengas una entrega en curso, aquí podrás hablar con logística.
          </p>
        </div>

        <div className="p-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
            No hay una entrega activa para usar el chat.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.08)]">
      <div className="border-b border-slate-100 bg-gradient-to-r from-white via-slate-50 to-green-50 px-5 py-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-lg font-extrabold text-slate-900">Chat con logística</h3>
            <p className="text-sm text-slate-500 mt-1">
              Soporte directo para esta entrega
            </p>
          </div>

          <div className="text-sm text-slate-600">
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
      </div>

      <div className="p-5">
        {showIncomingBanner ? (
          <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            Nuevo mensaje de logística
          </div>
        ) : null}

        <div
          ref={chatBodyRef}
          className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 h-[360px] overflow-y-auto space-y-3"
        >
          {loadingMessages && messages.length === 0 ? (
            <p className="text-sm text-slate-500">Cargando mensajes...</p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-slate-500">
              Aún no hay mensajes en esta entrega.
            </p>
          ) : (
            messages.map((msg) => {
              const isDriver = normalizeSender(msg) === "driver";

              return (
                <div
                  key={msg._id || `${msg.senderType}-${msg.createdAt}-${msg.text}`}
                  className={`flex ${isDriver ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${
                      isDriver
                        ? "bg-green-600 text-white"
                        : "bg-white border border-slate-200 text-slate-900"
                    }`}
                  >
                    <div
                      className={`text-xs mb-1 ${
                        isDriver ? "text-green-100" : "text-slate-500"
                      }`}
                    >
                      {msg.senderName || (isDriver ? "Conductor" : "Logística")}
                    </div>

                    <div className="text-sm whitespace-pre-wrap break-words">
                      {msg.text}
                    </div>

                    <div
                      className={`text-[11px] mt-2 ${
                        isDriver ? "text-green-100" : "text-slate-400"
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
            placeholder="Escribe un mensaje para logística..."
            className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-green-400 focus:bg-white focus:ring-4 focus:ring-green-100"
            maxLength={1500}
          />

          <button
            type="submit"
            disabled={sendingMessage}
            className="rounded-2xl bg-green-600 px-5 py-3 font-semibold text-white transition hover:scale-[1.01] disabled:opacity-60"
          >
            {sendingMessage ? "Enviando..." : "Enviar"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default EnterpriseDriverDeliveryChat;
