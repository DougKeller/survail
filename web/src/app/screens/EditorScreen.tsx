import { useEffect, type CSSProperties } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { CardPresentationProvider } from "../../modules/cards/ui/cardPresentation";
import { AgentDrawer } from "../editor/agentDrawer";
import { BulkEditModal } from "../editor/bulkEditModal";
import { CardNoteModal } from "../editor/cardNoteModal";
import { DeckCardsView } from "../editor/cardsView";
import { DeckHeader } from "../editor/deckHeader";
import { EditDeckModal } from "../editor/editDeckModal";
import { HistoryModal } from "../editor/historyModal";
import { useDeckAdvisor } from "../editor/useDeckAdvisor";
import { useDeckEditor } from "../editor/useDeckEditor";
import {
  DeckChartsView,
  DeckInfoView,
  DeckScoresView,
  useModalBehavior,
} from "../deckPrimitives";

export function EditorScreen() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const editor = useDeckEditor(id, navigate);
  const advisor = useDeckAdvisor({
    busy: editor.busy,
    deckId: id,
    loadDeck: editor.loadDeck,
    setAnnouncement: editor.setAnnouncement,
    setError: editor.setError,
  });
  const activeCardNote = editor.activeCardNote;
  const editDeckDialogRef = useModalBehavior<HTMLFormElement>(
    editor.showEditDeck,
    () => {
      editor.setShowEditDeck(false);
    },
  );
  const historyDialogRef = useModalBehavior<HTMLElement>(
    editor.showHistory,
    () => {
      editor.setShowHistory(false);
    },
  );
  const bulkEditDialogRef = useModalBehavior<HTMLElement>(
    editor.showBulkEdit,
    () => {
      editor.setShowBulkEdit(false);
    },
  );
  const cardNoteDialogRef = useModalBehavior<HTMLFormElement>(
    editor.activeCardNote !== null,
    () => {
      editor.setActiveCardNote(null);
    },
  );
  useEffect(() => {
    if (
      editor.editorView === "info" &&
      (editor.deck?.generated_description === null ||
        editor.deck?.generated_description === "")
    ) {
      void editor.handleGenerateDescription();
    }
  }, [
    editor.deck?.generated_description,
    editor.deck?.id,
    editor.deck?.revision,
    editor.editorView,
  ]);

  useEffect(() => {
    if (editor.editorView !== "scores") return;
    void editor.loadCachedScores();
  }, [editor.editorView, editor.loadCachedScores]);

  if (editor.deck === null) return <main>{editor.error ?? "Loading…"}</main>;

  return (
    <CardPresentationProvider
      cards={editor.deck.cardsets}
      deckEvaluation={{
        deckId: editor.deck.id,
        deckRevision: editor.deck.revision,
        scores: editor.scores,
      }}
    >
      <main
        aria-busy={editor.busy}
        className={`editor ${advisor.showAgent ? "advisor-open" : ""}`}
        style={
          {
            "--advisor-width": `${String(advisor.advisorWidth)}px`,
          } as CSSProperties
        }
      >
        <h1 className="sr-only">{editor.deck.title}</h1>
        <div aria-atomic="true" aria-live="polite" className="sr-only">
          {editor.announcement}
        </div>
        <section className="deck-editor">
          {editor.error !== null && (
            <p className="notice error" role="alert">
              {editor.error}
            </p>
          )}
          <DeckHeader
            deckFormat={editor.deck.format}
            deckTitle={editor.deck.title}
            editorView={editor.editorView}
            onDelete={editor.handleDelete}
            onEdit={() => {
              editor.setShowEditDeck(true);
            }}
            onOpenBulkEdit={editor.openBulkEdit}
            onOpenHistory={() => {
              editor.setShowHistory(true);
            }}
            onSelectView={editor.setEditorView}
            showAgent={advisor.showAgent}
            toggleAgent={() => {
              advisor.setShowAgent((current) => !current);
            }}
            validation={editor.validation}
          />
          {editor.editorView === "cards" && (
            <DeckCardsView
              addSearchResult={(card, zone) => {
                editor.addSearchResult(card, zone);
                editor.setShowSearchResults(false);
                editor.setResults([]);
                editor.setQuery("");
                requestAnimationFrame(() => {
                  editor.searchInputRef.current?.focus();
                });
              }}
              applyQuantityChange={editor.changeQuantity}
              busy={editor.busy}
              deck={editor.deck}
              displayPreferences={editor.displayPreferences}
              markCommander={editor.markAsCommander}
              moveCardToZone={editor.moveCardToZone}
              openSearch={editor.handleSearch}
              priceProvider={editor.priceProvider}
              results={editor.results}
              scores={editor.scores}
              searchForm={editor.query}
              searchInputRef={editor.searchInputRef}
              setDisplayPreferences={editor.setDisplayPreferences}
              setQuery={editor.setQuery}
              setShowSearchResults={editor.setShowSearchResults}
              showSearchResults={editor.showSearchResults}
              editCardNote={(card) => {
                editor.setActiveCardNote(card);
              }}
              toggleCoreCard={editor.toggleCoreCard}
            />
          )}
          {editor.editorView === "info" && (
            <DeckInfoView
              busy={editor.busy}
              deck={editor.deck}
              edit={() => {
                editor.setShowEditDeck(true);
              }}
              refreshOverview={() =>
                void editor.handleGenerateDescription(true)
              }
              validation={editor.validation}
            />
          )}
          {editor.editorView === "charts" && (
            <DeckChartsView
              analytics={editor.analytics}
              error={editor.analyticsError}
              loading={editor.analyticsLoading}
              refresh={() => {
                void editor.loadAnalytics();
              }}
            />
          )}
          {editor.editorView === "scores" && (
            <DeckScoresView
              deck={editor.deck}
              editGoal={() => {
                editor.setShowEditDeck(true);
              }}
              progress={editor.evaluationProgress}
              refreshCardScore={(oracleId) => void editor.evaluateCard(oracleId)}
              refreshingOracleIds={editor.refreshingOracleIds}
              scoreCards={() => void editor.evaluateCurrentDeck()}
              scores={editor.scores}
              scoring={editor.scoring}
              toggleCoreCard={(oracleId) => {
                const card = editor.deck?.cardsets.find(
                  (item) => item.oracle_id === oracleId,
                );
                if (card !== undefined) editor.toggleCoreCard(card);
              }}
            />
          )}
        </section>
        {advisor.showAgent && (
          <div
            aria-label="Resize deck advisor"
            aria-orientation="vertical"
            aria-valuemin={320}
            aria-valuenow={advisor.advisorWidth}
            className="advisor-resizer"
            onDoubleClick={() => {
              advisor.resetAdvisorWidth();
            }}
            onKeyDown={advisor.resizeAdvisorWithKeyboard}
            onPointerDown={advisor.beginAdvisorResize}
            onPointerMove={advisor.resizeAdvisor}
            role="separator"
            tabIndex={0}
          />
        )}
        {advisor.showAgent && (
          <AgentDrawer
            agentBusy={advisor.agentBusy}
            agentEvents={advisor.agentEvents}
            agentEventsRef={advisor.agentEventsRef}
            agentMessage={advisor.agentMessage}
            busy={editor.busy}
            close={() => {
              advisor.setShowAgent(false);
            }}
            decideOperationProposal={advisor.decideOperationProposal}
            deck={editor.deck}
            decideGuidanceProposal={advisor.decideGuidanceProposal}
            guidanceDecisions={advisor.guidanceDecisions}
            operationProposalDecisions={advisor.operationProposalDecisions}
            handleAgentComposerKeyDown={advisor.handleAgentComposerKeyDown}
            latestUserMessageId={advisor.latestUserMessageId}
            latestUserMessageRef={advisor.latestUserMessageRef}
            sendAgentMessage={advisor.sendAgentMessage}
            setAgentMessage={advisor.setAgentMessage}
            submitAgentMessage={advisor.submitAgentMessage}
          />
        )}
        {editor.showBulkEdit && (
          <BulkEditModal
            applyBulkEdit={editor.applyBulkEdit}
            bulkDecklist={editor.bulkDecklist}
            bulkEditDialogRef={bulkEditDialogRef}
            bulkEditErrors={editor.bulkEditErrors}
            busy={editor.busy}
            close={() => {
              editor.setShowBulkEdit(false);
            }}
            setBulkDecklist={editor.setBulkDecklist}
          />
        )}
        {activeCardNote !== null && (
          <CardNoteModal
            busy={editor.busy}
            cardset={activeCardNote}
            close={() => {
              editor.setActiveCardNote(null);
            }}
            dialogRef={cardNoteDialogRef}
            save={(note) => {
              editor.updateCardNote(activeCardNote, note);
              editor.setActiveCardNote(null);
            }}
          />
        )}
        {editor.showEditDeck && (
          <EditDeckModal
            busy={editor.busy}
            close={() => {
              editor.setShowEditDeck(false);
            }}
            deck={editor.deck}
            description={editor.description}
            dialogRef={editDeckDialogRef}
            goal={editor.goal}
            handleSubmit={(event) => {
              event.preventDefault();
              void editor.handleSaveDetails(event).then((saved) => {
                if (saved) editor.setShowEditDeck(false);
              });
            }}
            setDescription={editor.setDescription}
            setGoal={editor.setGoal}
            setTitle={editor.setTitle}
            title={editor.title}
          />
        )}
        {editor.showHistory && (
          <HistoryModal
            busy={editor.busy}
            close={() => {
              editor.setShowHistory(false);
            }}
            dialogRef={historyDialogRef}
            handleRevert={editor.handleRevert}
            operations={editor.operations}
          />
        )}
      </main>
    </CardPresentationProvider>
  );
}
