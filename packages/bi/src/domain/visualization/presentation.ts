import type { ExactValue } from "../evolution/types";

export interface PresentedValue {
  display: string;
  exact: string;
}

function groupedInteger(value: string): string {
  const negative = value.startsWith("-");
  const digits = negative ? value.slice(1) : value;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return negative ? `-${grouped}` : grouped;
}

function ratioParts(value: string): [bigint, bigint] {
  const [numerator, denominator] = value.split("/");
  return [BigInt(numerator!), BigInt(denominator ?? "1")];
}

function ratioPercent(value: string): string {
  const [numerator, denominator] = ratioParts(value);
  const negative = numerator < 0n;
  const absolute = negative ? -numerator : numerator;
  const scaled = absolute * 10_000n;
  let hundredths = scaled / denominator;
  if ((scaled % denominator) * 2n >= denominator) hundredths += 1n;
  const whole = hundredths / 100n;
  const fraction = String(hundredths % 100n).padStart(2, "0");
  return `${negative ? "-" : ""}${whole}.${fraction}%`;
}

export function presentExactValue(value: ExactValue): PresentedValue {
  const exact = `${String(value.value)} ${value.unit}`;
  if (value.kind === "RATIO")
    return { display: ratioPercent(value.value), exact };
  if (value.kind === "BOOLEAN") return { display: exact, exact };
  if (/^-?(?:0|[1-9][0-9]*)$/.test(value.value))
    return { display: `${groupedInteger(value.value)} ${value.unit}`, exact };
  return { display: exact, exact };
}
