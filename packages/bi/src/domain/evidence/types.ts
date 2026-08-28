export type EvidenceRoute = "facts" | "traces";
export type Scalar = string | number | boolean | null;

export interface FieldValue {
  field: string;
  value: Scalar;
}

export interface Truth {
  completeness:
    "FINAL" | "LOWER_BOUND" | "NOT_APPLICABLE" | "UNAVAILABLE" | null;
  availability: "AVAILABLE" | "UNAVAILABLE";
  expiry: "ACTIVE" | "EXPIRED";
  expires_at: string | null;
}

export type EvidenceSource =
  | { kind: "EVENT"; event_id: string }
  | { kind: "SPAN"; trace_id: string; span_id: string };

export interface FactProvenance {
  accepted_digest: string;
  profile_version: "1.0.0";
  family_schema: string | null;
  owner_key: Scalar[];
}

export interface FactCompatibility {
  family_schema: string | null;
  event_name: string | null;
  completeness: Truth["completeness"];
  dimensions: FieldValue[];
}

export interface RelationshipEndpoint {
  kind:
    | "FINDING"
    | "FINDING_TARGET"
    | "FIX"
    | "RECHECK"
    | "ROLE"
    | "ROLE_LINEAGE"
    | "SPAN"
    | "DELIVERY"
    | "MODEL_ROLE";
  key: Scalar[];
}

export interface FactRelationship {
  kind:
    | "FINDING_TARGET"
    | "FINDING_FIX"
    | "FINDING_RECHECK"
    | "ROLE_LINEAGE"
    | "DELIVERY_ROOT"
    | "MODEL_ATTRIBUTION";
  from: RelationshipEndpoint;
  to: RelationshipEndpoint;
}

export interface FactItem {
  id: string;
  kind:
    | "EVENT_CONTRIBUTION"
    | "FINDING_ASSERTION"
    | "FINDING_TARGET"
    | "FINDING_STATUS"
    | "FINDING_FIX"
    | "FINDING_RECHECK"
    | "ROLE_LINEAGE"
    | "DELIVERY_ROOT_BINDING"
    | "MODEL_ATTRIBUTION";
  source: EvidenceSource;
  recorded_at: string;
  provenance: FactProvenance;
  compatibility: FactCompatibility;
  truth: Truth;
  fields: FieldValue[];
  relationships: FactRelationship[];
}

export interface TraceEndpoint {
  trace_id: string;
  span_id: string;
}

export interface TraceNode {
  span_id: string;
  span_name: string;
  span_kind: "INTERNAL" | "CLIENT";
  start_time_unix_nano: string;
  end_time_unix_nano: string;
  span_status: "UNSET" | "OK" | "ERROR";
  span_flags: number;
  trace_state: string | null;
  fields: FieldValue[];
}

interface TraceItemBase {
  id: string;
  trace_id: string;
  source: EvidenceSource;
  recorded_at: string;
  truth: Truth;
}

export type TraceItem =
  | (TraceItemBase & { kind: "NODE"; node: TraceNode; edge: null })
  | (TraceItemBase & {
      kind: "PARENT_EDGE";
      node: null;
      edge: { from: TraceEndpoint; to: TraceEndpoint };
    })
  | (TraceItemBase & {
      kind: "LINK";
      node: null;
      edge: {
        from: TraceEndpoint;
        to: TraceEndpoint;
        trace_state?: string;
        flags?: number;
      };
    });

interface EvidencePageBase {
  contract: { name: "evidence.query"; revision: "0.1.0" };
  observation_profile: "1.0.0";
  read_model_revision: "1.0.0";
  snapshot: string;
  next_cursor: string | null;
}

export interface FactsPage extends EvidencePageBase {
  items: FactItem[];
}

export interface TracesPage extends EvidencePageBase {
  items: TraceItem[];
  trace_state: "ABSENT" | "AVAILABLE" | "PARTIAL" | "EXPIRED";
  trace_summaries: Array<{
    trace_id: string;
    state: "AVAILABLE" | "PARTIAL" | "EXPIRED";
  }>;
}

export type EvidencePage = FactsPage | TracesPage;

export type EvidenceError =
  | { kind: "INCOMPATIBLE"; reason: string }
  | { kind: "UPSTREAM"; code: string; message: string }
  | { kind: "ERROR"; reason: "MALFORMED_BODY" | "NETWORK" | "TIMEOUT" }
  | { kind: "RESPONSE_BOUND_EXCEEDED"; maximumBytes: number };

export type EvidenceResult<T = EvidencePage> =
  { ok: true; value: T } | { ok: false; error: EvidenceError };
