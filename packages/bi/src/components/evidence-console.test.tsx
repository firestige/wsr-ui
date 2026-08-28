import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { EvidenceConsoleRow } from "./evidence-console";
import { EvidenceConsoleFoundation } from "./evidence-console";

const row: EvidenceConsoleRow = {
  factId: "fact-a",
  factClass: "delivery.outcome",
  coordinates: { delivery_id: "delivery-a" },
  provenance: "accepted:event-a",
  truth: {
    completeness: "FINAL",
    availability: "AVAILABLE",
    expiry: "ACTIVE",
    expires_at: null,
  },
  trace: { traceId: "trace-a", spanId: "span-a", state: "PARTIAL" },
};

describe("Evidence Console foundation", () => {
  it("keeps result, related and read-set scopes semantically distinct", async () => {
    const user = userEvent.setup();
    const change = vi.fn();
    render(
      <EvidenceConsoleFoundation
        onScopeChange={change}
        rows={[row]}
        scope="related"
        state={{ tag: "READY" }}
      />,
    );

    expect(screen.getByRole("tab", { name: "Result evidence" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Related Facts" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.getByText(/not claimed as calculation contributors/i),
    ).toBeVisible();
    await user.click(screen.getByRole("tab", { name: "Resolved read set" }));
    expect(change).toHaveBeenCalledWith("read-set");
  });

  it.each([
    [{ tag: "EMPTY" } as const, "No Evidence in this scope"],
    [{ tag: "PARTIAL" } as const, "Partial Evidence data"],
    [{ tag: "EXPIRED" } as const, "Evidence detail expired"],
  ])("does not collapse %s into another state", (state, label) => {
    render(
      <EvidenceConsoleFoundation rows={[]} scope="result" state={state} />,
    );
    expect(screen.getByText(label)).toBeVisible();
  });

  it("renders Fact identity, provenance, lifecycle and exact Trace action", async () => {
    const user = userEvent.setup();
    const openTrace = vi.fn();
    render(
      <EvidenceConsoleFoundation
        onOpenTrace={openTrace}
        rows={[row]}
        scope="result"
        state={{ tag: "READY" }}
      />,
    );

    expect(
      screen.getByRole("table", { name: "Result evidence Facts" }),
    ).toBeVisible();
    expect(screen.getByText("fact-a")).toBeVisible();
    expect(screen.getByText("accepted:event-a")).toBeVisible();
    expect(screen.getByText("Completeness: final")).toBeVisible();
    await user.click(screen.getByRole("button", { name: /trace-a.*span-a/i }));
    expect(openTrace).toHaveBeenCalledWith("trace-a", "span-a");
  });

  it("keeps a 200-row table as structured fallback", () => {
    const rows = Array.from({ length: 200 }, (_, index) => ({
      ...row,
      factId: `fact-${index}`,
    }));
    render(
      <EvidenceConsoleFoundation
        rows={rows}
        scope="read-set"
        state={{ tag: "READY" }}
      />,
    );

    expect(screen.getAllByRole("row")).toHaveLength(201);
  });

  it("provides scoped retry without discarding the current scope", async () => {
    const user = userEvent.setup();
    const retry = vi.fn();
    render(
      <EvidenceConsoleFoundation
        rows={[]}
        scope="read-set"
        state={{ tag: "ERROR", detail: "Cursor failed", onRetry: retry }}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledOnce();
    expect(
      screen.getByRole("tab", { name: "Resolved read set" }),
    ).toHaveAttribute("aria-selected", "true");
  });
});
