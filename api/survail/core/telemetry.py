import asyncio
import contextlib
import logging
import time
from collections.abc import Generator
from dataclasses import dataclass

from fastapi import FastAPI
from openinference.instrumentation import TraceConfig
from openinference.instrumentation.openai_agents import OpenAIAgentsInstrumentor
from opentelemetry import metrics, trace
from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation import fastapi as otel_fastapi
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
from opentelemetry.instrumentation.redis import RedisInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.metrics import Counter, Histogram, UpDownCounter
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.sdk.resources import DEPLOYMENT_ENVIRONMENT, SERVICE_NAME, Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.trace import Status, StatusCode
from sqlalchemy import Engine
from starlette.routing import Match, Route

from survail.core.config import Settings

logger = logging.getLogger(__name__)
_configured = False


@dataclass(frozen=True)
class AgentMetrics:
    runs: Counter
    active_runs: UpDownCounter
    run_duration: Histogram
    model_phases: Counter
    tool_calls: Counter


def _agent_metrics() -> AgentMetrics:
    meter = metrics.get_meter("survail.deck_agent")
    return AgentMetrics(
        runs=meter.create_counter(
            "survail.agent.runs",
            description="Number of deck-agent runs by terminal status.",
            unit="{run}",
        ),
        active_runs=meter.create_up_down_counter(
            "survail.agent.active_runs",
            description="Number of deck-agent runs currently executing.",
            unit="{run}",
        ),
        run_duration=meter.create_histogram(
            "survail.agent.run.duration",
            description="Deck-agent run duration.",
            unit="s",
        ),
        model_phases=meter.create_counter(
            "survail.agent.model.phases",
            description="Number of deck-agent model lifecycle phases.",
            unit="{phase}",
        ),
        tool_calls=meter.create_counter(
            "survail.agent.tool.calls",
            description="Number of deck-agent tool calls.",
            unit="{call}",
        ),
    )


AGENT_METRICS = _agent_metrics()


def _route_path(starlette_route: object, scope: dict[str, object]) -> str | None:
    path = getattr(starlette_route, "path", None) or scope.get("path")
    return path if isinstance(path, str) else None


def _safe_fastapi_default_span_details(scope: dict[str, object]) -> tuple[str, dict[str, str]]:
    app = scope.get("app")
    route: str | None = None
    if app is not None:
        for starlette_route in getattr(app, "routes", ()):
            match, _ = (
                Route.matches(starlette_route, scope)
                if isinstance(starlette_route, Route)
                else starlette_route.matches(scope)
            )
            if match == Match.FULL:
                route = _route_path(starlette_route, scope)
                break
            if match == Match.PARTIAL:
                route = _route_path(starlette_route, scope)

    method = otel_fastapi.sanitize_method(str(scope.get("method", "")).strip())
    attributes: dict[str, str] = {}
    if method == "_OTHER":
        method = "HTTP"
    if route:
        attributes[otel_fastapi.HTTP_ROUTE] = route
    if method and route:
        span_name = f"{method} {route}"
    elif route:
        span_name = route
    else:
        span_name = method
    return span_name, attributes


def configure_telemetry(app: FastAPI, engine: Engine, settings: Settings) -> None:
    global _configured
    if not settings.otel_enabled or _configured:
        return
    _configured = True
    resource = Resource.create(
        {
            SERVICE_NAME: settings.otel_service_name,
            DEPLOYMENT_ENVIRONMENT: settings.environment,
        }
    )
    trace_provider = TracerProvider(resource=resource)
    trace_provider.add_span_processor(
        BatchSpanProcessor(
            OTLPSpanExporter(
                endpoint=settings.otel_exporter_otlp_endpoint,
                insecure=settings.otel_exporter_otlp_insecure,
            )
        )
    )
    trace.set_tracer_provider(trace_provider)
    metric_reader = PeriodicExportingMetricReader(
        OTLPMetricExporter(
            endpoint=settings.otel_exporter_otlp_endpoint,
            insecure=settings.otel_exporter_otlp_insecure,
        ),
        export_interval_millis=settings.otel_metric_export_interval_ms,
    )
    metrics.set_meter_provider(MeterProvider(resource=resource, metric_readers=[metric_reader]))

    # FastAPI instrumentation currently assumes every partial route match exposes
    # `.path`. Newer router internals can surface wrapper objects without it.
    otel_fastapi._get_default_span_details = _safe_fastapi_default_span_details
    FastAPIInstrumentor.instrument_app(app, tracer_provider=trace_provider)
    SQLAlchemyInstrumentor().instrument(engine=engine, tracer_provider=trace_provider)
    RedisInstrumentor().instrument(tracer_provider=trace_provider)
    HTTPXClientInstrumentor().instrument(tracer_provider=trace_provider)
    OpenAIAgentsInstrumentor().instrument(
        tracer_provider=trace_provider,
        exclusive_processor=False,
        config=TraceConfig(
            hide_inputs=not settings.otel_capture_agent_content,
            hide_outputs=not settings.otel_capture_agent_content,
        ),
    )
    logger.info(
        "OpenTelemetry enabled",
        extra={
            "service_name": settings.otel_service_name,
            "otlp_endpoint": settings.otel_exporter_otlp_endpoint,
        },
    )


def record_agent_model_phase(phase: str) -> None:
    AGENT_METRICS.model_phases.add(1, {"phase": phase})


def record_agent_tool_call(tool_name: str) -> None:
    AGENT_METRICS.tool_calls.add(1, {"tool.name": tool_name})


@contextlib.contextmanager
def observe_agent_run(
    *,
    run_id: str,
    conversation_id: str,
    deck_id: str,
) -> Generator[None, None, None]:
    started_at = time.monotonic()
    status = "completed"
    AGENT_METRICS.active_runs.add(1)
    tracer = trace.get_tracer("survail.deck_agent")
    with tracer.start_as_current_span(
        "survail.deck_agent.run",
        attributes={
            "survail.agent.run_id": run_id,
            "survail.agent.conversation_id": conversation_id,
            "survail.deck.id": deck_id,
        },
    ) as span:
        try:
            yield
        except BaseException as error:
            status = (
                "cancelled"
                if isinstance(error, (asyncio.CancelledError, GeneratorExit))
                else "failed"
            )
            span.record_exception(error)
            span.set_status(Status(StatusCode.ERROR, str(error)))
            raise
        finally:
            attributes = {"status": status}
            AGENT_METRICS.active_runs.add(-1)
            AGENT_METRICS.runs.add(1, attributes)
            AGENT_METRICS.run_duration.record(time.monotonic() - started_at, attributes)
