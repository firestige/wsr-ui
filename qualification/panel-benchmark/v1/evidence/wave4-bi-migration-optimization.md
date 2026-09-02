# Wave 4 BI migration optimization

The first fixed-runner benchmark after the Studio BI migration completed every
target and retained all 21 browser traces, but failed the unchanged
`panel-benchmark@1` long-task budget at the 200-span upper bound.

- Provider commit: `3f1fac7e480b1b5db8520132ba172115fe8e8d8f`
- Result: `results/full-2026-09-02T07-48-39-838Z/result.json`
- Result SHA-256:
  `962541ec418f4ba008f51fb99751b3d6e136a50d2f5b3da7c963953007bcc056`
- Waterfall upper bound: 48 / 48 / 22 long tasks
- Tree upper bound: 0 / 1 / 2 long tasks
- All other targets: passed

The failure was retained as performance RED evidence. The product fix does not
change the frozen fixture, benchmark budget, visual semantics, motion contract,
or renderer:

1. Waterfall builds the node and child indexes once per trace and memoizes
   filtering/collapse derivation instead of scanning the entire trace on each
   selection.
2. Tree builds parent/child indexes once per trace and keeps ordinary selection
   changes inside the existing animation loop instead of tearing down and
   recreating the Canvas render effect.
3. The smoke runner accepts an optional target and interaction duration only in
   non-qualifying mode so an individual panel can be exercised before the full
   fixed matrix. Full mode continues to reject focused targets and remains
   bound to the manifest protocol.

Before the qualifying rerun, each affected 200-span panel passed a focused
5-second interaction microbenchmark with three measured samples:

| Panel                              | First paint P95 | Frame P95 | Long tasks |
| ---------------------------------- | --------------- | --------- | ---------- |
| `recorded-trace-waterfall@1` upper | 54.525 ms       | 9.325 ms  | 0          |
| `recorded-trace-tree@1` upper      | 54.000 ms       | 10.330 ms | 0          |

These native smoke results are diagnostic only. They do not replace the fixed
Linux/arm64 three-run qualification result.

The first qualifying rerun at provider commit `e65f76b` retained 21 complete
browser traces and proved Tree green, but correctly exited non-zero because
Waterfall still recorded 1 / 1 / 2 long tasks across its upper-bound runs. Its
result is retained at `results/full-2026-09-02T08-39-21-272Z/result.json`
(SHA-256
`f2bc6d685a5143051d2cce4e6c67e8eae9fb7a6a37dc5a660d08b482af58ea1f`).
The remaining 50–56 ms events affected 4 of 90 samples. Memoizing the 200
static minimap elements across selection-only renders then returned the focused
Waterfall microbenchmark to zero long tasks before the next qualifying rerun.

The next full result at provider commit `cd8b333` proved Waterfall green in all
three runs. Tree upper-bound recorded 1 / 4 / 0 long tasks because the summary
renderer still animated every one of roughly 200 recorded edges with an
individual shadowed particle on every frame. The complete failed result remains
at `results/full-2026-09-02T09-20-41-051Z/result.json` (SHA-256
`7bcc387e5e999236399bcb7aeeef74381ccf74abc70c09834ed185108697322e`).
The summary renderer now retains the complete deterministic node/edge geometry
and bounds concurrent motion to the first 24 focused edges in stable trace
order. A component test fixes that behavior, and the 200-span Tree
microbenchmark returned to zero long tasks before the final qualifying rerun.

The original runner applied the five-second interaction window to every warm-up
and every first-paint sample. Four interactive targets therefore spent at least
31 minutes in duplicated interaction windows:
`4 × 3 × (1 + 30) × 5 seconds`. Human review rejected that execution model
before the next run completed. The incomplete run was terminated and is not a
qualification result.

The corrected protocol keeps 30 independent first-paint samples in each of
three runs, then records one separate five-second interaction window per
interactive target and run. The interaction record retains every frame
duration and measured long task; first-paint P95 continues to use 30 samples,
while frame P95 uses all frames from the dedicated window. Thus sample sizes,
three-run independence, budgets, fixtures, and 21 browser traces remain intact
without treating 30 duplicated long windows as independent first-paint data.

The first corrected-protocol result completed in about eight minutes. Every
interaction window passed with zero long tasks, but one of 90 Tree upper-bound
first-paint samples contained a 57 ms task. The result is retained at
`results/full-2026-09-02T10-12-16-298Z/result.json` (SHA-256
`4a181401a82f572ad5a901567f4a488caaccdaf0a8da6aac09f9a3b79c76da30`).
For the 200-node summary renderer, recorded edges are now emitted as two
batched Canvas paths and nodes use bounded summary geometry; exact labels and
relationships remain in the accessible tree and lossless IR. The focused
upper-bound microbenchmark returned to zero long tasks before the next fixed
rerun.

After Canvas batching, the next fixed result still found one exact-threshold
50 ms task among 90 Tree upper-bound first-paint samples; all other samples,
P95 budgets, and interaction windows passed. It is retained at
`results/full-2026-09-02T10-23-18-464Z/result.json` (SHA-256
`9afcd3dbe322d04b21fec42bbc7ab6a22fffaa289b01ec93df5e79964e285a93`).
Desktop Canvas mode was still constructing 200 hidden multi-element outline
rows. It now retains one exact accessible `treeitem` per Span with a compact
DOM representation; narrow mode retains the complete visible row layout. The
focused upper-bound result improved to 38.19 ms first-paint P95 with zero long
tasks before the next fixed rerun.

That fixed rerun moved the only violation from paint to one 51 ms task in the
Tree upper-bound interaction window; every other target/run and all P95 budgets
passed. The retained result is
`results/full-2026-09-02T10-34-59-263Z/result.json`. Summary motion is therefore
bounded to 8 deterministic representative edges without shadow blur, while the
complete static geometry and exact semantic tree remain unchanged.
