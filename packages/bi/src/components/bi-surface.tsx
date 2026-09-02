import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

import type { BiTheme } from "../domain/theme";

export interface BiSurfaceProps {
  children: ReactNode;
  className?: string;
  density?: "comfortable" | "compact";
  theme?: "light" | "dark" | "system" | BiTheme;
}

export function BiSurface({
  children,
  className,
  density,
  theme = "system",
}: BiSurfaceProps) {
  const resolvedTheme = typeof theme === "string" ? theme : theme.mode;
  const resolvedDensity =
    density ?? (typeof theme === "string" ? "comfortable" : theme.density);
  let style: CSSProperties | undefined;
  if (typeof theme !== "string") {
    const themeStyle: Record<string, string> = {
      "--wsr-container-border-style": theme.containerBorderStyle,
    };
    const setToken = (name: string, value: string | undefined) => {
      if (value !== undefined) themeStyle[name] = value;
    };
    const palette = theme.palette;
    setToken("--wsr-surface-section", palette?.surface?.section);
    setToken("--wsr-surface-panel", palette?.surface?.panel);
    setToken("--wsr-surface-raised", palette?.surface?.raised);
    setToken("--wsr-surface-inset", palette?.surface?.inset);
    setToken("--content-primary", palette?.content?.primary);
    setToken("--content-secondary", palette?.content?.secondary);
    setToken("--content-muted", palette?.content?.muted);
    setToken("--content-inverse", palette?.content?.inverse);
    setToken("--border-default", palette?.border?.default);
    setToken("--border-strong", palette?.border?.strong);
    setToken("--interaction-accent", palette?.interaction?.accent);
    setToken("--interaction-selection", palette?.interaction?.selection);
    setToken("--interaction-disabled", palette?.interaction?.disabled);
    setToken("--focus-ring", palette?.interaction?.focusRing);
    setToken("--status-available", palette?.status?.available);
    setToken("--status-attention", palette?.status?.attention);
    setToken("--status-warning", palette?.status?.attention);
    setToken("--status-unavailable", palette?.status?.unavailable);
    setToken("--status-expired", palette?.status?.expired);
    setToken("--status-incompatible", palette?.status?.incompatible);
    setToken("--status-error", palette?.status?.error);
    if (palette?.data !== undefined)
      Array.from({ length: 6 }, (_, index) =>
        setToken(
          `--data-series-${index + 1}`,
          palette.data?.[index % palette.data.length],
        ),
      );
    setToken("--wsr-font-family", theme.typography?.fontFamily);
    setToken("--wsr-code-font-family", theme.typography?.codeFontFamily);
    setToken("--wsr-type-h1", theme.typography?.h1);
    setToken("--wsr-type-h2", theme.typography?.h2);
    setToken("--wsr-type-subtitle1", theme.typography?.subtitle1);
    setToken("--wsr-type-body1", theme.typography?.body1);
    setToken("--wsr-type-body2", theme.typography?.body2);
    setToken("--wsr-type-caption", theme.typography?.caption);
    setToken("--wsr-type-overline", theme.typography?.overline);
    style = themeStyle as CSSProperties;
  }
  return (
    <div
      className={["wsr-bi", className].filter(Boolean).join(" ")}
      data-density={resolvedDensity}
      data-theme={resolvedTheme}
      style={style}
    >
      {children}
    </div>
  );
}

export function BiSection({
  className,
  ...props
}: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={["bi-section", className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}

export function BiCard({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <article
      className={["bi-card", className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}
