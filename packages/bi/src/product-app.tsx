import { useEffect, useState } from "react";

import { ScopedError } from "./components/status";
import {
  EvidenceDrilldown,
  type EvidenceFactsPort,
} from "./evidence-drilldown";
import type { TaskListItem, TaskResult } from "./domain/evidence/task-client";
import {
  parseEvaluationRoute,
  serializeEvaluationRoute,
  type EvaluationRoute,
} from "./domain/navigation/evaluation-route";
import {
  EvaluationWorkspace,
  type EvolutionPort,
} from "./evaluation-workspace";

export interface TaskPort {
  getPage(filters: { limit?: number; cursor?: string }): Promise<TaskResult>;
}

function TaskChoice({
  task,
  checked,
  prefix,
  onChange,
}: {
  task: TaskListItem;
  checked: boolean;
  prefix?: string;
  onChange: (checked: boolean) => void;
}) {
  const display = task.display_name ?? task.task_id;
  return (
    <label className="task-choice">
      <input
        aria-label={`${prefix === undefined ? "" : `${prefix} `}${display} (${task.task_id})`}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      <span>
        <strong>{display}</strong>
        {task.display_name === null ? null : (
          <code className="text-code">{task.task_id}</code>
        )}
      </span>
    </label>
  );
}

const toggle = (current: string[], taskId: string, checked: boolean) =>
  checked
    ? current.includes(taskId)
      ? current
      : [...current, taskId]
    : current.filter((item) => item !== taskId);

function TaskSelector({
  tasks,
  onSelect,
}: {
  tasks: TaskPort;
  onSelect: (route: EvaluationRoute) => void;
}) {
  const [page, setPage] = useState<TaskResult | undefined>();
  const [mode, setMode] = useState<"single" | "compare">("single");
  const [single, setSingle] = useState<string[]>([]);
  const [before, setBefore] = useState<string[]>([]);
  const [after, setAfter] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    void tasks.getPage({ limit: 100 }).then((result) => {
      if (active) setPage(result);
    });
    return () => {
      active = false;
    };
  }, [tasks]);

  return (
    <main className="evaluation-shell">
      <header className="evaluation-header">
        <div>
          <p className="text-label">Business intelligence</p>
          <h1 className="text-title">Choose Tasks</h1>
        </div>
      </header>
      {page === undefined ? (
        <p className="loading-state" role="status">
          Loading Tasks…
        </p>
      ) : !page.ok ? (
        <ScopedError
          announce="assertive"
          detail={
            page.error.kind === "UPSTREAM"
              ? `${page.error.code}: ${page.error.message}`
              : "reason" in page.error
                ? page.error.reason
                : "Task query failed"
          }
          retryable={false}
          title="Task list unavailable"
        />
      ) : (
        <form
          className="task-selector"
          onSubmit={(event) => {
            event.preventDefault();
            onSelect(
              mode === "single"
                ? { tag: "SINGLE", taskIds: single }
                : {
                    tag: "COMPARE",
                    leftTaskIds: before,
                    rightTaskIds: after,
                  },
            );
          }}
        >
          <fieldset className="mode-selector">
            <legend>Evaluation mode</legend>
            <label>
              <input
                checked={mode === "single"}
                name="mode"
                onChange={() => setMode("single")}
                type="radio"
              />
              Single
            </label>
            <label>
              <input
                checked={mode === "compare"}
                name="mode"
                onChange={() => setMode("compare")}
                type="radio"
              />
              Compare
            </label>
          </fieldset>
          {mode === "single" ? (
            <fieldset className="task-list">
              <legend>Tasks</legend>
              {page.value.items.map((task) => (
                <TaskChoice
                  checked={single.includes(task.task_id)}
                  key={task.task_id}
                  onChange={(checked) =>
                    setSingle(toggle(single, task.task_id, checked))
                  }
                  task={task}
                />
              ))}
            </fieldset>
          ) : (
            <div className="compare-task-lists">
              {(["Before", "After"] as const).map((side) => {
                const selected = side === "Before" ? before : after;
                const setSelected = side === "Before" ? setBefore : setAfter;
                return (
                  <fieldset className="task-list" key={side}>
                    <legend>{side}</legend>
                    {page.value.items.map((task) => (
                      <TaskChoice
                        checked={selected.includes(task.task_id)}
                        key={task.task_id}
                        onChange={(checked) =>
                          setSelected(toggle(selected, task.task_id, checked))
                        }
                        prefix={side}
                        task={task}
                      />
                    ))}
                  </fieldset>
                );
              })}
            </div>
          )}
          <button
            className="action-control"
            disabled={
              mode === "single"
                ? single.length === 0
                : before.length === 0 || after.length === 0
            }
            type="submit"
          >
            {mode === "single" ? "Evaluate selection" : "Compare selections"}
          </button>
        </form>
      )}
    </main>
  );
}

export function ProductApp({
  evolution,
  evidence,
  tasks,
  initialRelativeUrl = window.location.pathname + window.location.search,
}: {
  evolution: EvolutionPort;
  evidence: EvidenceFactsPort;
  tasks: TaskPort;
  initialRelativeUrl?: string;
}) {
  const [theme, setTheme] = useState<"system" | "light" | "dark">("system");
  const [density, setDensity] = useState<"comfortable" | "compact">(
    "comfortable",
  );
  const [route, setRoute] = useState(() =>
    parseEvaluationRoute(initialRelativeUrl),
  );
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.density = density;
  }, [density, theme]);
  useEffect(() => {
    const restore = () =>
      setRoute(
        parseEvaluationRoute(window.location.pathname + window.location.search),
      );
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);
  const navigate = (next: EvaluationRoute) => {
    const relativeUrl = serializeEvaluationRoute(next);
    window.history.pushState(null, "", relativeUrl);
    setRoute(next);
  };
  return (
    <>
      <nav aria-label="Display preferences" className="product-preferences">
        <label className="control-label">
          Theme
          <select
            className="control-field"
            onChange={(event) =>
              setTheme(event.target.value as "system" | "light" | "dark")
            }
            value={theme}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
        <label className="control-label">
          Density
          <select
            className="control-field"
            onChange={(event) =>
              setDensity(event.target.value as "comfortable" | "compact")
            }
            value={density}
          >
            <option value="comfortable">Comfortable</option>
            <option value="compact">Compact</option>
          </select>
        </label>
      </nav>
      {route.tag === "SELECT" ? (
        <TaskSelector onSelect={navigate} tasks={tasks} />
      ) : route.tag === "EVIDENCE" ? (
        <EvidenceDrilldown
          evidence={evidence}
          evolution={evolution}
          onNavigate={navigate}
          route={route}
        />
      ) : route.tag === "TRACE" ? (
        <main className="evaluation-shell">
          <h1 className="text-title">Recorded Trace</h1>
          <p aria-live="polite" className="loading-state" role="status">
            Resolving evaluation context…
          </p>
        </main>
      ) : (
        <EvaluationWorkspace
          evolution={evolution}
          onNavigate={navigate}
          route={route}
        />
      )}
    </>
  );
}
