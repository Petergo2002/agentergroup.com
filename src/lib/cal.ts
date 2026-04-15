import type {
  BuilderDefinition,
  CalBuilderNodeData,
  CalSelection,
} from "@/lib/types";

export interface CalEventTypeListItem {
  id: string;
  title: string;
  slug: string;
}

export function buildDefaultCalSelection(): CalSelection {
  return {
    connectionId: null,
    eventTypeMode: "ai_decides",
    eventTypeId: null,
    eventTypeLabel: null,
    timezone: null,
  };
}

function pickString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function extractCalSelectionFromNodes(
  nodes: unknown[] | null | undefined,
): CalSelection {
  if (!Array.isArray(nodes)) {
    return buildDefaultCalSelection();
  }

  const calNode = nodes.find((node) => {
    if (!node || typeof node !== "object") {
      return false;
    }

    const data = (node as { data?: { kind?: unknown } }).data;
    return data?.kind === "cal";
  }) as { data?: Partial<CalBuilderNodeData> } | undefined;

  if (!calNode?.data) {
    return buildDefaultCalSelection();
  }

  return {
    connectionId: pickString(calNode.data.connectionId),
    eventTypeMode: calNode.data.eventTypeMode === "specific_event_type" ? "specific_event_type" : "ai_decides",
    eventTypeId: pickString(calNode.data.eventTypeId),
    eventTypeLabel: pickString(calNode.data.eventTypeLabel),
    timezone: pickString(calNode.data.timezone),
  };
}

export function extractCalSelectionFromDefinition(
  definition: BuilderDefinition | null | undefined,
) {
  return extractCalSelectionFromNodes(definition?.nodes);
}

export function extractCalEventTypeListItems(payload: unknown) {
  const candidate =
    typeof payload === "object" && payload !== null
      ? (payload as Record<string, unknown>)
      : null;

  const buckets = [
    candidate?.eventTypes,
    candidate?.event_types,
    candidate?.data,
    candidate?.data && typeof candidate.data === "object"
      ? (candidate.data as Record<string, unknown>).eventTypes
      : null,
    candidate?.data && typeof candidate.data === "object"
      ? (candidate.data as Record<string, unknown>).event_types
      : null,
  ];

  for (const bucket of buckets) {
    if (!Array.isArray(bucket)) {
      continue;
    }

    const eventTypes = bucket
      .map((item) => {
        if (!item || typeof item !== "object") {
          return null;
        }

        const record = item as Record<string, unknown>;

        // Cal.com API returns `id` as an integer — coerce to string before the null check.
        const rawId = record.id ?? record.eventTypeId;
        const id =
          typeof rawId === "number" && rawId > 0
            ? String(rawId)
            : pickString(rawId);

        const title = pickString(record.title) ?? pickString(record.name);
        const slug = pickString(record.slug);

        if (!id || !title) {
          return null;
        }

        return {
          id,
          title,
          slug: slug ?? "",
        } satisfies CalEventTypeListItem;
      })
      .filter(Boolean) as CalEventTypeListItem[];

    if (eventTypes.length > 0) {
      return eventTypes;
    }
  }

  return [] as CalEventTypeListItem[];
}
