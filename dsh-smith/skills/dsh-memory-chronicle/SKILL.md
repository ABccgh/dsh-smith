---
name: dsh-memory-chronicle
description: Use when starting work in a repository, when a fact is verified that a later session would otherwise re-derive, when a design question is settled, when a handoff between experts changes state, or when the agent-notes layers have gone stale or contradictory. Carries the four-layer layout, the entry formats, and the maintenance rules.
---

# Memory and the chronicle

This preset's memory is the workspace, not the context window. These layers are read at
the start of work and written as facts are established — never batched to the end, when
the details are already gone.

## The four layers

| Layer | Path | Lifetime | Contents |
| --- | --- | --- | --- |
| Instructions | `AGENTS.md` (per directory) | durable, auto-loaded | Rules that must apply before any action: commands, conventions, forbidden paths, verification steps |
| Chronicle | `docs/agent-notes/PROJECT.md` | durable, edited in place | What is currently true: architecture as verified, component map, current state, deliberate gaps |
| Decisions | `docs/agent-notes/DECISIONS.md` | append-only | One entry per settled question, with its reason and its reversal condition |
| Board | `docs/agent-notes/BOARD.md` | volatile, rewritten | Current objective, open questions, live expert handoffs |

`AGENTS.md` is loaded automatically for the directory it sits in and for the project root
found by walking up; the budget for that load is 196608 bytes on this preset, spread across
the files that apply. Keep root `AGENTS.md` small and put directory-specific rules in the
directory that needs them, because every session pays for the root file.

## Reading before acting

1. Read the `AGENTS.md` files that apply to the directory you are about to change.
2. Read `PROJECT.md` before designing anything, and `DECISIONS.md` before re-opening a
   question that may already be settled.
3. Read `BOARD.md` when you resume a task rather than start one.

If a layer does not exist yet, create it with the first real entry rather than a
placeholder. A memory file containing only its headings is worse than no file, because it
reads as maintained.

## Entry formats

`DECISIONS.md` — append only, newest last:

```markdown
## D-<n>: <the question, as a question>
- **Decided:** <the answer, in the imperative>
- **Because:** <the evidence or constraint that decided it>
- **Rejected:** <the alternative, and why it lost>
- **Reversed by:** <what would make this wrong — a check, a measurement, a changed constraint>
- **Status:** current | superseded by D-<m>
```

Never edit an existing entry. A changed decision gets a new entry and an update to the old
entry's `Status` line — that one field is the only mutation a decision entry allows.

`PROJECT.md` — sections, edited in place:

```markdown
# <project> — chronicle
## What this is
## Architecture (verified)   <!-- each line names the file or query it was read from -->
## Component map             <!-- path → responsibility, one line each -->
## Current state
## Known gaps                <!-- deliberate omissions, with the reason -->
## Stale claims to re-check  <!-- anything believed but not verified in the last session -->
```

`BOARD.md` — rewritten freely, and expected to be short:

```markdown
# Board
## Objective            <!-- one line -->
## In progress          <!-- one line per live expert handoff: role, child id, question -->
## Open questions       <!-- each with the check that would answer it -->
## Next                  <!-- the immediate next action -->
```

## Rules that keep the record trustworthy

- **Write verified facts only.** A claim enters `PROJECT.md` with the source that
  established it; without a source it belongs under an open question on the board.
- **Write it when you learn it.** A fact held only in context is lost at compaction.
- **Replace, do not contradict.** When a fact changes, revise the line rather than
  appending a correction below it, except in `DECISIONS.md` where the record is history.
- **Never record secrets.** No tokens, credentials, connection strings, or personal data —
  a reference to where a value lives is the most that belongs in the record.
- **Keep each layer short.** Prune what is no longer true. Length is what makes a memory
  file stop being read, and an unread memory file is a cost with no benefit.
- **Hand maintenance to `expert_chronicler`** after a milestone, with the log, the diff, or
  the runtime query that establishes each fact. The chronicler writes from evidence, so a
  brief without evidence produces open questions instead of entries.
