import { useState } from "react";

import { DashboardComposer } from "../components/dashboard-composer";
import type { DashboardLayout } from "../domain/layout/layout";
import { Typography } from "../public";

import { dashboardLayout, dashboardResults } from "./dashboard-fixture";

export function ActiveScenario() {
  const [layout, setLayout] = useState<DashboardLayout>(dashboardLayout);
  return (
    <DashboardComposer
      layout={layout}
      onApply={setLayout}
      results={dashboardResults}
    >
      {({ actions, dashboard }) => (
        <section
          aria-label="Dashboard inspection"
          className="test-dashboard"
          data-testid="dashboard-scenario"
        >
          <header className="test-dashboard__intro trace-view-header">
            <div className="trace-view-header-copy">
              <Typography variant="overline" weight="bold">
                Exact recorded metrics
              </Typography>
              <Typography as="h2" variant="h2">
                Agent Operations Dashboard
              </Typography>
              <Typography as="p" tone="muted" variant="caption">
                Persistent fixture covering dashboard sizes and visualizers.
              </Typography>
            </div>
            <div aria-hidden="true" className="trace-view-header-spacer" />
            <div className="test-dashboard__actions">{actions}</div>
          </header>
          {dashboard}
        </section>
      )}
    </DashboardComposer>
  );
}
