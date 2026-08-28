import { useCallback, useEffect, useRef, useState } from "react";

import {
  EvidenceConsoleFoundation,
  type EvidenceReferenceRow,
  type EvidenceConsoleRow,
} from "./components/evidence-console";
import { ScopedError } from "./components/status";
import type { FactsFilters } from "./domain/evidence/client";
import type {
  EvidenceResult,
  FactItem,
  FactsPage,
} from "./domain/evidence/types";
import type { EvaluationRoute } from "./domain/navigation/evaluation-route";
import type { SideResult } from "./domain/evolution/types";
import type { EvolutionPort } from "./evaluation-workspace";

const MAX_ROWS = 200;

export interface EvidenceFactsPort {
  getFactsPage(filters: FactsFilters): Promise<EvidenceResult<FactsPage>>;
}

type EvidenceDrilldownRoute = Extract<EvaluationRoute, { tag: "EVIDENCE" }>;
type State =
  | { tag: "LOADING" }
  | {
      tag: "RESULT";
      rows: EvidenceConsoleRow[];
      references: EvidenceReferenceRow[];
      truth: "READY" | "EMPTY" | "PARTIAL" | "EXPIRED";
    }
  | { tag: "ERROR"; detail: string };

function sideResult(
  route: EvidenceDrilldownRoute,
  value: Awaited<ReturnType<EvolutionPort["computeSingle"]>> & { ok: true },
): SideResult | string {
  const response = value.value;
  if (route.selection.tag === "SINGLE") {
    if (response.mode !== "SINGLE" || route.side !== "single")
      return "Evolution response did not match the single selection";
    return response.result;
  }
  if (response.mode !== "COMPARE" || route.side === "single")
    return "Evolution response did not match the compare selection";
  const side = route.side === "left" ? response.left : response.right;
  return side.tag === "SIDE_RESULT" ? side : `${side.code}: ${side.detail}`;
}

function row(item: FactItem): EvidenceConsoleRow {
  const coordinates = Object.fromEntries(
    item.compatibility.dimensions.map(({ field, value }) => [
      field,
      String(value),
    ]),
  );
  if (item.compatibility.event_name !== null)
    coordinates.event_name = item.compatibility.event_name;
  if (item.compatibility.family_schema !== null)
    coordinates.family_schema = item.compatibility.family_schema;
  return {
    factId: item.id,
    factClass: item.kind,
    coordinates,
    provenance: item.provenance.accepted_digest,
    truth: item.truth,
    trace:
      item.source.kind === "SPAN"
        ? { traceId: item.source.trace_id, spanId: item.source.span_id }
        : undefined,
  };
}

function errorDetail(result: EvidenceResult<FactsPage>): string {
  if (result.ok) return "";
  if (result.error.kind === "UPSTREAM")
    return `${result.error.code}: ${result.error.message}`;
  if (result.error.kind === "RESPONSE_BOUND_EXCEEDED")
    return `Response exceeded ${result.error.maximumBytes} bytes`;
  return "reason" in result.error
    ? result.error.reason
    : "Evidence unavailable";
}

export function EvidenceDrilldown({
  route,
  evolution,
  evidence,
  onNavigate,
}: {
  route: EvidenceDrilldownRoute;
  evolution: EvolutionPort;
  evidence: EvidenceFactsPort;
  onNavigate?: (route: EvaluationRoute) => void;
}) {
  const [state, setState] = useState<State>({ tag: "LOADING" });
  const requestGeneration = useRef(0);
  const load = useCallback(async () => {
    const generation = ++requestGeneration.current;
    setState({ tag: "LOADING" });
    const computed =
      route.selection.tag === "SINGLE"
        ? await evolution.computeSingle(route.selection.taskIds)
        : await evolution.computeCompare(
            route.selection.leftTaskIds,
            route.selection.rightTaskIds,
          );
    if (generation !== requestGeneration.current) return;
    if (!computed.ok) {
      setState({ tag: "ERROR", detail: "Evaluation context unavailable" });
      return;
    }
    const resolved = sideResult(route, computed);
    if (typeof resolved === "string") {
      setState({ tag: "ERROR", detail: resolved });
      return;
    }
    const metric = resolved.metric_results.find(
      (candidate) =>
        `${candidate.metric_id}@${candidate.metric_version}` === route.metric,
    );
    if (metric === undefined) {
      setState({ tag: "ERROR", detail: "Metric Result is absent" });
      return;
    }
    const deliveryIds = [
      ...new Set(
        resolved.receipt.task_population.flatMap((task) =>
          task.memberships.map((membership) => membership.delivery_id),
        ),
      ),
    ].sort();
    const pages: FactsPage[] = [];
    let failed = "";
    for (const delivery_id of deliveryIds) {
      if (
        pages.reduce((count, page) => count + page.items.length, 0) >= MAX_ROWS
      )
        break;
      const result = await evidence.getFactsPage({
        delivery_id,
        limit: MAX_ROWS,
      });
      if (generation !== requestGeneration.current) return;
      if (result.ok) pages.push(result.value);
      else failed = errorDetail(result);
    }
    if (pages.length === 0 && failed !== "") {
      setState({ tag: "ERROR", detail: failed });
      return;
    }
    const resultRefs = new Set(
      metric.slices.flatMap((slice) => slice.provenance_refs),
    );
    const readSetRefs = new Set(
      resolved.receipt.input_refs
        .filter((reference) => reference.kind === "FACT")
        .flatMap((reference) => [reference.identity, reference.provenance_ref]),
    );
    const returnedFacts = pages.flatMap((page) => page.items);
    const allFacts = returnedFacts.slice(0, MAX_ROWS);
    const returnedIdentities = new Set(
      allFacts.flatMap((fact) => [fact.id, fact.provenance.accepted_digest]),
    );
    const selectedFacts = allFacts.filter((fact) => {
      const exact = [fact.id, fact.provenance.accepted_digest];
      if (route.scope === "result")
        return exact.some((identity) => resultRefs.has(identity));
      if (route.scope === "read-set")
        return exact.some((identity) => readSetRefs.has(identity));
      return !exact.some((identity) => resultRefs.has(identity));
    });
    const references: EvidenceReferenceRow[] =
      route.scope === "related"
        ? []
        : resolved.receipt.input_refs
            .filter(
              (reference) =>
                route.scope === "read-set" ||
                resultRefs.has(reference.identity) ||
                resultRefs.has(reference.provenance_ref),
            )
            .map((reference) => ({
              kind: reference.kind,
              identity: reference.identity,
              provenance: reference.provenance_ref,
              loadedAsFact:
                reference.kind === "FACT" &&
                (returnedIdentities.has(reference.identity) ||
                  returnedIdentities.has(reference.provenance_ref)),
            }));
    if (route.scope === "result") {
      const represented = new Set(
        references.flatMap((reference) => [
          reference.identity,
          reference.provenance,
        ]),
      );
      for (const provenance of resultRefs)
        if (!represented.has(provenance))
          references.push({
            kind: "PUBLISHED_PROVENANCE",
            identity: provenance,
            provenance,
            loadedAsFact: returnedIdentities.has(provenance),
          });
    }
    const incomplete =
      failed !== "" ||
      pages.some((page) => page.next_cursor !== null) ||
      pages.length < deliveryIds.length ||
      returnedFacts.length > MAX_ROWS;
    const truth = incomplete
      ? "PARTIAL"
      : selectedFacts.length === 0 && references.length === 0
        ? "EMPTY"
        : selectedFacts.every((fact) => fact.truth.expiry === "EXPIRED")
          ? "EXPIRED"
          : "READY";
    if (generation !== requestGeneration.current) return;
    setState({
      tag: "RESULT",
      rows: selectedFacts.map(row),
      references,
      truth,
    });
  }, [evidence, evolution, route]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => {
      window.clearTimeout(timer);
      requestGeneration.current += 1;
    };
  }, [load]);

  const parent: EvaluationRoute =
    route.selection.tag === "SINGLE"
      ? {
          ...route.selection,
          focus: { metric: route.metric, side: route.side },
        }
      : {
          ...route.selection,
          focus: { metric: route.metric, side: route.side },
        };
  return (
    <main className="evaluation-shell">
      <button
        className="link-control"
        onClick={() => onNavigate?.(parent)}
        type="button"
      >
        Back to evaluation
      </button>
      <p className="text-code">{route.metric}</p>
      {route.factId === undefined ? null : (
        <p className="text-code">Focused Fact: {route.factId}</p>
      )}
      {state.tag === "ERROR" ? (
        <ScopedError
          announce="assertive"
          detail={state.detail}
          onRetry={load}
          retryable
          title="Evidence query failed"
        />
      ) : (
        <EvidenceConsoleFoundation
          focusedFactId={route.factId}
          onOpenTrace={(traceId, spanId) =>
            onNavigate?.({
              tag: "TRACE",
              selection: route.selection,
              traceId,
              spanId,
              side: route.side,
            })
          }
          onScopeChange={(scope) => onNavigate?.({ ...route, scope })}
          rows={state.tag === "RESULT" ? state.rows : []}
          references={state.tag === "RESULT" ? state.references : []}
          scope={route.scope}
          state={
            state.tag === "LOADING" ? { tag: "LOADING" } : { tag: state.truth }
          }
        />
      )}
    </main>
  );
}
