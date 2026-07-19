import uuid
from datetime import UTC, datetime

from survail.modules.agent.api.schemas import DeckAgentEventRead


def test_agent_event_schema_supports_recursive_json_payloads() -> None:
    schema = DeckAgentEventRead.model_json_schema()

    assert DeckAgentEventRead.__pydantic_complete__ is True
    assert schema["properties"]["payload"]["type"] == "object"
    event = DeckAgentEventRead(
        id=uuid.uuid4(),
        run_id=uuid.uuid4(),
        sequence=1,
        event_type="tool_result",
        payload={"nested": [{"ok": True}, None]},
        created_at=datetime.now(UTC),
    )
    assert event.payload["nested"] == [{"ok": True}, None]
