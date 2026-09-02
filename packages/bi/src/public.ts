import "./shared.css";
import "./primitives.css";

export {
  Button,
  ButtonGroup,
  Divider,
  IconButton,
  StatusBadge,
  Surface,
  TextInput,
  Typography,
  type TypographyFamily,
  type TypographyTone,
  type TypographyVariant,
  type TypographyWeight,
} from "./components/design-system";
export {
  STUDIO_DESIGN_IR,
  type StudioDesignIR,
} from "./domain/studio-design-ir";

export {
  BiCard,
  BiSection,
  BiSurface,
  type BiSurfaceProps,
} from "./components/bi-surface";
export {
  createBiTheme,
  type BiDataPalette,
  type BiPalette,
  type BiTheme,
  type BiTypographyScale,
} from "./domain/theme";
export { CompareResultFrame } from "./components/compare-result";
export { MetricExplanationView, ReceiptView } from "./components/details";
export {
  EvidenceConsoleFoundation,
  type EvidenceConsoleRow,
  type EvidenceReferenceRow,
  type EvidenceScope,
} from "./components/evidence-console";
export {
  MetricNavigator,
  MetricResultFrame,
  type MetricNavigatorItem,
} from "./components/metric-result";
export {
  DEFAULT_MOTION_MODE,
  MotionControl,
  RecordedStructureFoundation,
  type MotionMode,
  type RecordedDetailState,
  type RecordedNodeView,
  type RecordedStructureViewModel,
} from "./components/recorded-structure";
export {
  DashboardMetricPanel,
  MetricPanel,
} from "./components/result-visualizer";
export { DashboardGrid } from "./components/dashboard-grid";
export {
  SpanPassport,
  TraceStatistics,
  TraceTree,
  TraceWaterfall,
} from "./components/trace-views";
export {
  CoverageLabel,
  EvidenceLifecycleLabel,
  MetricTruthLabel,
  ScopedError,
} from "./components/status";
export type * from "./domain/evidence/types";
export type * from "./domain/evolution/types";
export { CATALOG_COORDINATES } from "./domain/evolution/client";
export { isMetricResult } from "./domain/evolution/validation";
export {
  type TracePagePort,
  loadRecordedTrace,
} from "./domain/trace/load-recorded-trace";
export {
  type RecordedNode,
  type RecordedStructure,
  type UnresolvedEndpoint,
  projectRecordedStructure,
} from "./domain/trace/recorded-structure";
export {
  compileTraceView,
  type TraceView,
  type TraceViewLink,
  type TraceViewNode,
  type TraceViewParentEdge,
} from "./domain/trace/trace-view";
export { presentExactValue } from "./domain/visualization/presentation";
export {
  VISUALIZER_REGISTRY,
  compatibleVisualizerIds,
  selectDefaultVisualizer,
  type VisualizerId,
} from "./domain/visualization/registry";

export interface BiNavigationPort {
  navigate(destination: {
    kind: "receipt" | "fact" | "trace";
    id: string;
  }): void;
}

export interface BiHostErrorPort {
  report(error: unknown, context: string): void;
}
