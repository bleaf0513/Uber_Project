/* eslint-disable no-undef */

importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js");

/*
 * Service Worker de Firebase Cloud Messaging para Central Go.
 * Aquí NO va la private_key del service_account.
 * Aquí solo va la configuración pública Web de Firebase.
 */

firebase.initializeApp({
  apiKey: "AIzaSyAaxaIqm9HQUyvvjl5RGUxNDGwuf1HgtaE",
  authDomain: "central-go-9f8fe.firebaseapp.com",
  databaseURL: "https://central-go-9f8fe-default-rtdb.firebaseio.com",
  projectId: "central-go-9f8fe",
  storageBucket: "central-go-9f8fe.firebasestorage.app",
  messagingSenderId: "394563648766",
  appId: "1:394563648766:web:f610857a41ca22004339af",
  measurementId: "G-63G4RFG361",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log("[firebase-messaging-sw] Notificación recibida:", payload);

  const notification = payload.notification || {};
  const data = payload.data || {};

  const title = notification.title || data.title || "Central Go";

  const body =
    notification.body ||
    data.body ||
    "Tienes una nueva notificación en Central Go.";

  const options = {
    body,
    icon: "/logo-centralgo.png",
    badge: "/logo-centralgo.png",
    data,
    requireInteraction: data.requireInteraction === "true",
  };

  self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification?.data || {};
  const targetUrl = data.link || data.url || "/";

  event.waitUntil(
    clients
      .matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) {
            client.focus();

            if ("navigate" in client && targetUrl) {
              return client.navigate(targetUrl);
            }

            return null;
          }
        }

        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }

        return null;
      })
  );
});