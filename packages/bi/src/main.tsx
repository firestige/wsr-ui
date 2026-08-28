import { createRoot } from "react-dom/client";

import { EvidenceTaskClient } from "./domain/evidence/task-client";
import { EvolutionClient } from "./domain/evolution/client";
import { RootApp } from "./root-app";
import "./styles.css";

const root = document.getElementById("root");

if (root === null) {
  throw new Error("BI root element is missing");
}

const evolution = new EvolutionClient();
const tasks = new EvidenceTaskClient();

createRoot(root).render(
  <RootApp
    evolution={evolution}
    relativeUrl={window.location.pathname + window.location.search}
    tasks={tasks}
  />,
);
