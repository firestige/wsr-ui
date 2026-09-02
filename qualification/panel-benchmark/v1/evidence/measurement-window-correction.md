# Measurement-window correction

The third complete result is bound to provider commit `a318dce6bb0f43b6e94b1e6c54bf49e62e1883b5` and runner image `sha256:8336731073a36d3ba8c4a289d72017ac839f8e8bd48ccb3acf11e06abdc14616`.

- Result: local retained artifact `results/full-2026-09-01T00-39-28-075Z/result.json`
- Result SHA-256: `23b3be8fca9909aae7ff36df336b43aa8a41626d626e55d0460c44e046be877f`
- Completeness: 5 targets × 3 independent runs × 30 measured samples; all 15 browser traces retained locally

Fourteen of fifteen runs passed. Every ratio, trace upper-bound, and UNAVAILABLE run passed. Trace typical run 1 sample 15 recorded one browser Long Task entry with a total duration of 51 ms; its first-paint measurement from `data-ready` was 47.355 ms. The other five trace runs contained no Long Task entry.

The runner had retained only the browser entry duration, not its `startTime`. A Long Task entry may begin before the contract's `data-ready` measurement boundary, so comparing its entire task duration to the budget incorrectly counts pre-window work. `panel-benchmark@1` says durations inside the measured window are authoritative. The correction retains `startTime`, raw duration, and measured duration, clips the entry to the `[data-ready, measurement-end]` intersection, and applies the unchanged `>= 50 ms` failure threshold to that measured duration. A test fixes both sides of the boundary: a 60 ms task with only 40 ms inside the window passes, while a 50 ms task wholly inside the window fails.

This is a result-calculation correction, not a failure exclusion, budget change, fixture change, or selective rerun. A new exact-commit complete result is required.
