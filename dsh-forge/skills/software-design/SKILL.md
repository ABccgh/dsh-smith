---
name: software-design
description: Use when deciding module boundaries, where a piece of logic belongs, how two components should talk, whether to split or merge code, what interface to expose, or how to record a design decision. Carries the design procedure, the boundary tests, and the tradeoff record format.
---

# Designing a piece of software

A design is a set of decisions about **ownership** and **seams**. This skill is the
procedure for making those decisions in a way a reader can check, and for writing down
enough that the next engineer builds the same thing.

## The order that matters

1. **State the requirement as an observable behaviour.** Not "we need a cache" but
   "the same request within 60 s must not hit the upstream service twice". A requirement
   with no observable consequence cannot be designed against or tested.
2. **Name what exists already.** Search before designing: the installed packages, the
   repository, the sibling module that already does 80 % of it. Most "new" designs are a
   rediscovery of something the codebase already has, and the second implementation of an
   existing capability is the most expensive kind of duplication.
3. **Find the seam with the fewest crossings.** A seam is where two units meet. Count what
   crosses it — data, calls, control, error states — and prefer the boundary that minimises
   crossings, not the one that makes the diagram symmetric.
4. **Choose ownership, then write it down as a sentence.** "X owns Y, and Z may only read
   it through A" is a design; "X and Z both handle Y" is a future bug. Every shared mutable
   thing needs exactly one owner or it needs no shared state at all.
5. **State the tradeoff you are accepting.** A design with no stated cost is a design
   whose cost has not been found yet.

## Tests that catch a bad boundary

Apply these to any proposed split; each one has caught a real design:

- **The change test.** A new requirement inside one unit's responsibility should change
  one file. If the common case touches three units, the boundary is in the wrong place.
- **The leak test.** If a caller must know an internal detail to use the unit correctly
  (an init order, a flag that means "do the other thing"), the interface is leaking. Move
  the knowledge inside, or admit that the two units are one.
- **The parallel test.** Two units that must always change together are one unit that
  has been written twice.
- **The deletion test.** If you deleted the unit, could you describe what was lost in one
  sentence? If not, it has no single responsibility to name.
- **The error test.** Which unit decides what happens when this fails? A boundary with no
  owner for its failure mode has an owner-by-accident.

## Interfaces

- Expose the smallest surface that serves the callers you actually have — not the ones you
  imagine. Speculative generality is a maintenance cost paid by every later reader.
- Return data, not side effects, where the language allows. A function that both returns a
  value and mutates the caller's world is two behaviours behind one name.
- Keep the failure mode in the signature. An error that can only be discovered by reading
  the implementation is a defect waiting for a caller who did not.
- Version at the seam where the contract is consumed, not where it is produced.
- Prefer an explicit parameter over ambient state. Ambient state is what makes a unit
  untestable, and untestable units are where the design will calcify.

## Recording a design decision

Write it down where the next session will find it — the project's decision log if one
exists, otherwise beside the code it governs. One entry per settled question:

```markdown
## <the question, as a question>
- **Decided:** <the answer, in the imperative>
- **Because:** <the evidence or constraint that decided it>
- **Rejected:** <the alternative, and why it lost>
- **Reversed by:** <what would make this wrong — a check, a measurement, a changed constraint>
```

An entry with no `Rejected` line is usually not a decision but a description. The rejected
alternative is the part a later reader needs: it is what stops the same debate from being
held twice.

## When the requirement is under-specified

Do not silently choose. Name the missing decision, design the branches it separates, and say
which branch you would take and what would change your mind. A design that hides its
assumption is the one that gets built wrong for a month before anyone notices.

## Boundaries of this skill

This is the design procedure, not the implementation. Once the seam and the owner are
decided, the work belongs to the delivery loop; once the code exists, correctness belongs
to adversarial review. A design is finished when a second engineer could build the same
thing from the record — not when the diagram looks complete.
