import { App as PreviewApp } from "./app";
import type { EvolutionPort } from "./evaluation-workspace";
import {
  ProductApp,
  type EvidenceProductPort,
  type TaskPort,
} from "./product-app";

export function RootApp({
  relativeUrl,
  evolution,
  evidence,
  tasks,
}: {
  relativeUrl: string;
  evolution: EvolutionPort;
  evidence: EvidenceProductPort;
  tasks: TaskPort;
}) {
  const pathname = new URL(relativeUrl, "http://bi.local").pathname;
  return pathname === "/preview" ? (
    <PreviewApp />
  ) : (
    <ProductApp
      evidence={evidence}
      evolution={evolution}
      initialRelativeUrl={relativeUrl}
      tasks={tasks}
    />
  );
}
