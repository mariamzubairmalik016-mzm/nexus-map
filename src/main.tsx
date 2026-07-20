import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "react-hot-toast";

import { App } from "./app";
import { AuthProvider } from "./context/AuthContext";
import { registerOfflineWorker } from "./services/registerOfflineWorker";

// @ts-ignore: side-effect CSS imports may not have type declarations in this setup
import "leaflet/dist/leaflet.css";
// @ts-ignore: side-effect CSS imports may not have type declarations in this setup
import "./index.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element was not found.");
}

void registerOfflineWorker();

createRoot(rootElement).render(
  <StrictMode>
    <AuthProvider>
      <App />
      <Toaster position="top-right" />
    </AuthProvider>
  </StrictMode>,
);