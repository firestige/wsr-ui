import type {
  ButtonHTMLAttributes,
  ElementType,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from "react";

type TypographyVariant =
  | "pageTitle"
  | "sectionTitle"
  | "body"
  | "label"
  | "caption"
  | "eyebrow"
  | "code"
  | "value";
type ButtonAppearance = "solid" | "outline" | "ghost" | "segment";
type Tone = "neutral" | "primary" | "danger";
type SurfaceLevel = "section" | "panel" | "inset" | "raised";
type Status = "available" | "selected" | "partial" | "unavailable" | "error";

export function Typography({
  as: Tag = "span",
  variant,
  className,
  ...props
}: HTMLAttributes<HTMLElement> & {
  as?: ElementType;
  variant: TypographyVariant;
}) {
  return (
    <Tag
      className={["wsr-typography", className].filter(Boolean).join(" ")}
      data-variant={variant}
      {...props}
    />
  );
}

export function Button({
  appearance = "outline",
  tone = "neutral",
  size = "compact",
  selected,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  appearance?: ButtonAppearance;
  tone?: Tone;
  size?: "compact" | "regular";
  selected?: boolean;
}) {
  return (
    <button
      aria-pressed={appearance === "segment" ? selected : props["aria-pressed"]}
      className={["wsr-button", className].filter(Boolean).join(" ")}
      data-appearance={appearance}
      data-size={size}
      data-tone={tone}
      {...props}
    />
  );
}

export function IconButton({
  "aria-label": label,
  title,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  "aria-label": string;
  appearance?: ButtonAppearance;
  tone?: Tone;
  size?: "compact" | "regular";
  selected?: boolean;
}) {
  return (
    <Button
      aria-label={label}
      data-icon-button="true"
      title={title ?? label}
      {...props}
    >
      {children}
    </Button>
  );
}

export function ButtonGroup({
  segmented = false,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { segmented?: boolean }) {
  return (
    <div
      className={["wsr-button-group", className].filter(Boolean).join(" ")}
      data-segmented={segmented || undefined}
      role={segmented ? "group" : props.role}
      {...props}
    />
  );
}

export function Surface({
  as: Tag = "section",
  level = "section",
  border = "solid",
  className,
  children,
  ...props
}: HTMLAttributes<HTMLElement> & {
  as?: ElementType;
  level?: SurfaceLevel;
  border?: "solid" | "dashed" | "none";
  children?: ReactNode;
}) {
  return (
    <Tag
      className={["wsr-surface", className].filter(Boolean).join(" ")}
      data-border={border}
      data-level={level}
      {...props}
    >
      {children}
    </Tag>
  );
}

export function Divider(props: HTMLAttributes<HTMLHRElement>) {
  return (
    <hr
      className={["wsr-divider", props.className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}

export function TextInput({
  inputKind = "search",
  className,
  type,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { inputKind?: "search" }) {
  return (
    <input
      className={["wsr-input", className].filter(Boolean).join(" ")}
      data-input-kind={inputKind}
      type={type ?? inputKind}
      {...props}
    />
  );
}

export function StatusBadge({
  status,
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { status: Status }) {
  return (
    <span
      className={["wsr-status-badge", className].filter(Boolean).join(" ")}
      data-status={status}
      {...props}
    />
  );
}
