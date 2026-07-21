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