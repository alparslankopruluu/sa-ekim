import { Route, Routes } from "react-router-dom";

import { Shell } from "./components/Shell";
import { AdminPage } from "./pages/AdminPage";
import { HomePage } from "./pages/HomePage";
import { LegalPage } from "./pages/LegalPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { SupportPage } from "./pages/SupportPage";

export function App() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/support" element={<SupportPage />} />
        <Route
          path="/privacy"
          element={<LegalPage titleKey="privacy.title" bodyKey="privacy.body" />}
        />
        <Route
          path="/terms"
          element={<LegalPage titleKey="terms.title" bodyKey="terms.body" />}
        />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Shell>
  );
}
