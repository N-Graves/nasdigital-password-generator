import { describe, expect, it, vi } from "vitest";
import { acceptLimit, cryptoSource, uniformIndex, type Random32 } from "../src/random.js";

/** A random source that hands back exactly the values given, then complains. */
const scripted = (...values: number[]): Random32 => {
  let i = 0;
  return () => {
    const value = values[i];
    i += 1;
    if (value === undefined) throw new Error(`scripted source exhausted after ${values.length}`);
    return value;
  };
};

const counted = (source: Random32): { next: Random32; draws: () => number } => {
  let draws = 0;
  return {
    next: () => {
      draws += 1;
      return source();
    },
    draws: () => draws,
  };
};

const MAX_UINT32 = 0xffffffff;

describe("acceptLimit", () => {
  // Exact values rather than a property, because the whole point is that this
  // number is not approximately right.
  it.each([
    [1, 4294967296],
    [8, 4294967296],
    [24, 4294967280],
    [25, 4294967275],
    [26, 4294967274],
    [28, 4294967292],
    [62, 4294967292],
    [85, 4294967295],
    [90, 4294967220],
  ])("is the largest multiple of %i that fits a Uint32", (n, expected) => {
    expect(acceptLimit(n)).toBe(expected);
  });

  it("is always an exact multiple of the alphabet size, which is what makes it uniform", () => {
    for (let n = 1; n <= 128; n += 1) expect(acceptLimit(n) % n).toBe(0);
  });

  it("uses the whole range when the alphabet is a power of two", () => {
    for (const n of [1, 2, 4, 8, 16, 32, 64]) expect(acceptLimit(n)).toBe(4294967296);
  });

  it.each([0, -1, 1.5, Number.NaN])("refuses %s as an alphabet size", (n) => {
    expect(() => acceptLimit(n)).toThrow(RangeError);
  });
});

describe("uniformIndex", () => {
  // The test that catches the classic mistake. A generator that scales instead of
  // rejecting - Math.floor(next() / 0xFFFFFFFF * n) - returns n here rather than
  // n-1, which is one past the end of the alphabet.
  it("maps the largest possible draw inside the alphabet, never one past its end", () => {
    expect(uniformIndex(8, scripted(MAX_UINT32))).toBe(7);
    expect(uniformIndex(64, scripted(MAX_UINT32))).toBe(63);
  });

  // 2**32 mod 85 is 1, so for this tool's own default alphabet exactly one draw
  // in 2**32 is rejected, and it is this one.
  it("rejects the single unusable draw for the default 85-character alphabet", () => {
    const source = counted(scripted(MAX_UINT32, 5));
    expect(uniformIndex(85, source.next)).toBe(5);
    expect(source.draws()).toBe(2);
  });

  // Drawing again rather than folding the value in is the difference between
  // uniform and "the first few characters are slightly more likely".
  it("draws again rather than reusing a value at the limit", () => {
    const source = counted(scripted(acceptLimit(62), 5));
    expect(uniformIndex(62, source.next)).toBe(5);
    expect(source.draws()).toBe(2);
  });

  it("accepts the value just below the limit without drawing again", () => {
    const source = counted(scripted(acceptLimit(62) - 1));
    expect(uniformIndex(62, source.next)).toBe((acceptLimit(62) - 1) % 62);
    expect(source.draws()).toBe(1);
  });

  // Deterministic rather than statistical: every residue, in order, three times.
  it("covers every index evenly across consecutive draws", () => {
    const n = 62;
    const values = Array.from({ length: n * 3 }, (_, i) => i);
    const source = scripted(...values);
    const got = values.map(() => uniformIndex(n, source));
    const wanted = [0, 1, 2].flatMap(() => Array.from({ length: n }, (_, i) => i));
    expect(got).toEqual(wanted);
  });

  it("always returns 0 for a single-character alphabet", () => {
    expect(uniformIndex(1, scripted(0, 12345, MAX_UINT32))).toBe(0);
  });

  it("gives up rather than looping forever on a source that never lands in range", () => {
    expect(() => uniformIndex(62, () => MAX_UINT32, 100)).toThrow(/outside the usable range/);
  });
});

describe("cryptoSource", () => {
  const fakeCrypto = (...values: number[]): Crypto => {
    let i = 0;
    return {
      getRandomValues: (array: ArrayBufferView) => {
        if (array instanceof Uint32Array) {
          array[0] = values[i] ?? 0;
          i += 1;
        }
        return array;
      },
    } as unknown as Crypto;
  };

  it("hands back what getRandomValues wrote", () => {
    const next = cryptoSource(fakeCrypto(7, 4294967290));
    expect(next()).toBe(7);
    expect(next()).toBe(4294967290);
  });

  // There is no safe fallback here, and Math.random is emphatically not one.
  it("refuses to run when the browser has no crypto", () => {
    expect(() => cryptoSource({} as Crypto)).toThrow(/no crypto.getRandomValues/);
  });

  it("refuses when getRandomValues is not a function", () => {
    expect(() => cryptoSource({ getRandomValues: "nope" } as unknown as Crypto)).toThrow();
  });

  it("asks the browser for fresh bytes on every single draw", () => {
    const getRandomValues = vi.fn((array: ArrayBufferView) => {
      if (array instanceof Uint32Array) array[0] = 42;
      return array;
    });
    const next = cryptoSource({ getRandomValues } as unknown as Crypto);
    next();
    next();
    next();
    expect(getRandomValues).toHaveBeenCalledTimes(3);
  });
});
