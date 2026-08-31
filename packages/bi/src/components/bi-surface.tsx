import type { ReactNode } from "react";

export interface BiSurfaceProps {
  children: ReactNode;
  className?: string;
  density?: "comfortable" | "compact";
  theme?: "light" | "dark" | "system";
}

export function BiSurface({
  children,
  className,
  density = "comfortable",
  theme = "system",
}: BiSurfaceProps) {
  return (
    <div
      className={["wsr-bi", className].filter(Boolean).join(" ")}
      data-density={density}
      data-theme={theme}
    >
      {children}
    </div>
  );
}
