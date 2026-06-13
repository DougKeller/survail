# OpenTelemetry

Survail exports API and agent telemetry through the OpenTelemetry Collector.

## Development Stack

`docker compose up` starts:

- OpenTelemetry Collector OTLP receivers on `localhost:4317` (gRPC) and `localhost:4318` (HTTP).
- Jaeger trace UI at <http://localhost:16686>.
- Prometheus metrics UI at <http://localhost:9090>.
- Collector-exported application metrics at <http://localhost:8889/metrics>.

The collector prints a basic debug export, sends traces to Jaeger, and exposes application metrics
for Prometheus to scrape.

## Instrumentation

The API automatically instruments:

- FastAPI inbound requests.
- SQLAlchemy database calls.
- Redis calls.
- HTTPX outbound requests.
- OpenAI Agents SDK traces through the open-source OpenInference OpenAI Agents instrumentor.

Agent-specific metrics use low-cardinality dimensions:

- `survail.agent.runs` by terminal status.
- `survail.agent.active_runs`.
- `survail.agent.run.duration` by terminal status.
- `survail.agent.model.phases` by phase.
- `survail.agent.tool.calls` by tool name.

Agent run, conversation, and deck IDs are attached to traces, not metrics.

## Configuration

| Variable | Default in Docker | Purpose |
| --- | --- | --- |
| `OTEL_ENABLED` | `true` | Enables API telemetry. |
| `OTEL_SERVICE_NAME` | `survail-api` | OpenTelemetry service name. |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://otel-collector:4317` | OTLP gRPC destination. |
| `OTEL_EXPORTER_OTLP_INSECURE` | `true` | Uses plaintext OTLP for local development. |
| `OTEL_METRIC_EXPORT_INTERVAL_MS` | `10000` | Metric export interval. |
| `OTEL_CAPTURE_AGENT_CONTENT` | `false` | Includes agent inputs and outputs in traces when enabled. |

Agent content capture is disabled by default because decklists, prompts, and model responses may
contain sensitive data. OpenInference still exports agent, model, tool, timing, status, and token
usage attributes when content capture is disabled.
