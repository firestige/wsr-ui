# SVG optimization evidence 1

The first fixed-runner execution completed every warm-up, measured sample, independent run, and browser trace, then failed the unchanged `panel-benchmark@1` budgets. It is retained as pre-optimization evidence and is not a publishable qualification result.

- Result: local retained artifact `results/full-2026-08-31T23-47-23-079Z/result.json`
- Result SHA-256: `93b70592a24b3fcd4af87edf6d916007a3a0baceec7a9c458870c87f56492456`
- Runner image: `sha256:179c546a77dabc9719a2871c0bb43c74729717f6e1dbd9fef441974af286ee86`
- Environment: Linux arm64, Playwright 1.62.1, Chromium 151.0.7922.34 revision 1234, 1280×800, DPR 1
- Completeness: 5 targets × 3 independent runs × 30 measured samples; 15 browser trace archives retained locally (106 MiB total)

Observed failures:

| Panel / fixture     | Run results                                                  | Repeated violation                                            |
| ------------------- | ------------------------------------------------------------ | ------------------------------------------------------------- |
| ratio / typical     | all pass                                                     | none                                                          |
| ratio / upper-bound | first-paint p95 113.4 / 110.8 / 109.5 ms                     | first paint; one long task in run 3                           |
| trace / typical     | frame p95 16.8 / 16.8 / 16.8 ms                              | interactive frame; run 3 first paint 113.6 ms                 |
| trace / upper-bound | first-paint p95 140.4 / 102.9 / 98.4 ms; frame p95 16.8 each | first paint in runs 1–2, frame in all; 14 / 8 / 13 long tasks |
| unavailable         | first-paint p95 83.9 / 102.6 / 104.0 ms                      | first paint in runs 2–3                                       |

Because even the HTML-only UNAVAILABLE state crossed the first-paint budget, the result identified measurement overhead in addition to SVG work. The retained Playwright traces had DOM snapshots, screenshots, and sources enabled during the measured window; that instrumentation is not required by the contract, which requires a browser trace rather than DOM snapshot capture. The browser also exposed only 0.1 ms timer precision, making a nominal 60 Hz frame appear as 16.8 ms against the 16.7 ms budget.

The applicable optimization, without changing the budget, fixture, data contract, published value, renderer, or product semantics, is:

1. retain event browser traces while disabling measured-window DOM snapshots/screenshots/source capture;
2. serve the isolated benchmark page with COOP/COEP so `performance.now()` has sufficient precision for the frozen 16.7 ms boundary;
3. memoize the trace SVG geometry across selection-only state changes;
4. keep deterministic node selection every 30 frames and exercise resize once every 150 frames instead of rebuilding the entire 200-record graph every 15 frames.

No Canvas implementation is authorized by this failed run. The optimized SVG implementation must complete a new, unmodified three-run result before any renderer decision.
