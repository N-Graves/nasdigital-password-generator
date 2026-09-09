/**
 * Drawing the password itself.
 *
 * Every character is drawn uniformly from the whole alphabet, and deliberately
 * NOT with a guarantee of one from each selected class. The common
 * implementation - pick one of each, fill the rest, then shuffle - biases the
 * distribution and makes the advertised entropy figure a slight lie. Since the
 * point of showing a bit count is that it is honest, the generation has to be
 * the thing that count actually describes.
 *
 * The cost is real and is stated on the page: a short password may happen to
 * contain no symbol, and a site with composition rules may want a re-roll.
 */

import type { Charset, ClassId } from "./charset.js";
import { uniformIndex, type Random32 } from "./random.js";

export const MIN_LENGTH = 8;
export const MAX_LENGTH = 64;

export const generate = (charset: Charset, length: number, next: Random32): string => {
  if (!Number.isInteger(length) || length < 1) {
    throw new RangeError(`a password needs a whole number of characters, got ${length}`);
  }

  const alphabet = charset.chars;
  let out = "";

  for (let i = 0; i < length; i += 1) {
    const index = uniformIndex(alphabet.length, next);
    const char = alphabet[index];
    // Unreachable while uniformIndex is right, and kept because this is exactly
    // where the classic off-by-one surfaces: an index one past the end appends
    // the text "undefined" rather than failing, and nobody notices for years.
    if (char === undefined) {
      throw new RangeError(`index ${index} is outside an alphabet of ${alphabet.length}`);
    }
    out += char;
  }

  return out;
};

/** Which of the selected classes actually turned up. Reported, never enforced. */
export const classesPresent = (password: string, charset: Charset): ClassId[] => {
  const chars = new Set([...password]);
  return charset.classes.filter((c) => [...c.chars].some((ch) => chars.has(ch))).map((c) => c.id);
};
