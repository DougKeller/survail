import { useCallback, useEffect, useState } from "react";

import { api } from "../api";
import { messageFor } from "../deckPrimitives";

import type { Deck } from "../../modules/decks/contracts";
import type {
  CardEvaluationProgress,
  CardRoleEvaluation,
} from "../../modules/decks/evaluations/contracts";

export function useDeckScoring({
  deck,
  setAnnouncement,
  setError,
}: {
  deck: Deck | null;
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
  const [cachedScoresLoadedFor, setCachedScoresLoadedFor] = useState<
    string | null
  >(null);

  useEffect(() => {
    setScores(new Map());
    setEvaluationProgress(null);
    setCachedScoresLoadedFor(null);
  }, [deck?.id]);

  useEffect(() => {
    setCachedScoresLoadedFor(null);
  }, [deck?.revision]);

  const loadCachedScores = useCallback(async (): Promise<void> => {
    if (deck === null || cachedScoresLoadedFor === deck.id) return;
    try {
      const loadedScores = await api.cachedDeckEvaluation(deck.id);
      setScores(new Map(loadedScores.map((score) => [score.oracle_id, score])));
      setCachedScoresLoadedFor(deck.id);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? messageFor(reason)
          : "Could not load cached scores",
      );
    }
  }, [cachedScoresLoadedFor, deck, setError]);

  const evaluateCurrentDeck = useCallback(async (): Promise<void> => {
    if (deck === null || scoring) return;
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
  }, [deck, scoring, setAnnouncement, setError]);

  const clearScoreCache = useCallback(async (): Promise<boolean> => {
    if (deck === null || scoring || clearingScores) return false;
    setClearingScores(true);
    try {
      await api.clearDeckEvaluationCache(deck.id);
      setScores(new Map());
      setEvaluationProgress(null);
      setCachedScoresLoadedFor(deck.id);
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
  }, [clearingScores, deck, scoring, setAnnouncement, setError]);

  return {
    clearScoreCache,
    clearingScores,
    evaluationProgress,
    evaluateCurrentDeck,
    loadCachedScores,
    scoring,
    scores,
  };
}
