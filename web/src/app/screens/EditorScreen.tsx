import { lazy, Suspense, useEffect, type CSSProperties } from "react";
import { useNavigate, useParams } from "react-router-dom";

import "../../designsystem/base.css";
import { CardPresentationProvider } from "../../modules/cards/ui/cardPresentation";
import { evaluateCards } from "../../modules/decks/evaluations/api/client";
import { Notice } from "../../designsystem/primitives/notice";
import { Page } from "../../designsystem/layout/page";
import { Stack } from "../../designsystem/layout/stack";
import { Text } from "../../designsystem/layout/typography";
import { PaneResizer, Workspace } from "../../designsystem/layout/workspace";
import { api } from "../api";
import { PREFERRED_CARD_ROLE_ORDER } from "../deck/constants";
import { AgentDrawer } from "../editor/agentDrawer";
import { BulkEditModal } from "../editor/bulkEditModal";
import { CardNoteModal } from "../editor/cardNoteModal";
import { DeckCardsView } from "../editor/cardsView";
import { DeckEditorProvider } from "../editor/deckEditorContext";
import { DeckHeader } from "../editor/deckHeader";
import { DescribeDialog } from "../editor/describeDialog";
import { EditDeckModal } from "../editor/editDeckModal";
import { HistoryModal } from "../editor/historyModal";
import { ValidationDialog } from "../editor/validationDialog";
import { useDeckAdvisor } from "../editor/useDeckAdvisor";
import { useDeckEditor } from "../editor/useDeckEditor";
import { DeckInfoView, DeckScoresView } from "../deckPrimitives";

const DeckChartsView = lazy(async () => {
  const module = await import("../deck/chartsView");
  return { default: module.DeckChartsView };
});

export function EditorScreen() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const editor = useDeckEditor(id, navigate);
  const { actions, analytics, data, details, display, modals, scoring } =
    editor;
  const advisor = useDeckAdvisor({
    busy: data.busy,
    deckId: id,
    loadDeck: data.loadDeck,
    setAnnouncement: data.setAnnouncement,
    setError: data.setError,
  });

  useEffect(() => {
    if (
      display.editorView === "info" &&
      (data.deck?.generated_description === null ||
        data.deck?.generated_description === "")
    ) {
      void details.handleGenerateDescription();
    }
  }, [
    data.deck?.generated_description,
    data.deck?.id,
    data.deck?.revision,
    display.editorView,
  ]);

  useEffect(() => {
    if (display.editorView !== "scores") return;
    void scoring.loadCachedScores();
  }, [display.editorView, scoring.loadCachedScores]);

  const deck = data.deck;
  if (deck === null) {
    return (
      <Page>
        <Text muted>{data.error ?? "Loading…"}</Text>
      </Page>
    );
  }

  return (
    <CardPresentationProvider
      cards={deck.cardsets}
      deckEvaluation={{
        deckId: deck.id,
        deckRevision: deck.revision,
        evaluateCards,
        roleOrder: PREFERRED_CARD_ROLE_ORDER,
        scores: scoring.scores,
        submitFeedback: api.submitEvaluationFeedback,
      }}
    >
      <DeckEditorProvider advisor={advisor} editor={{ ...editor, deck }}>
        <Workspace
          aria-busy={data.busy}
          panelOpen={advisor.showAgent}
          style={
            {
              "--ds-panel-width": `${String(advisor.advisorWidth)}px`,
            } as CSSProperties
          }
        >
          <Stack gap={0}>
            <h1 className="sr-only">{deck.title}</h1>
            <div aria-atomic="true" aria-live="polite" className="sr-only">
              {data.announcement}
            </div>
            {data.error !== null && (
              <Notice role="alert" tone="error">
                {data.error}
              </Notice>
            )}
            <DeckHeader />
            {display.editorView === "cards" && <DeckCardsView />}
            {display.editorView === "info" && (
              <DeckInfoView
                busy={data.busy}
                deck={deck}
                edit={() => {
                  modals.setShowEditDeck(true);
                }}
                refreshOverview={() =>
                  void details.handleGenerateDescription(true)
                }
                validation={data.validation}
              />
            )}
            {display.editorView === "charts" && (
              <Suspense fallback={<Text muted>Loading charts…</Text>}>
                <DeckChartsView
                  analytics={analytics.analytics}
                  error={analytics.analyticsError}
                  loading={analytics.analyticsLoading}
                  refresh={() => {
                    void analytics.loadAnalytics();
                  }}
                />
              </Suspense>
            )}
            {display.editorView === "scores" && (
              <DeckScoresView
                deck={deck}
                editGoal={() => {
                  modals.setShowEditDeck(true);
                }}
                progress={scoring.evaluationProgress}
                refreshCardScore={(oracleId) =>
                  void scoring.evaluateCard(oracleId)
                }
                refreshingOracleIds={scoring.refreshingOracleIds}
                scoreCards={() => void scoring.evaluateCurrentDeck()}
                scores={scoring.scores}
                scoring={scoring.scoring}
                toggleCoreCard={(oracleId) => {
                  const card = deck.cardsets.find(
                    (item) => item.oracle_id === oracleId,
                  );
                  if (card !== undefined) actions.toggleCoreCard(card);
                }}
              />
            )}
          </Stack>
          {advisor.showAgent && (
            <PaneResizer
              aria-valuemin={320}
              aria-valuenow={advisor.advisorWidth}
              label="Resize deck advisor"
              onDoubleClick={() => {
                advisor.resetAdvisorWidth();
              }}
              onKeyDown={advisor.resizeAdvisorWithKeyboard}
              onPointerDown={advisor.beginAdvisorResize}
              onPointerMove={advisor.resizeAdvisor}
              tabIndex={0}
            />
          )}
          {advisor.showAgent && <AgentDrawer />}
          {modals.showBulkEdit && <BulkEditModal />}
          {modals.activeCardNote !== null && (
            <CardNoteModal cardset={modals.activeCardNote} />
          )}
          {modals.showEditDeck && <EditDeckModal />}
          {modals.openDialog === "history" && <HistoryModal />}
          {modals.openDialog === "validation" && <ValidationDialog />}
          {modals.openDialog === "describe" && <DescribeDialog />}
        </Workspace>
      </DeckEditorProvider>
    </CardPresentationProvider>
  );
}
