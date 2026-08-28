import { describe, expect, it } from "vitest";

import { presentExactValue } from "./presentation";

describe("Metric Result presentation transforms", () => {
  it("formats an authoritative ratio as a two-decimal percent", () => {
    expect(
      presentExactValue({ kind: "RATIO", value: "1/3", unit: "ratio" }),
    ).toEqual({ display: "33.33%", exact: "1/3 ratio" });
  });

  it("rounds percent display without replacing the exact rational", () => {
    expect(
      presentExactValue({ kind: "RATIO", value: "2/3", unit: "ratio" }),
    ).toEqual({ display: "66.67%", exact: "2/3 ratio" });
  });

  it("does not pass a large exact integer through JavaScript Number", () => {
    expect(
      presentExactValue({
        kind: "COUNT",
        value: "9007199254740993",
        unit: "tokens",
      }),
    ).toEqual({
      display: "9,007,199,254,740,993 tokens",
      exact: "9007199254740993 tokens",
    });
  });

  it("keeps zero distinct from absence", () => {
    expect(
      presentExactValue({ kind: "COUNT", value: "0", unit: "calls" }),
    ).toEqual({ display: "0 calls", exact: "0 calls" });
  });
});
