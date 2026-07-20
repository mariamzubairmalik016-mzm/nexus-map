export const registerOfflineWorker = async () => {
  if (!("serviceWorker" in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.register("/offline-sw.js", { scope: "/" });
    await registration.update();
  } catch (error) {
    console.error("Offline worker registration failed:", error);
  }
};
