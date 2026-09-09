/*! nasdigital-password-generator v0.1.0 - MIT
 * https://github.com/N-Graves/nasdigital-password-generator#readme
 * Runs entirely in the browser. No network requests, no storage.
 */
"use strict";
(() => {
  // node_modules/@nasdigitaluk/withnate-tool-core/dist/sniff.js
  var HEADER_BYTES = 64 * 1024;

  // node_modules/@nasdigitaluk/withnate-tool-core/dist/units.js
  var MM_PER_INCH = 25.4;
  var CM_PER_INCH = MM_PER_INCH / 10;

  // node_modules/@nasdigitaluk/withnate-tool-core/dist/exif.js
  var MAX_BLOCK_BYTES = 4 * 1024 * 1024;
  var TEXT = new TextDecoder("utf-8", { fatal: false });

  // node_modules/@nasdigitaluk/withnate-tool-core/dist/mount.js
  var getWn = () => globalThis.WN ?? null;
  var mount = (selector, init) => {
    const run = () => {
      const root = document.querySelector(selector);
      if (!root)
        return;
      const wn = getWn();
      const reduced = wn?.reduced ?? (typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)").matches : true);
      init({ root, wn, reduced });
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", run, { once: true });
    } else {
      run();
    }
  };

  // node_modules/@nasdigitaluk/withnate-tool-core/dist/clipboard.js
  var clipboardOf = (doc) => {
    const view = doc.defaultView;
    const nav = view?.navigator ?? (typeof navigator === "undefined" ? void 0 : navigator);
    return nav?.clipboard;
  };
  var selectAndCopy = (text, doc) => {
    if (!doc.body || typeof doc.execCommand !== "function")
      return { ok: false, method: "manual" };
    const previous = doc.activeElement instanceof HTMLElement ? doc.activeElement : null;
    const field = doc.createElement("textarea");
    field.value = text;
    field.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;padding:0;border:0;opacity:0;";
    field.readOnly = true;
    field.contentEditable = "true";
    doc.body.append(field);
    try {
      field.focus();
      field.select();
      field.setSelectionRange(0, text.length);
      return doc.execCommand("copy") ? { ok: true, method: "exec-command" } : { ok: false, method: "manual" };
    } catch {
      return { ok: false, method: "manual" };
    } finally {
      field.remove();
      previous?.focus();
    }
  };
  var copyText = async (text, doc = document) => {
    const clipboard = clipboardOf(doc);
    if (clipboard && typeof clipboard.writeText === "function") {
      try {
        await clipboard.writeText(text);
        return { ok: true, method: "clipboard" };
      } catch {
      }
    }
    return selectAndCopy(text, doc);
  };

  // src/charset.ts
  var LOWER = "abcdefghijklmnopqrstuvwxyz";
  var UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  var DIGIT = "0123456789";
  var SYMBOL = "!#$%&()*+,-./:;<=>?@[]^_{|}~";
  var AMBIGUOUS = "0O1lI";
  var CLASS_SOURCE = [
    ["lower", LOWER],
    ["upper", UPPER],
    ["digit", DIGIT],
    ["symbol", SYMBOL]
  ];
  var buildCharset = (opts) => {
    const excluded = opts.excludeAmbiguous ? new Set(AMBIGUOUS) : /* @__PURE__ */ new Set();
    const classes = [];
    for (const [id, source] of CLASS_SOURCE) {
      if (!opts[id]) continue;
      const chars2 = [...source].filter((c) => !excluded.has(c)).join("");
      if (chars2.length > 0) classes.push({ id, chars: chars2 });
    }
    const chars = classes.map((c) => c.chars).join("");
    if (chars.length === 0) {
      throw new RangeError("a password needs at least one kind of character to draw from");
    }
    return { chars, classes };
  };

  // src/entropy.ts
  var entropyBits = (length, alphabetSize) => {
    if (!Number.isFinite(length) || !Number.isFinite(alphabetSize)) return 0;
    if (length <= 0 || alphabetSize <= 1) return 0;
    return length * Math.log2(alphabetSize);
  };
  var describeEntropy = (bits) => {
    if (bits >= 128) return "Beyond brute force by any margin that will ever matter.";
    if (bits >= 90) return "Comfortably beyond cracking, even from a leaked password database.";
    if (bits >= 60) return "Safe against guessing at a login form, and a hard offline crack.";
    if (bits >= 40) return "Fine against guessing at a login form; weak if the site leaks its hashes.";
    return "Short. More length buys more here than more character types do.";
  };

  // src/random.ts
  var UINT32_VALUES = 4294967296;
  var acceptLimit = (n) => {
    if (!Number.isInteger(n) || n < 1) {
      throw new RangeError(`an alphabet needs at least one character, got ${n}`);
    }
    return Math.floor(UINT32_VALUES / n) * n;
  };
  var uniformIndex = (n, next, maxAttempts = 64) => {
    const limit = acceptLimit(n);
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const value = next();
      if (value < limit) return value % n;
    }
    throw new Error(`the random source gave ${maxAttempts} values outside the usable range`);
  };
  var cryptoSource = (source) => {
    const provider = source ?? (typeof crypto === "undefined" ? void 0 : crypto);
    if (!provider || typeof provider.getRandomValues !== "function") {
      throw new Error(
        "This browser has no crypto.getRandomValues. There is no safe fallback for a password."
      );
    }
    const buffer = new Uint32Array(1);
    return () => {
      provider.getRandomValues(buffer);
      const value = buffer[0];
      if (value === void 0) throw new Error("the random buffer came back empty");
      return value;
    };
  };

  // src/generate.ts
  var MIN_LENGTH = 8;
  var MAX_LENGTH = 64;
  var generate = (charset, length, next) => {
    if (!Number.isInteger(length) || length < 1) {
      throw new RangeError(`a password needs a whole number of characters, got ${length}`);
    }
    const alphabet = charset.chars;
    let out = "";
    for (let i = 0; i < length; i += 1) {
      const index = uniformIndex(alphabet.length, next);
      const char = alphabet[index];
      if (char === void 0) {
        throw new RangeError(`index ${index} is outside an alphabet of ${alphabet.length}`);
      }
      out += char;
    }
    return out;
  };
  var classesPresent = (password, charset) => {
    const chars = /* @__PURE__ */ new Set([...password]);
    return charset.classes.filter((c) => [...c.chars].some((ch) => chars.has(ch))).map((c) => c.id);
  };

  // src/index.ts
  var CLASS_NAMES = {
    lower: "lower-case letter",
    upper: "capital letter",
    digit: "digit",
    symbol: "symbol"
  };
  var list = (items) => items.length <= 1 ? items[0] ?? "" : `${items.slice(0, -1).join(", ")} or ${items[items.length - 1] ?? ""}`;
  var clampLength = (raw) => {
    const value = Number.parseInt(raw, 10);
    if (!Number.isFinite(value)) return 16;
    return Math.min(MAX_LENGTH, Math.max(MIN_LENGTH, value));
  };
  var modifierKey = () => {
    const nav = navigator;
    const platform = nav.userAgentData?.platform ?? navigator.platform ?? "";
    return /mac|iphone|ipad/i.test(platform) ? "\u2318" : "Ctrl";
  };
  mount("[data-pwg]", ({ root }) => {
    const output = root.querySelector("[data-pwg-output]");
    const lengthInput = root.querySelector("[data-pwg-length]");
    const lengthLabel = root.querySelector("[data-pwg-length-label]");
    const ambiguous = root.querySelector("[data-pwg-ambiguous]");
    const entropyOut = root.querySelector("[data-pwg-entropy]");
    const note = root.querySelector("[data-pwg-note]");
    const status = root.querySelector("[data-pwg-status]");
    const copyButton = root.querySelector("[data-pwg-copy]");
    const generateButton = root.querySelector("[data-pwg-generate]");
    const boxes = Array.from(root.querySelectorAll("[data-pwg-class]"));
    if (!output || !lengthInput || boxes.length === 0) return;
    let source;
    try {
      source = cryptoSource();
    } catch (error) {
      output.textContent = "";
      if (note) {
        note.textContent = error instanceof Error ? error.message : "This browser cannot generate secure randomness.";
      }
      return;
    }
    let current = "";
    const say = (el, text) => {
      if (el) el.textContent = text;
    };
    const readOptions = () => {
      const on = (id) => boxes.some((b) => b.dataset["pwgClass"] === id && b.checked);
      return {
        lower: on("lower"),
        upper: on("upper"),
        digit: on("digit"),
        symbol: on("symbol"),
        excludeAmbiguous: ambiguous?.checked ?? false
      };
    };
    const render = () => {
      const length = clampLength(lengthInput.value);
      say(lengthLabel, String(length));
      const charset = buildCharset(readOptions());
      current = generate(charset, length, source);
      output.textContent = current;
      const bits = entropyBits(length, charset.chars.length);
      say(
        entropyOut,
        `${Math.round(bits)} bits, drawn from ${charset.chars.length} possible characters. ` + describeEntropy(bits)
      );
      const present = new Set(classesPresent(current, charset));
      const missing = charset.classes.filter((c) => !present.has(c.id)).map((c) => CLASS_NAMES[c.id]);
      say(
        note,
        missing.length === 0 ? "" : `No ${list(missing)} happened to come up. Generate again if a site insists on one.`
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
    window.addEventListener("pagehide", () => {
      current = "";
      output.textContent = "";
      say(status, "");
    });
    window.addEventListener("pageshow", (event) => {
      if (event.persisted) render();
    });
    render();
  });
})();
