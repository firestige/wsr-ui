import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  Button,
  ButtonGroup,
  IconButton,
  STUDIO_DESIGN_IR,
  StatusBadge,
  Surface,
  TextInput,
  Typography,
} from "../public";

describe("Studio semantic design assets", () => {
  it("covers every frozen page with one closed reusable variant vocabulary", () => {
    expect(Object.keys(STUDIO_DESIGN_IR.buttons)).toEqual([
      "primary",
      "secondary",
      "ghost",
      "danger",
      "segment",
    ]);
    expect(Object.keys(STUDIO_DESIGN_IR.typography)).toEqual([
      "h1",
      "h2",
      "subtitle1",
      "body1",
      "body2",
      "caption",
      "overline",
    ]);
    expect(
      Object.fromEntries(
        Object.entries(STUDIO_DESIGN_IR.typography).map(([variant, style]) => [
          variant,
          style.size,
        ]),
      ),
    ).toEqual({
      h1: "4xl",
      h2: "xl",
      subtitle1: "lg",
      body1: "base",
      body2: "sm",
      caption: "xs",
      overline: "2xs",
    });
    expect(Object.keys(STUDIO_DESIGN_IR.inputs)).toEqual(["search"]);
    expect(Object.keys(STUDIO_DESIGN_IR.statuses)).toEqual([
      "available",
      "selected",
      "partial",
      "unavailable",
      "error",
    ]);
    expect(Object.keys(STUDIO_DESIGN_IR.pages)).toEqual([
      "select",
      "dashboard",
      "evidence",
      "trace",
    ]);
  });

  it("emits stable semantic attributes for inputs and status badges", () => {
    const html = renderToStaticMarkup(
      <div>
        <TextInput inputKind="search" aria-label="Search Tasks" />
        <StatusBadge status="selected">Selected</StatusBadge>
      </div>,
    );

    expect(html).toContain('data-input-kind="search"');
    expect(html).toContain('type="search"');
    expect(html).toContain('data-status="selected"');
  });

  it("compiles semantic props to deterministic DOM attributes", () => {
    render(
      <Surface aria-label="panel" level="panel">
        <Typography as="h2" variant="h2">
          Title
        </Typography>
        <ButtonGroup aria-label="actions">
          <Button appearance="solid" tone="primary">
            Run
          </Button>
        </ButtonGroup>
      </Surface>,
    );
    expect(screen.getByRole("region", { name: "panel" })).toHaveAttribute(
      "data-level",
      "panel",
    );
    expect(screen.getByRole("heading", { name: "Title" })).toHaveAttribute(
      "data-variant",
      "h2",
    );
    expect(screen.getByRole("button", { name: "Run" })).toHaveAttribute(
      "data-appearance",
      "solid",
    );
    expect(screen.getByRole("button", { name: "Run" })).toHaveAttribute(
      "data-tone",
      "primary",
    );
  });

  it("composes many text scenarios from a small variant and modifier vocabulary", () => {
    render(
      <Typography
        as="blockquote"
        family="mono"
        italic
        tone="secondary"
        truncate
        underline
        variant="body1"
        weight="medium"
      >
        Recorded quotation
      </Typography>,
    );

    const quotation = screen.getByText("Recorded quotation");
    expect(quotation).toHaveAttribute("data-variant", "body1");
    expect(quotation).toHaveAttribute("data-family", "mono");
    expect(quotation).toHaveAttribute("data-tone", "secondary");
    expect(quotation).toHaveAttribute("data-weight", "medium");
    expect(quotation).toHaveAttribute("data-italic", "true");
    expect(quotation).toHaveAttribute("data-underline", "true");
    expect(quotation).toHaveAttribute("data-truncate", "true");
  });

  it("keeps section and business-panel surfaces as distinct theme roles", () => {
    render(
      <div>
        <Surface aria-label="section" level="section" />
        <Surface aria-label="panel" level="panel" />
      </div>,
    );

    expect(screen.getByRole("region", { name: "section" })).toHaveAttribute(
      "data-level",
      "section",
    );
    expect(screen.getByRole("region", { name: "panel" })).toHaveAttribute(
      "data-level",
      "panel",
    );
  });

  it("gives compact icon actions one reusable accessible tooltip contract", () => {
    render(<IconButton aria-label="Reset focus">⌖</IconButton>);

    const button = screen.getByRole("button", { name: "Reset focus" });
    expect(button).toHaveAttribute("data-icon-button", "true");
    expect(button).toHaveAttribute("title", "Reset focus");
  });
});
