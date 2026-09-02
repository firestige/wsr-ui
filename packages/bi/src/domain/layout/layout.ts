import { closed, record } from "../evidence/validation";
import { CATALOG_COORDINATES } from "../evolution/client";
import {
  VISUALIZER_REGISTRY,
  type VisualizerId,
} from "../visualization/registry";

export type PanelSize = "SMALL" | "MEDIUM" | "WIDE";
export interface DashboardGridPlacement {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const ALLOWED_DASHBOARD_WIDGET_SIZES = [
  { w: 1, h: 1 },
  { w: 2, h: 1 },
  { w: 3, h: 1 },
  { w: 3, h: 2 },
  { w: 3, h: 3 },
] as const;

const DASHBOARD_WIDGET_SIZES_BY_VISUALIZER = {
  "numeric-card@1": [{ w: 1, h: 1 }],
  "badge@1": [{ w: 1, h: 1 }],
  "ratio-bar@1": [
    { w: 1, h: 1 },
    { w: 2, h: 1 },
    { w: 3, h: 1 },
  ],
  "table@1": [{ w: 3, h: 2 }],
} as const satisfies Record<
  VisualizerId,
  readonly Pick<DashboardGridPlacement, "w" | "h">[]
>;

export function dashboardWidgetSizesForVisualizer(
  visualizer: VisualizerId,
): readonly Pick<DashboardGridPlacement, "w" | "h">[] {
  return DASHBOARD_WIDGET_SIZES_BY_VISUALIZER[visualizer];
}

export function isDashboardWidgetSize(
  visualizer: VisualizerId,
  w: number,
  h: number,
): boolean {
  if (visualizer === "table@1") return w === 3 && Number.isInteger(h) && h >= 2;
  return dashboardWidgetSizesForVisualizer(visualizer).some(
    (candidate) => candidate.w === w && candidate.h === h,
  );
}

export function snapDashboardWidgetSize(
  visualizer: VisualizerId,
  w: number,
  h: number,
): Pick<DashboardGridPlacement, "w" | "h"> {
  if (visualizer === "table@1") {
    return { w: 3, h: Math.max(2, Math.round(h)) };
  }
  return [...dashboardWidgetSizesForVisualizer(visualizer)].sort(
    (left, right) => {
      const leftDistance = (left.w - w) ** 2 + (left.h - h) ** 2;
      const rightDistance = (right.w - w) ** 2 + (right.h - h) ** 2;
      if (leftDistance !== rightDistance) return leftDistance - rightDistance;
      const targetArea = w * h;
      const leftAreaDistance = Math.abs(left.w * left.h - targetArea);
      const rightAreaDistance = Math.abs(right.w * right.h - targetArea);
      if (leftAreaDistance !== rightAreaDistance)
        return leftAreaDistance - rightAreaDistance;
      return right.w * right.h - left.w * left.h;
    },
  )[0]!;
}

export function panelSizeForGrid(
  grid: Pick<DashboardGridPlacement, "w" | "h">,
): PanelSize {
  if (grid.w === 1 && grid.h === 1) return "SMALL";
  if (grid.w === 3 || grid.w * grid.h >= 6) return "WIDE";
  return "MEDIUM";
}

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
  grid: DashboardGridPlacement;
}

export interface DashboardLayout {
  layout_version: 1;
  name: string;
  panels: LayoutPanel[];
}

const channelBinding: Record<string, string> = {
  domain: "ratio-domain",
  "published-result": "slices",
};

export function bindLayoutPanel(
  panelId: string,
  metricCoordinate: (typeof CATALOG_COORDINATES)[number],
  visualizer: VisualizerId,
  size: PanelSize,
  grid: DashboardGridPlacement,
): LayoutPanel {
  const visualizerContract = VISUALIZER_REGISTRY[visualizer];
  return {
    panel_id: panelId,
    metric_coordinate: metricCoordinate,
    visualizer,
    size,
    channels: Object.fromEntries(
      visualizerContract.channels.map((channel) => [
        channel,
        channelBinding[channel] ?? channel,
      ]),
    ),
    transforms: [...visualizerContract.transforms],
    grid,
  };
}

type LayoutResult =
  { ok: true; value: DashboardLayout } | { ok: false; reason: string };

const tablePanel = (
  coordinate: (typeof CATALOG_COORDINATES)[number],
  grid: DashboardGridPlacement,
): LayoutPanel => ({
  panel_id: coordinate.slice(0, coordinate.lastIndexOf("@")),
  metric_coordinate: coordinate,
  visualizer: "table@1",
  size: "WIDE",
  channels: { "published-result": "slices" },
  transforms: [
    "DISPLAY_ROUNDING",
    "RATIO_TO_PERCENT",
    "STABLE_AUTHORITATIVE_SORT",
  ],
  grid,
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
        grid: { x: 0, y: 0, w: 2, h: 1 },
      },
      {
        panel_id: "role-model-outcome",
        metric_coordinate: "role-model-task-outcome-rate@2.0.0",
        visualizer: "ratio-bar@1",
        size: "SMALL",
        channels: { value: "value", domain: "ratio-domain" },
        transforms: ["RATIO_TO_PERCENT", "SCALE_LAYOUT"],
        grid: { x: 2, y: 0, w: 1, h: 1 },
      },
      {
        panel_id: "latency",
        metric_coordinate: "operational-latency-ms@2.0.0",
        visualizer: "numeric-card@1",
        size: "SMALL",
        channels: { value: "value" },
        transforms: ["DISPLAY_ROUNDING", "RATIO_TO_PERCENT"],
        grid: { x: 0, y: 1, w: 1, h: 1 },
      },
      tablePanel("delivery-stage-reach@2.0.0", {
        x: 0,
        y: 2,
        w: 3,
        h: 2,
      }),
      {
        panel_id: "terminal-outcome",
        metric_coordinate: "delivery-terminal-outcome-rate@2.0.0",
        visualizer: "ratio-bar@1",
        size: "MEDIUM",
        channels: { value: "value", domain: "ratio-domain" },
        transforms: ["RATIO_TO_PERCENT", "SCALE_LAYOUT"],
        grid: { x: 1, y: 1, w: 2, h: 1 },
      },
      tablePanel("operational-token-usage@2.0.0", {
        x: 0,
        y: 4,
        w: 3,
        h: 2,
      }),
    ],
  },
  "detail-table@1": {
    layout_version: 1,
    name: "Detailed tables",
    panels: CATALOG_COORDINATES.map((coordinate, index) =>
      tablePanel(coordinate, { x: 0, y: index * 2, w: 3, h: 2 }),
    ),
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
      "grid",
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
    new Set(value.transforms).size !== value.transforms.length ||
    !record(value.grid) ||
    !closed(value.grid, ["x", "y", "w", "h"]) ||
    !Number.isInteger(value.grid.x) ||
    !Number.isInteger(value.grid.y) ||
    (value.grid.x as number) < 0 ||
    (value.grid.y as number) < 0 ||
    !Number.isInteger(value.grid.w) ||
    !Number.isInteger(value.grid.h) ||
    !isDashboardWidgetSize(
      value.visualizer as VisualizerId,
      value.grid.w as number,
      value.grid.h as number,
    )
  )
    return false;
  const declaration = VISUALIZER_REGISTRY[value.visualizer as VisualizerId];
  const expectedChannels = Object.fromEntries(
    declaration.channels.map((channel) => [
      channel,
      channelBinding[channel] ?? channel,
    ]),
  );
  return (
    Object.keys(value.channels).length === declaration.channels.length &&
    Object.entries(value.channels).every(
      ([channel, binding]) => expectedChannels[channel] === binding,
    ) &&
    value.transforms.length === declaration.transforms.length &&
    value.transforms.every(
      (transform, index) => transform === declaration.transforms[index],
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
    input.panels.length < 1 ||
    input.panels.length > 24 ||
    !input.panels.every(panel)
  )
    return { ok: false, reason: "Layout does not match closed version 1" };
  const ids = input.panels.map((item) => (item as LayoutPanel).panel_id);
  if (new Set(ids).size !== ids.length)
    return { ok: false, reason: "Panel identities must be unique" };
  return { ok: true, value: input as unknown as DashboardLayout };
}
