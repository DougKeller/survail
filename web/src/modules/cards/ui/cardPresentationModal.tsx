import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";

import type { CardRoleEvaluation } from "../../decks/evaluations/contracts";
import { evaluateCards } from "../../decks/evaluations/api/client";
import { CardAnalysisPanel, CardInfoPanel } from "./cardPresentationPanels";
import {
  cardDetails,
  focusableElements,
  imageSource,
  oracleId,
  type DeckCardEvaluationContext,
  type CardPresentationSource,
} from "./cardPresentationShared";

export function CardDetailsModal({
  close,
  deckEvaluation,
  source,
}: {
  close: () => void;
  deckEvaluation?: DeckCardEvaluationContext;
  source: CardPresentationSource;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const details = cardDetails(source);
  const card = details.card;
  const image = imageSource(card);
  const [activeTab, setActiveTab] = useState<"analysis" | "info">(
    deckEvaluation === undefined ? "info" : "analysis",
  );
  const [evaluation, setEvaluation] = useState<CardRoleEvaluation | null>(null);
  const [loadingEvaluation, setLoadingEvaluation] = useState(false);
  const [evaluationError, setEvaluationError] = useState<string | null>(null);

  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        close();
        return;
      }
      const dialog = document.querySelector<HTMLElement>(".card-details-modal");
      if (event.key !== "Tab" || dialog === null) return;
      const focusable = focusableElements(dialog);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (first === undefined || last === undefined) {
        event.preventDefault();
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus();
    };
  }, [close]);

  useEffect(() => {
    setActiveTab(deckEvaluation === undefined ? "info" : "analysis");
    if (deckEvaluation === undefined) {
      setEvaluation(null);
      setEvaluationError(null);
      setLoadingEvaluation(false);
      return;
    }
    const cached = deckEvaluation.scores.get(oracleId(source));
    if (cached?.deck_revision === deckEvaluation.deckRevision) {
      setEvaluation(cached);
      setEvaluationError(null);
      setLoadingEvaluation(false);
      return;
    }
    const requestState = { cancelled: false };
    setLoadingEvaluation(true);
    setEvaluation(null);
    setEvaluationError(null);
    void (async () => {
      try {
        const results = await evaluateCards(deckEvaluation.deckId, [
          oracleId(source),
        ]);
        if (requestState.cancelled) return;
        if (results.length === 0) {
          setEvaluationError("Could not load deck analysis");
          return;
        }
        const [result] = results as [
          CardRoleEvaluation,
          ...CardRoleEvaluation[],
        ];
        setEvaluation(result);
      } catch (error: unknown) {
        if (requestState.cancelled) return;
        setEvaluationError(
          error instanceof Error
            ? error.message
            : "Could not load deck analysis",
        );
      } finally {
        if (!requestState.cancelled) setLoadingEvaluation(false);
      }
    })();
    return () => {
      requestState.cancelled = true;
    };
  }, [deckEvaluation, source]);

  return createPortal(
    <div className="card-presentation-backdrop" onMouseDown={close}>
      <section
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="card-details-modal"
        onMouseDown={(event) => {
          event.stopPropagation();
        }}
        role="dialog"
        tabIndex={-1}
      >
        <header className="card-details-header">
          <div>
            <h2 id={titleId}>{card.name}</h2>
            <p id={descriptionId}>{card.type_line}</p>
          </div>
          <button
            aria-label="Close card details"
            className="card-details-close"
            onClick={close}
            type="button"
          >
            <span aria-hidden="true" className="material-symbols-outlined">
              close
            </span>
          </button>
        </header>
        <div className="card-details-content">
          <div className="card-details-art">
            {image === null ? (
              <div
                aria-label={`${card.name}, image unavailable`}
                className="card-presentation-placeholder"
                role="img"
              >
                {card.name}
              </div>
            ) : (
              <img alt={card.name} src={image} />
            )}
          </div>
          <div className="card-details-copy">
            {deckEvaluation !== undefined && (
              <div
                aria-label="Card details tabs"
                className="card-details-tabs"
                role="tablist"
              >
                <button
                  aria-selected={activeTab === "analysis"}
                  className={activeTab === "analysis" ? "active" : ""}
                  onClick={() => {
                    setActiveTab("analysis");
                  }}
                  role="tab"
                  type="button"
                >
                  Analysis
                </button>
                <button
                  aria-selected={activeTab === "info"}
                  className={activeTab === "info" ? "active" : ""}
                  onClick={() => {
                    setActiveTab("info");
                  }}
                  role="tab"
                  type="button"
                >
                  Info
                </button>
              </div>
            )}
            {activeTab === "analysis" ? (
              <CardAnalysisPanel
                error={evaluationError}
                evaluation={evaluation}
                loading={loadingEvaluation}
              />
            ) : (
              <CardInfoPanel card={card} finish={details.finish} />
            )}
          </div>
        </div>
      </section>
    </div>,
    document.body,
  );
}
