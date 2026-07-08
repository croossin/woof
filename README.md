# 🐚 shellby

A tiny hermit crab that lives in your terminal and grows with your real work.
Git activity is **food**. Time spent working with Claude is **joy**. Neglect it
and it gets hungry and lonely — but it never dies. Worst case it tucks into its
shell and hibernates until you come back.

```
       .-~~-.
      / ,--, \
     ( ( () ) )
      \ '--' /
    .-'      '-.
   (   ◕ ‿ ◕    )
    '.,      ,.'
    /\ "    " /\

  Shellby the sprout is thriving.

  food  ▰▰▰▰▰▰▰▰▱▱   joy  ▰▰▰▰▰▰▰▱▱▱
  xp    412 (1088 to companion)
```

## How it works

No daemons, no git hooks, no tokens to configure:

- **GitHub events via `gh`** — commits you push, PRs you merge, reviews you
  give, across every repo you touch (company and personal). Uses your existing
  `gh` auth.
- **Local git scan** — any repo you run shellby (or the statusline) inside is
  remembered and scanned for unpushed commits.
- **Claude Code transcripts** — token usage read locally from
  `~/.claude/projects/`. Working with Claude is the pet's social time.

State lives in `~/.shellby/state.json`. Every invocation simulates the time
that passed since the last one — the classic Tamagotchi trick.

## Install

```sh
npm install && npm run build && npm link
shellby hatch
```

If `gh` is installed and logged in, shellby reads your recent GitHub history
and hatches already knowing you a little.

## Commands

| command | what it does |
| --- | --- |
| `shellby hatch` | hatch your pet (`--name X` to name it) |
| `shellby status` | visit your pet |
| `shellby feed` | force an immediate refresh from all sources |
| `shellby statusline` | one-line render for the Claude Code statusline |
| `shellby journal` | the last week of your pet's diary |

## Statusline (recommended)

Add to `~/.claude/settings.json`:

```json
"statusLine": { "type": "command", "command": "shellby statusline" }
```

The statusline refresh doubles as the pet's heartbeat — it polls GitHub at
most every 5 minutes and rescans local sources every 10.

## Growth

hatchling → sprout (300 xp) → companion (1500 xp) → elder (5000 xp)

Commits are meals. Merged PRs are feasts. Reviewing someone else's PR is a
special treat. It sleeps when you (probably) do, 11pm–7am.
