import {
  createConversation,
  sendAgentMessage,
} from "../modules/agent/api/conversations";
import { me, logout } from "../modules/auth/api/session";
import { printings, search } from "../modules/cards/api/search";
import {
  createDeck,
  deck,
  decks,
  deleteDeck,
  generateDescription,
  sample,
  updateDeck,
  validation,
} from "../modules/decks/api/manage";
import {
  applyOperation,
  operations,
  revertOperation,
} from "../modules/decks/api/operations";
import {
  evaluateCard,
  evaluateCards,
  evaluateCurrentDeck,
  streamCurrentDeckEvaluation,
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
  operations,
  revertOperation,
  validation,
  evaluateCard,
  evaluateCurrentDeck,
  streamCurrentDeckEvaluation,
  evaluateCards,
  decideGuidanceProposal,
  generateDescription,
  createConversation,
  sendAgentMessage,
};
