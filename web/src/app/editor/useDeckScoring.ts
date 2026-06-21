import { useEffect, useState } from "react";

import { api } from "../api";

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
  const [refreshingOracleIds, setRefreshingOracleIds] = useState<Set<string>>(
    new Set(),
  );
  const [evaluationProgress, setEvaluationProgress] =
    useState<CardEvaluationProgress | null>(null);
  const [cachedScoresLoadedFor, setCachedScoresLoadedFor] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (deck === null) return;
    setScores(new Map());
    setRefreshingOracleIds(new Set());
    setEvaluationProgress(null);
    setCachedScoresLoadedFor(null);
  }, [deck]);

  async function loadCachedScores(): Promise<void> {
    if (deck === null || cachedScoresLoadedFor === deck.id) return;
    try {
      const loadedScores = await api.cachedDeckEvaluation(deck.id);
      setScores(new Map(loadedScores.map((score) => [score.oracle_id, score])));
      setCachedScoresLoadedFor(deck.id);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not load cached scores",
      );
    }
  }

  async function evaluateCurrentDeck(): Promise<void> {
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
        reason instanceof Error ? reason.message : "Could not score cards",
      );
    } finally {
      setScoring(false);
      setEvaluationProgress(null);
    }
  }

  async function evaluateCard(oracleId: string): Promise<void> {
    if (
      deck === null ||
      scoring ||
      refreshingOracleIds.has(oracleId)
    ) {
      return;
    }
    if (deck.goal.trim() === "") {
      setAnnouncement("Add a Goal / North Star before evaluating cards");
      return;
    }
    setRefreshingOracleIds((current) => new Set(current).add(oracleId));
    try {
      const result = await api.evaluateCard(deck.id, oracleId);
      setScores((current) => new Map(current).set(result.oracle_id, result));
      setAnnouncement("Card score refreshed");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not refresh card score",
      );
    } finally {
      setRefreshingOracleIds((current) => {
        const next = new Set(current);
        next.delete(oracleId);
        return next;
      });
    }
  }

  return {
    evaluationProgress,
    evaluateCard,
    evaluateCurrentDeck,
    loadCachedScores,
    refreshingOracleIds,
    scoring,
    scores,
  };
}
