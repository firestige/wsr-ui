import type { ExactValue, MetricSlice } from "../evolution/types";

export type VisualizerId =
  | "numeric-card@1"
  | "badge@1"
  | "ratio-bar@1"
  | "gauge@1"
  | "bar@1"
  | "line@1"
  | "table@1"
  | "radar@1";
type Transform =
  | "DISPLAY_ROUNDING"
  | "RATIO_TO_PERCENT"
  | "SCALE_LAYOUT"
  | "STABLE_AUTHORITATIVE_SORT";

interface VisualizerDeclaration {
  id: VisualizerId;
  arity: "ONE_SLICE" | "SERIES" | "ANY";
  channels: readonly string[];
  kinds: readonly ExactValue["kind"][] | "ANY";
  authoritativeDomain: "NONE" | "REQUIRED" | "SHARED_NORMALIZED_REQUIRED";
  missingTolerance: "TRUTH_STATE" | "EXPLICIT_GAPS" | "ROWS";
  compare: "SUPPORTED" | "SEPARATE_SIDES";
  fallback: "table@1";
  transforms: readonly Transform[];
}

const declaration = (value: VisualizerDeclaration): VisualizerDeclaration =>
  value;

export const VISUALIZER_REGISTRY: Record<VisualizerId, VisualizerDeclaration> =
  {
    "numeric-card@1": declaration({
      id: "numeric-card@1",
      arity: "ONE_SLICE",
      channels: ["value"],
      kinds: ["COUNT", "QUANTITY", "RATIO", "MONEY", "DURATION_MS"],
      authoritativeDomain: "NONE",
      missingTolerance: "TRUTH_STATE",
      compare: "SEPARATE_SIDES",
      fallback: "table@1",
      transforms: ["DISPLAY_ROUNDING", "RATIO_TO_PERCENT"],
    }),
    "badge@1": declaration({
      id: "badge@1",
      arity: "ONE_SLICE",
      channels: ["value"],
      kinds: ["BOOLEAN"],
      authoritativeDomain: "NONE",
      missingTolerance: "TRUTH_STATE",
      compare: "SEPARATE_SIDES",
      fallback: "table@1",
      transforms: [],
    }),
    "ratio-bar@1": declaration({
      id: "ratio-bar@1",
      arity: "ONE_SLICE",
      channels: ["value", "domain"],
      kinds: ["RATIO"],
      authoritativeDomain: "NONE",
      missingTolerance: "TRUTH_STATE",
      compare: "SEPARATE_SIDES",
      fallback: "table@1",
      transforms: ["RATIO_TO_PERCENT", "SCALE_LAYOUT"],
    }),
    "gauge@1": declaration({
      id: "gauge@1",
      arity: "ONE_SLICE",
      channels: ["value", "authoritative-domain"],
      kinds: ["COUNT", "QUANTITY", "RATIO", "MONEY", "DURATION_MS"],
      authoritativeDomain: "REQUIRED",
      missingTolerance: "TRUTH_STATE",
      compare: "SEPARATE_SIDES",
      fallback: "table@1",
      transforms: ["DISPLAY_ROUNDING", "SCALE_LAYOUT"],
    }),
    "bar@1": declaration({
      id: "bar@1",
      arity: "SERIES",
      channels: ["category", "value"],
      kinds: ["COUNT", "QUANTITY", "RATIO", "MONEY", "DURATION_MS"],
      authoritativeDomain: "REQUIRED",
      missingTolerance: "EXPLICIT_GAPS",
      compare: "SEPARATE_SIDES",
      fallback: "table@1",
      transforms: [
        "DISPLAY_ROUNDING",
        "SCALE_LAYOUT",
        "STABLE_AUTHORITATIVE_SORT",
      ],
    }),
    "line@1": declaration({
      id: "line@1",
      arity: "SERIES",
      channels: ["ordered-dimension", "value"],
      kinds: ["COUNT", "QUANTITY", "RATIO", "MONEY", "DURATION_MS"],
      authoritativeDomain: "REQUIRED",
      missingTolerance: "EXPLICIT_GAPS",
      compare: "SEPARATE_SIDES",
      fallback: "table@1",
      transforms: [
        "DISPLAY_ROUNDING",
        "SCALE_LAYOUT",
        "STABLE_AUTHORITATIVE_SORT",
      ],
    }),
    "table@1": declaration({
      id: "table@1",
      arity: "ANY",
      channels: ["published-result"],
      kinds: "ANY",
      authoritativeDomain: "NONE",
      missingTolerance: "ROWS",
      compare: "SUPPORTED",
      fallback: "table@1",
      transforms: [
        "DISPLAY_ROUNDING",
        "RATIO_TO_PERCENT",
        "STABLE_AUTHORITATIVE_SORT",
      ],
    }),
    "radar@1": declaration({
      id: "radar@1",
      arity: "SERIES",
      channels: ["homogeneous-channel", "value", "shared-domain"],
      kinds: ["COUNT", "QUANTITY", "RATIO", "MONEY", "DURATION_MS"],
      authoritativeDomain: "SHARED_NORMALIZED_REQUIRED",
      missingTolerance: "EXPLICIT_GAPS",
      compare: "SEPARATE_SIDES",
      fallback: "table@1",
      transforms: [
        "DISPLAY_ROUNDING",
        "SCALE_LAYOUT",
        "STABLE_AUTHORITATIVE_SORT",
      ],
    }),
  };

export function compatibleVisualizerIds(
  slice: MetricSlice,
  _context: {
    authoritativeDomain?: boolean;
    orderedDimension?: boolean;
    sharedNormalizedDomain?: boolean;
  } = {},
): VisualizerId[] {
  if (slice.value === undefined) return ["table@1"];
  const ids: VisualizerId[] = [];
  if (slice.value.kind === "BOOLEAN") ids.push("badge@1");
  else ids.push("numeric-card@1");
  if (slice.value.kind === "RATIO" && slice.value.unit === "ratio")
    ids.push("ratio-bar@1");
  ids.push("table@1");
  return ids;
}
