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
  const style =
    typeof theme === "string"
      ? undefined
      : ({
          "--wsr-container-border-style": theme.containerBorderStyle,
          ...(theme.surfaces === undefined
            ? {}
            : {
                "--wsr-surface-section": theme.surfaces.section,
                "--wsr-surface-panel": theme.surfaces.panel,
                "--wsr-surface-raised": theme.surfaces.raised,
                "--wsr-surface-inset": theme.surfaces.inset,
              }),
          ...(theme.traceIndentGuides === undefined
            ? {}
            : {
                "--wsr-trace-indent-0": theme.traceIndentGuides[0],
                "--wsr-trace-indent-1": theme.traceIndentGuides[1],
                "--wsr-trace-indent-2": theme.traceIndentGuides[2],
                "--wsr-trace-indent-3": theme.traceIndentGuides[3],
              }),
        } as CSSProperties);
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
