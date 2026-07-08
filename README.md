# 🐶 woof

A puppy that lives in your terminal and grows with your real work. Git
activity is **food**. Time spent working with Claude is **joy**. Neglect it
and it gets hungry and lonely — but it never dies. Worst case it waits by the
door until you come back, and is overjoyed when you do.

The dog is drawn as **animated pixel art** right in your terminal — colored
sprites built from Unicode half-blocks (`▀▄`), with idle animations: blinking,
a panting tongue, and a tail that wags when it's thriving. Moods show in the
sprite itself — begging eyes when hungry, a frown when lonely, curled-up eyes
when asleep. Works in any terminal with 24-bit color (iTerm2, Terminal.app,
VS Code, Ghostty, kitty, ...) and falls back to 256 colors elsewhere.

```
woof status     # Byte blinks, pants, and wags — animates until you hit Ctrl+C
```

`woof status` keeps the dog animating in place above its stats until you press
Ctrl+C. `woof feed` plays the idle loop once and returns. Piped or non-TTY
output is a single static frame, so it's safe in scripts and the statusline.

## How it works

No daemons, no git hooks, no tokens to configure:

- **GitHub events via `gh`** — commits you push, PRs you merge, reviews you
  give, across every repo you touch (company and personal). Uses your existing
  `gh` auth. Only commits *you* authored count.
- **Local git scan** — any repo you run woof (or the statusline) inside is
  remembered and scanned for unpushed commits.
- **Claude Code transcripts** — token usage read locally from
  `~/.claude/projects/`. Working with Claude is the dog's social time.

State lives in `~/.woof/state.json`. Every invocation simulates the time that
passed since the last one — the classic Tamagotchi trick.

## Install

```sh
npm install -g @roo-app/woof
woof adopt
```

Or try it without installing:

```sh
npx @roo-app/woof adopt
```

**Requirements:** Node ≥ 18. `git` and the [`gh` CLI](https://cli.github.com)
are optional but recommended — with `gh` logged in, woof reads your recent
GitHub history and your dog arrives already knowing your scent. Without them it
still grows from local commits and Claude sessions.

### From source

```sh
git clone https://github.com/croossin/woof && cd woof
npm install && npm run build && npm link
woof adopt
```

## Commands

| command | what it does |
| --- | --- |
| `woof adopt` | bring your dog home (`--name X` to name it, default Byte) |
| `woof status` | visit your dog (animates until you press Ctrl+C) |
| `woof connect` | attach GitHub to an existing dog and back-fill history |
| `woof feed` | force an immediate refresh from all sources |
| `woof journal` | your dog's diary, most recent day first |
| `woof statusline` | one-line render for the Claude Code statusline |
| `woof statusline --install` | add woof to your Claude Code statusline |

## Statusline (recommended)

Let your dog live in your Claude Code statusline with one command:

```sh
woof statusline --install
```

That writes the `statusLine` block into `~/.claude/settings.json` for you
(preserving anything already there); start a new Claude Code session to see it.
The statusline refresh doubles as the dog's heartbeat — it polls GitHub at
most every 5 minutes and rescans local sources every 10.

To set it up by hand instead, add:

```json
"statusLine": { "type": "command", "command": "woof statusline" }
```

## No GitHub yet?

woof still grows from local commits and Claude sessions without `gh`. Once you
install the [GitHub CLI](https://cli.github.com) and run `gh auth login`, run
`woof connect` and your dog back-fills its history across all your repos — no
re-adopting.

## Tests

```sh
npm test
```

Zero-dependency test suite on Node's built-in runner (`node:test`). Pure game
logic (decay, moods, stages, feeding, journal, sprites) is unit-tested; the
full CLI flows — onboarding with and without `gh`, private-repo event
enrichment, `status`/`feed`/`statusline`/`journal`, and dedup — run
end-to-end against a sandboxed `HOME` with fake `gh`/`git` on `PATH`, so no
network or real repos are touched.

## Growth

puppy → good dog (300 xp) → best friend (1500 xp) → old faithful (5000 xp)

Commits are kibble. Merged PRs earn zoomies. Reviewing someone else's PR is a
special treat. It sleeps when you (probably) do, 11pm–7am.
