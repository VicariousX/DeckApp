import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppShell } from "./layout/AppShell";
import { LandingPage } from "./pages/LandingPage";
import { SearchPage } from "./pages/SearchPage";
import { LoginPage } from "./pages/LoginPage";
import { PublicDecksPage } from "./pages/PublicDecksPage";
import "./index.css";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Full-bleed landing — no chrome */}
        <Route path="/" element={<LandingPage />} />

        {/* App chrome for feature pages */}
        <Route element={<AppShell />}>
          <Route path="/search" element={<SearchPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/decks" element={<PublicDecksPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
