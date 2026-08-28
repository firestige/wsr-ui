import { describe, expect, it } from "vitest";

import { CATALOG_COORDINATES } from "../evolution/client";
import { METRIC_COPY } from "./metric-copy";

describe("Catalog-backed metric explanation copy", () => {
  it("covers exactly the published Catalog coordinates", () => {
    expect(Object.keys(METRIC_COPY)).toEqual(CATALOG_COORDINATES);
  });

  it("preserves the no-causality and no-total-cost limits", () => {
    expect(METRIC_COPY["role-template-rework-rate@2.0.0"].limits).toMatch(
      /do not infer.*causality/i,
    );
    expect(METRIC_COPY["operational-attributable-cost@2.0.0"].limits).toMatch(
      /do not label as total cost/i,
    );
  });
});
