# SVG optimization evidence 2

The second complete fixed-runner result is bound to provider commit `606e8dfa7e2d14ce2c1bfdf05596ffb61c519576` and runner image `sha256:e66680cc3017a0500524cb7b301509b9a329405b7d49bee103f6a1bf527ff377`.

- Result: local retained artifact `results/full-2026-09-01T00-14-21-770Z/result.json`
- Result SHA-256: `6ecb1695c4302189d32c9fedaad5a9c17a5d3e2819bb090543d59b8cb32106f9`
- Completeness: 5 targets × 3 independent runs × 30 measured samples; all 15 browser event traces retained locally

Thirteen of fifteen runs passed every budget. Ratio typical/upper-bound, trace typical, and UNAVAILABLE all passed in every run. The 200-record trace upper-bound passed first paint and interactive frame budgets in all three runs, but had one 50 ms long task in run 1 sample 29 and one 51 ms long task in run 3 sample 24; run 2 had zero. This does not meet the Canvas trigger, because three complete SVG runs did not violate the same budget.

The remaining initial-render duplication was the complete SVG graph plus roughly 200 HTML node/relation controls. The applicable SVG/HTML optimization is to keep the chart, exact counts, selected identity, and semantic summary in the first render, while placing the duplicate exact node/relation controls behind a native keyboard-operable disclosure and mounting them only when requested. Unit and browser tests require the disclosure to expose the same stable order, exact identities, relation types, orphan states, and selection callbacks. The deterministic benchmark interaction continues to update both node and relation selection identity and to resize the panel; no fixture, duration, budget, renderer, or product value changes.

No Canvas implementation is authorized by this result. A new exact-commit three-run result is required.
