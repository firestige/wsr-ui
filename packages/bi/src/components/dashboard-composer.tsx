import { useRef, useState, type ReactNode } from "react";

import { CATALOG_COORDINATES } from "../domain/evolution/client";
import type { MetricResult } from "../domain/evolution/types";
import {
  bindLayoutPanel,
  decodeLayout,
  type DashboardLayout,
  type LayoutPanel,
} from "../domain/layout/layout";
import { ButtonGroup, IconButton } from "./design-system";
import { DashboardGrid } from "./dashboard-grid";
import { DashboardMetricPanel } from "./result-visualizer";

const clone = (layout: DashboardLayout): DashboardLayout =>
  structuredClone(layout);

function resultCoordinate(result: MetricResult): string {
  return `${result.metric_id}@${result.metric_version}`;
}

function nextPanelId(panels: readonly LayoutPanel[]): string {
  for (let index = 1; index <= 24; index += 1) {
    const candidate = `local-${index}`;
    if (!panels.some((panel) => panel.panel_id === candidate)) return candidate;
  }
  return "local-panel";
}

function ActionIcon({ kind }: { kind: "add" | "cancel" | "edit" | "import" }) {
  const paths = {
    add: "M12 5v14M5 12h14",
    cancel: "M6 6l12 12M18 6 6 18",
    edit: "M4 20h4L19 9l-4-4L4 16v4Zm9.5-13.5 4 4",
    import: "M12 3v12m0 0 4-4m-4 4-4-4M5 17v3h14v-3",
  };
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d={paths[kind]} />
    </svg>
  );
}

export interface DashboardComposerView {
  actions: ReactNode;
  dashboard: ReactNode;
  editing: boolean;
}

export function DashboardComposer({
  layout,
  results,
  onApply,
  children,
  initiallyEditing = false,
  focusedMetricCoordinate,
  onEditingChange,
  renderPanel,
}: {
  layout: DashboardLayout;
  results: MetricResult[];
  onApply: (layout: DashboardLayout) => void;
  children: (view: DashboardComposerView) => ReactNode;
  initiallyEditing?: boolean;
  focusedMetricCoordinate?: string;
  onEditingChange?: (editing: boolean) => void;
  renderPanel?: (panel: LayoutPanel) => ReactNode;
}) {
  const [editing, setEditingState] = useState(initiallyEditing);
  const [draft, setDraft] = useState(() => clone(layout));
  const [error, setError] = useState<string | undefined>();
  const importInput = useRef<HTMLInputElement>(null);
  const setEditing = (next: boolean) => {
    setEditingState(next);
    onEditingChange?.(next);
  };

  const actions = (
    <ButtonGroup aria-label="Dashboard actions" className="dashboard-actions">
      <input
        accept="application/json,.json"
        aria-label="Import dashboard file"
        className="dashboard-import-input"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (file === undefined) return;
          void file
            .text()
            .then((text) => {
              const decoded = decodeLayout(JSON.parse(text));
              if (!decoded.ok) {
                setError(decoded.reason);
                return;
              }
              setDraft(clone(decoded.value));
              setError(undefined);
              setEditing(true);
            })
            .catch(() => setError("Layout JSON is malformed"));
          event.currentTarget.value = "";
        }}
        ref={importInput}
        type="file"
      />
      <IconButton
        appearance="ghost"
        aria-label="Import dashboard"
        data-testid="dashboard-import"
        onClick={() => importInput.current?.click()}
        type="button"
      >
        <ActionIcon kind="import" />
      </IconButton>
      {editing ? (
        <>
          <IconButton
            appearance="ghost"
            aria-label="Add widget"
            data-testid="dashboard-add"
            disabled={draft.panels.length >= 24}
            onClick={() =>
              setDraft((current) => {
                const panel = bindLayoutPanel(
                  nextPanelId(current.panels),
                  CATALOG_COORDINATES[0],
                  "table@1",
                  "WIDE",
                  {
                    x: 0,
                    y: Math.max(
                      0,
                      ...current.panels.map(
                        (candidate) => candidate.grid.y + candidate.grid.h,
                      ),
                    ),
                    w: 3,
                    h: 2,
                  },
                );
                return { ...current, panels: [...current.panels, panel] };
              })
            }
            type="button"
          >
            <ActionIcon kind="add" />
          </IconButton>
          <IconButton
            appearance="ghost"
            aria-label="Save dashboard"
            data-testid="dashboard-save"
            onClick={() => {
              const decoded = decodeLayout(draft);
              if (!decoded.ok) setError(decoded.reason);
              else {
                onApply(decoded.value);
                setError(undefined);
                setEditing(false);
              }
            }}
            type="button"
          >
            <span
              aria-hidden="true"
              className="dashboard-confirm-icon icon-[tabler--check]"
            />
          </IconButton>
          <IconButton
            appearance="ghost"
            aria-label="Cancel editing"
            data-testid="dashboard-cancel"
            onClick={() => {
              setDraft(clone(layout));
              setError(undefined);
              setEditing(false);
            }}
            type="button"
          >
            <ActionIcon kind="cancel" />
          </IconButton>
        </>
      ) : (
        <IconButton
          appearance="ghost"
          aria-label="Edit dashboard"
          data-testid="dashboard-edit"
          onClick={() => {
            setDraft(clone(layout));
            setError(undefined);
            setEditing(true);
          }}
          type="button"
        >
          <ActionIcon kind="edit" />
        </IconButton>
      )}
      {error === undefined ? null : (
        <span className="dashboard-action-error" role="alert">
          {error}
        </span>
      )}
    </ButtonGroup>
  );

  const dashboard = (
    <DashboardGrid
      editing={editing}
      focusedMetricCoordinate={focusedMetricCoordinate}
      layout={editing ? draft : layout}
      onLayoutChange={editing ? setDraft : undefined}
      onRemovePanel={
        editing
          ? (panelId) =>
              setDraft((current) => ({
                ...current,
                panels: current.panels.filter(
                  (panel) => panel.panel_id !== panelId,
                ),
              }))
          : undefined
      }
      renderPanel={(panel) => {
        if (renderPanel !== undefined) return renderPanel(panel);
        const metric = results.find(
          (candidate) =>
            resultCoordinate(candidate) === panel.metric_coordinate,
        );
        return metric === undefined ? (
          <p className="status-reading">{panel.metric_coordinate}</p>
        ) : (
          <DashboardMetricPanel
            onEvidence={() => undefined}
            result={metric}
            size={panel.size}
            visualizer={panel.visualizer}
          />
        );
      }}
    />
  );

  return children({ actions, dashboard, editing });
}
