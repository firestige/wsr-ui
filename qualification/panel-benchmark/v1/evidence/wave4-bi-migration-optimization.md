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
