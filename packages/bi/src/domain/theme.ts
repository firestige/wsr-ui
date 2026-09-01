export interface BiTheme {
  readonly mode: "light" | "dark";
  readonly density: "comfortable" | "compact";
  readonly containerBorderStyle: "solid" | "dashed";
  readonly surfaces?: Readonly<{
    section: string;
    panel: string;
    raised: string;
    inset: string;
  }>;
  readonly traceIndentGuides?: readonly [string, string, string, string];
}

export function createBiTheme({
  mode,
  density = "comfortable",
  containerBorderStyle = "solid",
  surfaces,
  traceIndentGuides,
}: {
  mode: BiTheme["mode"];
  density?: BiTheme["density"];
  containerBorderStyle?: BiTheme["containerBorderStyle"];
  surfaces?: BiTheme["surfaces"];
  traceIndentGuides?: BiTheme["traceIndentGuides"];
}): BiTheme {
  return Object.freeze({
    mode,
    density,
    containerBorderStyle,
    ...(surfaces === undefined
      ? {}
      : { surfaces: Object.freeze({ ...surfaces }) }),
    ...(traceIndentGuides === undefined
      ? {}
      : {
          traceIndentGuides: Object.freeze([
            ...traceIndentGuides,
          ]) as BiTheme["traceIndentGuides"],
        }),
  });
}
