import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { warmFonts } from "./app/fonts.js";
import { registerServiceWorker } from "./app/sw-client.js";
import { AppErrorBoundary, ROOT_OPTIONS } from "./components/ErrorBoundary.js";
// DESIGN-M6-001 §2: the single CSS entry; component modules never import CSS.
import "./styles/index.css";

createRoot(document.getElementById("root")!, ROOT_OPTIONS).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
);
// DESIGN-M6-001 §5: load both font weights up front so no font request starts inside the registration import window.
void warmFonts();
registerServiceWorker();
