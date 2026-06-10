import time
from collections.abc import Callable

import httpx
from pydantic import BaseModel, Field

from survail.types import JsonObject, json_object

OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses"
TRANSIENT_STATUS_CODES = frozenset({408, 409, 429, 500, 502, 503, 504})


class ResponseContent(BaseModel):
    type: str
    text: str | None = None


class ResponseOutput(BaseModel):
    content: list[ResponseContent] = Field(default_factory=list)


class OpenAIResponse(BaseModel):
    output_text: str | None = None
    output: list[ResponseOutput] = Field(default_factory=list)


class DeckDescriptionClient:
    def __init__(
        self,
        api_key: str,
        model: str,
        *,
        http_client: httpx.Client | None = None,
        max_attempts: int = 4,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        if not api_key:
            raise ValueError("OPENAI_API_KEY is required")
        if not model:
            raise ValueError("An OpenAI description model is required")
        if max_attempts < 1:
            raise ValueError("max_attempts must be positive")
        self._api_key = api_key
        self._model = model
        self._owns_http_client = http_client is None
        self._http_client = http_client or httpx.Client(timeout=120)
        self._max_attempts = max_attempts
        self._sleep = sleep

    def close(self) -> None:
        if self._owns_http_client:
            self._http_client.close()

    def generate(self, context: str) -> str:
        payload: JsonObject = {
            "model": self._model,
            "instructions": (
                "Explain what this Magic: The Gathering deck does in two to four concise "
                "paragraphs. Identify its primary plan, important synergies, interaction, and "
                "likely weaknesses. Base every claim only on the supplied format and card data. "
                "Do not list every card and do not invent absent cards. Whenever you cite a card "
                "by name, wrap its exact supplied title in double square brackets, for example "
                "[[Ephemerate]]."
            ),
            "input": context,
        }
        for attempt in range(self._max_attempts):
            try:
                response = self._http_client.post(
                    OPENAI_RESPONSES_URL,
                    headers={"Authorization": f"Bearer {self._api_key}"},
                    json=payload,
                )
                response.raise_for_status()
                return self._parse_response(json_object(response.json()))
            except (httpx.TimeoutException, httpx.NetworkError, httpx.HTTPStatusError) as error:
                if attempt + 1 == self._max_attempts or not self._is_retryable(error):
                    raise
                self._sleep(self._retry_delay(error, attempt))
        raise RuntimeError("Description retry loop exited unexpectedly")

    @staticmethod
    def _parse_response(payload: JsonObject) -> str:
        response = OpenAIResponse.model_validate(payload)
        if response.output_text and response.output_text.strip():
            return response.output_text.strip()
        text = "\n".join(
            content.text.strip()
            for output in response.output
            for content in output.content
            if content.type == "output_text" and content.text and content.text.strip()
        )
        if not text:
            raise ValueError("OpenAI returned no deck description")
        return text

    @staticmethod
    def _is_retryable(error: httpx.HTTPError) -> bool:
        return not isinstance(error, httpx.HTTPStatusError) or (
            error.response.status_code in TRANSIENT_STATUS_CODES
        )

    @staticmethod
    def _retry_delay(error: httpx.HTTPError, attempt: int) -> float:
        if isinstance(error, httpx.HTTPStatusError):
            retry_after = error.response.headers.get("retry-after")
            if retry_after is not None:
                try:
                    return min(float(retry_after), 60)
                except ValueError:
                    pass
        return float(min(2**attempt, 60))


class OpenAIDeckDescriptionGenerator:
    def __init__(self, api_key: str, model: str) -> None:
        self._api_key = api_key
        self._model = model

    def generate(self, context: str) -> str:
        client = DeckDescriptionClient(self._api_key, self._model)
        try:
            return client.generate(context)
        finally:
            client.close()
