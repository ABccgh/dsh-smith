---
name: software-chronicle
description: Use when starting work in a repository, when a fact is verified that a later session would otherwise re-derive, when a design question is settled, when a bug's cause is found, or when the project notes have gone stale or contradictory. Carries the layer layout, the entry formats, and the maintenance rules.
---

# Project memory

A codebase's memory is the workspace, not the context window. These layers are read at the
start of work and written **as facts are established** — never batched to the end, when the
details are already gone and the session is being compacted.

## The layers

Every `docs/agent-notes/…` path below is relative to **the project root**, and the project
root is not necessarily your working directory.

Resolve it in this order, and stop at the first answer:

1. The directory named by a project-root marker you can see — `.git`, `package.json`,
   `pnpm-workspace.yaml`, `go.mod`, `Cargo.toml`, or whatever the project's instruction file
   names as the root.
2. Otherwise, the outermost instruction file that applies to your working directory; the
   memory layers belong beside it.
3. Otherwise — a directory with no markers — **do not invent a root**. Write the layers under
   the working directory and record on the board that the root is unresolved, so the next
   session re-derives it instead of trusting this choice.

Never create a memory layer inside a subpackage's own directory, and never let one tree
collect two `docs/agent-notes/` directories: a memory split in two is worse than a memory in
one wrong place, because each half looks complete.

| Layer | Path | Lifetime | Contents |
| --- | --- | --- | --- |
| Instructions | `AGENTS.md`, per directory | durable, auto-loaded | Rules that must apply before any action: build/test/run commands, conventions, forbidden paths, verification steps |
| Runbook | `docs/agent-notes/RUNBOOK.md` | durable, edited in place | The commands: build, test one file, test all, lint, run locally, reset the database, deploy. One line each |
| Chronicle | `docs/agent-notes/PROJECT.md` | durable, edited in place | What is currently true: architecture as verified, component map, current state, deliberate gaps |
| Decisions | `docs/agent-notes/DECISIONS.md` | append-only | One entry per settled question, with its reason and its reversal condition |
| Board | `docs/agent-notes/BOARD.md` | volatile, rewritten | Current objective, open questions, live handoffs |

The instruction file is loaded automatically; the rest are read by choice, so they must be
worth the read. Keep the root instruction file small and put directory-specific rules in the
directory that needs them, because every session pays for the root file.

Create `RUNBOOK.md` the first time you look up a command for the second time. That repetition
is the signal, and it is the only one. Do not create any layer before you have something real
to put in it: a memory file containing only its headings reads as maintained, which is worse
than no file.

## Starting a project with no memory yet

Seed the layers from what you verify in your first session, not from a template:

1. `RUNBOOK.md` with only the commands you actually ran.
2. `PROJECT.md` with only the sections you can fill today — typically `## What this is` and
   `## Architecture (verified)`. Leave out the rest.
3. `BOARD.md` immediately, with the objective and the first open questions: the two things a
   resuming session needs most, and they cost nothing to write.
4. `DECISIONS.md` only when a question actually gets settled. If none has, the file should not
   exist yet.

## Reading before acting

1. Read the instruction files that apply to the directory you are about to change.
2. Read `RUNBOOK.md` before running anything — the commands are there so you do not
   rediscover them.
3. Read `PROJECT.md` before designing anything, and `DECISIONS.md` before re-opening a
   question that may already be settled.
4. Read `BOARD.md` when you **resume** a task rather than start one.
5. If step 4 found an unresolved-root note or a "believed but unverified" claim, re-check it
   before writing anything. A chosen root and a stale claim are both things the next session
   must confirm, not inherit.

## Entry formats

`DECISIONS.md` — append only, newest last:

```markdown
## D-<n>: <the question, as a question>
- **Decided:** <the answer, in the imperative>
- **Because:** <the evidence or constraint that decided it>
- **Rejected:** <the alternative, and why it lost>
- **Reversed by:** <what would make this wrong — a check, a measurement, a changed constraint>
```

**A decision entry is immutable.** Do not edit one, not even a status line. A decision that is
later overturned gets a **new** entry that says so:

```markdown
## D-<m>: Is D-<n> still right?
- **Decided:** No — D-<n> is superseded.
- **Because:** <what changed, or the check that failed>
- **Rejected:** keeping D-<n> because its reasoning still reads as sound
- **Reversed by:** <what would restore D-<n>>
```

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

`RUNBOOK.md` — one line per command, with the directory it runs from:

```markdown
# Runbook
## Setup
## Build
## Test            <!-- single file, whole suite, and how to run one test by name -->
## Lint and format
## Run locally
## Debug           <!-- log levels, how to attach a debugger, where the logs go -->
```

`BOARD.md` — rewritten freely, and expected to be short:

```markdown
# Board
## Objective            <!-- one line -->
## In progress          <!-- one line per live handoff: who, what, since when -->
## Open questions       <!-- each with the check that would answer it -->
## Next                 <!-- the immediate next action -->
```

## Rules that keep the record trustworthy

- **Write verified facts only.** A claim enters `PROJECT.md` with the source that established
  it — a path and line, a command and its output, a commit, a query. Without a source it
  belongs under an open question.
- **Write it when you learn it.** A fact held only in context is lost at compaction.
- **Replace, do not contradict.** When a fact changes, revise the line rather than appending a
  correction below it — except in `DECISIONS.md`, where the record is history and the reason
  a past decision was made must never be silently lost.
- **Never record secrets.** No tokens, credentials, connection strings, or personal data. A
  pointer to where a value lives is the most that belongs in the record.
- **Keep each layer short.** Length is what makes a memory file stop being read, and an unread
  memory file is a cost with no benefit. Prune what is no longer true.
- **Date a snapshot.** A table of "current state" or "in progress" is true of a moment; say
  which moment, or the next reader will trust a stale picture.
