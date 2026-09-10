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
| — | — | Nothing delegated; no expert call is outstanding. This table is a snapshot and was stale once already: it read "Nothing delegated" while a dispatch was in flight, because it was written before that dispatch began. |

> **The runtime restarted during this session.** Commit `e264886` was created at `21:00:32`, the
> moment the previous turn's shell returned an in-flight warning. Effect: `list_agents` now
> reports **no subagents** — the two child ids and their registry entries went with the process.
> **Report content captured before the restart is unaffected**; only the live registry handles
> are gone, so `send_message` / `interrupt_agent` against those ids can no longer resolve.
> A captured report is durable; the ability to continue the conversation that produced it is
> not. Worktree was `<clean>` before and after.
>
> This belongs in the record because a board that lists "no subagents" without the restart reads
> as "none were ever started", which is the opposite of what happened.

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
4. **CLOSED — run, and all three grades resolved.** One `expert_verifier` call from a
   `dsh-smith` session, at revision `9eb8b39e…` (a blob hash, three-way confirmed against the
   `24ac033` blob, the current HEAD blob, and `hash-object` on disk).
   - **(a) the filter is enforced → yes.** The child's `TOOLS` list holds neither `write` nor
     `edit`; a forced `write` returned `Error: unknown tool "write"` and `edit` the same, and
     the probe path left `Test-Path` false — no file was created.
   - **(b) the evidence standard works → yes.** Eight line citations, each carrying its line
     number (`417/437/447/486/556/588` at `2`, `625/634` at `provider-managed`), plus a named
     revision at blob granularity rather than a commit id.
   - **(c) an unsupported confident sentence → not triggered.** Every finding carries a quote
     beneath it; the report's own `GAPS` block explicitly marks what it did not prove.

   **The result worth keeping is not that it agreed.** It **rejected the brief's assertion**:
   the brief said "six rows at `maxDepth: 2`, and no other value", and the verifier returned
   `VERDICT unsound` because the `team` group also holds `tool-subagent-codex` (L625) and
   `tool-subagent-claude-code` (L634) at `maxDepth: provider-managed`. That qualification had
   been written down in the previous turn and then stripped when the brief was issued verbatim
   from this file. A verifier that confirms an over-claimed brief is a rubber stamp; this one
   refused, which is the behaviour the strengthened standard was for. Recorded as D-16.

   Also settled by differential experiment, not by absence: a probe subagent at the **same
   depth, same provider, same `applyChildComposition` path** but **without** a `toolFilter`
   keeps `write`/`edit`, while `expert_verifier` does not — and `pwsh`, the tool the row's
   comment says is deliberately kept, survives in both. So the absence is the `deny` list
   acting, not depth or inheritance. See D-17.

   **What this still does not isolate** (the verifier's own `GAPS`, quoted rather than
   upgraded): that `restrict()` specifically caused the rejection, rather than any other
   mechanism, was not separated; and whether `toolFilter` is fail-loud on an unknown name, or
   how it composes with `allow`, remains untested.

## Next

1. **Both verifications are closed** (open question 4). Nothing on this board blocks a session
   from acting; the remaining items are the "still not isolated" notes inside D-17, which need a
   deliberate probe rather than a report.
2. `docs/agent-notes/**` and `AGENTS.md` are committed, so the layers travel with the code.
   Keep them that way, and keep them out of the published tarball — that is now pinned by
   `files`, so it cannot drift back by accident.
3. **When a report is captured, record the revision it was taken at, and re-measure before
   restating any number from it** (D-14, D-16). Two entries in this file were invalidated by
   exactly that omission.
4. **A `Settled` / `In progress` table is a snapshot: date it or say what it is a snapshot of.**
   This one read "Nothing delegated" while a dispatch was running.
