# nasdigital-password-generator

Set a length, pick which characters are allowed, get a password. It is generated on your own device
by the browser's own cryptographic random number generator, and it is never sent anywhere and never
stored.

Built for [nasdigital.co.uk](https://nasdigital.co.uk) as a drop-in artefact: one IIFE, one
stylesheet, and a demo page.

## The one that makes it different: a number, not a meter

Weak/Medium/Strong meters mislead in both directions. A long dictionary phrase scores well on
character variety while being trivially guessable, and a genuinely strong password reads as "medium"
for happening to contain no symbol. This shows the actual figure — how many bits of guessing the
password is worth, given the alphabet it was drawn from — with one line of context separating the
two threats that differ by orders of magnitude: guessing at a rate-limited login form, and cracking
a leaked hash offline on your own hardware.

That figure is only honest if it describes what the code actually does, which is why the next section
exists.

## Every character is drawn uniformly, and that is a decision

Each character comes from the whole allowed alphabet with equal probability. The common alternative —
guarantee one character from each selected class, then shuffle — sounds more thorough and is slightly
worse: it skews the distribution and makes `length × log₂(alphabet)` a small lie.

The cost is real and the tool says so rather than hiding it: a short password may happen to contain
no symbol, and the note under the result tells you when that has happened so you can generate
another. Reported, never corrected.

## The off-by-one everyone names here is not the one that bites

Rejection sampling needs the largest multiple of the alphabet size that fits a `Uint32`. It is
usually written `Math.floor(2 ** 32 / n) * n`, and using `0xFFFFFFFF` instead is the classic warning.

Checked rather than repeated: **as a rejection threshold that mistake is harmless.** For every
alphabet that is not a power of two — 85, 90, 62, 26 — the two expressions give an identical answer,
and for one that is (digits with lookalikes removed is exactly 8) the accepted range stays an exact
multiple of `n` and so stays uniform. It costs about `n` wasted draws in four billion.

What genuinely breaks is the **scaling** form some generators use instead:

```js
Math.floor(next() / 0xFFFFFFFF * n)   // returns n itself at the maximum draw
Math.floor(next() / 4294967296 * n)   // right
```

One past the end of the alphabet appends the string `"undefined"` to a password, silently, for
roughly one password in `2**32 / length`. `generate()` carries a tripwire that throws instead, and
that tripwire has its own test — an unreachable guard is indistinguishable from decoration.

A pleasing accident falls out of this: `2**32 mod 85` is **1**, so for the default alphabet exactly
one draw in four billion is rejected, and it is `0xFFFFFFFF` — the same value the scaling bug breaks
on. One test case covers both.

## The alphabet

| Class | Characters | With lookalikes removed |
|---|---|---|
| Lower case | `a`–`z` | 25 (no `l`) |
| Capitals | `A`–`Z` | 24 (no `O`, `I`) |
| Digits | `0`–`9` | 8 (no `0`, `1`) |
| Symbols | `` !#$%&()*+,-./:;<=>?@[]^_{|}~ `` | 28, unchanged |

Symbols are ASCII punctuation minus `"`, `'`, `\` and `` ` `` — the four that cause real trouble when
a password is pasted into a shell command, a config file or a CSV. That costs about 0.19 bits per
character against the full set, and the figure on the page reflects the alphabet actually in use, so
the number stays true either way.

Leaving out the lookalikes is not free either: it takes the default alphabet from 90 characters to
85, and the bit count moves when you toggle it rather than pretending otherwise.

## What it refuses to do

**No storage, no history, no vault.** There is no way to get a password back once it is off the
screen. Adding any of that would turn a tool with nothing to protect into one that needs a security
posture it was never designed for.

**No strength check on a password you type.** Doing that properly means a breached-password lookup,
which means sending it somewhere, and not sending anything anywhere is the whole reason this is a
browser tool rather than a web service.

**Never `Math.random`.** If `crypto.getRandomValues` is missing the tool says so and stops. There is
no fallback, because a generator that quietly degrades to a non-cryptographic source looks identical
from the outside and is worthless.

## Integration

Copy `dist/password-generator.js` and `dist/password-generator.css` into the site's assets. The
script is a plain IIFE and does nothing unless the page contains `[data-pwg]`.

The markup lives in the page and the bundle **finds** it — nothing is created. A missing hook is not
an error; that control simply does not work, and the tool no-ops entirely if `[data-pwg]`,
`[data-pwg-output]`, `[data-pwg-length]` or the class checkboxes are absent.

| Attribute | On | Purpose |
|---|---|---|
| `data-pwg` | the root `<section>` | Mount point. Nothing runs without it |
| `data-pwg-output` | an `<output>` | Where the password is written — see below |
| `data-pwg-copy` | a `<button>` | Copy to clipboard |
| `data-pwg-entropy` | a `<p>` | The bit count and its line of context |
| `data-pwg-note` | a `<p>` | Which selected class did not turn up. **Not** a live region |
| `data-pwg-status` | a `<p role="status">` | Copy result and the last-class refusal. The only live region |
| `data-pwg-length` | `<input type="range">` | 8 to 64 |
| `data-pwg-length-label` | any element | Shows the current length |
| `data-pwg-class` | `<input type="checkbox">` | Value is `lower`, `upper`, `digit` or `symbol` |
| `data-pwg-ambiguous` | `<input type="checkbox">` | Leave out `0 O 1 l I` |
| `data-pwg-generate` | a `<button>` | Draw another |

Three details in that table are load-bearing rather than stylistic:

- **The output must not be an `<input>`.** In an input, Chrome and Safari password managers offer to
  save the value and autofill will sometimes overwrite it — storage by proxy, on a tool whose whole
  claim is that it stores nothing.
- **Only one live region.** The note rewrites on every draw, so announcing it would fire a torrent
  while the length slider is being dragged. The status carries the things that are genuinely events.
- **Do not put `data-reveal` on anything the tool writes into.** nasdigital's `fx.js` snapshots
  `[data-reveal]` once at load, so an element it injects afterwards stays at `opacity: 0` forever.

The stylesheet defers to the host page's tokens — `--text`, `--line`, `--accent`, `--f-mono` and a
few others — with standalone fallbacks, so it takes the site's identity without either page knowing
about the other.

## Structured data

`demo/index.html` carries a `WebApplication` block for the site to lift. It claims no rating and no
review count, because there aren't any and inventing them is a manual action.

## Security posture

The strongest properties here are absences, and they are checked rather than asserted —
`npm run smoke` runs 19 assertions against the built bundle:

- **No network.** No `fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon` or `EventSource`, and no
  external URL anywhere outside the banner comment. Verified in a real browser too: 25 generations
  produced **zero** new network requests.
- **No storage.** No `localStorage`, `sessionStorage`, `indexedDB` or `document.cookie`.
- **No inline handlers**, no module syntax, no `require`. It is a self-contained IIFE that bails
  silently when the page has no root element — proven by running the bundle in a bare `vm` sandbox.
- **Blanked on `pagehide`**, so navigating away and pressing Back does not bring the last password
  back with it out of the bfcache.

One honest limit: the clipboard write reports success from the browser, and reading it back to prove
the contents requires a permission a page is not granted. The write not rejecting is as far as
verification goes from inside the page.

## Testing

```bash
npm run lint    # tsc --noEmit
npm test        # 116 tests
npm run smoke   # 19 assertions against the built bundle
npm run demo    # serves demo/ on http://127.0.0.1:4180
```

All the arithmetic is pure and the random source is injected, so the interesting property — that an
index is uniform, with no character quietly more likely than another — is tested exactly rather than
with a distribution histogram that would pass either way. A scripted source returning the exact
boundary value proves the rejection branch fires; a counting wrapper proves it drew again rather than
folding the value in with a bare modulo.

Five guards were confirmed **red** by disabling them one at a time and re-running: rejection
sampling, the `2**32` constant, the lookalike exclusion, entropy tracking the real alphabet size, and
the index tripwire.

## Built on

[`@nasdigitaluk/withnate-tool-core`](https://github.com/N-Graves/withnate-tool-core) for `mount` and
`copyText`. Everything else is in this repository.

## Licence

MIT. See [LICENSE](LICENSE).
