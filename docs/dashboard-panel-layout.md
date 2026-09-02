# Dashboard panel layout contract

This document defines how dashboard visualizers adapt to their legal grid sizes. A smaller panel is a
distinct information composition, not a scaled-down copy of a larger panel.

## Grid units

- One grid column is `10rem` (`160px` at the default root font size).
- One grid row is `10rem` (`160px` at the default root font size).
- Product-facing sizes in this document use **rows × columns** so `1×3` means one row high and three
  columns wide. The code representation remains `{ w: 3, h: 1 }`; every contract or test crossing
  that boundary must name both axes explicitly.
- `160×160px` is the resolved outer border box of a `1×1` panel in the current grid. A panel spanning
  multiple tracks also spans the intervening grid gaps; it is not an exact pixel multiple of `160px`.
- The host width determines the number of available columns. Remaining inline space is distributed
  through the grid gap and equal container padding so that occupied items stay centered.
- A visualizer must declare only sizes for which it has an intentional composition. Overflow and
  scrolling are not substitutes for a legal compact composition.

## Capacity classes

Dashboard visualizers belong to one of two allocation classes:

- **Compact widget:** a closed small-tool catalog with an intentional composition at one or more of
  `1×1`, `1×2`, `1×3`, and `2×2`.
- **Jumbo panel:** a multi-dimensional visualization that starts at `2×3` and may grow when its axes,
  legend, labels, series, rows, or interactions require more capacity.

Only visualizers explicitly listed in the Compact Widget Catalog may use a compact size. Everything
else defaults to Jumbo. A renderer must not compress a Jumbo panel until it happens to fit.

Tables and full line, bar, radar, heatmap, distribution, and multi-series charts are Jumbo examples.
A chart name alone does not determine its class. The validated semantic IR carries numeric counts,
required-feature booleans, a prevalidated compact label/value pair, and compatible semantic
representations. Compact eligibility requires `primarySignalCount === 1`,
`supportingSignalCount <= 3`, `dimensions <= 1`, `seriesCount <= 1`, `horizontalBarCount <= 2`,
`simpleColumnCount <= 5`, every `requires*` flag below to be `false`, and a compact label/value pair.
Exceeding any bound makes the presentation Jumbo.

### Compact Widget Catalog

The normative implemented catalog is:

| Semantic tool   | Visualizer ID    | Legal sizes         | Intended signal                                      |
| --------------- | ---------------- | ------------------- | ---------------------------------------------------- |
| Scalar number   | `numeric-card@1` | `1×1`               | One count, amount, duration, money value, or percent |
| Status / badge  | `badge@1`        | `1×1`               | One boolean, availability, health, or alert state    |
| Linear progress | `ratio-bar@1`    | `1×1`, `1×2`, `1×3` | One completion, coverage, or stage-progress value    |

The following are non-normative candidates. They are not valid registry IDs or legal layout choices
until separately reviewed and implemented:

| Candidate tool    | Proposed sizes | Intended signal                                      |
| ----------------- | -------------- | ---------------------------------------------------- |
| Icon indicator    | `1×1`          | One direction, grade, health, or pointer-like signal |
| Delta comparison  | `1×2`          | Current value, reference, and one delta              |
| Sparkline trend   | `1×2`, `1×3`   | One axis-free compact trend                          |
| Micro bars        | `1×3`          | One or two horizontal bars or at most five columns   |
| Gauge / ring      | `2×2`          | One ratio or pointer with one explanatory layer      |
| Compact breakdown | `2×2`          | One total and at most three related components       |

Adding a Compact tool is a registry decision. It requires an explicit semantic purpose, closed legal
sizes, information hierarchy, overflow behavior, missing/error treatment, and accessibility contract.
It is not inferred from unused dashboard space.

## Relationship to semantic Evaluation IR

Capacity classification is downstream of semantic evaluation. Evidence remains the factual source;
Evolution produces the Metric Result and semantic structure; the dashboard then applies deterministic
capacity and visualizer rules:

```text
Evidence Facts
      ↓
Metric Result
      ↓
Semantic Evaluation IR
      ↓
Compact eligibility / Jumbo classification
      ↓
Visualizer Registry + legal sizes
      ↓
Size-specific panel composition
```

The semantic structure must expose enough information to classify capacity without inspecting React
markup or guessing from field names. It describes requirements and safe omission, but contains no
visualizer ID, grid size, React component, or CSS choice. The publish-time contract validates at least
these fields:

```ts
type SemanticTool =
  | "SCALAR_NUMBER"
  | "STATUS_BADGE"
  | "LINEAR_PROGRESS"
  | "ICON_INDICATOR"
  | "DELTA_COMPARISON"
  | "SPARKLINE_TREND"
  | "MICRO_BARS"
  | "GAUGE_RING"
  | "COMPACT_BREAKDOWN";

interface PanelPresentationSemantics {
  primarySignalCount: number;
  supportingSignalCount: number;
  supportingSignals: readonly {
    id: string;
    role: "TRUTH" | "COVERAGE" | "DELTA" | "TREND" | "EXACT";
    priority: number;
    compactEligible: boolean;
    label: string;
    value: string;
  }[];
  dimensions: number;
  seriesCount: number;
  horizontalBarCount: number;
  simpleColumnCount: number;
  requiresFullAxis: boolean;
  requiresLegend: boolean;
  requiresZoom: boolean;
  requiresScroll: boolean;
  requiresCompleteLabels: boolean;
  exactCanBeOmitted: boolean;
  compactLabel?: string;
  compactValue?: string;
  representations: readonly SemanticTool[];
}
```

Compact classification requires the numeric bounds above; `requiresFullAxis`, `requiresLegend`,
`requiresZoom`, `requiresScroll`, and `requiresCompleteLabels` must be false;
`exactCanBeOmitted` must be true; both compact strings must be present; and at least one representation
must exist in the normative Compact catalog. `supportingSignalCount` must equal
`supportingSignals.length`. A
size-specific composition selects only `compactEligible` supporting
signals, ordered by ascending `priority` and then `id`; `1×2` takes the first one and `1×3` takes the
first two. Candidate tools never satisfy classification until they become normative registry entries.
Any failed condition returns Jumbo.

An LLM-assisted publish-time compiler may propose this semantic structure, but it should not choose an
arbitrary concrete dashboard size at query time. Ownership is deterministic:

1. The capacity classifier maps validated semantics to Compact or Jumbo and returns compatible
   semantic-tool/visualizer IDs.
2. The presentation resolver applies the layout's explicit visualizer choice when compatible;
   otherwise it uses stable registry priority. The current default order is boolean → `badge@1`, unit
   ratio → `ratio-bar@1`, other scalar → `numeric-card@1`.
3. The Visualizer Registry is the only authority for each visualizer's legal size set or Jumbo size
   rule.
4. The layout allocator or dashboard author selects one concrete size from that legal set.
5. The renderer applies the composition defined for that exact size.

If no Compact tool satisfies the metric-level constraints, classification falls back to a compatible
Jumbo visualizer. `table@1` is lossless specifically at the published Metric Result boundary: it maps
each original slice to a row and renders its slice key, truth state, and exact value directly instead
of consuming arbitrary Semantic IR fields. An incompatible Metric Result produces the scoped contract
error rather than a fabricated table. Unknown visualizers or illegal sizes fail closed instead of
being silently stretched or shrunk.

This contract is an input to the deferred Evolution compiler discussion in
[`workflow-self-recursive#180`](https://github.com/firestige/workflow-self-recursive/issues/180).

## The 1×1 information contract

A `1×1` panel is a single-signal widget. Its purpose is to make one result recognizable at a glance.
It is not a miniature report card.

A `1×1` composition must:

1. Give visual priority to exactly one primary result: a number, boolean state, progress value,
   pointer, or similarly simple indicator.
2. Keep identification secondary. A short name may remain as subdued text; a long or complex name
   must be truncated or replaced by a semantic icon with an accessible name and tooltip containing
   the full name.
3. Convert secondary actions to icon buttons with accessible names and tooltips when the action is
   retained at all.
4. Show the formatted display value when it is primary, but omit its raw or full-precision exact value,
   numerator/denominator detail, descriptions, evidence labels, secondary metrics, and other
   explanatory copy from the visible composition.
5. Represent truth or availability without competing with the primary result. Prefer a compact
   semantic marker when the state must remain visible.
6. Fit within `160×160px` without scrolling in either direction. Content that cannot do so makes the
   visualizer or metric ineligible for `1×1`.

The full metric name, exact value, evidence, and explanation remain available through accessible
names, tooltips, and drill-down actions. Hiding them visually must not erase their semantic or
navigational path.

## 1×1 eligibility test

A visualizer supports `1×1` only when all of the following are true:

- Its primary message has one information dimension.
- The primary result has a stable compact representation.
- Removing supporting detail does not change or misrepresent the result.
- Missing, unavailable, and incompatible states have equally compact representations.
- The composition remains usable with long localized names and large plausible values.
- No scrollbar is required.

Eligibility exists at two levels:

- **Visualizer eligibility:** the visualization type has a valid single-signal composition.
- **Metric eligibility:** a specific metric has a usable short label or semantic icon and a value that
  can be presented safely in that composition.

A visualizer being eligible does not automatically make every compatible metric suitable for `1×1`.

## The 1×n information contract

A one-row panel is a bounded horizontal summary strip. In this notation its height is one row and its
width is `n` columns. The closed global range is `n ∈ {1, 2, 3}`; no one-row visualizer may grow
beyond `1×3`, regardless of how many columns the host grid provides.

Each visualizer must declare an explicit subset of those sizes. Host width determines how many panels
fit in a row, not how far an individual panel may stretch.

- `1×1` follows the single-signal contract above.
- `1×2` may add one closely related visual explanation or supporting value beside the primary result.
- `1×3` may use the horizontal room for one or two horizontal bars, a simple bar chart, or a linear
  progress indicator with limited supporting labels.

A `1×n` composition keeps one primary conclusion, favors a side-by-side information hierarchy, and
must not become a row of unrelated mini-widgets. It must fit without panel scrolling. If a visualizer
needs more than three columns, richer vertical hierarchy, a large legend, or more supporting values,
it must select a compatible Jumbo visualizer or be split into separate panels.

## The 2×2 information contract

A `2×2` panel is a single-topic analytical summary. Four times the nominal `1×1` area permits one
layer of explanation; it does not permit four unrelated primary signals or a miniature dashboard.

A `2×2` composition must use a stable hierarchy:

1. A compact header identifies the topic, carries a truth marker when needed, and keeps retained
   actions in an icon-button group.
2. One dominant body region presents the primary conclusion through a number and one meaningful
   visualization, such as a ring, gauge, trend, or distribution.
3. One supporting region presents at most three semantically related values. Exact value,
   coverage, delta, or trend may return only when they explain the primary conclusion.
4. Full provenance, long explanations, complete Evidence, and unrelated metrics remain in
   drill-down surfaces.
5. A `2×2` composition must fit without panel scrolling. Additional area must improve
   comprehension rather than compensate for an unsuitable visualizer.

The current registry has no visualizer that clearly requires `2×2`:

- `numeric-card@1` and `badge@1` intentionally remain single-signal `1×1` widgets.
- `ratio-bar@1` remains a one-row `1×n` visualizer.
- `table@1` requires at least two rows and three columns (`2×3`, `{ w: 3, h: 2 }`).

Future trend, ratio-breakdown, distribution, stage-summary, or comparison visualizers may declare
`2×2` only after defining the primary conclusion and its one supporting layer. A simple scalar must
not become `2×2` merely to occupy more space.

## The Jumbo information contract

A Jumbo visualizer starts at two rows and three columns (`2×3`) and owns an explicit size rule. The
rule defines fixed axes, growing axes, minimums, and either an intrinsic maximum or the named host
capacity that provides the runtime maximum. There is no implicit unlimited width or height.

Compact and Jumbo are mutually exclusive visualizer classes. When semantic requirements exceed a
Compact tool's limits, the system selects a compatible Jumbo visualizer rather than enlarging the
Compact visualizer into an undeclared size.

The current `table@1` Jumbo family is exactly three columns wide and at least two rows high
(`n×3`, `n ≥ 2`; `{ w: 3, h: n }`). Its runtime maximum is the dashboard allocator's available row
capacity; additional result rows remain inside the declared scrollable table viewport rather than
increasing the grid item without bound. Other Jumbo chart families must separately define their
minimum, growth axes, intrinsic maximum or named host bound, scrolling/zoom behavior, label capacity,
and fallback. A Jumbo panel may scroll or zoom only when that interaction is part of its declared
composition.

## Current visualizer review

| Visualizer       | Current legal sizes | Suitable for 1×1 | Review                                                                                                                                                                                                       |
| ---------------- | ------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `numeric-card@1` | `1×1`               | Yes              | A scalar number is the canonical single-signal case. Keep one display value; suppress exact and supporting detail; use compact actions. Long money, quantity, or duration values still require fit handling. |
| `badge@1`        | `1×1`               | Yes              | A boolean/state badge naturally communicates one dimension. Avoid presenting truth state and boolean value as two equally prominent, redundant badges.                                                       |
| `ratio-bar@1`    | `1×1`, `1×2`, `1×3` | Yes, conditional | A percent or progress indicator is a single signal. The `1×1` composition must suppress numerator/denominator exact detail and prevent title, status, number, and bar from competing.                        |
| `table@1`        | `n×3`, `n ≥ 2`      | No               | A table is inherently multi-dimensional and depends on headers, rows, and comparison. Its current two-row, three-column minimum remains appropriate.                                                         |

Implementation audit outcome:

- Keep `1×1` for `numeric-card@1`. Its exact detail and scrolling are already removed and Evidence is
  icon-only. A later compact-layout pass must still handle long names, large values, tooltip behavior,
  and competition between the availability marker and primary number.
- Keep `1×1` for `badge@1`. Before treating it as complete, combine or prioritize the currently
  redundant availability and boolean-state presentations and define the long-name icon fallback.
- Keep `1×1` for `ratio-bar@1`. Numerator/denominator exact detail is removed at this size, but the
  compact-layout pass must decide on one unified primary treatment and validate title overflow.
- Do not add `1×1` to `table@1`. Its existing minimum-size rule already matches this contract.

## Required compact compositions

### `numeric-card@1`

- Primary: the formatted number.
- Secondary: a short metric name or semantic icon.
- Optional: one compact truth marker and one evidence icon action.
- Hidden: exact value, numerator/denominator, coverage copy, and explanations.
- Overflow: forbidden.

### `badge@1`

- Primary: one boolean or categorical state symbol with a short label where space permits.
- Secondary: a short metric name or semantic icon.
- Avoid redundant simultaneous presentations of availability and boolean truth.
- Overflow: forbidden.

### `ratio-bar@1`

- At `1×1`, primary is one percentage or unified compact progress treatment. Identification is a short
  label or semantic icon; truth and Evidence are icon-only when retained. Exact ratio,
  numerator/denominator, coverage, and descriptive copy are hidden.
- At `1×2`, primary is the percentage paired with one horizontal progress bar. The full one-line label
  may return, along with at most one supporting value selected by semantic priority; actions remain
  icon-only.
- At `1×3`, primary is the percentage paired with one or two horizontal bars or at most five simple
  columns. It may show at most two supporting labels/values. A full axis, legend, zoom, or scroll is
  forbidden.
- Every size has one primary conclusion and must fit without panel scrolling. Wider sizes restore only
  the context named above; they do not stretch the `1×1` composition mechanically.

### `table@1`

- Must not offer `1×1`.
- Minimum size is two rows and three columns (`2×3`, `{ w: 3, h: 2 }`); height may grow with the
  number of rows and the host layout.
- Scrolling is allowed only inside its legal table composition when bounded data exceeds the visible
  row capacity.

## Acceptance criteria for each size pass

For every visualizer and every legal size, verify:

- primary, secondary, and omitted information are explicitly identified;
- plausible longest names and values do not introduce a panel scrollbar;
- icon-only names and actions have accessible names and tooltips;
- unavailable and error states preserve the same information hierarchy;
- light/dark themes and host semantic tokens remain effective;
- resizing between legal sizes changes composition at the grid boundary without stale detail;
- automated selectors identify the panel, visualizer, size, primary result, and retained actions.
