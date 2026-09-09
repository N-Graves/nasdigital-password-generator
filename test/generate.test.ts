import { describe, expect, it } from "vitest";
import { buildCharset, type CharsetOptions } from "../src/charset.js";
import { classesPresent, generate } from "../src/generate.js";
import type { Random32 } from "../src/random.js";

const opts = (over: Partial<CharsetOptions>): CharsetOptions => ({
  lower: false,
  upper: false,
  digit: false,
  symbol: false,
  excludeAmbiguous: false,
  ...over,
});

/** Cycles through the values, so a test can ask for more characters than draws. */
const cycling = (...values: number[]): Random32 => {
  let i = 0;
  return () => {
    const value = values[i % values.length];
    i += 1;
    return value ?? 0;
  };
};

describe("generate", () => {
  it("produces exactly the length asked for", () => {
    const set = buildCharset(opts({ lower: true }));
    for (const n of [1, 8, 16, 64]) {
      expect(generate(set, n, cycling(0)).length).toBe(n);
    }
  });

  it("draws only from the alphabet it was given", () => {
    const set = buildCharset(opts({ digit: true, excludeAmbiguous: true }));
    const out = generate(set, 200, cycling(0, 1, 2, 3, 4, 5, 6, 7));
    for (const c of out) expect(set.chars).toContain(c);
    expect(out).not.toMatch(/[01]/);
  });

  it("maps each draw to the character at that index, in order", () => {
    const set = buildCharset(opts({ lower: true }));
    expect(generate(set, 4, cycling(0, 1, 2, 25))).toBe("abcz");
  });

  // The whole reason the alphabet and the draw are separable: the same source
  // must give the same password, or nothing above is testable.
  it("is deterministic for a given source", () => {
    const set = buildCharset(opts({ lower: true, upper: true, digit: true, symbol: true }));
    const script = () => cycling(3, 17, 42, 8, 61, 90, 12, 7);
    expect(generate(set, 32, script())).toBe(generate(set, 32, script()));
  });

  it.each([0, -1, 2.5])("refuses a length of %s", (n) => {
    expect(() => generate(buildCharset(opts({ lower: true })), n, cycling(0))).toThrow(RangeError);
  });

  // Uniform-from-union is deliberate, so this is a property of the design rather
  // than a bug: a short password can legitimately miss a selected class.
  it("does not guarantee one character from every selected class", () => {
    const set = buildCharset(opts({ lower: true, digit: true }));
    const allLower = generate(set, 4, cycling(0));
    expect(allLower).toBe("aaaa");
    expect(classesPresent(allLower, set)).toEqual(["lower"]);
  });
});

describe("classesPresent", () => {
  it("reports every class that actually turned up", () => {
    const set = buildCharset(opts({ lower: true, upper: true, digit: true, symbol: true }));
    expect(classesPresent("aB3!", set).sort()).toEqual(["digit", "lower", "symbol", "upper"]);
  });

  it("reports nothing for an empty password", () => {
    expect(classesPresent("", buildCharset(opts({ lower: true })))).toEqual([]);
  });

  it("never reports a class that was not selected", () => {
    const set = buildCharset(opts({ lower: true }));
    expect(classesPresent("aBc3!", set)).toEqual(["lower"]);
  });
});
