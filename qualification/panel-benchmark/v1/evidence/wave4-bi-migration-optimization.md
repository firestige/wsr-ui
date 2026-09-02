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
