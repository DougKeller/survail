import { useEffect, useState } from "react";

import { Dialog } from "../../../designsystem/primitives/dialog";
import { Art } from "../../../designsystem/primitives/artPlaceholder";
import { Tab, TabList } from "../../../designsystem/primitives/tablist";
import { SplitPane } from "../../../designsystem/layout/divided";
import { Stack } from "../../../designsystem/layout/stack";

import type { CardRoleEvaluation } from "../../decks/evaluations/contracts";
import { CardAnalysisPanel, CardInfoPanel } from "./cardPresentationPanels";
import {
  cardDetails,
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
    setActiveTab(deckEvaluation === undefined ? "info" : "analysis");
    if (deckEvaluation === undefined) {
      setEvaluation(null);
      setEvaluationError(null);
      setLoadingEvaluation(false);
      return;
    }
    const cached = deckEvaluation.scores.get(oracleId(source));
    if (cached !== undefined) {
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
        const results = await deckEvaluation.evaluateCards(
          deckEvaluation.deckId,
          [oracleId(source)],
        );
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

  return (
    <Dialog
      closeLabel="Close card details"
      description={card.type_line}
      onClose={close}
      open
      size="wide"
      title={card.name}
    >
      <SplitPane ratio="wide-end">
        {image === null ? (
          <Art label={`${card.name}, image unavailable`} size="lg" />
        ) : (
          <img alt={card.name} src={image} />
        )}
        <Stack gap={3}>
          {deckEvaluation !== undefined && (
            <TabList label="Card details tabs">
              <Tab
                onClick={() => {
                  setActiveTab("analysis");
                }}
                selected={activeTab === "analysis"}
              >
                Analysis
              </Tab>
              <Tab
                onClick={() => {
                  setActiveTab("info");
                }}
                selected={activeTab === "info"}
              >
                Info
              </Tab>
            </TabList>
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
        </Stack>
      </SplitPane>
    </Dialog>
  );
}
