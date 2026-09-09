import { describe, expect, it } from "vitest";
import { describeEntropy, entropyBits } from "../src/entropy.js";

describe("entropyBits", () => {
  // Exact, because these are the two the README quotes.
  it("is exact where the alphabet is a power of two", () => {
    expect(entropyBits(16, 8)).toBe(48);
    expect(entropyBits(12, 8)).toBe(36);
    expect(entropyBits(10, 2)).toBe(10);
  });

  it("matches the hand calculation for the real alphabets", () => {
    expect(entropyBits(16, 90)).toBeCloseTo(103.8696, 4);
    expect(entropyBits(16, 85)).toBeCloseTo(102.5503, 4);
  });

  // Excluding lookalikes shrinks the alphabet, so it costs bits. The figure has
  // to move, or the page would be claiming the exclusion is free.
  it("falls when the alphabet shrinks", () => {
    expect(entropyBits(16, 85)).toBeLessThan(entropyBits(16, 90));
    expect(entropyBits(16, 8)).toBeLessThan(entropyBits(16, 10));
  });

  it("rises with length, in proportion", () => {
    expect(entropyBits(32, 90)).toBeCloseTo(2 * entropyBits(16, 90), 10);
  });

  it("is zero when there is nothing to choose between", () => {
    expect(entropyBits(16, 1)).toBe(0);
    expect(entropyBits(0, 90)).toBe(0);
    expect(entropyBits(-4, 90)).toBe(0);
  });

  it("returns a number rather than NaN for nonsense input", () => {
    expect(entropyBits(Number.NaN, 90)).toBe(0);
    expect(entropyBits(16, Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("describeEntropy", () => {
  // It is a line of context, not a grade. What it must get right is the
  // distinction that actually differs by orders of magnitude: guessing at a
  // rate-limited login form versus cracking a leaked hash offline.
  it("separates the online and offline threat models in the middle band", () => {
    const middle = describeEntropy(45);
    expect(middle).toMatch(/login form/i);
    expect(middle).toMatch(/leak/i);
  });

  it("stops escalating once the number stops meaning anything", () => {
    expect(describeEntropy(128)).toBe(describeEntropy(415));
  });

  it("says something for every plausible value, and never the empty string", () => {
    for (const bits of [0, 20, 39, 40, 59, 60, 89, 90, 127, 128, 500]) {
      expect(describeEntropy(bits).length).toBeGreaterThan(10);
    }
  });

  it("changes its answer at each band it claims to have", () => {
    const bands = [20, 45, 70, 100, 200].map(describeEntropy);
    expect(new Set(bands).size).toBe(bands.length);
  });
});
