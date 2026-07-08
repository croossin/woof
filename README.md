# 🐶 woof

A puppy that lives in your terminal and grows with your real work. Git
activity is **food**. Time spent working with Claude is **joy**. Neglect it
and it gets hungry and lonely — but it never dies. Worst case it waits by the
door until you come back, and is overjoyed when you do.

```
    ,-.____,-.
   ( (  ◕ ᴥ ◕  ) )
    \_)       (_/
    /           \
   |             |   ,,
   |             |__//
   (__)   (__)   '--'

  Byte the good dog is thriving. The tail says it all.

  food  ▰▰▰▰▰▰▰▰▱▱   joy  ▰▰▰▰▰▰▰▱▱▱
  xp    412 (1088 to best friend)
```

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
npm install && npm run build && npm link
woof adopt
```

If `gh` is installed and logged in, woof reads your recent GitHub history and
your dog arrives already knowing your scent.

## Commands

| command | what it does |
| --- | --- |
| `woof adopt` | bring your dog home (`--name X` to name it, default Byte) |
| `woof status` | visit your dog |
| `woof feed` | force an immediate refresh from all sources |
| `woof statusline` | one-line render for the Claude Code statusline |
| `woof journal` | the last week of your dog's diary |

## Statusline (recommended)

Add to `~/.claude/settings.json`:

```json
"statusLine": { "type": "command", "command": "woof statusline" }
```

The statusline refresh doubles as the dog's heartbeat — it polls GitHub at
most every 5 minutes and rescans local sources every 10.

## Growth

puppy → good dog (300 xp) → best friend (1500 xp) → old faithful (5000 xp)

Commits are kibble. Merged PRs earn zoomies. Reviewing someone else's PR is a
special treat. It sleeps when you (probably) do, 11pm–7am.
