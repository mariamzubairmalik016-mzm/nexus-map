import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "react-hot-toast";

// Explicit .tsx extension avoids the case-insensitive collision with the
// stray backend copy at src/app.ts, ensuring this resolves to the React root.
import App from "./App.tsx";
import { AuthProvider } from "./context/AuthContext";
import { registerOfflineWorker } from "./services/registerOfflineWorker";

// Self-hosted premium fonts (work offline — bundled, not fetched from Google).
import "@fontsource-variable/space-grotesk";
import "@fontsource-variable/inter";
import "@fontsource/marcellus"; // antique display font for hero headings

// CSS side-effect imports are typed by vite/client (referenced in
// src/vite-env.d.ts), so these need no suppression.
import "leaflet/dist/leaflet.css";
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