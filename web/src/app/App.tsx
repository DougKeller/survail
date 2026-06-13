import { useEffect, useState, type ChangeEvent } from "react";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";

import { API } from "../core/http/client";

import "../modules/decks/ui/preferences.css";
import "../modules/decks/ui/styles.css";
import { api } from "./api";
import {
  isPriceProvider,
  PriceProviderContext,
  ScrollToTop,
  storedPriceProvider,
} from "./deckPrimitives";
import { EditorScreen } from "./screens/EditorScreen";
import { LibraryScreen } from "./screens/LibraryScreen";

import type { PriceProvider } from "../modules/decks/contracts";

export function App() {
  const [user, setUser] = useState<string | null>(null);
  const [priceProvider, setPriceProvider] =
    useState<PriceProvider>(storedPriceProvider);

  useEffect(() => {
    void api.me().then(
      (authenticatedUser) => {
        setUser(authenticatedUser.display_name ?? authenticatedUser.username);
        return undefined;
      },
      () => {
        setUser(null);
        return undefined;
      },
    );
  }, []);

  function handleLogout(): void {
    void api.logout().then(() => {
      location.reload();
      return undefined;
    });
  }

  function handlePriceProvider(event: ChangeEvent<HTMLSelectElement>): void {
    if (!isPriceProvider(event.target.value)) return;
    localStorage.setItem("survail.price-provider", event.target.value);
    setPriceProvider(event.target.value);
  }

  if (user === null) {
    return (
      <main className="login">
        <h1>Survail</h1>
        <p>Build and validate exact-printing MTG decks.</p>
        <a className="button" href={`${API}/auth/discord/login`}>
          Sign in with Discord
        </a>
      </main>
    );
  }

  return (
    <PriceProviderContext.Provider value={priceProvider}>
      <BrowserRouter>
        <ScrollToTop />
        <header>
          <Link to="/decks">
            <strong>Survail</strong>
          </Link>
          <nav aria-label="Primary navigation">
            <Link to="/decks">Decks</Link>
            <Link to="/import">Import</Link>
          </nav>
          <label className="price-setting">
            Prices
            <select
              aria-label="Price marketplace"
              value={priceProvider}
              onChange={handlePriceProvider}
            >
              <option value="tcgplayer">TCGPlayer · USD</option>
              <option value="cardmarket">Cardmarket · EUR</option>
              <option value="cardhoarder">Cardhoarder · TIX</option>
            </select>
          </label>
          <span>{user}</span>
          <button onClick={handleLogout}>Log out</button>
        </header>
        <Routes>
          <Route path="*" element={<LibraryScreen mode="decks" />} />
          <Route path="/decks" element={<LibraryScreen mode="decks" />} />
          <Route path="/import" element={<LibraryScreen mode="import" />} />
          <Route path="/decks/:id" element={<EditorScreen />} />
        </Routes>
      </BrowserRouter>
    </PriceProviderContext.Provider>
  );
}
