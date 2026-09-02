import type { Layout } from "react-grid-layout";

const DASHBOARD_COLUMN_WIDTH = 160;
const MINIMUM_DASHBOARD_COLUMNS = 3;

export interface DashboardGridGeometry {
  columnWidth: number;
  columns: number;
  gap: number;
  inlinePadding: number;
  width: number;
}

export function dashboardGridGeometry(
  containerWidth: number,
): DashboardGridGeometry {
  const width = Math.max(
    containerWidth,
    DASHBOARD_COLUMN_WIDTH * MINIMUM_DASHBOARD_COLUMNS,
  );
  const columns = Math.max(
    MINIMUM_DASHBOARD_COLUMNS,
    Math.floor(width / DASHBOARD_COLUMN_WIDTH),
  );
  const remaining = width - columns * DASHBOARD_COLUMN_WIDTH;
  const gap = Math.floor(remaining / (columns + 1));
  const inlinePadding = (remaining - gap * (columns - 1)) / 2;
  return {
    columnWidth: DASHBOARD_COLUMN_WIDTH,
    columns,
    gap,
    inlinePadding,
    width,
  };
}

export function centerDashboardGridItems(
  layout: Layout,
  columns: number,
): Layout {
  if (layout.length === 0) return layout;
  const left = Math.min(...layout.map((item) => item.x));
  const right = Math.max(...layout.map((item) => item.x + item.w));
  const occupiedColumns = right - left;
  if (occupiedColumns > columns) return layout;
  const offset = Math.floor((columns - occupiedColumns) / 2) - left;
  if (offset === 0) return layout;
  return layout.map((item) => ({ ...item, x: item.x + offset }));
}
