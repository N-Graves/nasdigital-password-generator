/**
 * The tripwire in generate() is unreachable while uniformIndex is correct, which
 * is precisely why it is worth pinning: it exists to catch a future edit to the
 * index maths, and an untested guard is indistinguishable from decoration.
 *
 * Its own file because the mock replaces the module for everything in the file.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("../src/random.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/random.js")>();
  // One past the end of any alphabet this tool builds - the exact shape the
  // scaling form of the index bug produces.
  return { ...actual, uniformIndex: () => 9999 };
});

const { buildCharset } = await import("../src/charset.js");
const { generate } = await import("../src/generate.js");

describe("when the index maths goes wrong", () => {
  const charset = buildCharset({
    lower: true,
    upper: false,
    digit: false,
    symbol: false,
    excludeAmbiguous: false,
  });

  it("throws rather than splicing the text 'undefined' into the password", () => {
    expect(() => generate(charset, 8, () => 0)).toThrow(RangeError);
  });

  it("says which index and which alphabet, so the cause is obvious", () => {
    expect(() => generate(charset, 8, () => 0)).toThrow(/9999.*alphabet of 26/);
  });

  // The failure this guards against is silent, not loud - the giveaway is that
  // the password would still look like a password.
  it("never returns a password containing the word undefined", () => {
    let produced: string | null = null;
    try {
      produced = generate(charset, 8, () => 0);
    } catch {
      produced = null;
    }
    expect(produced).toBeNull();
  });
});
