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
import { AppShell } from "../designsystem/layout/appShell";
import { Stack } from "../designsystem/layout/stack";
import { Heading, Text } from "../designsystem/layout/typography";
import { Art } from "../designsystem/primitives/artPlaceholder";
import { BrandMark } from "../designsystem/primitives/brandMark";
import { Button, ButtonLink } from "../designsystem/primitives/button";
import { Chip } from "../designsystem/primitives/chip";
import { Checkbox } from "../designsystem/primitives/choice";
import { NavBar, NavBrand, NavLink } from "../designsystem/primitives/nav";
import { Notice } from "../designsystem/primitives/notice";
import { Popover, PopoverAnchor } from "../designsystem/primitives/popover";
import { Select } from "../designsystem/primitives/select";
import { api } from "./api";
import {
  isPriceProvider,
  PriceProviderContext,
  ScoringEnabledContext,
  ScrollToTop,
  storedPriceProvider,
  storePriceProvider,
} from "./deckPrimitives";
import type { PriceProvider } from "../modules/decks/contracts";
import type { CurrentUser } from "../modules/auth/contracts";
import { useDismissibleSurface } from "./deck/hooks";

const EditorScreen = lazy(async () => {
  const module = await import("./screens/EditorScreen");
  return { default: module.EditorScreen };
});
const LibraryScreen = lazy(async () => {
  const module = await import("./screens/LibraryScreen");
  return { default: module.LibraryScreen };
});
const DesignLibraryScreen = lazy(async () => {
  const module = await import("./screens/DesignLibraryScreen");
  return { default: module.DesignLibraryScreen };
});
const JudgeGoldenScreen = lazy(async () => {
  const module = await import("./screens/JudgeGoldenScreen");
  return { default: module.JudgeGoldenScreen };
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
  onScoringEnabled,
  priceProvider,
  settingsError,
  user,
}: {
  onLogout: () => void;
  onPriceProvider: (event: ChangeEvent<HTMLSelectElement>) => void;
  onScoringEnabled: (enabled: boolean) => void;
  priceProvider: PriceProvider;
  settingsError: string | null;
  user: CurrentUser;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useDismissibleSurface<HTMLDivElement>(
    userMenuOpen,
    () => {
      setUserMenuOpen(false);
    },
    { manageFocus: false },
  );

  function goTo(path: string) {
    return (event: MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();
      void navigate(path);
    };
  }

  const onImport = location.pathname === "/import";
  const onDesign = location.pathname === "/design";
  const onJudge = location.pathname === "/judge";
  const onDecks =
    !onImport &&
    !onDesign &&
    !onJudge &&
    (location.pathname === "/" || location.pathname.startsWith("/decks"));
  const onDeckEditor = /^\/decks\/[^/]+$/.test(location.pathname);
  const onCardsEditor =
    onDeckEditor &&
    [null, "cards"].includes(new URLSearchParams(location.search).get("tab"));

  return (
    <AppShell viewportLocked={onCardsEditor}>
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
        <NavLink current={onDesign} href="/design" onClick={goTo("/design")}>
          Design
        </NavLink>
        {user.scoring_enabled && (
          <NavLink current={onJudge} href="/judge" onClick={goTo("/judge")}>
            Judge
          </NavLink>
        )}
        <FlexSpacer />
        <PopoverAnchor ref={userMenuRef}>
          <Chip
            aria-expanded={userMenuOpen}
            icon={<CircleUserRound size={14} strokeWidth={2.75} />}
            onClick={() => {
              setUserMenuOpen((current) => !current);
            }}
          >
            {user.display_name ?? user.username}
          </Chip>
          {userMenuOpen && (
            <Popover align="end" label="User settings">
              <Stack gap={3}>
                {settingsError !== null && (
                  <Notice role="alert" tone="error">
                    {settingsError}
                  </Notice>
                )}
                <Select
                  aria-label="Price marketplace"
                  onChange={onPriceProvider}
                  options={PRICE_PROVIDER_OPTIONS}
                  value={priceProvider}
                />
                <Checkbox
                  checked={user.scoring_enabled}
                  label="Enable card scoring"
                  onChange={(event) => {
                    onScoringEnabled(event.target.checked);
                  }}
                />
                <Button
                  alignStart
                  block
                  muted
                  onClick={onLogout}
                  variant="ghost"
                >
                  Log out
                </Button>
              </Stack>
            </Popover>
          )}
        </PopoverAnchor>
      </NavBar>
      <Suspense fallback={null}>
        <Routes>
          <Route path="*" element={<LibraryScreen mode="decks" />} />
          <Route path="/decks" element={<LibraryScreen mode="decks" />} />
          <Route path="/import" element={<LibraryScreen mode="import" />} />
          <Route path="/design" element={<DesignLibraryScreen />} />
          {user.scoring_enabled && (
            <Route path="/judge" element={<JudgeGoldenScreen />} />
          )}
          <Route path="/decks/:id" element={<EditorScreen />} />
        </Routes>
      </Suspense>
    </AppShell>
  );
}

export function App() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [priceProvider, setPriceProvider] =
    useState<PriceProvider>(storedPriceProvider);

  useEffect(() => {
    void api.me().then(
      (authenticatedUser) => {
        setUser(authenticatedUser);
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

  function handleScoringEnabled(enabled: boolean): void {
    setSettingsError(null);
    void api.updateSettings(enabled).then(setUser, () => {
      setSettingsError("Could not update scoring setting");
    });
  }

  if (user === null) return <LoginScreen />;

  return (
    <PriceProviderContext.Provider value={priceProvider}>
      <ScoringEnabledContext.Provider value={user.scoring_enabled}>
        <BrowserRouter>
          <ScrollToTop />
          <AppChrome
            onLogout={handleLogout}
            onPriceProvider={handlePriceProvider}
            onScoringEnabled={handleScoringEnabled}
            priceProvider={priceProvider}
            settingsError={settingsError}
            user={user}
          />
        </BrowserRouter>
      </ScoringEnabledContext.Provider>
    </PriceProviderContext.Provider>
  );
}
