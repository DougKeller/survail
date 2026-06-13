type JsonValue =
  | boolean
  | null
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

interface ValidationIssue {
  loc: (string | number)[];
  msg: string;
}

interface ImportIssueDetail {
  errors: { line_number: number; message: string }[];
}

interface ErrorResponse {
  detail?: string | ValidationIssue[] | ImportIssueDetail;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export const API: string =
  import.meta.env.VITE_API_URL ?? "http://localhost:8000";

function parseJson(body: string): JsonValue {
  return JSON.parse(body) as JsonValue;
}

export async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");

  const response = await fetch(`${API}${path}`, {
    ...init,
    credentials: "include",
    headers,
  });

  if (!response.ok) {
    const responseBody = await response.text();
    const error =
      responseBody === "" ? {} : (parseJson(responseBody) as ErrorResponse);
    throw new ApiError(
      errorMessage(error.detail, response.statusText),
      response.status,
    );
  }

  const responseBody = await response.text();
  return responseBody === ""
    ? (undefined as T)
    : (parseJson(responseBody) as T);
}

export function errorMessage(
  detail: ErrorResponse["detail"],
  fallback: string,
): string {
  if (detail === undefined) return fallback;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map(
        (issue) => `${issue.loc.slice(1).join(".") || "Request"}: ${issue.msg}`,
      )
      .join("\n");
  }
  return detail.errors
    .map((issue) => `Line ${String(issue.line_number)}: ${issue.message}`)
    .join("\n");
}
