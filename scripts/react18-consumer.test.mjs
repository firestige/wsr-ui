import assert from "node:assert/strict";
import test from "node:test";

import { assertReact18Markup } from "./qualify-react18-consumer.mjs";

test("accepts semantic AVAILABLE and UNAVAILABLE output from the package", () => {
  assert.doesNotThrow(() =>
    assertReact18Markup(
      '<div class="wsr-bi"><svg aria-label="Ratio bar"></svg><article aria-label="metric@2.0.0">Unavailable Reason: MISSING_INPUT</article></div>',
    ),
  );
});

test("rejects a consumer that falls back to JSON instead of the chart", () => {
  assert.throws(
    () =>
      assertReact18Markup(
        '<div class="wsr-bi"><pre>{"metric_id":"metric"}</pre></div>',
      ),
    /AVAILABLE ratio chart/i,
  );
});
