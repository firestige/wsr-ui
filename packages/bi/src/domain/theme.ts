type ThemeGroup<T> = Readonly<Partial<T>>;

export type BiDataPalette = readonly [string, ...string[]];

export interface BiPalette {
  readonly surface?: ThemeGroup<{
    section: string;
    panel: string;
    raised: string;
    inset: string;
  }>;
  readonly content?: ThemeGroup<{
    primary: string;
    secondary: string;
    muted: string;
    inverse: string;
  }>;
  readonly border?: ThemeGroup<{ default: string; strong: string }>;
  readonly interaction?: ThemeGroup<{
    accent: string;
    selection: string;
    disabled: string;
    focusRing: string;
  }>;
  readonly status?: ThemeGroup<{
    available: string;
    attention: string;
    unavailable: string;
    expired: string;
    incompatible: string;
    error: string;
  }>;
  readonly data?: BiDataPalette;
}

export type BiTypographyScale = ThemeGroup<{
  fontFamily: string;
  codeFontFamily: string;
  h1: string;
  h2: string;
  subtitle1: string;
  body1: string;
  body2: string;
  caption: string;
  overline: string;
}>;

export interface BiTheme {
  readonly mode: "light" | "dark";
  readonly density: "comfortable" | "compact";
  readonly containerBorderStyle: "solid" | "dashed";
  readonly palette?: Readonly<BiPalette>;
  readonly typography?: BiTypographyScale;
}

function freezePalette(palette: BiPalette): Readonly<BiPalette> {
  return Object.freeze({
    ...(palette.surface === undefined
      ? {}
      : { surface: Object.freeze({ ...palette.surface }) }),
    ...(palette.content === undefined
      ? {}
      : { content: Object.freeze({ ...palette.content }) }),
    ...(palette.border === undefined
      ? {}
      : { border: Object.freeze({ ...palette.border }) }),
    ...(palette.interaction === undefined
      ? {}
      : { interaction: Object.freeze({ ...palette.interaction }) }),
    ...(palette.status === undefined
      ? {}
      : { status: Object.freeze({ ...palette.status }) }),
    ...(palette.data === undefined
      ? {}
      : { data: Object.freeze([...palette.data]) as BiDataPalette }),
  });
}

export function createBiTheme({
  mode,
  density = "comfortable",
  containerBorderStyle = "solid",
  palette,
  typography,
}: {
  mode: BiTheme["mode"];
  density?: BiTheme["density"];
  containerBorderStyle?: BiTheme["containerBorderStyle"];
  palette?: BiTheme["palette"];
  typography?: BiTheme["typography"];
}): BiTheme {
  return Object.freeze({
    mode,
    density,
    containerBorderStyle,
    ...(palette === undefined ? {} : { palette: freezePalette(palette) }),
    ...(typography === undefined
      ? {}
      : { typography: Object.freeze({ ...typography }) }),
  });
}
