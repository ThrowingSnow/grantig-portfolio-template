# doc/

Working documentation for the one-pager. Four files, each with one job — if
something belongs in two of them, it belongs in the one further down this list.

| File | What it holds | Changes when |
| ---- | ------------- | ------------ |
| [CONTEXT.md](CONTEXT.md) | How the thing is built and why. Architecture, conventions, the invariants you can break without the compiler noticing. | The architecture changes |
| [ROADMAP.md](ROADMAP.md) | Where it is going, in horizons. Themes, not tickets. **Proposal — not signed off.** | The direction changes |
| [BACKLOG.md](BACKLOG.md) | What is actually open right now, itemised. Every entry is something observed in the repo, not something imagined. | Constantly |

## What is *not* in here

**The scroll story itself.** That lives in the [root README](../README.md), beat
by beat, and it is the better document — it explains what every panel does and
why it does it that way. This folder is the stuff around it: the shape of the
codebase, what is unfinished, where it is going.

**Per-module reasoning.** It is in the source, in the doc comments, and it is
kept there on purpose. `LetterField.ts` explains its own hand-over to cannon-es
better than a page in here ever would, and a comment three lines from the code
it describes is a comment that gets updated. Do not lift explanations out of the
source into this folder; link to the file instead.

**The design-sync pipeline.** That has its own notes, written by the sync that
produced it, at
[`packages/onepage-chrome/.design-sync/NOTES.md`](../packages/onepage-chrome/.design-sync/NOTES.md).
Read it before touching anything in that package — it is a list of traps that
have already been fallen into once.

## Conventions in these files

- **Facts are separated from proposals.** Anything not yet agreed says so in the
  open. ROADMAP.md is entirely proposal until someone says otherwise.
- **Every backlog entry names a file.** An item nobody can locate is not an item,
  it is a mood.
- **Dates are absolute.** "Next sprint" means nothing six months from now.
- **English**, like the rest of the repo — the source comments, the commit
  messages and the root README are all in it, and a docs folder in a second
  language is a docs folder that drifts.
