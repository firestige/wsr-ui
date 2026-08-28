import type { Truth } from "../domain/evidence/types";
import { EvidenceLifecycleLabel, ScopedError } from "./status";

export type EvidenceScope = "result" | "related" | "read-set";

export interface EvidenceConsoleRow {
  factId: string;
  factClass: string;
  coordinates: Record<string, string>;
  provenance: string;
  truth: Truth;
  trace?: {
    traceId: string;
    spanId?: string;
    state?: "AVAILABLE" | "PARTIAL" | "EXPIRED";
  };
}

export interface EvidenceReferenceRow {
  kind: "FACT" | "TRACE_NODE" | "TASK_MEMBERSHIP" | "PUBLISHED_PROVENANCE";
  identity: string;
  provenance: string;
  loadedAsFact: boolean;
}

type ConsoleState =
  | { tag: "LOADING" }
  | { tag: "READY" }
  | { tag: "EMPTY" }
  | { tag: "PARTIAL" }
  | { tag: "EXPIRED" }
  | { tag: "ERROR"; detail: string; onRetry?: () => void };

const scopes: ReadonlyArray<{ id: EvidenceScope; label: string }> = [
  { id: "result", label: "Result evidence" },
  { id: "related", label: "Related Facts" },
  { id: "read-set", label: "Resolved read set" },
];

const scopeNotes: Record<EvidenceScope, string> = {
  result:
    "Exact provenance identities cited by this Metric Result; non-Fact detail may remain unresolved.",
  related:
    "Related Facts match the context but are not claimed as calculation contributors.",
  "read-set":
    "Every bounded identity recorded by this receipt; this view only hydrates matching Fact rows.",
};

function ReferenceTable({ rows }: { rows: EvidenceReferenceRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="table-scroll">
      <table aria-label="Receipt identities" className="evidence-table">
        <caption>Receipt identities</caption>
        <thead>
          <tr>
            <th scope="col">Kind</th>
            <th scope="col">Identity</th>
            <th scope="col">Provenance</th>
            <th scope="col">Detail state</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.kind}:${row.identity}:${row.provenance}`}>
              <td>{row.kind}</td>
              <td className="text-code">{row.identity}</td>
              <td className="text-code">{row.provenance}</td>
              <td>
                {row.loadedAsFact
                  ? "Loaded as Fact row"
                  : "Identity retained; detail not loaded by Facts query"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EvidenceTable({
  scope,
  rows,
  focusedFactId,
  onOpenTrace,
}: {
  scope: EvidenceScope;
  rows: EvidenceConsoleRow[];
  focusedFactId?: string;
  onOpenTrace?: (traceId: string, spanId?: string) => void;
}) {
  const caption = scopes.find((item) => item.id === scope)!.label;
  return (
    <div className="table-scroll">
      <table className="evidence-table">
        <caption>{caption} Facts</caption>
        <thead>
          <tr>
            <th scope="col">Fact</th>
            <th scope="col">Coordinates</th>
            <th scope="col">Provenance and lifecycle</th>
            <th scope="col">Recorded Trace</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              aria-current={focusedFactId === row.factId ? "true" : undefined}
              key={row.factId}
            >
              <td>
                <code className="text-code">{row.factId}</code>
                <span>{row.factClass}</span>
              </td>
              <td>
                {Object.entries(row.coordinates).map(([key, value]) => (
                  <code className="text-code" key={key}>
                    {key}={value}
                  </code>
                ))}
              </td>
              <td>
                <code className="text-code">{row.provenance}</code>
                <EvidenceLifecycleLabel truth={row.truth} />
              </td>
              <td>
                {row.trace === undefined ? (
                  "No Trace reference"
                ) : (
                  <>
                    {row.trace.state === undefined ? (
                      <span>Trace lifecycle not loaded</span>
                    ) : (
                      <EvidenceLifecycleLabel traceState={row.trace.state} />
                    )}
                    {onOpenTrace === undefined ? (
                      <code className="text-code">
                        {row.trace.traceId}
                        {row.trace.spanId === undefined
                          ? ""
                          : ` / ${row.trace.spanId}`}
                      </code>
                    ) : (
                      <button
                        className="link-control"
                        onClick={() =>
                          onOpenTrace(row.trace!.traceId, row.trace!.spanId)
                        }
                        type="button"
                      >
                        Open {row.trace.traceId}
                        {row.trace.spanId === undefined
                          ? ""
                          : ` / ${row.trace.spanId}`}
                      </button>
                    )}
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EvidenceConsoleFoundation({
  scope,
  state,
  rows,
  references = [],
  focusedFactId,
  onScopeChange,
  onOpenTrace,
}: {
  scope: EvidenceScope;
  state: ConsoleState;
  rows: EvidenceConsoleRow[];
  references?: EvidenceReferenceRow[];
  focusedFactId?: string;
  onScopeChange?: (scope: EvidenceScope) => void;
  onOpenTrace?: (traceId: string, spanId?: string) => void;
}) {
  return (
    <section className="evidence-console">
      <header>
        <h2 className="text-heading">Evidence Console</h2>
        <p className="text-body">
          Read-only Fact and recorded Trace drill-down.
        </p>
      </header>
      <nav aria-label="Evidence scope" className="scope-tabs">
        <ul>
          {scopes.map((item) => (
            <li key={item.id}>
              <button
                aria-current={scope === item.id ? "page" : undefined}
                className="scope-tab"
                onClick={() => onScopeChange?.(item.id)}
                type="button"
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <p className="scope-note">{scopeNotes[scope]}</p>
      {state.tag === "LOADING" ? (
        <p aria-live="polite" role="status">
          Loading Evidence…
        </p>
      ) : state.tag === "ERROR" ? (
        <ScopedError
          announce="assertive"
          detail={state.detail}
          onRetry={state.onRetry}
          retryable={state.onRetry !== undefined}
          title="Evidence query failed"
        />
      ) : (
        <>
          {state.tag === "EMPTY" ? (
            <p className="empty-state">No Evidence in this scope</p>
          ) : null}
          {state.tag === "PARTIAL" ? (
            <p className="status-banner status-attention">
              Partial Evidence data
            </p>
          ) : null}
          {state.tag === "EXPIRED" ? (
            <p className="status-banner status-expired">
              Evidence detail expired
            </p>
          ) : null}
          {rows.length === 0 ? null : (
            <EvidenceTable
              focusedFactId={focusedFactId}
              onOpenTrace={onOpenTrace}
              rows={rows}
              scope={scope}
            />
          )}
          <ReferenceTable rows={references} />
        </>
      )}
    </section>
  );
}
