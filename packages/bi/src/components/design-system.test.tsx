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
      "pageTitle",
      "sectionTitle",
      "body",
      "label",
      "caption",
      "eyebrow",
      "code",
      "value",
    ]);
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
        <Typography as="h2" variant="sectionTitle">
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
      "sectionTitle",
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
