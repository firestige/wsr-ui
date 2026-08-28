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
  const canonicalIdentities = new Set<string>();
  let snapshot: string | undefined;
  let cursor: string | undefined;
  let state: TracesPage["trace_state"] | undefined;
  let summaries: string | undefined;
  const cursors = new Set<string>();
  let pages = 0;

  do {
    if (pages >= maximumPages)
      return { ok: false, reason: "TRACE_PAGE_BOUND_EXCEEDED" };
    const initialPage = cursor === undefined;
    const result = await port.getTracesPage({
      trace_id: traceId,
      limit: 200,
      ...(cursor === undefined ? {} : { cursor }),
    });
    if (!result.ok) {
      const detail =
        "reason" in result.error
          ? result.error.reason
          : "code" in result.error
            ? result.error.code
            : result.error.kind;
      return { ok: false, reason: detail };
    }
    const page = result.value;
    pages += 1;
    if (
      initialPage &&
      (page.trace_state === "AVAILABLE" || page.trace_state === "PARTIAL") &&
      page.items.length === 0
    )
      return { ok: false, reason: "TRACE_INITIAL_PAGE_EMPTY" };
    if (snapshot !== undefined && page.snapshot !== snapshot)
      return { ok: false, reason: "TRACE_SNAPSHOT_DRIFT" };
    snapshot = page.snapshot;
    const pageSummaries = JSON.stringify(page.trace_summaries);
    if (
      (state !== undefined && page.trace_state !== state) ||
      (summaries !== undefined && pageSummaries !== summaries)
    )
      return { ok: false, reason: "TRACE_SUMMARY_DRIFT" };
    state = page.trace_state;
    summaries = pageSummaries;
    if (
      page.trace_summaries.some((summary) => summary.trace_id !== traceId) ||
      page.items.some((item) => item.trace_id !== traceId)
    )
      return { ok: false, reason: "TRACE_IDENTITY_MISMATCH" };
    for (const item of page.items) {
      if (identities.has(item.id))
        return { ok: false, reason: "TRACE_DUPLICATE_IDENTITY" };
      identities.add(item.id);
      const canonicalIdentity =
        item.kind === "NODE"
          ? `NODE:${item.trace_id}:${item.node.span_id}`
          : `${item.kind}:${item.edge.from.trace_id}:${item.edge.from.span_id}:${item.edge.to.trace_id}:${item.edge.to.span_id}`;
      if (canonicalIdentities.has(canonicalIdentity))
        return { ok: false, reason: "TRACE_DUPLICATE_CANONICAL_IDENTITY" };
      canonicalIdentities.add(canonicalIdentity);
      items.push(item);
    }
    if (items.length > maximumItems)
      return { ok: false, reason: "TRACE_ITEM_BOUND_EXCEEDED" };
    cursor = page.next_cursor ?? undefined;
    if (cursor !== undefined) {
      if (cursors.has(cursor))
        return { ok: false, reason: "TRACE_CURSOR_REPEATED" };
      cursors.add(cursor);
    }
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
