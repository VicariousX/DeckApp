import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppShell } from "./layout/AppShell";
import { LandingPage } from "./pages/LandingPage";
import { SearchPage } from "./pages/SearchPage";
import { LoginPage } from "./pages/LoginPage";
import { PublicDecksPage } from "./pages/PublicDecksPage";
import { MyDecksPage } from "./pages/MyDecksPage";
import { CardPage } from "./pages/CardPage";
import "./index.css";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />

        <Route element={<AppShell />}>
          <Route path="/search" element={<SearchPage />} />
          <Route path="/card/:id" element={<CardPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/decks" element={<PublicDecksPage />} />
          <Route path="/my-decks" element={<MyDecksPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
