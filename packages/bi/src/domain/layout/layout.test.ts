import { describe, expect, it } from "vitest";

import { CATALOG_COORDINATES } from "../evolution/client";
import { bindLayoutPanel, decodeLayout, PRESET_LAYOUTS } from "./layout";

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
  });

  it("accepts a closed local layout without changing evaluation identity", () => {
    const layout = {
      layout_version: 1,
      name: "My overview",
      panels: [
        {
          panel_id: "outcome",
          metric_coordinate: "delivery-terminal-outcome-rate@2.0.0",
          visualizer: "ratio-bar@1",
          size: "MEDIUM",
          channels: { value: "value" },
          transforms: ["RATIO_TO_PERCENT", "SCALE_LAYOUT"],
        },
      ],
    };
    expect(decodeLayout(layout)).toEqual({ ok: true, value: layout });
  });

  it("creates only closed channel and transform bindings", () => {
    const panel = bindLayoutPanel(
      "local-1",
      "delivery-terminal-outcome-rate@2.0.0",
      "ratio-bar@1",
      "MEDIUM",
    );
    expect(panel).toMatchObject({
      channels: { value: "value", domain: "ratio-domain" },
      transforms: ["RATIO_TO_PERCENT", "SCALE_LAYOUT"],
    });
    expect(
      decodeLayout({ layout_version: 1, name: "Local", panels: [panel] }),
    ).toMatchObject({ ok: true });
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
        },
      ],
    },
  ])("fails closed for unknown layout input", (value) => {
    expect(decodeLayout(value)).toMatchObject({ ok: false });
  });
});
