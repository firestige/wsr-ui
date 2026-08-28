import { closed, record } from "../evidence/validation";
import { CATALOG_COORDINATES } from "../evolution/client";
import {
  VISUALIZER_REGISTRY,
  type VisualizerId,
} from "../visualization/registry";

type PanelSize = "SMALL" | "MEDIUM" | "WIDE";
type PresentationTransform =
  | "DISPLAY_ROUNDING"
  | "RATIO_TO_PERCENT"
  | "SCALE_LAYOUT"
  | "STABLE_AUTHORITATIVE_SORT";

export interface LayoutPanel {
  panel_id: string;
  metric_coordinate: (typeof CATALOG_COORDINATES)[number];
  visualizer: VisualizerId;
  size: PanelSize;
  channels: Record<string, string>;
  transforms: PresentationTransform[];
}

export interface DashboardLayout {
  layout_version: 1;
  name: string;
  panels: LayoutPanel[];
}

type LayoutResult =
  { ok: true; value: DashboardLayout } | { ok: false; reason: string };

const tablePanel = (
  coordinate: (typeof CATALOG_COORDINATES)[number],
): LayoutPanel => ({
  panel_id: coordinate.slice(0, coordinate.lastIndexOf("@")),
  metric_coordinate: coordinate,
  visualizer: "table@1",
  size: "WIDE",
  channels: { "published-result": "slices" },
  transforms: ["DISPLAY_ROUNDING", "STABLE_AUTHORITATIVE_SORT"],
});

export const PRESET_LAYOUTS = {
  "default-overview@1": {
    layout_version: 1,
    name: "Default overview",
    panels: [
      {
        panel_id: "rework",
        metric_coordinate: "role-template-rework-rate@2.0.0",
        visualizer: "ratio-bar@1",
        size: "MEDIUM",
        channels: { value: "value", domain: "ratio-domain" },
        transforms: ["RATIO_TO_PERCENT", "SCALE_LAYOUT"],
      },
      {
        panel_id: "role-model-outcome",
        metric_coordinate: "role-model-task-outcome-rate@2.0.0",
        visualizer: "ratio-bar@1",
        size: "MEDIUM",
        channels: { value: "value", domain: "ratio-domain" },
        transforms: ["RATIO_TO_PERCENT", "SCALE_LAYOUT"],
      },
      {
        panel_id: "latency",
        metric_coordinate: "operational-latency-ms@2.0.0",
        visualizer: "numeric-card@1",
        size: "SMALL",
        channels: { value: "value" },
        transforms: ["DISPLAY_ROUNDING"],
      },
      tablePanel("delivery-stage-reach@2.0.0"),
      {
        panel_id: "terminal-outcome",
        metric_coordinate: "delivery-terminal-outcome-rate@2.0.0",
        visualizer: "ratio-bar@1",
        size: "MEDIUM",
        channels: { value: "value", domain: "ratio-domain" },
        transforms: ["RATIO_TO_PERCENT", "SCALE_LAYOUT"],
      },
      tablePanel("operational-token-usage@2.0.0"),
    ],
  },
  "detail-table@1": {
    layout_version: 1,
    name: "Detailed tables",
    panels: CATALOG_COORDINATES.map(tablePanel),
  },
} satisfies Record<string, DashboardLayout>;

function panel(value: unknown): value is LayoutPanel {
  if (
    !record(value) ||
    !closed(value, [
      "panel_id",
      "metric_coordinate",
      "visualizer",
      "size",
      "channels",
      "transforms",
    ]) ||
    typeof value.panel_id !== "string" ||
    !/^[a-z0-9][a-z0-9-]{0,63}$/.test(value.panel_id) ||
    !CATALOG_COORDINATES.includes(
      value.metric_coordinate as (typeof CATALOG_COORDINATES)[number],
    ) ||
    !Object.hasOwn(VISUALIZER_REGISTRY, value.visualizer as string) ||
    !["SMALL", "MEDIUM", "WIDE"].includes(value.size as string) ||
    !record(value.channels) ||
    !Object.values(value.channels).every(
      (channel) => typeof channel === "string" && channel.length > 0,
    ) ||
    !Array.isArray(value.transforms) ||
    new Set(value.transforms).size !== value.transforms.length
  )
    return false;
  const declaration = VISUALIZER_REGISTRY[value.visualizer as VisualizerId];
  return (
    Object.keys(value.channels).every((channel) =>
      declaration.channels.includes(channel),
    ) &&
    value.transforms.every(
      (transform) =>
        typeof transform === "string" &&
        declaration.transforms.includes(transform as never),
    )
  );
}

export function decodeLayout(input: unknown): LayoutResult {
  if (
    !record(input) ||
    !closed(input, ["layout_version", "name", "panels"]) ||
    input.layout_version !== 1 ||
    typeof input.name !== "string" ||
    input.name.trim().length < 1 ||
    input.name.length > 80 ||
    !Array.isArray(input.panels) ||
    input.panels.length > 24 ||
    !input.panels.every(panel)
  )
    return { ok: false, reason: "Layout does not match closed version 1" };
  const ids = input.panels.map((item) => (item as LayoutPanel).panel_id);
  if (new Set(ids).size !== ids.length)
    return { ok: false, reason: "Panel identities must be unique" };
  return { ok: true, value: input as unknown as DashboardLayout };
}
