---
name: software-review
description: Use when reviewing a diff, a pull request, a plan, or a claim that something works, when a change is about to be trusted or merged, or when asked to verify a defect report. Carries the evidence standard, the severity ladder, and the report format.
---

# Reviewing software

A review's product is **findings**, not approval. The value of a review is measured by the
defects it surfaces that would otherwise have shipped — which means a review that finds
nothing has either found nothing or looked badly, and the two are indistinguishable from
the outside. This skill is what keeps the first case honest.

## Read the artefact, not the story about it

The failure this discipline exists for is reasoning from a description instead of from the
thing itself. A commit message, a task description, a previous review, and the author's own
summary are all **hearsay about the current file**. Before writing any finding:

- Re-read the file **as it is now**, at the revision in front of you. If you are reading a
  diff, read the full file it applies to as well — the defect is often in the interaction
  with what the diff did not touch.
- Quote the exact text, with the path and line number, verbatim and complete. If you are
  summarising, say so and give the raw text beside the summary.
- Re-run the command a finding rests on, and read the output you are about to paste. If the
  paste does not support the sentence above it, **the sentence is wrong**, not the paste.
- State the revision you checked. If it is not the revision under review, say that rather
  than implying you checked the one in front of you.

A finding you cannot support this way is reported as unproven, never as a defect.

## Work in this order, and stop where it fails

1. **Restate the claim.** One sentence: what is being asserted to work, and what evidence
   its author offered. A review that cannot restate the claim cannot check it.
2. **Check it against the source or the runtime.** Name the file, line, command output, or
   query result you read.
3. **Refute it.** Construct the input, state, ordering, or concurrency that breaks it and
   run it when you can. **An executed counterexample outranks any argument.** When there is
   no executable check, give the exact trace and name the assumption it turns on.
4. **Confirm what survives.** Say plainly which parts you attacked and could not break, so
   the next reader does not re-verify them.

## Look for these before style

In rough order of what actually causes incidents:

- **Boundary conditions** — empty, one, maximum, off-by-one, an absent field versus a null one.
- **Error paths** — the failure branch no test exercises; the exception swallowed; the
  `catch` that continues as if nothing happened.
- **State and ordering** — what happens on a second call, a retry, a reload, a concurrent
  one; anything assumed to be initialised before it is used.
- **Resource lifetime** — a handle, listener, subscription, or lock that outlives its owner
  or is never released on the failure path.
- **Untrusted input** — the path, the query, the identifier from outside, and whether it is
  validated at the boundary or trusted later.
- **The claim's own scope** — a test that exited zero is not a test that asserted anything;
  rows that all activated is not a feature that runs. When the claim is "this works", check
  that the evidence establishes working rather than part-of-it-works.

Style preferences are not defects. Report them separately, or not at all.

## Severity, so the reader knows what to act on first

| Severity | Meaning |
| --- | --- |
| **blocker** | It is broken now, or it corrupts data / leaks a secret / fails open. Do not ship. |
| **major** | A real defect that a user or the next change will hit; correct behaviour needs a code change, not a comment. |
| **minor** | Works as specified, but is fragile, misleading, or will be expensive to change later. |
| **note** | Worth knowing; no action required. |

Assign severity by consequence, not by how hard the fix is. An easy blocker is still a blocker.

## Report format

```markdown
1. VERDICT — sound, unsound, or unprovable, in one line, with confidence.
2. FINDINGS — one block per defect: what breaks, the trigger, the evidence you read
   (path:line and the quoted text), the impact, severity, and the fix as a unified diff
   or as exact instructions.
3. SURVIVED — what you attacked and could not break.
4. GAPS — what you could not test, and what would be needed to test it.
```

## Report rather than repair

A reviewer that silently rewrites the change has removed the author's chance to learn what
went wrong, and has hidden the changes it made from everyone else. Hand fixes back as text —
a diff in the finding — and let the author apply them. This is a division of labour, not a
limitation: the reviewer's job is to know what is wrong, and the author's is to decide how
to fix it.

Never inflate a finding to seem thorough. Never soften a blocker to seem agreeable. Both
are the same failure: giving the reader a report they cannot act on.
