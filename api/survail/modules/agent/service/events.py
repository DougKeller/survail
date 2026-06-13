import asyncio
import logging
import uuid
from dataclasses import dataclass

from sqlalchemy import func, select

from survail.core.db import SessionLocal
from survail.core.models import DeckAgentEvent
from survail.core.types import JsonObject, json_object

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class AgentUiEvent:
    type: str
    run_id: uuid.UUID
    payload: JsonObject


class AgentEventSink:
    def __init__(self, run_id: uuid.UUID, conversation_id: uuid.UUID) -> None:
        self.run_id = run_id
        self.conversation_id = conversation_id
        self.queue: asyncio.Queue[AgentUiEvent] = asyncio.Queue()
        with SessionLocal() as db:
            self._sequence = int(
                db.scalar(
                    select(func.max(DeckAgentEvent.sequence)).where(DeckAgentEvent.run_id == run_id)
                )
                or 0
            )

    async def emit(self, event_type: str, payload: object) -> None:
        normalized = json_object(payload)
        await self._persist_and_queue(event_type, normalized)

    async def emit_transient(self, event_type: str, payload: object) -> None:
        normalized = json_object(payload)
        await self.queue.put(AgentUiEvent(type=event_type, run_id=self.run_id, payload=normalized))

    async def _persist_and_queue(self, event_type: str, normalized: JsonObject) -> None:
        self._sequence += 1
        with SessionLocal() as db:
            db.add(
                DeckAgentEvent(
                    run_id=self.run_id,
                    conversation_id=self.conversation_id,
                    sequence=self._sequence,
                    event_type=event_type,
                    payload=normalized,
                )
            )
            db.commit()
        logger.info(
            "deck agent event persisted",
            extra={
                "run_id": str(self.run_id),
                "conversation_id": str(self.conversation_id),
                "event_type": event_type,
                "sequence": self._sequence,
            },
        )
        await self.queue.put(AgentUiEvent(type=event_type, run_id=self.run_id, payload=normalized))
