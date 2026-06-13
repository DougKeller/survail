import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type SyntheticEvent,
} from "react";

import { api } from "../api";
import { messageFor } from "../deckPrimitives";

import type { AgentUiEvent } from "../../modules/agent/contracts";

export function useDeckAdvisor({
  busy,
  deckId,
  loadDeck,
  setAnnouncement,
  setError,
}: {
  busy: boolean;
  deckId: string;
  loadDeck: () => Promise<void>;
  setAnnouncement: (value: string) => void;
  setError: (value: string | null) => void;
}) {
  const [showAgent, setShowAgent] = useState(true);
  const [advisorWidth, setAdvisorWidth] = useState(() => {
    const stored = Number.parseInt(
      localStorage.getItem("survail.advisor-width") ?? "",
      10,
    );
    return Number.isFinite(stored) ? Math.max(320, stored) : 400;
  });
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [agentMessage, setAgentMessage] = useState("");
  const [agentEvents, setAgentEvents] = useState<AgentUiEvent[]>([]);
  const [agentBusy, setAgentBusy] = useState(false);
  const [guidanceDecisions, setGuidanceDecisions] = useState<
    Record<string, "approved" | "rejected">
  >({});
  const [latestUserMessageId, setLatestUserMessageId] = useState<string | null>(
    null,
  );
  const agentEventsRef = useRef<HTMLDivElement>(null);
  const latestUserMessageRef = useRef<HTMLElement>(null);

  useEffect(() => {
    localStorage.setItem("survail.advisor-width", String(advisorWidth));
  }, [advisorWidth]);

  useEffect(() => {
    if (latestUserMessageId === null) return;
    const frame = requestAnimationFrame(() => {
      const viewport = agentEventsRef.current;
      const message = latestUserMessageRef.current;
      if (viewport !== null && message !== null) {
        viewport.scrollTo({
          top: message.offsetTop - viewport.offsetTop,
          behavior: "smooth",
        });
      }
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [latestUserMessageId]);

  function beginAdvisorResize(event: PointerEvent<HTMLDivElement>): void {
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function resizeAdvisor(event: PointerEvent<HTMLDivElement>): void {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    setAdvisorWidth(Math.max(320, window.innerWidth - event.clientX - 16));
  }

  function resizeAdvisorWithKeyboard(
    event: KeyboardEvent<HTMLDivElement>,
  ): void {
    if (
      event.key !== "ArrowLeft" &&
      event.key !== "ArrowRight" &&
      event.key !== "Home"
    )
      return;
    event.preventDefault();
    if (event.key === "Home") setAdvisorWidth(400);
    else
      setAdvisorWidth((current) =>
        Math.max(320, current + (event.key === "ArrowLeft" ? 24 : -24)),
      );
  }

  function resetAdvisorWidth(): void {
    setAdvisorWidth(400);
  }

  const refreshDeckAfterAgentOperation = async (): Promise<void> => {
    try {
      await loadDeck();
      setAnnouncement("Deck updated by the deck advisor");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? messageFor(reason)
          : "Could not refresh the updated deck",
      );
    }
  };

  function receiveAgentEvent(event: AgentUiEvent): void {
    setAgentEvents((current) => [...current, event]);
    if (event.type === "operation_applied")
      void refreshDeckAfterAgentOperation();
  }

  async function decideGuidanceProposal(
    proposalId: string,
    expectedRevision: number,
    decision: "approve" | "reject",
  ): Promise<void> {
    if (busy) return;
    setError(null);
    try {
      await api.decideGuidanceProposal(
        deckId,
        proposalId,
        expectedRevision,
        decision,
      );
      setGuidanceDecisions((current) => ({
        ...current,
        [proposalId]: decision === "approve" ? "approved" : "rejected",
      }));
      if (decision === "approve") {
        await loadDeck();
        setAnnouncement("Deck goal updated");
      } else setAnnouncement("Guidance proposal rejected");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? messageFor(reason)
          : "Could not decide guidance proposal",
      );
    }
  }

  async function ensureConversation(): Promise<string> {
    if (conversationId !== null) return conversationId;
    const conversation = await api.createConversation(deckId);
    setConversationId(conversation.id);
    return conversation.id;
  }

  async function submitAgentMessage(message: string): Promise<void> {
    if (message.trim() === "" || agentBusy) return;
    const cleanedMessage = message.trim();
    const userMessageId = crypto.randomUUID();
    setAgentMessage("");
    setAgentEvents((current) => [
      ...current,
      {
        type: "user_message",
        run_id: userMessageId,
        payload: { message: cleanedMessage },
      },
    ]);
    setLatestUserMessageId(userMessageId);
    setAgentBusy(true);
    try {
      await api.sendAgentMessage(
        deckId,
        await ensureConversation(),
        cleanedMessage,
        receiveAgentEvent,
      );
    } catch (reason) {
      setAgentEvents((current) => [
        ...current,
        {
          type: "stream_closed",
          run_id: userMessageId,
          payload: {
            expected: false,
            message: "The deck advisor could not be reached. Please try again.",
          },
        },
      ]);
      setError(
        reason instanceof Error
          ? messageFor(reason)
          : "Could not contact deck advisor",
      );
    } finally {
      setAgentBusy(false);
    }
  }

  function sendAgentMessage(event: SyntheticEvent<HTMLFormElement>): void {
    event.preventDefault();
    void submitAgentMessage(agentMessage);
  }

  function handleAgentComposerKeyDown(
    event: KeyboardEvent<HTMLTextAreaElement>,
  ): void {
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      event.nativeEvent.isComposing
    )
      return;
    event.preventDefault();
    void submitAgentMessage(agentMessage);
  }

  return {
    advisorWidth,
    agentBusy,
    agentEvents,
    agentEventsRef,
    agentMessage,
    beginAdvisorResize,
    decideGuidanceProposal,
    guidanceDecisions,
    handleAgentComposerKeyDown,
    latestUserMessageId,
    latestUserMessageRef,
    resizeAdvisor,
    resizeAdvisorWithKeyboard,
    resetAdvisorWidth,
    sendAgentMessage,
    setAgentMessage,
    setShowAgent,
    showAgent,
    submitAgentMessage,
  };
}
