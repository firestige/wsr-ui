# wsr-ui-core

Host-neutral React components and domain projections for WSR business-intelligence results.

Install the package beside a host-provided React 18 or React 19 runtime. Import `wsr-ui-core/styles.css`, then wrap shared components in `BiSurface`; the stylesheet is scoped to that root and does not install a global reset or theme.

The package does not own network access, routing, history, authentication, notifications, or application startup. Hosts supply data and action/navigation callbacks through component props and ports.

Dashboard visualizers follow the size-specific information hierarchy and eligibility rules in
[`docs/dashboard-panel-layout.md`](../../docs/dashboard-panel-layout.md).
