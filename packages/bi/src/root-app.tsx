import { App as PreviewApp } from "./app";
import type { EvidenceFactsPort } from "./evidence-drilldown";
import type { EvolutionPort } from "./evaluation-workspace";
import { ProductApp, type TaskPort } from "./product-app";

export function RootApp({
  relativeUrl,
  evolution,
  evidence,
  tasks,
}: {
  relativeUrl: string;
  evolution: EvolutionPort;
  evidence: EvidenceFactsPort;
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
