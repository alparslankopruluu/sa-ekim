import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { AdminSessionProvider } from "./admin-session";
import { App } from "./App";
import "./i18n";
import "./styles.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element is missing");
}

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <AdminSessionProvider>
        <App />
      </AdminSessionProvider>
    </BrowserRouter>
  </StrictMode>,
);
