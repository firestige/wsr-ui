export const STUDIO_DESIGN_IR = Object.freeze({
  schemaVersion: "wsr.studio-design@1",
  typography: Object.freeze({
    pageTitle: Object.freeze({
      level: "page",
      family: "sans",
      emphasis: "strong",
    }),
    sectionTitle: Object.freeze({
      level: "section",
      family: "sans",
      emphasis: "strong",
    }),
    body: Object.freeze({ level: "body", family: "sans", emphasis: "regular" }),
    label: Object.freeze({
      level: "label",
      family: "sans",
      emphasis: "strong",
    }),
    caption: Object.freeze({
      level: "caption",
      family: "sans",
      emphasis: "regular",
    }),
    eyebrow: Object.freeze({
      level: "micro",
      family: "sans",
      emphasis: "strong",
      transform: "uppercase",
    }),
    code: Object.freeze({
      level: "caption",
      family: "mono",
      emphasis: "regular",
    }),
    value: Object.freeze({
      level: "value",
      family: "mono",
      emphasis: "strong",
    }),
  }),
  buttons: Object.freeze({
    primary: Object.freeze({
      appearance: "solid",
      tone: "primary",
      size: "compact",
    }),
    secondary: Object.freeze({
      appearance: "outline",
      tone: "neutral",
      size: "compact",
    }),
    ghost: Object.freeze({
      appearance: "ghost",
      tone: "neutral",
      size: "compact",
    }),
    danger: Object.freeze({
      appearance: "solid",
      tone: "danger",
      size: "compact",
    }),
    segment: Object.freeze({
      appearance: "segment",
      tone: "primary",
      size: "compact",
    }),
  }),
  inputs: Object.freeze({
    search: Object.freeze({
      kind: "search",
      size: "compact",
      surface: "inset",
    }),
  }),
  statuses: Object.freeze({
    available: Object.freeze({ tone: "primary", emphasis: "soft" }),
    selected: Object.freeze({ tone: "primary", emphasis: "soft" }),
    partial: Object.freeze({ tone: "warning", emphasis: "soft" }),
    unavailable: Object.freeze({ tone: "neutral", emphasis: "soft" }),
    error: Object.freeze({ tone: "danger", emphasis: "soft" }),
  }),
  surfaces: Object.freeze({
    header: Object.freeze({
      level: "section",
      border: "solid",
      radius: "panel",
    }),
    section: Object.freeze({
      level: "section",
      border: "solid",
      radius: "panel",
    }),
    panel: Object.freeze({ level: "panel", border: "solid", radius: "panel" }),
    inset: Object.freeze({
      level: "inset",
      border: "solid",
      radius: "control",
    }),
    notice: Object.freeze({
      level: "raised",
      border: "dashed",
      radius: "panel",
    }),
  }),
  spacing: Object.freeze(["tight", "control", "cluster", "grid", "section"]),
  pages: Object.freeze({
    select: Object.freeze(["header", "taskPopulation", "currentSelection"]),
    dashboard: Object.freeze(["header", "panelCanvas", "traceNotice"]),
    evidence: Object.freeze(["header", "evidenceContent"]),
    trace: Object.freeze([
      "header",
      "traceContext",
      "rendererNavigation",
      "renderer",
      "motion",
    ]),
  }),
});

export type StudioDesignIR = typeof STUDIO_DESIGN_IR;
