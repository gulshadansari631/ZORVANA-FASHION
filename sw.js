importScripts("https://www.gstatic.com/firebasejs/13.2.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/13.2.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyC6ljZWr8cDxEtPuziF7DhxQYiykFRocOc",
  authDomain: "zorvana-fashion-new.firebaseapp.com",
  projectId: "zorvana-fashion-new",
  storageBucket: "zorvana-fashion-new.firebasestorage.app",
  messagingSenderId: "328407308597",
  appId: "1:328407308597:web:3a36dbb2e6c80e971ad47c"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.data?.title || "ZORVANA FASHION";
  const options = {
    body: payload.data?.body || "New order received!",
    icon: "/admin-icon.svg",
    data: {
      url: payload.data?.url || "/admin.html"
    }
  };

  self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/admin.html";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if ("focus" in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        return clients.openWindow(url);
      })
  );
});

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;
});
