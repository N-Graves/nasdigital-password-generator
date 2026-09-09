/**
 * The alphabet a password is drawn from.
 *
 * Kept separate from generation because the alphabet is where every honest
 * claim on the page comes from: the entropy figure is a statement about this
 * string's length, and it is only true if what gets sampled is exactly this.
 */

export type ClassId = "lower" | "upper" | "digit" | "symbol";

export interface CharsetOptions {
  lower: boolean;
  upper: boolean;
  digit: boolean;
  symbol: boolean;
  excludeAmbiguous: boolean;
}

export interface CharClass {
  id: ClassId;
  chars: string;
}

export interface Charset {
  chars: string;
  classes: CharClass[];
}

const LOWER = "abcdefghijklmnopqrstuvwxyz";
const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGIT = "0123456789";

/**
 * ASCII punctuation minus " ' \ and ` - the four that cause real trouble when a
 * password is pasted into a shell command, a config file or a CSV, which is where
 * these end up often enough to matter. Dropping them costs about 0.19 bits per
 * character against the full set, and the entropy figure reflects the alphabet
 * actually in use, so the number on the page stays true either way.
 */
const SYMBOL = "!#$%&()*+,-./:;<=>?@[]^_{|}~";

/** Characters that read as each other in the fonts a password gets typed or read in. */
export const AMBIGUOUS = "0O1lI";

const CLASS_SOURCE: ReadonlyArray<readonly [ClassId, string]> = [
  ["lower", LOWER],
  ["upper", UPPER],
  ["digit", DIGIT],
  ["symbol", SYMBOL],
];

export const buildCharset = (opts: CharsetOptions): Charset => {
  const excluded = opts.excludeAmbiguous ? new Set(AMBIGUOUS) : new Set<string>();
  const classes: CharClass[] = [];

  for (const [id, source] of CLASS_SOURCE) {
    if (!opts[id]) continue;
    const chars = [...source].filter((c) => !excluded.has(c)).join("");
    if (chars.length > 0) classes.push({ id, chars });
  }

  const chars = classes.map((c) => c.chars).join("");
  if (chars.length === 0) {
    throw new RangeError("a password needs at least one kind of character to draw from");
  }
  return { chars, classes };
};
