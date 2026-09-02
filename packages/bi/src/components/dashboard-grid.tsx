import type { CSSProperties, ReactNode } from "react";
import ReactGridLayout, {
  useContainerWidth,
  type Layout,
} from "react-grid-layout";
import { gridBounds, type LayoutConstraint } from "react-grid-layout/core";

import {
  panelSizeForGrid,
  snapDashboardWidgetSize,
  type DashboardLayout,
  type LayoutPanel,
} from "../domain/layout/layout";
import {
  centerDashboardGridItems,
  dashboardGridGeometry,
} from "./dashboard-grid-geometry";
import { IconButton } from "./design-system";

const approvedWidgetSizes: LayoutConstraint = {
  name: "wsr-approved-widget-sizes",
};

function visualizerSizeConstraint(
  visualizer: LayoutPanel["visualizer"],
): LayoutConstraint {
  return {
    ...approvedWidgetSizes,
    constrainSize(_item, w, h) {
      return snapDashboardWidgetSize(visualizer, w, h);
    },
  };
}

function applyGridLayout(
  dashboard: DashboardLayout,
  gridLayout: Layout,
): DashboardLayout {
  const positions = new Map(gridLayout.map((item) => [item.i, item]));
  return {
    ...dashboard,
    panels: dashboard.panels.map((panel) => {
      const item = positions.get(panel.panel_id);
      if (item === undefined) return panel;
      const grid = { x: item.x, y: item.y, w: item.w, h: item.h };
      return { ...panel, grid, size: panelSizeForGrid(grid) };
    }),
  };
}

export function DashboardGrid({
  layout,
  editing = false,
  focusedMetricCoordinate,
  onLayoutChange,
  onRemovePanel,
  renderPanel,
}: {
  layout: DashboardLayout;
  editing?: boolean;
  focusedMetricCoordinate?: string;
  onLayoutChange?: (layout: DashboardLayout) => void;
  onRemovePanel?: (panelId: string) => void;
  renderPanel: (panel: LayoutPanel) => ReactNode;
}) {
  const { containerRef, width } = useContainerWidth({ initialWidth: 1200 });
  const geometry = dashboardGridGeometry(width);
  const gridLayout = centerDashboardGridItems(
    layout.panels.map((panel) => ({
      i: panel.panel_id,
      ...panel.grid,
      isDraggable: editing,
      isResizable: editing,
      constraints: [visualizerSizeConstraint(panel.visualizer)],
    })),
    geometry.columns,
  );
  const commit = (next: Layout) =>
    onLayoutChange?.(applyGridLayout(layout, next));

  return (
    <div
      className="dashboard-grid-shell"
      data-editing={editing ? "true" : "false"}
      data-grid-columns={geometry.columns}
      data-grid-gap={geometry.gap}
      data-grid-padding={geometry.inlinePadding}
      data-testid="dashboard-grid"
      ref={containerRef}
      style={
        {
          "--dashboard-grid-column-width": `${geometry.columnWidth}px`,
          "--dashboard-grid-gap": `${geometry.gap}px`,
          "--dashboard-grid-inline-padding": `${geometry.inlinePadding}px`,
        } as CSSProperties
      }
    >
      <ReactGridLayout
        className="dashboard-grid"
        constraints={[gridBounds]}
        dragConfig={{
          cancel: ".dashboard-widget-delete",
          enabled: editing,
          threshold: 3,
        }}
        gridConfig={{
          cols: geometry.columns,
          containerPadding: [geometry.inlinePadding, 0],
          margin: [geometry.gap, 16],
          rowHeight: 160,
        }}
        layout={gridLayout}
        onDragStop={commit}
        onResizeStop={commit}
        resizeConfig={{ enabled: editing, handles: editing ? ["se"] : [] }}
        width={geometry.width}
      >
        {layout.panels.map((panel) => (
          <section
            aria-current={
              focusedMetricCoordinate === panel.metric_coordinate
                ? "true"
                : undefined
            }
            aria-label={`Dashboard widget ${panel.panel_id}`}
            className="dashboard-panel"
            data-grid-height={panel.grid.h}
            data-grid-width={panel.grid.w}
            data-panel-id={panel.panel_id}
            data-size={panel.size}
            data-testid="dashboard-panel"
            key={panel.panel_id}
          >
            {editing && onRemovePanel !== undefined ? (
              <IconButton
                appearance="ghost"
                aria-label={`Delete widget ${panel.panel_id}`}
                className="dashboard-widget-delete"
                data-testid={`dashboard-delete-${panel.panel_id}`}
                disabled={layout.panels.length === 1}
                onClick={(event) => {
                  event.stopPropagation();
                  onRemovePanel(panel.panel_id);
                }}
                type="button"
              >
                <span
                  aria-hidden="true"
                  className="dashboard-remove-icon icon-[tabler--x]"
                />
              </IconButton>
            ) : null}
            {renderPanel(panel)}
          </section>
        ))}
      </ReactGridLayout>
    </div>
  );
}
