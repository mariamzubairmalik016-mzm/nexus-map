import { flushQueue } from "./offlineQueue";

export const registerOfflineWorker = async () => {
  if (!("serviceWorker" in navigator)) return;
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
