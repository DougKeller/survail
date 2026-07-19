import { useCallback, useState } from "react";

import type { DeckAnalytics } from "../../modules/decks/analytics/contracts";
import { api } from "../api";
import { messageFor } from "../deckPrimitives";

export function useDeckAnalytics(deckId: string) {
  const [analytics, setAnalytics] = useState<DeckAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  const loadAnalytics = useCallback(async (): Promise<void> => {
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    try {
      setAnalytics(await api.deckAnalytics(deckId));
    } catch (reason) {
      setAnalyticsError(
        reason instanceof Error
          ? messageFor(reason)
          : "Could not load deck analytics",
      );
    } finally {
      setAnalyticsLoading(false);
    }
  }, [deckId, setAnalytics, setAnalyticsError, setAnalyticsLoading]);

  return { analytics, analyticsError, analyticsLoading, loadAnalytics };
}
