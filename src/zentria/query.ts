export function appendQueryParams(
  path: string,
  query?: Record<string, string | number | boolean | undefined | null>,
): string {
  if (!query) {
    return path;
  }

  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }

  const qs = params.toString();

  return qs ? `${path}?${qs}` : path;
}

export function collectionItems(body: unknown): Record<string, unknown>[] {
  if (Array.isArray(body)) {
    return body as Record<string, unknown>[];
  }

  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;

    if (Array.isArray(record.member)) {
      return record.member as Record<string, unknown>[];
    }

    if (Array.isArray(record["hydra:member"])) {
      return record["hydra:member"] as Record<string, unknown>[];
    }
  }

  return [];
}
