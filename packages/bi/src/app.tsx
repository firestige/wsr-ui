import { line } from "d3";
import { useEffect, useMemo, useState } from "react";

type Theme = "system" | "light" | "dark";
type Density = "comfortable" | "compact";

const trendPoints: ReadonlyArray<readonly [number, number]> = [
  [8, 57],
  [46, 45],
  [84, 51],
  [122, 29],
  [160, 35],
  [198, 18],
];

function FactualPreview() {
  const path = useMemo(
    () =>
      line<readonly [number, number]>()
        .x(([x]) => x)
        .y(([, y]) => y)(trendPoints),
    [],
  );

  return (
    <svg
      aria-label="Factual trend preview"
      className="h-24 w-full text-data-series-1"
      role="img"
      viewBox="0 0 206 70"
    >
      <path
        className="stroke-border-default"
        d="M8 62 H198"
        fill="none"
        vectorEffect="non-scaling-stroke"
      />
      <path
        className="stroke-current"
        d={path ?? undefined}
        fill="none"
        strokeWidth="2.5"
        vectorEffect="non-scaling-stroke"
      />
      {trendPoints.map(([x, y]) => (
        <circle
          className="fill-current"
          cx={x}
          cy={y}
          key={`${x}-${y}`}
          r="2.5"
        />
      ))}
    </svg>
  );
}

function TracePreview() {
  return (
    <svg
      aria-label="Recorded trace preview"
      className="h-24 w-full text-data-series-2"
      role="img"
      viewBox="0 0 206 70"
    >
      <path
        className="stroke-border-strong"
        d="M29 35 H94 M112 35 H177"
        fill="none"
        strokeDasharray="4 3"
        vectorEffect="non-scaling-stroke"
      />
      {[20, 103, 186].map((x) => (
        <circle
          className="fill-surface-panel stroke-current"
          cx={x}
          cy="35"
          key={x}
          r="9"
          strokeWidth="2"
        />
      ))}
    </svg>
  );
}

function TruthBadge({
  children,
  tone,
}: {
  children: string;
  tone: "available" | "partial";
}) {
  const toneClass = tone === "available" ? "truth-available" : "truth-partial";
  return <span className={`truth-badge ${toneClass}`}>{children}</span>;
}

export function App() {
  const [theme, setTheme] = useState<Theme>("system");
  const [density, setDensity] = useState<Density>("comfortable");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.density = density;
  }, [density]);

  return (
    <main className="min-h-screen bg-surface-canvas px-layout-page py-layout-section text-content-primary">
      <div className="mx-auto flex max-w-layout-content flex-col gap-layout-section">
        <header className="flex flex-wrap items-end justify-between gap-layout-cluster">
          <div className="space-y-layout-tight">
            <p className="text-label text-content-muted">Component preview</p>
            <h1 className="text-title">BI visual system</h1>
            <p className="max-w-prose text-body text-content-secondary">
              Semantic tokens bind theme, density, spacing and D3 color without
              fixing page composition.
            </p>
          </div>
          <div className="flex flex-wrap gap-layout-cluster">
            <label className="control-label">
              Theme
              <select
                className="control-field"
                onChange={(event) => setTheme(event.target.value as Theme)}
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
                onChange={(event) => setDensity(event.target.value as Density)}
                value={density}
              >
                <option value="comfortable">Comfortable</option>
                <option value="compact">Compact</option>
              </select>
            </label>
          </div>
        </header>

        <section
          aria-label="Semantic component examples"
          className="grid gap-layout-grid lg:grid-cols-2"
        >
          <article className="panel-card">
            <div className="flex items-start justify-between gap-layout-cluster">
              <div>
                <p className="text-label text-content-muted">
                  Factual primitive
                </p>
                <h2 className="text-heading">Trend geometry</h2>
              </div>
              <TruthBadge tone="available">Available</TruthBadge>
            </div>
            <FactualPreview />
          </article>

          <article className="panel-card">
            <div className="flex items-start justify-between gap-layout-cluster">
              <div>
                <p className="text-label text-content-muted">Trace primitive</p>
                <h2 className="text-heading">Recorded relationships</h2>
              </div>
              <TruthBadge tone="partial">Partial</TruthBadge>
            </div>
            <TracePreview />
          </article>
        </section>
      </div>
    </main>
  );
}
