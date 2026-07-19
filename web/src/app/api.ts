import {
  createConversation,
  sendAgentMessage,
} from "../modules/agent/api/conversations";
import { me, logout } from "../modules/auth/api/session";
import { printings, search } from "../modules/cards/api/search";
import {
  createDeck,
  analytics as deckAnalytics,
  deck,
  decks,
  deleteDeck,
  generateDescription,
  sample,
  updateDeck,
  validation,
} from "../modules/decks/api/manage";
import {
  addCardsetTag,
  applyOperation,
  createDeckTag,
  decideOperationProposal,
  deleteDeckTag,
  operations,
  removeCardsetTag,
  renameDeckTag,
  revertOperation,
  setCardNote,
} from "../modules/decks/api/operations";
import {
  cachedDeckEvaluation,
  clearDeckEvaluationCache,
  evaluateCards,
  evaluateCurrentDeck,
  judgeReference,
  streamCurrentDeckEvaluation,
  submitEvaluationFeedback,
} from "../modules/decks/evaluations/api/client";
import { decideGuidanceProposal } from "../modules/decks/guidance/api/client";
import {
  createMoxfieldDeck,
  importMoxfield,
} from "../modules/imports/api/moxfield";

export const api = {
  me,
  logout,
  decks,
  deck,
  createDeck,
  updateDeck,
  deleteDeck,
  importMoxfield,
  createMoxfieldDeck,
  sample,
  search,
  printings,
  applyOperation,
  decideOperationProposal,
  operations,
  revertOperation,
  setCardNote,
  createDeckTag,
  renameDeckTag,
  deleteDeckTag,
  addCardsetTag,
  removeCardsetTag,
  validation,
  deckAnalytics,
  cachedDeckEvaluation,
  clearDeckEvaluationCache,
  evaluateCurrentDeck,
  judgeReference,
  streamCurrentDeckEvaluation,
  submitEvaluationFeedback,
  evaluateCards,
  decideGuidanceProposal,
  generateDescription,
  createConversation,
  sendAgentMessage,
};
