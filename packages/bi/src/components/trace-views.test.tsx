import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { TraceView } from "../domain/trace/trace-view";
import { TraceTree, TraceWaterfall } from "../public";

const trace: TraceView = {
  schemaVersion: "wsr.trace-view@1",
  status: "READY",
  traceId: "trace-1",
  startTimeUnixNano: "1000",
  endTimeUnixNano: "1100",
  durationNano: "100",
  errors: [],
  nodes: [
    {
      id: "root",
      endpoint: { trace_id: "trace-1", span_id: "root" },
      label: "workflow.run",
      kind: "INTERNAL",
      status: "OK",
      startTimeUnixNano: "1000",
      endTimeUnixNano: "1100",
      durationNano: "100",
      startOffsetNano: "0",
      flags: 1,
      traceState: null,
      fields: [{ field: "wsr.role", value: "orchestrator" }],
      truth: {
        availability: "AVAILABLE",
        completeness: "FINAL",
        expiry: "ACTIVE",
        expires_at: null,
      },
      depth: 0,
    },
    {
      id: "child",
      endpoint: { trace_id: "trace-1", span_id: "child" },
      label: "tool.execute",
      kind: "CLIENT",
      status: "OK",
      startTimeUnixNano: "1010",
      endTimeUnixNano: "1040",
      durationNano: "30",
      startOffsetNano: "10",
      flags: 257,
      traceState: "vendor=value",
      fields: [{ field: "tool", value: "shell" }],
      truth: {
        availability: "AVAILABLE",
        completeness: "FINAL",
        expiry: "ACTIVE",
        expires_at: null,
      },
      depth: 1,
      parentId: "root",
    },
  ],
  parentEdges: [
    {
      id: "parent-child-root",
      from: { trace_id: "trace-1", span_id: "child" },
      to: { trace_id: "trace-1", span_id: "root" },
      truth: {
        availability: "AVAILABLE",
        completeness: "FINAL",
        expiry: "ACTIVE",
        expires_at: null,
      },
    },
  ],
  links: [
    {
      id: "link-child-remote",
      from: { trace_id: "trace-1", span_id: "child" },
      to: { trace_id: "trace-2", span_id: "remote" },
      flags: 1,
      traceState: "linked=yes",
      truth: {
        availability: "AVAILABLE",
        completeness: "FINAL",
        expiry: "ACTIVE",
        expires_at: null,
      },
    },
  ],
};

describe("recorded Trace business panels", () => {
  it("renders a shared-scale waterfall and a lossless span passport", async () => {
    render(<TraceWaterfall trace={trace} />);

    expect(
      screen.getByRole("region", { name: "Recorded trace waterfall" }),
    ).toHaveAttribute("data-motion", "finite-recorded-time");
    expect(screen.getByText("100 ns recorded duration")).toBeVisible();
    expect(screen.getByText("Recorded links: 1")).toBeVisible();

    await userEvent.click(
      screen.getByRole("button", { name: /tool.execute/i }),
    );
    const passport = screen.getByRole("region", { name: "Span passport" });
    expect(passport).toHaveTextContent("1010");
    expect(passport).toHaveTextContent("1040");
    expect(passport).toHaveTextContent("vendor=value");
    expect(passport).toHaveTextContent('"tool":"shell"');
    expect(passport).toHaveTextContent("FINAL");
  });

  it("renders a call tree, keeping recorded LINK edges distinct", () => {
    render(<TraceTree trace={trace} />);

    const tree = screen.getByRole("tree", { name: "Recorded trace call tree" });
    expect(tree).toHaveTextContent("workflow.run");
    expect(tree).toHaveTextContent("tool.execute");
    expect(screen.getByText("Recorded LINK → trace-2:remote")).toBeVisible();
    expect(screen.queryByText(/service map|architecture/i)).toBeNull();
  });

  it("disables finite recorded-time motion when reduced motion is requested", () => {
    render(<TraceWaterfall reducedMotion trace={trace} />);

    const region = screen.getByRole("region", {
      name: "Recorded trace waterfall",
    });
    expect(region).toHaveAttribute("data-motion", "off");
    expect(region).not.toHaveTextContent(/live/i);
  });
});
