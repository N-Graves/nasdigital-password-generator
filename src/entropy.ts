/**
 * How much guessing a password is actually worth, in bits.
 *
 * A number with one line of context, not a Weak/Medium/Strong meter. Those
 * meters mislead in both directions - a long dictionary phrase scores well on
 * character variety while being trivially guessable, and this tool has no
 * wordlist to check against, so it must not imply it does.
 *
 * The line of context distinguishes the two threat models that actually differ,
 * because they differ by many orders of magnitude: someone guessing at a login
 * form, which is rate-limited, and someone cracking a leaked hash offline on
 * their own hardware, which is not.
 */

export const entropyBits = (length: number, alphabetSize: number): number => {
  if (!Number.isFinite(length) || !Number.isFinite(alphabetSize)) return 0;
  if (length <= 0 || alphabetSize <= 1) return 0;
  return length * Math.log2(alphabetSize);
};

export const describeEntropy = (bits: number): string => {
  if (bits >= 128) return "Beyond brute force by any margin that will ever matter.";
  if (bits >= 90) return "Comfortably beyond cracking, even from a leaked password database.";
  if (bits >= 60) return "Safe against guessing at a login form, and a hard offline crack.";
  if (bits >= 40) return "Fine against guessing at a login form; weak if the site leaks its hashes.";
  return "Short. More length buys more here than more character types do.";
};
