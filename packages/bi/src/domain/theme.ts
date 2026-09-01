export interface BiTheme {
  readonly mode: "light" | "dark";
  readonly density: "comfortable" | "compact";
  readonly containerBorderStyle: "solid" | "dashed";
}

export function createBiTheme({
  mode,
  density = "comfortable",
  containerBorderStyle = "solid",
}: {
  mode: BiTheme["mode"];
  density?: BiTheme["density"];
  containerBorderStyle?: BiTheme["containerBorderStyle"];
}): BiTheme {
  return Object.freeze({ mode, density, containerBorderStyle });
}
