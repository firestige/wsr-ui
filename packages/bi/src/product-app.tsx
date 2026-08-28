import { useCallback, useEffect, useState } from "react";

import { ScopedError } from "./components/status";
import {
  EvidenceDrilldown,
  type EvidenceFactsPort,
} from "./evidence-drilldown";
import type {
  TaskListItem,
  TaskPage,
  TaskResult,
} from "./domain/evidence/task-client";
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
  disabled = false,
  prefix,
  onChange,
}: {
  task: TaskListItem;
  checked: boolean;
  disabled?: boolean;
  prefix?: string;
  onChange: (checked: boolean) => void;
}) {
  const display = task.display_name ?? task.task_id;
  return (
    <label className="task-choice">
      <input
        aria-label={`${prefix === undefined ? "" : `${prefix} `}${display} (${task.task_id})`}
        checked={checked}
        disabled={disabled}
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

const taskErrorDetail = (result: Extract<TaskResult, { ok: false }>) =>
  result.error.kind === "UPSTREAM"
    ? `${result.error.code}: ${result.error.message}`
    : "reason" in result.error
      ? result.error.reason
      : "Task query failed";

function TaskSelector({
  tasks,
  onSelect,
}: {
  tasks: TaskPort;
  onSelect: (route: EvaluationRoute) => void;
}) {
  const [page, setPage] = useState<TaskPage | undefined>();
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [queryError, setQueryError] = useState<string | undefined>();
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<"single" | "compare">("single");
  const [single, setSingle] = useState<string[]>([]);
  const [before, setBefore] = useState<string[]>([]);
  const [after, setAfter] = useState<string[]>([]);
  const [selectionError, setSelectionError] = useState<string | undefined>();

  const load = useCallback(
    async (cursor?: string) => {
      if (cursor === undefined) setLoading(true);
      else setLoadingMore(true);
      setQueryError(undefined);
      const result = await tasks.getPage({
        limit: 100,
        ...(cursor === undefined ? {} : { cursor }),
      });
      if (!result.ok) {
        setQueryError(taskErrorDetail(result));
      } else if (cursor === undefined) {
        setPage(result.value);
      } else {
        setPage((current) => {
          if (
            current === undefined ||
            current.snapshot !== result.value.snapshot
          ) {
            setQueryError("Task pagination changed snapshot");
            return current;
          }
          const known = new Set(current.items.map((item) => item.task_id));
          if (result.value.items.some((item) => known.has(item.task_id))) {
            setQueryError("Task pagination repeated an identity");
            return current;
          }
          return {
            ...current,
            items: [...current.items, ...result.value.items],
            next_cursor: result.value.next_cursor,
          };
        });
      }
      setLoading(false);
      setLoadingMore(false);
    },
    [tasks],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const normalizedSearch = search.trim();
  const visibleTasks =
    page?.items.filter(
      (task) =>
        normalizedSearch.length === 0 ||
        task.task_id === normalizedSearch ||
        task.display_name
          ?.toLocaleLowerCase()
          .includes(normalizedSearch.toLocaleLowerCase()),
    ) ?? [];

  return (
    <main className="evaluation-shell" id="main-content" tabIndex={-1}>
      <header className="evaluation-header">
        <div>
          <p className="text-label">Business intelligence</p>
          <h1 className="text-title">Choose Tasks</h1>
        </div>
      </header>
      {loading && page === undefined ? (
        <p className="loading-state" role="status">
          Loading Tasks…
        </p>
      ) : page === undefined ? (
        <ScopedError
          announce="assertive"
          detail={queryError ?? "Task query failed"}
          onRetry={() => void load()}
          retryable
          title="Task list unavailable"
        />
      ) : (
        <form
          className="task-selector"
          onSubmit={(event) => {
            event.preventDefault();
            const next: EvaluationRoute =
              mode === "single"
                ? { tag: "SINGLE", taskIds: single }
                : {
                    tag: "COMPARE",
                    leftTaskIds: before,
                    rightTaskIds: after,
                  };
            try {
              serializeEvaluationRoute(next);
              setSelectionError(undefined);
              onSelect(next);
            } catch (error) {
              setSelectionError(
                error instanceof Error ? error.message : "Invalid selection",
              );
            }
          }}
        >
          <label className="control-label">
            Search Tasks
            <input
              className="control-field"
              onChange={(event) => setSearch(event.target.value)}
              type="search"
              value={search}
            />
          </label>
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
              {visibleTasks.map((task) => (
                <TaskChoice
                  checked={single.includes(task.task_id)}
                  disabled={
                    single.length >= 24 && !single.includes(task.task_id)
                  }
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
                    {visibleTasks.map((task) => (
                      <TaskChoice
                        checked={selected.includes(task.task_id)}
                        disabled={
                          selected.length >= 24 &&
                          !selected.includes(task.task_id)
                        }
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
          {queryError === undefined ? null : (
            <ScopedError
              announce="polite"
              detail={queryError}
              onRetry={() => void load(page.next_cursor ?? undefined)}
              retryable
              title="More Tasks unavailable"
            />
          )}
          {page.next_cursor === null ? null : (
            <button
              className="action-control"
              disabled={loadingMore}
              onClick={() => void load(page.next_cursor ?? undefined)}
              type="button"
            >
              {loadingMore ? "Loading more Tasks…" : "Load more Tasks"}
            </button>
          )}
          <p className="status-reading">24 Task limit per side.</p>
          {selectionError === undefined ? null : (
            <p className="status-banner status-error" role="alert">
              Selection cannot open: {selectionError}
            </p>
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
    if (next.tag === "EVIDENCE" && route.tag !== "EVIDENCE") {
      const parent: EvaluationRoute = {
        ...next.selection,
        focus: { metric: next.metric, side: next.side },
      };
      window.history.replaceState(
        { wsrBi: true },
        "",
        serializeEvaluationRoute(parent),
      );
      window.history.pushState({ wsrBiParent: true }, "", relativeUrl);
    } else if (next.tag === "EVIDENCE" && route.tag === "EVIDENCE") {
      window.history.replaceState({ wsrBiParent: true }, "", relativeUrl);
    } else {
      window.history.pushState({ wsrBi: true }, "", relativeUrl);
    }
    setRoute(next);
  };
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
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
          onBack={() => {
            if (window.history.state?.wsrBiParent === true)
              window.history.back();
            else {
              const parent: EvaluationRoute = {
                ...route.selection,
                focus: { metric: route.metric, side: route.side },
              };
              navigate(parent);
            }
          }}
          onNavigate={navigate}
          route={route}
        />
      ) : route.tag === "TRACE" ? (
        <main className="evaluation-shell" id="main-content" tabIndex={-1}>
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
