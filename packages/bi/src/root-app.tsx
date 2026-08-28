import { App as PreviewApp } from "./app";
import type { EvolutionPort } from "./evaluation-workspace";
import { ProductApp, type TaskPort } from "./product-app";

export function RootApp({
  relativeUrl,
  evolution,
  tasks,
}: {
  relativeUrl: string;
  evolution: EvolutionPort;
  tasks: TaskPort;
}) {
  const pathname = new URL(relativeUrl, "http://bi.local").pathname;
  return pathname === "/preview" ? (
    <PreviewApp />
  ) : (
    <ProductApp
      evolution={evolution}
      initialRelativeUrl={relativeUrl}
      tasks={tasks}
    />
  );
}
