import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "../api";
import { messageFor } from "../deckPrimitives";

import type { Deck } from "../../modules/decks/contracts";
import type {
  CardEvaluationProgress,
  CardRoleEvaluation,
} from "../../modules/decks/evaluations/contracts";

const NO_SCORES = new Map<string, CardRoleEvaluation>();

export function useDeckScoring({
  deck,
  scoringEnabled,
  setAnnouncement,
  setError,
}: {
  deck: Deck | null;
  scoringEnabled: boolean;
  setAnnouncement: (value: string) => void;
  setError: (value: string | null) => void;
}) {
  const [scores, setScores] = useState<Map<string, CardRoleEvaluation>>(
    new Map(),
  );
  const [scoring, setScoring] = useState(false);
  const [clearingScores, setClearingScores] = useState(false);
  const [evaluationProgress, setEvaluationProgress] =
    useState<CardEvaluationProgress | null>(null);
  const cachedScoresLoadedForRef = useRef<string | null>(null);
  const deckCacheKey =
    deck === null ? null : `${deck.id}:${String(deck.revision)}`;
  const observedDeckCacheKeyRef = useRef(deckCacheKey);
  if (observedDeckCacheKeyRef.current !== deckCacheKey) {
    observedDeckCacheKeyRef.current = deckCacheKey;
    cachedScoresLoadedForRef.current = null;
  }

  useEffect(() => {
    setScores(new Map());
    setEvaluationProgress(null);
  }, [deck?.id]);

  const loadCachedScores = useCallback(async (): Promise<void> => {
    if (
      !scoringEnabled ||
      deck === null ||
      deckCacheKey === null ||
      cachedScoresLoadedForRef.current === deckCacheKey
    )
      return;
    cachedScoresLoadedForRef.current = deckCacheKey;
    try {
      const loadedScores = await api.cachedDeckEvaluation(deck.id);
      setScores(new Map(loadedScores.map((score) => [score.oracle_id, score])));
    } catch (reason) {
      cachedScoresLoadedForRef.current = null;
      setError(
        reason instanceof Error
          ? messageFor(reason)
          : "Could not load cached scores",
      );
    }
  }, [deck, deckCacheKey, scoringEnabled, setError]);

  const evaluateCurrentDeck = useCallback(async (): Promise<void> => {
    if (!scoringEnabled || deck === null || scoring) return;
    if (deck.goal.trim() === "") {
      setAnnouncement("Add a Goal / North Star before evaluating cards");
      return;
    }
    setScoring(true);
    try {
      setEvaluationProgress({
        completed: 0,
        total: new Set(deck.cardsets.map((card) => card.oracle_id)).size,
        average_seconds_per_card: null,
        eta_seconds: null,
      });
      const loadedScores = await api.streamCurrentDeckEvaluation(
        deck.id,
        setEvaluationProgress,
        (result) => {
          setScores((current) =>
            new Map(current).set(result.oracle_id, result),
          );
        },
      );
      setScores(new Map(loadedScores.map((score) => [score.oracle_id, score])));
      setAnnouncement(`${String(loadedScores.length)} cards scored`);
    } catch (reason) {
      setError(
        reason instanceof Error ? messageFor(reason) : "Could not score cards",
      );
    } finally {
      setScoring(false);
      setEvaluationProgress(null);
    }
  }, [deck, scoring, scoringEnabled, setAnnouncement, setError]);

  const clearScoreCache = useCallback(async (): Promise<boolean> => {
    if (deck === null || scoring || clearingScores) return false;
    setClearingScores(true);
    try {
      await api.clearDeckEvaluationCache(deck.id);
      setScores(new Map());
      setEvaluationProgress(null);
      cachedScoresLoadedForRef.current = deckCacheKey;
      setAnnouncement("Deck score cache cleared");
      return true;
    } catch (reason) {
      setError(
        reason instanceof Error
          ? messageFor(reason)
          : "Could not clear deck score cache",
      );
      return false;
    } finally {
      setClearingScores(false);
    }
  }, [
    clearingScores,
    deck,
    deckCacheKey,
    scoring,
    setAnnouncement,
    setError,
  ]);

  return {
    clearScoreCache,
    clearingScores,
    evaluationProgress,
    evaluateCurrentDeck,
    loadCachedScores,
    scoring,
    scores: scoringEnabled ? scores : NO_SCORES,
  };
}
