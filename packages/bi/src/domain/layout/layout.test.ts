import { describe, expect, it } from "vitest";

import { CATALOG_COORDINATES } from "../evolution/client";
import {
  ALLOWED_DASHBOARD_WIDGET_SIZES,
  bindLayoutPanel,
  dashboardWidgetSizesForVisualizer,
  decodeLayout,
  PRESET_LAYOUTS,
  snapDashboardWidgetSize,
} from "./layout";

describe("bounded dashboard layouts", () => {
  it("ships a visual overview and a lossless table preset", () => {
    expect(PRESET_LAYOUTS["default-overview@1"].panels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ visualizer: "ratio-bar@1" }),
        expect.objectContaining({ visualizer: "numeric-card@1" }),
        expect.objectContaining({ visualizer: "table@1" }),
      ]),
    );
    expect(PRESET_LAYOUTS["detail-table@1"].panels).toHaveLength(
      CATALOG_COORDINATES.length,
    );
    expect(
      PRESET_LAYOUTS["default-overview@1"].panels.every(
        (panel) => panel.grid !== undefined,
      ),
    ).toBe(true);
  });

  it("limits each visualizer to its meaningful widget sizes", () => {
    expect(ALLOWED_DASHBOARD_WIDGET_SIZES).toEqual([
      { w: 1, h: 1 },
      { w: 2, h: 1 },
      { w: 3, h: 1 },
      { w: 3, h: 2 },
      { w: 3, h: 3 },
    ]);
    expect(dashboardWidgetSizesForVisualizer("numeric-card@1")).toEqual([
      { w: 1, h: 1 },
    ]);
    expect(dashboardWidgetSizesForVisualizer("badge@1")).toEqual([
      { w: 1, h: 1 },
    ]);
    expect(dashboardWidgetSizesForVisualizer("ratio-bar@1")).toEqual([
      { w: 1, h: 1 },
      { w: 2, h: 1 },
      { w: 3, h: 1 },
    ]);
    expect(dashboardWidgetSizesForVisualizer("table@1")).toEqual([
      { w: 3, h: 2 },
    ]);
    expect(snapDashboardWidgetSize("numeric-card@1", 3, 3)).toEqual({
      w: 1,
      h: 1,
    });
    expect(snapDashboardWidgetSize("ratio-bar@1", 2, 3)).toEqual({
      w: 2,
      h: 1,
    });
    expect(snapDashboardWidgetSize("table@1", 1, 1)).toEqual({ w: 3, h: 2 });
    expect(snapDashboardWidgetSize("table@1", 2, 7)).toEqual({ w: 3, h: 7 });
  });

  it("rejects a layout that does not declare grid geometry", () => {
    const layout = {
      layout_version: 1,
      name: "My overview",
      panels: [
        {
          panel_id: "outcome",
          metric_coordinate: "delivery-terminal-outcome-rate@2.0.0",
          visualizer: "ratio-bar@1",
          size: "MEDIUM",
          channels: { value: "value", domain: "ratio-domain" },
          transforms: ["RATIO_TO_PERCENT", "SCALE_LAYOUT"],
        },
      ],
    };
    expect(decodeLayout(layout)).toMatchObject({ ok: false });
  });

  it("accepts persisted grid positions and rejects unsupported dimensions", () => {
    const panel = {
      ...bindLayoutPanel(
        "outcome",
        "delivery-terminal-outcome-rate@2.0.0",
        "ratio-bar@1",
        "MEDIUM",
        { x: 1, y: 2, w: 2, h: 1 },
      ),
    };
    expect(
      decodeLayout({ layout_version: 1, name: "Grid", panels: [panel] }),
    ).toMatchObject({ ok: true });
    expect(
      decodeLayout({
        layout_version: 1,
        name: "Responsive grid",
        panels: [{ ...panel, grid: { x: 6, y: 2, w: 2, h: 1 } }],
      }),
    ).toMatchObject({ ok: true });
    const table = PRESET_LAYOUTS["default-overview@1"].panels.find(
      (candidate) => candidate.visualizer === "table@1",
    )!;
    expect(
      decodeLayout({
        layout_version: 1,
        name: "Tall table",
        panels: [{ ...table, grid: { x: 0, y: 0, w: 3, h: 7 } }],
      }),
    ).toMatchObject({ ok: true });
    expect(
      decodeLayout({
        layout_version: 1,
        name: "Bad grid",
        panels: [{ ...panel, grid: { x: 0, y: 0, w: 2, h: 2 } }],
      }),
    ).toMatchObject({ ok: false });
  });

  it("rejects an empty layout that would hide compare truth and recovery", () => {
    expect(
      decodeLayout({ layout_version: 1, name: "Empty", panels: [] }),
    ).toMatchObject({ ok: false });
  });

  it("creates only closed channel and transform bindings", () => {
    const panel = bindLayoutPanel(
      "local-1",
      "delivery-terminal-outcome-rate@2.0.0",
      "ratio-bar@1",
      "MEDIUM",
      { x: 0, y: 0, w: 2, h: 1 },
    );
    expect(panel).toMatchObject({
      channels: { value: "value", domain: "ratio-domain" },
      transforms: ["RATIO_TO_PERCENT", "SCALE_LAYOUT"],
      grid: { x: 0, y: 0, w: 2, h: 1 },
    });
    expect(
      decodeLayout({ layout_version: 1, name: "Local", panels: [panel] }),
    ).toMatchObject({ ok: true });
  });

  it.each([
    {
      panel_id: "missing-channel",
      metric_coordinate: "delivery-terminal-outcome-rate@2.0.0",
      visualizer: "ratio-bar@1",
      size: "MEDIUM",
      channels: { value: "value" },
      transforms: ["RATIO_TO_PERCENT", "SCALE_LAYOUT"],
      grid: { x: 0, y: 0, w: 2, h: 1 },
    },
    {
      panel_id: "wrong-binding",
      metric_coordinate: "delivery-terminal-outcome-rate@2.0.0",
      visualizer: "ratio-bar@1",
      size: "MEDIUM",
      channels: { value: "invented", domain: "ratio-domain" },
      transforms: ["RATIO_TO_PERCENT", "SCALE_LAYOUT"],
    },
    {
      panel_id: "missing-transform",
      metric_coordinate: "delivery-terminal-outcome-rate@2.0.0",
      visualizer: "ratio-bar@1",
      size: "MEDIUM",
      channels: { value: "value", domain: "ratio-domain" },
      transforms: ["RATIO_TO_PERCENT"],
      grid: { x: 0, y: 0, w: 2, h: 1 },
    },
  ])("rejects an open or partial panel binding", (panel) => {
    expect(
      decodeLayout({ layout_version: 1, name: "Local", panels: [panel] }),
    ).toMatchObject({ ok: false });
  });

  it.each([
    { unknown: true },
    { layout_version: 2, name: "future", panels: [] },
    {
      layout_version: 1,
      name: "bad metric",
      panels: [
        {
          panel_id: "x",
          metric_coordinate: "invented-score@2.0.0",
          visualizer: "numeric-card@1",
          size: "SMALL",
          channels: { value: "value" },
          transforms: [],
          grid: { x: 0, y: 0, w: 1, h: 1 },
        },
      ],
    },
    {
      layout_version: 1,
      name: "bad visualizer",
      panels: [
        {
          panel_id: "x",
          metric_coordinate: "delivery-cycle-time-ms@2.0.0",
          visualizer: "plugin@1",
          size: "SMALL",
          channels: { value: "value" },
          transforms: [],
          grid: { x: 0, y: 0, w: 1, h: 1 },
        },
      ],
    },
  ])("fails closed for unknown layout input", (value) => {
    expect(decodeLayout(value)).toMatchObject({ ok: false });
  });
});
