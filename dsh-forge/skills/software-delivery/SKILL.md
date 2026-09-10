---
name: software-delivery
description: Use when implementing a change, fixing a bug, adding a test, preparing a commit or pull request, or deciding whether work is actually finished. Carries the delivery loop, the debugging method, and the definition of done.
---

# Delivering a change

The loop is **understand → reproduce → change → verify → record**. Skipping a step does not
save its cost; it moves the cost to whoever runs the code next.

## 1. Understand before changing

- Name the behaviour you are changing and the behaviour you must not change. The second
  half is what makes a change safe; a change with no stated invariant is a rewrite.
- Read the code you are about to edit, plus its callers. A change made without reading the
  callers is a change whose blast radius is unknown.
- Find out how this project is built, tested, and run **before** you edit anything. Put the
  exact commands in the project's instruction file (`AGENTS.md` or equivalent) the first
  time you have to look them up twice. That file is loaded automatically next session; you
  are not.
- If the change is large enough to need a design decision, make that decision first and
  write it down. Implementing your way into a design produces the design you get by
  accident.

## 2. Reproduce before fixing

A bug you cannot reproduce is a bug you cannot know you fixed.

- Build the smallest reproduction: the shortest input, the least setup, the fewest steps.
  A small reproduction is also the regression test.
- For an intermittent failure, find what varies — timing, ordering, data, environment — and
  make that variable explicit. "It passed this time" is not a diagnosis.
- Read the whole error, including the frames above and below the line that looks relevant,
  and the cause chain. The interesting frame is often the one that did not throw.

**Root cause, not symptom.** The chain you need is *defect → mechanism → symptom*: this
line does X, which makes Y true, which is why you observe Z. If you cannot state the middle
step, you have a correlation. Stop and find it — a fix for the symptom leaves the defect
in place and adds a second thing to understand later. Before fixing, ask why the defect was
possible at all: a check that was missing, an assumption that held only by accident. Fixing
that class of cause is what prevents the next one.

## 3. Change the least

- One logical change per commit. A commit that does two things cannot be reverted as one.
- Match the surrounding code. A new pattern introduced beside an existing one is a
  maintenance cost charged to every later reader, and it needs a reason stronger than taste.
- Do not reformat or reorder code you are not changing; it buries the real diff.
- Prefer deleting code to adding it. The smallest sufficient change is usually a fix in the
  existing seam rather than a new layer beside it.
- Add the regression test with the fix, not after it. The test is the proof the fix is the
  fix, and it is much cheaper to write while the reproduction is still in front of you.

## 4. Verify by running it

- Run the test that proves the change, and the tests around it. Say which command you ran
  and what it printed.
- **Distinguish "the tests pass" from "the change works".** A suite that passes because it
  does not cover the new path proves nothing about it. If the change spans several parts,
  run the whole thing end to end — parts verified separately is not a working feature.
- Check what you might have broken outside the suite: the other caller, the persisted data
  written by the old version, the error path, the empty input.
- A command that exited zero is not a passing test. Read the output for the assertion count
  and the skips.
- When you cannot verify something, say exactly that. An unverified change reported as
  verified is worse than an unverified change, because the reader stops looking.

## 5. Record what was learned

- Commit message: what changed and **why** — the why is the part git cannot recover from the
  diff. Reference the issue if one exists.
- Update the instruction file or the project chronicle with anything you had to derive: a
  build command, a non-obvious constraint, a test that is flaky and why.
- Leave the workspace in a state the next session can continue from: no half-applied
  migration, no debug print left in a hot path, no commented-out code without a reason.

## Definition of done

All of these, not most:

1. The requested behaviour is demonstrably present, by a command or a test someone else can run.
2. The tests covering it pass, and you know they fail without the change (or you say you did
   not check).
3. The surrounding tests still pass.
4. No new warning, flake, or skipped test is left behind.
5. The change is reviewed with fresh eyes — by another agent, a teammate, or a deliberate
   self-review of the full diff rather than of your memory of it.
6. What you learned is written where the next session will find it.

**Working code beats perfect plans, but only working.** A change that is 90 % done and
reported as done costs the next person more than a change correctly reported as unfinished.

## When you are blocked

Say what you tried, what you observed, and what you need. Concretely: the command, the
output, the thing you cannot decide. Do not silently widen the change to route around an
obstacle — that is how a fix becomes a refactor nobody reviewed. If the obstacle is a
decision that belongs to the user (a goal, an acceptance criterion, an irreversible choice),
ask, and keep working on the part that does not depend on the answer.
