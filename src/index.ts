/**
 * The DOM half. Everything with a decision in it lives in the pure modules;
 * this finds the controls the page already ships, wires them, and renders.
 *
 * Two things here are deliberate and easy to get wrong the other way:
 *
 * The password is written into an <output>, never an <input>. In an input,
 * Chrome and Safari password managers offer to save it and autofill will
 * sometimes overwrite it - which is storage by proxy, on a tool whose whole
 * claim is that it stores nothing.
 *
 * And it is blanked on pagehide. Without that, navigating away and pressing
 * Back brings the page out of the bfcache with the last password still sitting
 * on screen, which is not what anyone expects of a thing that says it keeps
 * nothing.
 */

import { copyText, mount } from "@nasdigitaluk/withnate-tool-core";
import { buildCharset, type CharsetOptions, type ClassId } from "./charset.js";
import { describeEntropy, entropyBits } from "./entropy.js";
import { MAX_LENGTH, MIN_LENGTH, classesPresent, generate } from "./generate.js";
import { cryptoSource, type Random32 } from "./random.js";

const CLASS_NAMES: Record<ClassId, string> = {
  lower: "lower-case letter",
  upper: "capital letter",
  digit: "digit",
  symbol: "symbol",
};

const list = (items: string[]): string =>
  items.length <= 1
    ? (items[0] ?? "")
    : `${items.slice(0, -1).join(", ")} or ${items[items.length - 1] ?? ""}`;

const clampLength = (raw: string): number => {
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value)) return 16;
  return Math.min(MAX_LENGTH, Math.max(MIN_LENGTH, value));
};

const modifierKey = (): string => {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const platform = nav.userAgentData?.platform ?? navigator.platform ?? "";
  return /mac|iphone|ipad/i.test(platform) ? "⌘" : "Ctrl";
};

mount("[data-pwg]", ({ root }) => {
  const output = root.querySelector<HTMLElement>("[data-pwg-output]");
  const lengthInput = root.querySelector<HTMLInputElement>("[data-pwg-length]");
  const lengthLabel = root.querySelector<HTMLElement>("[data-pwg-length-label]");
  const ambiguous = root.querySelector<HTMLInputElement>("[data-pwg-ambiguous]");
  const entropyOut = root.querySelector<HTMLElement>("[data-pwg-entropy]");
  const note = root.querySelector<HTMLElement>("[data-pwg-note]");
  const status = root.querySelector<HTMLElement>("[data-pwg-status]");
  const copyButton = root.querySelector<HTMLButtonElement>("[data-pwg-copy]");
  const generateButton = root.querySelector<HTMLButtonElement>("[data-pwg-generate]");
  const boxes = Array.from(root.querySelectorAll<HTMLInputElement>("[data-pwg-class]"));

  // A tool script is loaded on one page and must do nothing on every other one.
  if (!output || !lengthInput || boxes.length === 0) return;

  let source: Random32;
  try {
    source = cryptoSource();
  } catch (error) {
    output.textContent = "";
    if (note) {
      note.textContent =
        error instanceof Error ? error.message : "This browser cannot generate secure randomness.";
    }
    return;
  }

  let current = "";

  const say = (el: HTMLElement | null, text: string): void => {
    if (el) el.textContent = text;
  };

  const readOptions = (): CharsetOptions => {
    const on = (id: string): boolean =>
      boxes.some((b) => b.dataset["pwgClass"] === id && b.checked);
    return {
      lower: on("lower"),
      upper: on("upper"),
      digit: on("digit"),
      symbol: on("symbol"),
      excludeAmbiguous: ambiguous?.checked ?? false,
    };
  };

  const render = (): void => {
    const length = clampLength(lengthInput.value);
    say(lengthLabel, String(length));

    const charset = buildCharset(readOptions());
    current = generate(charset, length, source);
    output.textContent = current;

    const bits = entropyBits(length, charset.chars.length);
    say(
      entropyOut,
      `${Math.round(bits)} bits, drawn from ${charset.chars.length} possible characters. ` +
        describeEntropy(bits),
    );

    // Uniform-from-union is the design, so a class can legitimately not turn up.
    // Reported rather than corrected, because correcting it is what makes the
    // bit count above a slight lie.
    const present = new Set(classesPresent(current, charset));
    const missing = charset.classes.filter((c) => !present.has(c.id)).map((c) => CLASS_NAMES[c.id]);
    say(
      note,
      missing.length === 0
        ? ""
        : `No ${list(missing)} happened to come up. Generate again if a site insists on one.`,
    );
    say(status, "");
  };

  for (const box of boxes) {
    box.addEventListener("change", () => {
      const opts = readOptions();
      if (!opts.lower && !opts.upper && !opts.digit && !opts.symbol) {
        box.checked = true;
        say(status, "A password needs at least one kind of character, so that one stays on.");
        return;
      }
      render();
    });
  }

  lengthInput.addEventListener("input", render);
  ambiguous?.addEventListener("change", render);
  generateButton?.addEventListener("click", render);

  copyButton?.addEventListener("click", () => {
    if (!current) return;
    const label = copyButton.textContent ?? "Copy";
    // copyText is called with the string already in hand and before anything is
    // awaited, because WebKit refuses a clipboard write that is not inside the
    // user-gesture task.
    void copyText(current).then(({ ok }) => {
      if (ok) {
        copyButton.textContent = "Copied";
        say(status, "Password copied to the clipboard.");
        window.setTimeout(() => {
          copyButton.textContent = label;
        }, 1600);
        return;
      }
      const selection = window.getSelection();
      if (selection) {
        const range = document.createRange();
        range.selectNodeContents(output);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      say(status, `This browser would not let the page copy it. Press ${modifierKey()}-C.`);
    });
  });

  // Coming back through the bfcache would otherwise show the previous password.
  window.addEventListener("pagehide", () => {
    current = "";
    output.textContent = "";
    say(status, "");
  });
  window.addEventListener("pageshow", (event) => {
    if ((event as PageTransitionEvent).persisted) render();
  });

  render();
});
