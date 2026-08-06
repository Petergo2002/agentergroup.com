export class JsonFetchError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "JsonFetchError";
    this.status = status;
    this.payload = payload;
  }
}

export type WorkspaceSWRKey = readonly [
  userId: string,
  workspaceId: string,
  url: string,
];

export function workspaceSWRKey(
  userId: string,
  workspaceId: string,
  url: string | null | undefined,
): WorkspaceSWRKey | null {
  return url ? [userId, workspaceId, url] : null;
}

export async function jsonFetcher<T>(key: string | WorkspaceSWRKey): Promise<T> {
  const url = typeof key === "string" ? key : key[2];
  const response = await fetch(url);
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : "Request failed.";

    throw new JsonFetchError(message, response.status, payload);
  }

  return payload as T;
}
