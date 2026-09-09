/**
 * Uniform random indices, and the one place the browser's CSPRNG is touched.
 *
 * The randomness is injected rather than reached for, so the interesting part -
 * that an index is uniform over the alphabet, with no value quietly more likely
 * than another - can be tested exactly instead of with a distribution histogram
 * that would pass either way.
 */

export type Random32 = () => number;

/**
 * The number of distinct Uint32 values, which is 2 ** 32 - deliberately not
 * 0xFFFFFFFF, which is the largest one. Off by one here is the classic bug in
 * this neighbourhood, though it bites in a way that is worth stating precisely:
 * as the rejection threshold below it is harmless, because for every alphabet
 * that is not a power of two the two expressions give the identical answer, and
 * for one that is, the range stays an exact multiple and so stays uniform.
 *
 * Where it genuinely breaks is the scaling form some generators use instead -
 * Math.floor(next() / 0xFFFFFFFF * n) returns n itself when next() is at its
 * maximum, which is one past the end of the alphabet. That splices the literal
 * text "undefined" into a password, silently, for about one password in
 * 2**32 / length. generate() carries a guard against exactly that.
 */
const UINT32_VALUES = 4294967296;

/** The largest multiple of n that fits in a Uint32; anything at or above it is rejected. */
export const acceptLimit = (n: number): number => {
  if (!Number.isInteger(n) || n < 1) {
    throw new RangeError(`an alphabet needs at least one character, got ${n}`);
  }
  return Math.floor(UINT32_VALUES / n) * n;
};

/**
 * An index in [0, n), uniform. Values at or above the accept limit are drawn
 * again rather than folded in with a bare modulo, which would make the first
 * (2**32 mod n) characters of the alphabet fractionally more likely than the rest.
 */
export const uniformIndex = (n: number, next: Random32, maxAttempts = 64): number => {
  const limit = acceptLimit(n);
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const value = next();
    if (value < limit) return value % n;
  }
  // Unreachable with a real CSPRNG - the chance of one rejection is under
  // n / 2**32 - so reaching here means the source is broken, and looping
  // forever on a broken source is worse than saying so.
  throw new Error(`the random source gave ${maxAttempts} values outside the usable range`);
};

/** Wraps crypto.getRandomValues. Never falls back to Math.random, which is not a CSPRNG. */
export const cryptoSource = (source?: Crypto): Random32 => {
  const provider = source ?? (typeof crypto === "undefined" ? undefined : crypto);
  if (!provider || typeof provider.getRandomValues !== "function") {
    throw new Error(
      "This browser has no crypto.getRandomValues. There is no safe fallback for a password.",
    );
  }
  const buffer = new Uint32Array(1);
  return () => {
    provider.getRandomValues(buffer);
    const value = buffer[0];
    if (value === undefined) throw new Error("the random buffer came back empty");
    return value;
  };
};
