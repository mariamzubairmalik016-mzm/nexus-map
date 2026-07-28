import { flushQueue } from "./offlineQueue";

export const registerOfflineWorker = async () => {
  if (!("serviceWorker" in navigator)) return;

  // In development every edit rewrites the build-hashed chunk URLs, so a
  // worker caching them serves dead references within seconds. Worse, it keeps
  // answering after the dev server restarts, which reads as "the app broke"
  // when the app is fine. Unregister anything left over from a previous run —
  // a developer who already has v7 installed cannot otherwise get rid of it
  // without opening devtools.
  if (process.env.NODE_ENV !== "production") {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("nexus-map-app")).map((key) => caches.delete(key)));
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register("/offline-sw.js", { scope: "/" });
    await registration.update();

    // The service worker asks us to flush the offline write-queue when a
    // background-sync event fires (we hold the auth token + API logic here).
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data?.type === "nexus-sync-queue") void flushQueue();
    });
  } catch (error) {
    console.error("Offline worker registration failed:", error);
  }
};
