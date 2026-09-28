export class ZentriaError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "ZentriaError";
    this.status = status;
    this.details = details;
  }
}

export class ZentriaUnauthorizedError extends ZentriaError {
  constructor(message = "Unauthorized — check ZENTRIA_API_KEY") {
    super(401, message);
    this.name = "ZentriaUnauthorizedError";
  }
}

export class ZentriaForbiddenError extends ZentriaError {
  constructor(message = "Forbidden — check API key scopes, modules, or team permissions") {
    super(403, message);
    this.name = "ZentriaForbiddenError";
  }
}

export class ZentriaNotFoundError extends ZentriaError {
  constructor(message = "Resource not found") {
    super(404, message);
    this.name = "ZentriaNotFoundError";
  }
}

export class ZentriaValidationError extends ZentriaError {
  constructor(message: string, details?: unknown) {
    super(422, message, details);
    this.name = "ZentriaValidationError";
  }
}

export class ZentriaRateLimitError extends ZentriaError {
  readonly retryAfter?: number;

  constructor(message: string, retryAfter?: number) {
    super(429, message);
    this.name = "ZentriaRateLimitError";
    this.retryAfter = retryAfter;
  }
}

export function zentriaErrorFromResponse(
  status: number,
  body: unknown,
  headers: Headers,
): ZentriaError {
  const messageFromBody = extractErrorMessage(body);

  switch (status) {
    case 401:
      return new ZentriaUnauthorizedError(messageFromBody);
    case 403:
      return new ZentriaForbiddenError(messageFromBody);
    case 404:
      return new ZentriaNotFoundError(messageFromBody);
    case 422:
      return new ZentriaValidationError(messageFromBody ?? "Validation failed", body);
    case 429: {
      const retryAfter = parseRetryAfter(headers);

      return new ZentriaRateLimitError(
        messageFromBody ?? "Rate limit exceeded",
        retryAfter,
      );
    }
    default:
      return new ZentriaError(
        status,
        messageFromBody ?? `Zentria API request failed with status ${status}`,
        body,
      );
  }
}

function extractErrorMessage(body: unknown): string | undefined {
  if (typeof body === "string" && body.trim()) {
    return body;
  }

  if (!body || typeof body !== "object") {
    return undefined;
  }

  const record = body as Record<string, unknown>;

  if (typeof record.detail === "string") {
    return record.detail;
  }

  if (typeof record.message === "string") {
    return record.message;
  }

  if (typeof record.title === "string") {
    return record.title;
  }

  if (typeof record.error === "string") {
    return record.error;
  }

  return undefined;
}

export function parseRetryAfter(headers: Headers): number | undefined {
  const retryAfter = headers.get("Retry-After");

  if (retryAfter) {
    const seconds = Number.parseInt(retryAfter, 10);

    if (!Number.isNaN(seconds)) {
      return Math.min(seconds, 60);
    }
  }

  return undefined;
}
