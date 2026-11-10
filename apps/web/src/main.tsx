import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { registerServiceWorker } from "./app/sw-client.js";
import { AppErrorBoundary, ROOT_OPTIONS } from "./components/ErrorBoundary.js";
import "./styles.css";

createRoot(document.getElementById("root")!, ROOT_OPTIONS).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
);
registerServiceWorker();
