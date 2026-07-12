import { useCallback, useEffect, useState } from "react";

import { api } from "../api";

import type { Deck } from "../../modules/decks/contracts";
import type {
  CardEvaluationProgress,
  CardRoleEvaluation,
  RoleAnnotationLabel,
  RoleAnnotationQueue,
  SandboxRun,
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
  const [annotationQueue, setAnnotationQueue] = useState<RoleAnnotationQueue | null>(
    null,
  );
  const [annotationQueueLoadedFor, setAnnotationQueueLoadedFor] = useState<string | null>(
    null,
  );
  const [annotationLoading, setAnnotationLoading] = useState(false);
  const [sandboxRun, setSandboxRun] = useState<SandboxRun | null>(null);
  const [sandboxRunning, setSandboxRunning] = useState(false);

  useEffect(() => {
    if (deck === null) return;
    setScores(new Map());
    setRefreshingOracleIds(new Set());
    setEvaluationProgress(null);
    setCachedScoresLoadedFor(null);
    setAnnotationQueue(null);
    setAnnotationQueueLoadedFor(null);
    setSandboxRun(null);
  }, [deck]);

  const loadCachedScores = useCallback(async (): Promise<void> => {
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
  }, [cachedScoresLoadedFor, deck, setError]);

  const loadAnnotationQueue = useCallback(
    async (force = false): Promise<void> => {
      if (deck === null) return;
      if (!force && annotationQueueLoadedFor === deck.id) return;
      setAnnotationLoading(true);
      try {
        setAnnotationQueue(await api.annotationQueue(deck.id));
        setAnnotationQueueLoadedFor(deck.id);
      } catch (reason) {
        setError(
          reason instanceof Error ? reason.message : "Could not load annotation queue",
        );
      } finally {
        setAnnotationLoading(false);
      }
    },
    [annotationQueueLoadedFor, deck, setError],
  );

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
      void loadAnnotationQueue(true);
      setAnnouncement(`${String(loadedScores.length)} cards scored`);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not score cards",
      );
    } finally {
      setScoring(false);
      setEvaluationProgress(null);
    }
  }, [deck, loadAnnotationQueue, scoring, setAnnouncement, setError]);

  const evaluateCard = useCallback(async (oracleId: string): Promise<void> => {
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
      void loadAnnotationQueue(true);
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
  }, [deck, loadAnnotationQueue, refreshingOracleIds, scoring, setAnnouncement, setError]);

  const saveAnnotationLabel = useCallback(async (
    captureId: string,
    label: RoleAnnotationLabel,
  ): Promise<void> => {
    if (deck === null) return;
    try {
      const updated = await api.labelAnnotationCapture(deck.id, captureId, label);
      setAnnotationQueue((current) => {
        if (current === null) return current;
        return {
          unlabeled: current.unlabeled.filter((item) => item.id !== captureId),
          labeled: [updated, ...current.labeled.filter((item) => item.id !== captureId)],
        };
      });
      setAnnouncement("Annotation saved");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not save annotation",
      );
    }
  }, [deck, setAnnouncement, setError]);

  const runSandbox = useCallback(async (systemPrompt: string, model: string): Promise<void> => {
    if (deck === null || sandboxRunning) return;
    setSandboxRunning(true);
    try {
      setSandboxRun(await api.runAnnotationSandbox(deck.id, { system_prompt: systemPrompt, model }));
      setAnnouncement("Sandbox run completed");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not run sandbox",
      );
    } finally {
      setSandboxRunning(false);
    }
  }, [deck, sandboxRunning, setAnnouncement, setError]);

  return {
    annotationLoading,
    annotationQueue,
    evaluationProgress,
    evaluateCard,
    evaluateCurrentDeck,
    loadCachedScores,
    loadAnnotationQueue,
    refreshingOracleIds,
    runSandbox,
    sandboxRun,
    sandboxRunning,
    saveAnnotationLabel,
    scoring,
    scores,
  };
}
