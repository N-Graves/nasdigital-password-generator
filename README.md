# nasdigital-password-generator

Set a length, pick which characters are allowed, get a password. It is generated on your own device
by the browser's own cryptographic random number generator, and it is never sent anywhere and never
stored.

Built for [nasdigital.co.uk](https://nasdigital.co.uk) as a drop-in artefact: one IIFE, one
stylesheet, and a demo page.

## What it is for

Two things, and the first is table stakes that plenty of generators still get wrong. Every character
comes from `crypto.getRandomValues`, never `Math.random` — which is fast, repeatable and completely
unsuitable, and which a password generator built on it is worse than useless for, because it looks
exactly the same from the outside.

The second is the number. Most generators show a Weak/Medium/Strong meter, and those mislead in both
directions: a long dictionary phrase scores well on character variety while being trivially
guessable, and a genuinely strong password can read as "medium" for having no symbol in it. This one
shows the actual figure — how many bits of guessing it is worth — with one line of context saying
what that means for the two threats that differ by orders of magnitude: someone guessing at a
rate-limited login form, and someone cracking a leaked hash offline on their own hardware.

That figure is only honest if it describes what actually happens, so every character is drawn
uniformly from the whole alphabet. The common shortcut — guarantee one from each selected class,
then shuffle — biases the result and makes the advertised number slightly false.

## What it is not

Not a password manager. There is no storage, no history, and no way to get a password back once it
is off the screen. Adding any of that would turn a tool with nothing to protect into one that needs
a security posture it was never designed for.

It also will not tell you whether a password *you* type is any good. Doing that properly means
checking it against a list of known-breached passwords, which means sending it somewhere — and not
sending anything anywhere is the entire point of this being a browser tool rather than a web service.

## Licence

MIT. See [LICENSE](LICENSE).
