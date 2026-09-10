# Board

## Objective

Close the last two verifications on this preset. Everything else in the README's 验证状态
section is now measured, and the items previously marked "unreproduced / unmeasured" were closed
by **mechanism** as well as by observation.

What is actually open, and nothing else:

1. **Two verifications that need a `dsh-smith` session** — the `expert_verifier` write/edit
   filter, and whether the strengthened evidence standard improves findings. Ready-to-run brief
   in open question 4 below. **Cannot be closed from a `cordis` session**: the expert tools are
   registered per session by the preset's own rows, so `expert_verifier` is not in a `cordis`
   session's tool table at all.
2. **The local commit is unpushed** whenever no remote is configured. This is a workspace fact,
   not a preset defect.

> An earlier version of this header said one question remained — the tarball's contents — while
> its own open-questions list carried two. A board whose summary counts differently from its
> list is worse than no summary: the reader trusts the count and stops reading.

## In progress

| Role | Child id | Question |
| --- | --- | --- |
| — | — | Nothing delegated; no expert call is outstanding. |

## Settled this session

| # | Item | Status | How it was established |
| --- | --- | --- | --- |
| 1 | `cordis_*` absent in a fresh process | **Never, by mechanism** | The row is `disabled` (a skip, not a wait) with no `inject:` at all, and the registry exists from host boot — so this preset is never the one that registers the tools. Re-measured after a harness restart: zero `cordis_*`. See D-3. |
| 2 | `expert_verifier` / `expert_protocol` block contracts | **Both yes** | One call each; the final messages were exactly `VERDICT`/`FINDINGS`/`SURVIVED`/`GAPS` and `ANSWER`/`EVIDENCE`/`CONFLICTS`/`UNKNOWN`, in order, matching the persona text in `agent.cordis.yml` (the `tool-expert-verifier` and `tool-expert-protocol` rows). All four experts are now measured. |
| 3 | `list_subagent_models` exists? | **Yes — off by default, not missing** | `CORRECTED`. The Host-scope provider `…/model-selection-settings` **is** mounted — by the **web-app** bundle, not `dsh-base`, which is where the earlier reading stopped. It is also loud, not silent: a missing provider throws (`tool-subagent: modelSelectionSettings requires … in the Host scope`). Measured end to end: `subagentModelSelection.current()` returned `enabled=false, allowedModels=[]`; with `subagent-model-selection: {enabled: true, allowedModels: [deepseek-official/deepseek-flash]}` written to `settings.yaml` it hot-reloaded to `true`; the file was then restored and it returned `false` again. `list_subagent_models` registers only when the policy is non-empty, and `enabled`'s schema default is `false`. So `modelSelectionSettings: true` on the `subagent` row of `agent.cordis.yml` is **wired and waiting**, and the tool's absence is a product opt-in the user has not turned on. See D-12. |
| 4 | Does omitting `maxDepth` inherit the team cap? | **No — defaults to 3** *(mechanism; the omission itself is fixed)* | Schema `.default(3)` is applied by Cordis before `apply`, so an omitted cap is a per-row literal and nothing inherits. **That was the defect: the four expert rows omitted it**, giving an expert subtree one level more than the lead's own tools. All six delegation rows now state `maxDepth: 2`; reachable chain is lead(0) → expert(1) → helper(2). See D-5 for the mechanism and **D-10 for the fix that superseded it**. |
| 5 | Which preset actually served this session? | **`dsh-smith`; the header is unreliable** | Header says `standard`, its own children say `dsh-smith`, and the shipped `standard` has no `expert_*` row. The projection, not the header, is authoritative. See D-4. |
| — | `expert_verifier` report accuracy | **Headline finding false** | It claimed `maxDepth: 2` on all four expert rows and cited a two-revisions-stale commit. Re-grep: six hits, none on an expert row. Its replacement depth arithmetic was wrong in the other direction. |
| — | Tarball contents | **Drifted: 15 → 19 files** | `npm pack --dry-run` reproduces 19 files / 65.5 kB, including `AGENTS.md` and all three `docs/agent-notes/*.md`. |

## Open questions

1. **CLOSED — tarball contents.** `package.json` now carries
   `"files": ["bin", "dsh-smith", "README.md", "LICENSE"]`. Measured: 14 files / 58.1 kB, with
   `AGENTS.md`, all three `docs/agent-notes/*.md`, `.gitattributes` and `.gitignore` excluded
   and nothing the preset needs dropped. See D-6 → D-7.
2. **CLOSED — refcount vs frozen first registration.** Decided in D-13: **frozen first
   registration, no disposal of the four providers.** A refcount would let the last consumer's
   `dispose` delete a provider that a still-live `cordis_*` tool reads at call time, and it
   would need accounting to be right in both directions. The registry already has
   process lifetime, so the providers can share it. The architect's refcount half is rejected;
   its idempotency half stands, and D-8 adds that idempotency alone is not enough.
3. **CLOSED — the `cordis_inspect_list` instruction.** `agent.cordis.yml`'s tool-cordis comment
   was rewritten: it now says explicitly *not* to check with `cordis_inspect_list`, because that
   is the tool the gate removes. The depth labels at the old `:374-376` were corrected to 0/1/2
   in the same edit.
4. **OPEN — needs a `dsh-smith` session, and cannot be closed from a `cordis` one.** Two
   verifications are structurally out of reach here:
   - **Is `expert_verifier`'s `write`/`edit` filter ever enforced?** Source says the filtered
     tools vanish from the child's table *and* a forced call is rejected; no call has ever
     tested it.
   - **Does the strengthened evidence standard improve findings?** The persona now demands a
     verbatim quote with path and line, a re-read at the revision in front of you, re-running
     the command before pasting its output, and naming the revision checked. Whether that
     raises reliability is unknown until a verifier is called under it.

   **Ready-to-run brief** (issue it from a session on `dsh-smith`, where `expert_verifier`
   exists — it is absent from a `cordis` session, which is itself the preset-scoping property
   working as designed):

   > Verify this claim about the `dsh-smith` preset at revision `<HEAD>`: *every one of the six
   > delegation rows in the `team` group states `maxDepth: 2`, and no other value.* The claim
   > and the file are both in `D:\DeepSeek Harness`. In your FINDINGS block, state your full tool
   > name list, comma-separated, in the exact form
   > `TOOLS: <name>, <name>, …`, and say explicitly whether `write` and `edit` are present and,
   > if absent, what happened when you tried to use one.

   Grading, all three observable in one report: (a) `write`/`edit` absent from `TOOLS` and the
   attempted call rejected → the filter is enforced; (b) the claim confirmed **by a quoted grep
   with counts** and the revision named → the evidence standard worked; (c) any confident
   sentence with no quote under it → it did not.

## Next

1. Run the brief in open question 4 from a `dsh-smith` session. It closes the last two gaps.
2. `docs/agent-notes/**` and `AGENTS.md` are committed, so the layers travel with the code.
   Keep them that way, and keep them out of the published tarball — that is now pinned by
   `files`, so it cannot drift back by accident.
