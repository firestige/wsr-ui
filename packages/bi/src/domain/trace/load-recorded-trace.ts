import type { TracesFilters } from "../evidence/client";
import type { EvidenceResult, TraceItem, TracesPage } from "../evidence/types";
import {
  projectRecordedStructure,
  type RecordedStructure,
} from "./recorded-structure";

export interface TracePagePort {
  getTracesPage(filters: TracesFilters): Promise<EvidenceResult<TracesPage>>;
}

export type LoadedTrace =
  | {
      ok: true;
      state: "AVAILABLE" | "PARTIAL";
      pages: number;
      snapshot: string;
      structure: RecordedStructure;
    }
  | { ok: true; state: "ABSENT"; pages: number; snapshot: string }
  | { ok: false; reason: string };

export async function loadRecordedTrace(
  port: TracePagePort,
  traceId: string,
  options: { maximumPages?: number; maximumItems?: number } = {},
): Promise<LoadedTrace> {
  const maximumPages = options.maximumPages ?? 20;
  const maximumItems = options.maximumItems ?? 4_000;
  const items: TraceItem[] = [];
  const identities = new Set<string>();
  let snapshot: string | undefined;
  let cursor: string | undefined;
  let state: TracesPage["trace_state"] | undefined;
  let pages = 0;

  do {
    if (pages >= maximumPages)
      return { ok: false, reason: "TRACE_PAGE_BOUND_EXCEEDED" };
    const result = await port.getTracesPage({
      trace_id: traceId,
      limit: 200,
      ...(cursor === undefined ? {} : { cursor }),
    });
    if (!result.ok) {
      const detail =
        "reason" in result.error ? result.error.reason : result.error.kind;
      return { ok: false, reason: detail };
    }
    const page = result.value;
    pages += 1;
    if (snapshot !== undefined && page.snapshot !== snapshot)
      return { ok: false, reason: "TRACE_SNAPSHOT_DRIFT" };
    snapshot = page.snapshot;
    state = page.trace_state;
    for (const item of page.items) {
      if (identities.has(item.id))
        return { ok: false, reason: "TRACE_DUPLICATE_IDENTITY" };
      identities.add(item.id);
      items.push(item);
    }
    if (items.length > maximumItems)
      return { ok: false, reason: "TRACE_ITEM_BOUND_EXCEEDED" };
    cursor = page.next_cursor ?? undefined;
  } while (cursor !== undefined);

  if (snapshot === undefined || state === undefined)
    return { ok: false, reason: "TRACE_EMPTY_RESPONSE" };
  if (state === "ABSENT" || state === "EXPIRED") {
    if (items.length !== 0)
      return { ok: false, reason: "TRACE_ABSENT_WITH_ITEMS" };
    return { ok: true, state: "ABSENT", pages, snapshot };
  }
  return {
    ok: true,
    state,
    pages,
    snapshot,
    structure: projectRecordedStructure(items),
  };
}
