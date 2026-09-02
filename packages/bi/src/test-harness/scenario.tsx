import { TraceStatistics } from "../public";

import { statisticsTrace } from "./statistics-fixture";

export function ActiveScenario() {
  return <TraceStatistics trace={statisticsTrace} />;
}
