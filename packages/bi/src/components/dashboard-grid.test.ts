import { describe, expect, it } from "vitest";

import {
  centerDashboardGridItems,
  dashboardGridGeometry,
} from "./dashboard-grid-geometry";

describe("dashboard grid geometry", () => {
  it("keeps every column at 10rem while centering the grid tracks", () => {
    expect(dashboardGridGeometry(480)).toEqual({
      columnWidth: 160,
      columns: 3,
      gap: 0,
      inlinePadding: 0,
      width: 480,
    });
    expect(dashboardGridGeometry(600)).toEqual({
      columnWidth: 160,
      columns: 3,
      gap: 30,
      inlinePadding: 30,
      width: 600,
    });
    expect(dashboardGridGeometry(1512)).toEqual({
      columnWidth: 160,
      columns: 9,
      gap: 7,
      inlinePadding: 8,
      width: 1512,
    });
  });

  it("preserves fixed columns instead of compressing them in a narrow host", () => {
    expect(dashboardGridGeometry(420)).toEqual({
      columnWidth: 160,
      columns: 3,
      gap: 0,
      inlinePadding: 0,
      width: 480,
    });
  });

  it("centers a partially occupied layout in the available columns", () => {
    expect(
      centerDashboardGridItems(
        [
          { i: "wide", x: 0, y: 0, w: 2, h: 1 },
          { i: "single", x: 2, y: 0, w: 1, h: 1 },
        ],
        9,
      ).map(({ i, x }) => ({ i, x })),
    ).toEqual([
      { i: "wide", x: 3 },
      { i: "single", x: 5 },
    ]);
  });
});
