export interface CalEventType {
  id: string;
  title: string;
  slug: string;
}

type CalEventTypeExecutor = (
  composioUserId: string,
  toolName: string,
  arguments_: Record<string, unknown>,
  options?: { connectedAccountId?: string | null },
) => Promise<unknown>;

function pickString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function flattenEventTypeItems(items: unknown[]): CalEventType[] {
  return items
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const rawId = record.id ?? record.eventTypeId;
      const id =
        typeof rawId === "number" && rawId > 0
          ? String(rawId)
          : pickString(rawId);
      const title = pickString(record.title) ?? pickString(record.name);
      const slug = pickString(record.slug);
      if (!id || !title) return null;
      return { id, title, slug: slug ?? "" } satisfies CalEventType;
    })
    .filter(Boolean) as CalEventType[];
}

export function extractCalEventTypes(payload: unknown): CalEventType[] {
  let root = payload;
  if (typeof root === "string") {
    try {
      root = JSON.parse(root);
    } catch {
      return [];
    }
  }

  const candidate =
    typeof root === "object" && root !== null
      ? (root as Record<string, unknown>)
      : null;

  let parsedData: Record<string, unknown> | null = null;
  if (candidate?.data && typeof candidate.data === "string") {
    try {
      const data = JSON.parse(candidate.data);
      parsedData =
        typeof data === "object" && data !== null
          ? (data as Record<string, unknown>)
          : null;
    } catch {
      // ignored
    }
  } else if (candidate?.data && typeof candidate.data === "object") {
    parsedData = candidate.data as Record<string, unknown>;
  }

  const groups = parsedData?.eventTypeGroups;
  if (Array.isArray(groups) && groups.length > 0) {
    const flattened = groups.flatMap((group) => {
      const record = group as Record<string, unknown>;
      return Array.isArray(record.eventTypes)
        ? (record.eventTypes as unknown[])
        : [];
    });
    if (flattened.length > 0) {
      return flattenEventTypeItems(flattened);
    }
  }

  const buckets = [
    candidate?.event_types,
    candidate?.eventTypes,
    candidate?.result,
    Array.isArray(root) ? root : null,
    parsedData?.event_types,
    parsedData?.eventTypes,
    parsedData?.result,
    parsedData?.data,
    candidate?.data,
  ];

  for (const bucket of buckets) {
    if (!Array.isArray(bucket)) {
      continue;
    }

    const eventTypes = flattenEventTypeItems(bucket);
    if (eventTypes.length > 0) {
      return eventTypes;
    }
  }

  return [];
}

export async function listCalEventTypesWithExecutor(
  executor: CalEventTypeExecutor,
  composioUserId: string,
  connectedAccountId: string | null | undefined,
  isConnectedAccountMissingError: (error: unknown) => boolean,
): Promise<CalEventType[]> {
  try {
    const result = await executor(
      composioUserId,
      "CAL_LIST_EVENT_TYPES",
      {},
      { connectedAccountId },
    );
    return extractCalEventTypes(result);
  } catch (error) {
    if (isConnectedAccountMissingError(error)) {
      throw error;
    }

    console.warn(
      `[Cal.com] CAL_LIST_EVENT_TYPES failed for compUserId: ${composioUserId}, connectionId: ${connectedAccountId ?? "none"}. Falling back to manual input.`,
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}
