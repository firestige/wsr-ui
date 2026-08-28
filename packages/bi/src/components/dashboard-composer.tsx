import { useState } from "react";

import { CATALOG_COORDINATES } from "../domain/evolution/client";
import type { MetricResult } from "../domain/evolution/types";
import {
  bindLayoutPanel,
  decodeLayout,
  type DashboardLayout,
  type LayoutPanel,
  type PanelSize,
} from "../domain/layout/layout";
import {
  compatibleVisualizerIds,
  type VisualizerId,
} from "../domain/visualization/registry";

const clone = (layout: DashboardLayout): DashboardLayout =>
  structuredClone(layout);

function resultCoordinate(result: MetricResult): string {
  return `${result.metric_id}@${result.metric_version}`;
}

function choices(
  result: MetricResult | undefined,
  current?: VisualizerId,
): VisualizerId[] {
  const compatible =
    result === undefined
      ? (["table@1"] as VisualizerId[])
      : result.slices.reduce<VisualizerId[]>((shared, slice, index) => {
          const ids = compatibleVisualizerIds(slice);
          return index === 0
            ? ids
            : shared.filter((candidate) => ids.includes(candidate));
        }, []);
  const safe =
    compatible.length === 0 ? (["table@1"] as VisualizerId[]) : compatible;
  return current === undefined || safe.includes(current)
    ? safe
    : [current, ...safe];
}

function nextPanelId(panels: readonly LayoutPanel[]): string {
  for (let index = 1; index <= 24; index += 1) {
    const candidate = `local-${index}`;
    if (!panels.some((panel) => panel.panel_id === candidate)) return candidate;
  }
  return "local-panel";
}

export function DashboardComposer({
  layout,
  results,
  onApply,
}: {
  layout: DashboardLayout;
  results: MetricResult[];
  onApply: (layout: DashboardLayout) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => clone(layout));
  const [transfer, setTransfer] = useState("");
  const [error, setError] = useState<string | undefined>();

  if (!editing)
    return (
      <button
        className="action-control"
        onClick={() => {
          setDraft(clone(layout));
          setError(undefined);
          setEditing(true);
        }}
        type="button"
      >
        Edit dashboard
      </button>
    );

  const replacePanel = (index: number, panel: LayoutPanel) =>
    setDraft((current) => ({
      ...current,
      panels: current.panels.map((candidate, candidateIndex) =>
        candidateIndex === index ? panel : candidate,
      ),
    }));
  const move = (index: number, offset: -1 | 1) =>
    setDraft((current) => {
      const destination = index + offset;
      if (destination < 0 || destination >= current.panels.length)
        return current;
      const panels = [...current.panels];
      [panels[index], panels[destination]] = [
        panels[destination]!,
        panels[index]!,
      ];
      return { ...current, panels };
    });

  return (
    <section aria-label="Dashboard editor" className="panel-card">
      <h2 className="text-heading">Edit dashboard</h2>
      <label className="control-label">
        Layout name
        <input
          className="control-field"
          maxLength={80}
          onChange={(event) =>
            setDraft((current) => ({ ...current, name: event.target.value }))
          }
          value={draft.name}
        />
      </label>
      <ol className="layout-editor-list">
        {draft.panels.map((panel, index) => {
          const result = results.find(
            (candidate) =>
              resultCoordinate(candidate) === panel.metric_coordinate,
          );
          const visualizers = choices(result, panel.visualizer);
          const incompatible = !choices(result).includes(panel.visualizer);
          return (
            <li key={panel.panel_id}>
              <fieldset className="panel-card">
                <legend>Edit panel {panel.panel_id}</legend>
                <label className="control-label">
                  Metric coordinate
                  <select
                    className="control-field"
                    onChange={(event) => {
                      const coordinate = event.target
                        .value as (typeof CATALOG_COORDINATES)[number];
                      const selected = results.find(
                        (candidate) =>
                          resultCoordinate(candidate) === coordinate,
                      );
                      const visualizer = choices(selected)[0]!;
                      replacePanel(
                        index,
                        bindLayoutPanel(
                          panel.panel_id,
                          coordinate,
                          visualizer,
                          panel.size,
                        ),
                      );
                    }}
                    value={panel.metric_coordinate}
                  >
                    {CATALOG_COORDINATES.map((coordinate) => (
                      <option key={coordinate} value={coordinate}>
                        {coordinate}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="control-label">
                  Visualizer
                  <select
                    className="control-field"
                    onChange={(event) =>
                      replacePanel(
                        index,
                        bindLayoutPanel(
                          panel.panel_id,
                          panel.metric_coordinate,
                          event.target.value as VisualizerId,
                          panel.size,
                        ),
                      )
                    }
                    value={panel.visualizer}
                  >
                    {visualizers.map((visualizer) => (
                      <option key={visualizer} value={visualizer}>
                        {visualizer}
                      </option>
                    ))}
                  </select>
                </label>
                {incompatible ? (
                  <p className="status-reading">
                    Saved binding is incompatible with the current Result.
                    Choose a listed repair.
                  </p>
                ) : null}
                <label className="control-label">
                  Panel size
                  <select
                    className="control-field"
                    onChange={(event) =>
                      replacePanel(index, {
                        ...panel,
                        size: event.target.value as PanelSize,
                      })
                    }
                    value={panel.size}
                  >
                    <option value="SMALL">Small</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="WIDE">Wide</option>
                  </select>
                </label>
                <div className="metric-actions">
                  <button
                    className="action-control"
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                    type="button"
                  >
                    Move up
                  </button>
                  <button
                    className="action-control"
                    disabled={index === draft.panels.length - 1}
                    onClick={() => move(index, 1)}
                    type="button"
                  >
                    Move down
                  </button>
                  <button
                    className="action-control"
                    disabled={draft.panels.length === 1}
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        panels: current.panels.filter(
                          (candidate) => candidate.panel_id !== panel.panel_id,
                        ),
                      }))
                    }
                    type="button"
                  >
                    Remove panel
                  </button>
                </div>
              </fieldset>
            </li>
          );
        })}
      </ol>
      <button
        className="action-control"
        disabled={draft.panels.length >= 24}
        onClick={() =>
          setDraft((current) => ({
            ...current,
            panels: [
              ...current.panels,
              bindLayoutPanel(
                nextPanelId(current.panels),
                CATALOG_COORDINATES[0],
                "table@1",
                "MEDIUM",
              ),
            ],
          }))
        }
        type="button"
      >
        Add panel
      </button>
      <label className="control-label">
        Layout JSON
        <textarea
          className="control-field"
          onChange={(event) => setTransfer(event.target.value)}
          rows={5}
          value={transfer}
        />
      </label>
      {error === undefined ? null : (
        <p className="status-banner status-error" role="alert">
          {error}
        </p>
      )}
      <div className="metric-actions">
        <button
          className="action-control"
          onClick={() => setTransfer(JSON.stringify(draft, null, 2))}
          type="button"
        >
          Export JSON
        </button>
        <button
          className="action-control"
          onClick={() => {
            try {
              const decoded = decodeLayout(JSON.parse(transfer));
              if (!decoded.ok) setError(decoded.reason);
              else {
                setDraft(clone(decoded.value));
                setError(undefined);
              }
            } catch {
              setError("Layout JSON is malformed");
            }
          }}
          type="button"
        >
          Import JSON
        </button>
        <button
          className="action-control"
          onClick={() => {
            const decoded = decodeLayout(draft);
            if (!decoded.ok) setError(decoded.reason);
            else {
              onApply(decoded.value);
              setEditing(false);
            }
          }}
          type="button"
        >
          Save local layout
        </button>
        <button
          className="action-control"
          onClick={() => setEditing(false)}
          type="button"
        >
          Cancel editing
        </button>
      </div>
    </section>
  );
}
