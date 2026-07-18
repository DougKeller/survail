import { CircleUserRound } from "lucide-react";
import {
  lazy,
  Suspense,
  useEffect,
  useState,
  type ChangeEvent,
  type MouseEvent,
} from "react";
import {
  BrowserRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";

import { API } from "../core/http/client";

import "../designsystem/base.css";
import { AuthLayout } from "../designsystem/layout/authLayout";
import { FlexSpacer } from "../designsystem/layout/inline";
import { Stack } from "../designsystem/layout/stack";
import { Heading, Text } from "../designsystem/layout/typography";
import { Art } from "../designsystem/primitives/artPlaceholder";
import { BrandMark } from "../designsystem/primitives/brandMark";
import { Button, ButtonLink } from "../designsystem/primitives/button";
import { Chip } from "../designsystem/primitives/chip";
import { NavBar, NavBrand, NavLink } from "../designsystem/primitives/nav";
import { Select } from "../designsystem/primitives/select";
import { api } from "./api";
import {
  isPriceProvider,
  PriceProviderContext,
  ScrollToTop,
  storedPriceProvider,
  storePriceProvider,
} from "./deckPrimitives";
import type { PriceProvider } from "../modules/decks/contracts";

const EditorScreen = lazy(async () => {
  const module = await import("./screens/EditorScreen");
  return { default: module.EditorScreen };
});
const LibraryScreen = lazy(async () => {
  const module = await import("./screens/LibraryScreen");
  return { default: module.LibraryScreen };
});

const PRICE_PROVIDER_OPTIONS = [
  { label: "TCGPlayer · USD", value: "tcgplayer" },
  { label: "Cardmarket · EUR", value: "cardmarket" },
  { label: "Cardhoarder · TIX", value: "cardhoarder" },
];

function LoginScreen() {
  return (
    <AuthLayout footer={<Art size="md" />}>
      <BrandMark />
      <Stack gap={2}>
        <Heading level={1}>Survail</Heading>
        <Text muted>Build and validate exact-printing MTG decks.</Text>
      </Stack>
      <ButtonLink block href={`${API}/auth/discord/login`}>
        Continue with Discord
      </ButtonLink>
    </AuthLayout>
  );
}

function AppChrome({
  onLogout,
  onPriceProvider,
  priceProvider,
  user,
}: {
  onLogout: () => void;
  onPriceProvider: (event: ChangeEvent<HTMLSelectElement>) => void;
  priceProvider: PriceProvider;
  user: string;
}) {
  const location = useLocation();
  const navigate = useNavigate();

  function goTo(path: string) {
    return (event: MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();
      void navigate(path);
    };
  }

  const onImport = location.pathname === "/import";
  const onDecks =
    !onImport &&
    (location.pathname === "/" || location.pathname.startsWith("/decks"));

  return (
    <>
      <NavBar aria-label="Primary navigation" divided>
        <NavLink href="/decks" onClick={goTo("/decks")}>
          <NavBrand>Survail</NavBrand>
        </NavLink>
        <NavLink current={onDecks} href="/decks" onClick={goTo("/decks")}>
          Decks
        </NavLink>
        <NavLink current={onImport} href="/import" onClick={goTo("/import")}>
          Import
        </NavLink>
        <FlexSpacer />
        <Select
          aria-label="Price marketplace"
          onChange={onPriceProvider}
          options={PRICE_PROVIDER_OPTIONS}
          value={priceProvider}
        />
        <Chip icon={<CircleUserRound size={14} strokeWidth={2.75} />}>
          {user}
        </Chip>
        <Button muted onClick={onLogout} variant="ghost">
          Log out
        </Button>
      </NavBar>
      <Suspense fallback={null}>
        <Routes>
          <Route path="*" element={<LibraryScreen mode="decks" />} />
          <Route path="/decks" element={<LibraryScreen mode="decks" />} />
          <Route path="/import" element={<LibraryScreen mode="import" />} />
          <Route path="/decks/:id" element={<EditorScreen />} />
        </Routes>
      </Suspense>
    </>
  );
}

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
    storePriceProvider(event.target.value);
    setPriceProvider(event.target.value);
  }

  if (user === null) return <LoginScreen />;

  return (
    <PriceProviderContext.Provider value={priceProvider}>
      <BrowserRouter>
        <ScrollToTop />
        <AppChrome
          onLogout={handleLogout}
          onPriceProvider={handlePriceProvider}
          priceProvider={priceProvider}
          user={user}
        />
      </BrowserRouter>
    </PriceProviderContext.Provider>
  );
}
