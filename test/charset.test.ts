import { describe, expect, it } from "vitest";
import { AMBIGUOUS, buildCharset, type CharsetOptions } from "../src/charset.js";

const NONE: CharsetOptions = {
  lower: false,
  upper: false,
  digit: false,
  symbol: false,
  excludeAmbiguous: false,
};

const opts = (over: Partial<CharsetOptions>): CharsetOptions => ({ ...NONE, ...over });

const ALL_COMBINATIONS: CharsetOptions[] = [];
for (const lower of [false, true])
  for (const upper of [false, true])
    for (const digit of [false, true])
      for (const symbol of [false, true])
        for (const excludeAmbiguous of [false, true])
          ALL_COMBINATIONS.push({ lower, upper, digit, symbol, excludeAmbiguous });

const USABLE = ALL_COMBINATIONS.filter((o) => o.lower || o.upper || o.digit || o.symbol);

describe("buildCharset", () => {
  it("gives the four full classes when nothing is excluded", () => {
    const set = buildCharset(opts({ lower: true, upper: true, digit: true, symbol: true }));
    expect(set.chars.length).toBe(90);
    expect(set.classes.map((c) => c.id)).toEqual(["lower", "upper", "digit", "symbol"]);
  });

  it("drops exactly the ambiguous characters and nothing else", () => {
    const set = buildCharset(
      opts({ lower: true, upper: true, digit: true, symbol: true, excludeAmbiguous: true }),
    );
    expect(set.chars.length).toBe(85);
    for (const c of AMBIGUOUS) expect(set.chars).not.toContain(c);
    // The lookalikes go; their unambiguous neighbours stay.
    expect(set.chars).toContain("o");
    expect(set.chars).toContain("L");
    expect(set.chars).toContain("2");
  });

  // The exclusion is not free, and the tool says so. Eight characters is three
  // bits each, which is where a 16-character digits-only password gets 48 bits.
  it("leaves digits at eight characters once the lookalikes go", () => {
    expect(buildCharset(opts({ digit: true, excludeAmbiguous: true })).chars).toBe("23456789");
  });

  it("refuses to build an alphabet from nothing", () => {
    expect(() => buildCharset(NONE)).toThrow(RangeError);
    expect(() => buildCharset(opts({ excludeAmbiguous: true }))).toThrow(RangeError);
  });

  // A duplicate character silently inflates the claimed entropy, because the
  // bit count is computed from the alphabet's length.
  it.each(USABLE.map((o, i) => [i, o] as const))(
    "has no duplicate characters for combination %i",
    (_i, o) => {
      const set = buildCharset(o);
      expect(new Set([...set.chars]).size).toBe(set.chars.length);
    },
  );

  it.each(USABLE.map((o, i) => [i, o] as const))(
    "keeps classes and the joined alphabet in step for combination %i",
    (_i, o) => {
      const set = buildCharset(o);
      const fromClasses = set.classes.reduce((n, c) => n + c.chars.length, 0);
      expect(fromClasses).toBe(set.chars.length);
    },
  );

  it("only ever includes a class that was asked for", () => {
    const set = buildCharset(opts({ lower: true, digit: true }));
    expect(set.classes.map((c) => c.id)).toEqual(["lower", "digit"]);
    expect(set.chars).not.toMatch(/[A-Z]/);
    expect(set.chars).not.toMatch(/[!#$%&]/);
  });

  it("keeps the symbol set clear of the four that break shells and CSVs", () => {
    const set = buildCharset(opts({ symbol: true }));
    for (const c of ["\\", "`", '"', "'"]) expect(set.chars).not.toContain(c);
    expect(set.chars.length).toBe(28);
  });
});
