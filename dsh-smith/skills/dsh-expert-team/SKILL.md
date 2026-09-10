---
name: dsh-expert-team
description: Use when the lead agent decides whether to delegate, which named expert fits a question, how to brief one so a fresh child can answer, how to combine several experts' reports, or when to escalate to the human instead. Carries the team roster, the handoff contract, and the composition pattern that defines a role.
---

# The expert team

Four named experts are composed for this preset as separate `tool-subagent` rows. Each
one is an ordinary subagent behind a role name, so it has its own session, its own
system prompt, and zero sight of this conversation. That last property is the whole
discipline: an expert answers only what its brief states.

## Roster

| Tool | Role | Reasoning budget | Writes? | Call it for |
| --- | --- | --- | --- | --- |
| `expert_architect` | Architecture and design | `max` | yes | A design, a decomposition, a boundary decision, a second opinion on an approach |
| `expert_verifier` | Adversarial verification | `max` | **not by design** — `write`/`edit` are filtered out, and the persona directs it to hand back a patch instead | Reviewing a claim, a diff, a composition, or a plan before it is trusted |
| `expert_protocol` | Protocol and ecosystem | default | no | Package contracts, version behavior, external specifications, product facts |
| `expert_chronicler` | Memory keeper | default | yes (memory layers only, by instruction) | Folding a decided question or finished milestone into the memory record |

`subagent` is the generic worker for delegated work that matches no role, and
`subagent_fork` is for a task that depends on this conversation's history rather than on a
self-contained brief.

**What the `write`/`edit` filter does and does not do.** `toolFilter` removes those two
tools from the child's visibility *and* makes a forced call fail — that part is enforced.
It is **not** a confinement boundary: the child still has `pwsh`, and a shell can write
files. The filter is a design signal, and the verifier's persona is what makes it stick.
Do not describe this role as sandboxed; describe it as *directed* to stay read-only.
It also does not deny `pwsh` on purpose — a shell is how a claim gets reproduced, and a
verifier that cannot reproduce anything is a proofreader.

## Choosing between delegation and doing it

Delegate when the work is **independent** (it does not need this conversation's context),
**separable** (its result can be stated as a contract), and **worth a session** (a report
that saves more context than it costs). Read the file yourself when the answer is one read
away; a round trip to an expert is slower than a `read` call.

Prefer `expert_verifier` over self-review whenever the change is destructive, hard to
reverse, or already believed correct. A reviewer that shares the author's context shares
the author's blind spots, which is why the verifier gets a brief rather than this history.

## The handoff contract

Give each expert these five parts, in this order. A fresh child cannot infer any of them:

1. **Objective** — the decision or artifact the report must serve, stated as a question.
2. **Context** — repository layout, absolute paths of the files that matter, and the
   task's constraints. Absolute paths, because the child does not share your cwd.
3. **Evidence** — what you already verified, quoted. Separate it from what you assume.
4. **Deliverable** — the exact blocks the role's persona defines, and nothing more.
5. **Boundaries** — what must not change, what is out of scope, and any deadline or size
   limit.

Independent work goes in one message. Each call returns a durable child id, so a second
expert can be started while the first is still running, and `send_message` steers a child
that is already working. `job_list` and `job_output` collect background work; `list_agents`
shows which children are live.

## Using a report

An expert report is a strong source, not a verified one. Test its central claim against
the runtime before you act on it, and say in your own answer which parts you re-verified.
When two experts conflict, do not average them: find the check that decides, and run it.
Record the resolution in `DECISIONS.md` — a conflict settled by a test is exactly the kind
of fact the next session must not re-derive.

Escalate to the human instead of delegating when the question is a goal, an acceptance
criterion, a preference, or an irreversible choice. No expert can own those.

## Composing a new role

A role is a composition change, not a new backend. Add one row to the `team` group in the
preset composition:

```yaml
    - id: tool-expert-<role>
      name: '@deepseek-ai/dsh-tool-subagent'
      config:
        provider: spawn
        toolName: expert_<role>
        backgroundMode: continuable
        maxDepth: 2                 # state it; the schema default is 3, not "inherit"
        agentOptions:
          reasoningEffort: max        # off | low | high | max, adapter-owned
        toolFilter:
          deny: [write, edit]         # GLOBAL tool names; unknown names fail startup
        persona: |-
          You are ... Your output is exactly these blocks: ...
```

`toolName` must be unique — the tool registry is keyed by name. `toolFilter` and `persona`
require the spawn provider's `persona` and `toolFilter` capabilities, which
`@deepseek-ai/dsh-subagent-spawn-in-process` advertises for every start; a provider that
lacks one rejects the start rather than ignoring it. Keep the role's output blocks in its
persona, because that is the only place a fresh child learns the shape of its report.

**State `maxDepth` on every row.** Omitting it does not inherit a sibling row's cap — the
tool's own schema applies `.default(3)`, so an omitted cap is 3 for that row alone. A team
whose rows disagree about depth has no single recursion bound, and `subagent_fork` is the
row most likely to drift because the fork provider advertises `depthLimit` itself.

**A role that must verify end to end is not one of these four.** The roster covers design,
adversarial review, outside facts, and memory. Nobody in it owns "did the whole flow
actually work" — that gap is how a composition ends up verified row-by-row while the
feature is broken. When a change spans several parts, run the end-to-end check yourself or
give `subagent` an explicit instruction to do exactly that and report the observed result,
not the conclusion.
