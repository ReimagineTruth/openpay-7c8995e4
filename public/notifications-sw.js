self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow("/dashboard"));
});

self.addEventListener("push", (event) => {
  if (event.data) {
    const options = {
      body: event.data.text(),
      icon: "/openpay-auth-logo.png",
      badge: "/favicon.ico",
      vibrate: [200, 100, 200],
      requireInteraction: true,
    };

    event.waitUntil(
      self.registration.showNotification("OpenPay Notification", options)
    );

    // Play notification bell sound
    try {
      const audio = new Audio("https://www.myinstants.com/media/sounds/notification-bell-91796.mp3");
      audio.play().catch(() => {});
    } catch (error) {
      console.log("Could not play notification sound:", error);
    }
  }
});
