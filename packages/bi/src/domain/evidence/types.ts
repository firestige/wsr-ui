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

export interface EvidencePage {
  contract: { name: "evidence.query"; revision: "0.1.0" };
  observation_profile: "1.0.0";
  read_model_revision: "1.0.0";
  snapshot: string;
  items: Array<Record<string, unknown>>;
  next_cursor: string | null;
  trace_state?: "ABSENT" | "AVAILABLE" | "PARTIAL" | "EXPIRED";
  trace_summaries?: Array<{
    trace_id: string;
    state: "AVAILABLE" | "PARTIAL" | "EXPIRED";
  }>;
}

export type EvidenceError =
  | { kind: "INCOMPATIBLE"; reason: string }
  | { kind: "UPSTREAM"; code: string; message: string }
  | { kind: "ERROR"; reason: "MALFORMED_BODY" | "NETWORK" | "TIMEOUT" }
  | { kind: "RESPONSE_BOUND_EXCEEDED"; maximumBytes: number };

export type EvidenceResult<T = EvidencePage> =
  { ok: true; value: T } | { ok: false; error: EvidenceError };
