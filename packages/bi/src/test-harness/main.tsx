import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { ActiveScenario } from "./scenario";
import { TestHarness } from "./test-harness";
import "./test-harness.css";

const root = document.getElementById("root");

if (root === null) {
  throw new Error("Test harness root element is missing");
}

createRoot(root).render(
  <StrictMode>
    <TestHarness>
      <ActiveScenario />
    </TestHarness>
  </StrictMode>,
);
