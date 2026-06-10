FROM python:3.12-slim AS development

WORKDIR /app
COPY pyproject.toml README.md alembic.ini ./
COPY alembic ./alembic
COPY survail ./survail

RUN pip install --no-cache-dir -e ".[dev]"

RUN useradd --create-home --uid 10001 survail
USER survail

CMD ["sh", "-c", "alembic upgrade head && uvicorn survail.main:app --host 0.0.0.0 --port 8000 --reload --reload-dir /app/survail"]
