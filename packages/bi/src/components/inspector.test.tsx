import { useRef, useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { OwnedInspector } from "./inspector";

function InspectorHarness({
  modal = true,
  onOutside,
}: {
  modal?: boolean;
  onOutside?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const invoker = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button onClick={() => setOpen(true)} ref={invoker} type="button">
        Open receipt
      </button>
      <button onClick={onOutside} type="button">
        Outside action
      </button>
      <OwnedInspector
        invokerRef={invoker}
        kind="receipt"
        modal={modal}
        onClose={() => setOpen(false)}
        open={open}
        title="Evaluation receipt"
      >
        <button type="button">Copy digest</button>
      </OwnedInspector>
    </>
  );
}

describe("owned inspector", () => {
  it("owns one labeled modal, closes with Escape and restores invoker focus", async () => {
    const user = userEvent.setup();
    render(<InspectorHarness />);
    const invoker = screen.getByRole("button", { name: "Open receipt" });

    await user.click(invoker);
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(
      screen.getByRole("dialog", { name: "Evaluation receipt" }),
    ).toHaveAttribute("aria-modal", "true");
    expect(
      screen.getByRole("button", { name: "Close inspector" }),
    ).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(invoker).toHaveFocus();
  });

  it("traps Tab only for a modal inspector", async () => {
    const user = userEvent.setup();
    render(<InspectorHarness />);
    await user.click(screen.getByRole("button", { name: "Open receipt" }));

    await user.tab();
    expect(screen.getByRole("button", { name: "Copy digest" })).toHaveFocus();
    await user.tab();
    expect(
      screen.getByRole("button", { name: "Close inspector" }),
    ).toHaveFocus();
  });

  it("does not claim modal focus ownership for a non-modal inspector", async () => {
    const user = userEvent.setup();
    const outside = vi.fn();
    render(<InspectorHarness modal={false} onOutside={outside} />);
    await user.click(screen.getByRole("button", { name: "Open receipt" }));

    expect(screen.getByRole("dialog")).not.toHaveAttribute("aria-modal");
    expect(screen.getByRole("dialog").parentElement).not.toHaveAttribute(
      "data-modal",
    );
    await user.click(screen.getByRole("button", { name: "Outside action" }));
    expect(outside).toHaveBeenCalledOnce();
  });
});
