# Decisions

## D-1: Does the `tool-cordis` row keep its `disabled: !!js` gate?
- **Decided:** Yes — keep the gate, and record the row as a **known limitation with an
  upstream fix**, not as something this repository can solve. The four Cordis plugin-authoring
  tools are consequently absent from a `dsh-smith` session's tool table.
- **Because:** three facts read from the installed 0.1.5-rc.1 packages, not inferred:
  (1) `@deepseek-ai/dsh-cordis-host-runner\lib\index.js` line 732 throws
  `Host Cordis inspect provider "<id>" is already registered` when a provider id is already
  in the map — there is no idempotent path; (2) `@deepseek-ai/dsh-tool-cordis\lib\index.js`
  line 9113 registers the four providers (`Service`, `Event`, `Builtin`, `Tool`) at
  **apply** time, unconditionally, with no config branch; (3) therefore a second composition
  containing this row throws inside `ctx.effect` during the *first* session that mounts after
  another session already claimed those ids, failing that row.
- **Rejected:** sharpening the predicate to ask "are the providers already registered?"
  (`ctx.get('cordisInspect').list()`). It fails on its own terms: `apply` is what registers
  the model-facing tools, so skipping it means **every session after the first gets no
  `cordis_*` tools** — exactly the outcome the row exists to prevent. It also cannot tell a
  sibling preset's registration from a dynamic `cordis_run` package's. Its runtime
  feasibility was never settled, but settling it would not change the verdict.
- **Rejected:** moving `tool-cordis` to the host composition. Mechanically viable — the
  `Tool` provider's `listTools` reads `ctx.tools.schemas(context.agent)` with the agent
  supplied per query, so a host-registered provider is not agent-blind. It loses as a
  *scope* decision: it would expose `cordis_define` / `cordis_run` (arbitrary JavaScript
  against the live runtime) to **every** session of the profile, not only `dsh-smith`.
- **Reversed by:** an upstream `CordisInspectRegistryService.register()` that is idempotent —
  returns the existing disposer for an already-registered provider id instead of throwing —
  shipped in a DSH release. Then the gate is deleted and the row enabled unconditionally.
  <!-- SUPERSEDED BY D-8: that release would NOT restore the tools on its own. See D-8. -->

## D-2: Does the upstream idempotent-`register()` fix need a refcount?
- **Decided:** Open — deliberately not settled. Recorded so the next session does not
  mistake the proposal for a decided design.
- **Because:** the `expert_architect` report of this session recommended "idempotent by
  provider id **with a refcount**". The first half is forced by D-1; the refcount is a new
  mechanism — grep over `dsh-cordis-host-runner\lib\index.js` for `refcount|refCount` returns
  **no match**, so nothing existing supports it. It also carries a hazard the report did not
  address: with a refcount the provider is removed when the last consumer disposes, and
  `cordis_inspect_list` / `cordis_inspect_query` read the registry at *call* time, so a
  surviving consumer could find the provider gone.
- **Rejected:** adopting the report's full recommendation as-is. The verified half is sound;
  the unverified half would introduce a new failure mode on the strength of an expert claim.
- **Reversed by:** a stated lifetime rule for the four providers — "first registration wins
  and never disposes for the life of the process" is the alternative worth preferring,
  because it needs no accounting and cannot leave a live tool without its provider.

## D-3: Is the cold-start `cordis_*` absence still an open question?
- **Decided:** No — closed, and closed more strongly than "unreproduced". On any boot where
  the web-app bundle is composed, the `tool-cordis` row is **skipped**, so a `dsh-smith`
  session can never be the composition that provides `cordis_*`. The answer no longer depends
  on observing a cold process.
- **Because:** two facts put together. (1) The host row constructs the registry at
  **constructor** time and never disposes it, so `cordisInspect` exists from boot
  (`dsh-cordis-host-runner/lib/index.js:1598`). (2) The preset's row is
  `disabled: !!js ctx.get('cordisInspect') !== void 0` (the `tool-cordis` row of
  `dsh-smith/agent.cordis.yml`),
  and `disabled` is a **skip**, not a wait — it is evaluated by the loader and the row returns
  before `init()` (`cordis-plugin-loader/lib/index.js:289,359-378,391`). The row declares no
  `inject:` anywhere, so the "the row would sit waiting on its declared injection" branch this
  board previously hypothesised has no implementation behind it. Measured on top of the
  argument: a fresh root session after a harness restart still shows zero `cordis_*` tools.
- **Rejected:** treating the earlier "warm process only" statement as the final word. It was
  true about the *evidence* but wrong about the *status*: the mechanism is deterministic, and
  calling it unmeasured invited a future session to re-run a check that cannot change.
- **Reversed by:** a DSH release in which the web-app bundle no longer composes
  `cordis-host-runner` (then the predicate is false and the row loads), or in which the row's
  `disabled` predicate is replaced by an `inject` (then it really can wait).

## D-4: Is the header's `agentPreset` usable as evidence of which preset served a session?
- **Decided:** No. It is a creation-time hint. The authority is the `agentPreset` **session
  projection**, which the `agent-preset/selected` event writes with the mounted preset id.
- **Because:** the field is optional (`dsh-session-format/lib/types/types.d.ts:19`); the
  web-app row supplies the default id (`dsh-web-app/cordis.patch.yml:481-484`,
  `config.default: standard`); the API answers preset questions from
  `ctx.sessionProjections.stateOf(session, 'agentPreset')`
  (`dsh-api-session-controller/lib/index.js:363,522`); and the projection's `init` adopts the
  header while its `apply` takes the event's value
  (`dsh-agent-presets/lib/index.js:1071-1079`). Measured divergence in this very repo: the
  root session's header reads `standard` while the two children it spawned — same tool table —
  read `dsh-smith`, and the shipped `standard` composition contains no `expert_*` row at all.
- **Rejected:** reading `agentPreset` from a header as the mounted preset id. It is exactly the
  kind of claim that looks like a measurement and is not: this session's own header would have
  mislabelled the composition under test.
- **Reversed by:** a version whose session header is rewritten on preset selection, or a
  projection whose `init` resolves the mounted preset rather than adopting the header.

## D-5: Does omitting `maxDepth` on an expert row inherit the team's cap of 2?
- **Decided:** No. It defaults to **3, per row and independently** — no inheritance, no
  cross-row propagation. The cap that actually binds is the one on `subagent` / `subagent_fork`.
- **Because:** the schema is
  `z.union([z.natural().max(Number.MAX_SAFE_INTEGER), z.const("provider-managed")]).default(3)`
  (`dsh-tool-subagent/lib/index.js:269`), and Cordis applies schema defaults before the plugin's
  `apply` runs (`cordis/lib/index.js:955-957`); the proof they *are* applied is
  `dsh-tool-subagent/lib/index.js:508`, which branches on `typeof config.maxDepth === "number"`
  and so can only see a defaulted value. In this composition the four expert rows omit the key
  (only L405 and L425 carry `maxDepth: 2`), so they carry 3. With depth counting from 0 at the
  lead, the reachable chain is lead(0) → expert(1) → grandchild(2), because
  `resolveChildDepth` rejects only `childDepth > maxDepth`
  (`dsh-subagent/lib/types/child-agent.js:32-41`).
- **Rejected:** the belief that the omitted key "rides the shared spawn provider" or a sibling
  row. Nothing reads a sibling's config; an omitted cap is a per-row literal after parsing.
- **Reversed by:** a schema change that makes `maxDepth` inherit from a group, or a preset edit
  that states the cap on all six rows — either would make the two cheap rows and the four
  expensive ones agree by construction instead of by arithmetic.
  <!-- SUPERSEDED BY D-10: the second reversal condition HAPPENED. All six rows now state
       `maxDepth: 2`, so the fact this entry rests on ("the four expert rows omit the key") is no
       longer true of HEAD. Read D-10 for the current state. Note also that this entry's own
       parenthetical — "only L405 and L425 carry `maxDepth: 2`" — contradicts the sentence it sits
       inside, which says the four expert rows omit the key. Both statements were true of the same
       revision; the parenthetical counted the file, the sentence generalised from it. -->

## D-6: Should this repo's npm tarball include the memory layers?
- **Decided:** Keep them in the **git** repository — that is what makes the memory travel with
  the code — and keep them out of the **npm package** by pinning the publishable set, unless
  shipping them is a deliberate choice. Nothing pins it today.
- **Because:** `npm pack --dry-run` (this session, exit 0) packs **19 files / 65.5 kB**, up from
  the recorded 15 / 56.3 kB, the four new ones being `.gitattributes` and
  `docs/agent-notes/{BOARD,DECISIONS,PROJECT}.md`; `AGENTS.md` was already in the list. The
  cause is that `package.json` has no `files` allowlist, so npm falls back to `.gitignore`
  (`npm-packlist` `gitignore-fallback`, guarded to the package root). A `files` list is the
  only mechanism under which the root ignore files stop being consulted, and it pins the set
  instead of depending on a growing tree being ignored correctly.
- **Rejected:** creating an `.npmignore` to silence the warning — it silences the same warning
  but leaves the publishable set defined by exclusion, which is the property that just drifted
  by four files. Also rejected: shipping the notes unexamined, because they contain internal
  state (hashes, session ids, half-open questions) whose audience is this repository.
- **Reversed by:** an explicit decision that the package *should* carry the chronicle for
  consumers — in which case add a `files` entry that admits them on purpose, and delete this
  entry's "unless".

## D-7: Decision on D-6's publish surface — memory layers stay out of the tarball
- **Decided:** Closed, and D-6's first branch is the one taken. `package.json` now carries
  `"files": ["bin", "dsh-smith", "README.md", "LICENSE"]`. The memory layers stay in the git
  repository and stay out of the npm package.
- **Because:** the allowlist was measured rather than assumed. `npm pack --dry-run` now packs
  **14 files / 58.1 kB** (was 19 / 65.5 kB), and every one of `AGENTS.md`,
  `docs/agent-notes/{PROJECT,DECISIONS,BOARD}.md`, `.gitattributes` and `.gitignore` is
  excluded — while nothing the preset needs was dropped: all four `bin/` scripts, the whole
  `dsh-smith/` tree including five skills, `preset.yml`, `README.md` and `LICENSE` are in.
  The chronicle's audience is this repository: it holds hashes, session ids, and half-open
  questions, and a consumer installing an agent preset has no use for them.
- **Rejected:** leaving the set defined by exclusion. That is the property that drifted by four
  files the moment the memory layers were committed, and it would drift again on the next
  addition. Also rejected: an `.npmignore`, which silences the same warning while keeping the
  publishable set unpinned.
- **Reversed by:** an explicit decision that the package should carry the chronicle; then add
  `docs` to `files` on purpose and record why.

## D-8: Would an idempotent upstream `register()` alone restore `cordis_*` to this preset?
- **Decided:** No — and D-1's reversal condition is therefore **too weak**. Two independent
  upstream changes are needed, not one: `register()` must become idempotent **and** a
  composition must be able to obtain the seven tools without running this row's `apply`, which
  is what registers the providers.
- **Because:** the two registration surfaces have different scopes (counted in
  `dsh-tool-cordis/lib/index.js`: one `ctx.cordisInspect.register` loop over four providers,
  seven `ctx.tools.register` calls). The providers are process-global and colliding; the seven
  tools are session-scoped and are registered **by the same `apply`**. So skipping `apply` to
  avoid the collision also skips the tools — the opposite of what is wanted. Idempotent
  `register()` removes the collision but leaves the tools registered into whichever session
  loaded the row first, not this one.
- **Rejected:** the naive refcount that the `expert_architect` report recommended alongside
  idempotency. No `refcount`/`refCount` token exists in `dsh-cordis-host-runner/lib/index.js`,
  so it is a new mechanism; and disposing the providers at zero consumers would leave a live
  `cordis_*` tool reading a registry that is gone, because `cordis_inspect_list` /
  `cordis_inspect_query` read it at call time. This half of the report never reproduced.
- **Reversed by:** an upstream split in which the tool registration does not also own the
  provider registration — e.g. a `tool-cordis` that consumes an already-registered provider set
  when present. That is what this repository cannot express from YAML, and it is the ceiling
  recorded in the README.

## D-9: Is a persona's contract satisfied by its final report alone?
- **Decided:** Yes for the contract, **no for the finding**. All four personas were called and
  all four emitted exactly their contracted blocks in their final messages — but the
  `expert_verifier`'s headline finding was **false**, so persona compliance says nothing about
  report quality.
- **Because:** measured this session. `expert_verifier` → `VERDICT` / `FINDINGS` / `SURVIVED` /
  `GAPS`, matching `agent.cordis.yml`; `expert_protocol` → `ANSWER` / `EVIDENCE` / `CONFLICTS` /
  `UNKNOWN`. Both compliant. Yet the verifier declared `maxDepth: 2` present on all four expert
  rows, and **printed a grep whose own output contradicted that** (six hits, none on an expert
  row), citing a commit body instead of the file, at a revision two commits behind. Re-grepping
  the same 40032-byte file reproduced the original audit exactly: the expert rows carry **no**
  `maxDepth` at all, so they defaulted to 3 — the opposite of both its claim and the composition
  comment it was reviewing.
- **Rejected:** "the persona contract was met, so the review is trustworthy". Two different
  claims, and the second does not follow from the first.
- **Reversed by:** nothing about personas — the fix is in the persona's *evidence standard*,
  which now requires a verbatim quote with path and line, re-running the command before pasting
  its output, and naming the revision checked. Whether that raises finding quality is itself
  unproven until the next verifier call.

## D-10: Where does the recursion bound actually sit, and is it one bound?
- **Decided:** On **all six** delegating rows, now explicitly — and it was **not** one bound
  before this session. The four expert rows stated no `maxDepth` and therefore carried the
  schema default 3, giving an expert a *deeper* budget than the lead's own tools.
- **Because:** `maxDepth` is checked as `childDepth > maxDepth` with
  `childDepth = delegationDepthOf(parent) + 1` (`dsh-subagent/lib/index.js:432`), and a
  top-level session header carries `delegationDepth: 0` — so levels count 0, 1, 2 from the lead,
  not 1, 2, 3 as the composition comment claimed. With `subagent`/`subagent_fork` at 2 and the
  expert rows defaulting to 3, the reachable chain was lead(0) → expert(1) → helper(2) →
  helper(3): the expert's subtree could go one level deeper than the lead's. All six rows now
  state `maxDepth: 2`, making the deepest chain lead(0) → expert(1) → helper(2).
- **Rejected:** resting on the two rows that were already correct and the comment that described
  a bound the file did not implement. A bound that holds on two of six rows is not a bound.
- **Reversed by:** a deliberate decision to let experts recurse further than the lead; then
  state a number on every row anyway, because the omission is what broke the invariant, not the
  value.

## D-11: Is `modelSelectionSettings: true` inert on this deployment?
- **Decided:** **No — it is wired and waiting.** The tool `list_subagent_models` is absent
  because the product's opt-in is off (`enabled` defaults to `false`), not because a required
  row is missing. Nothing in this repository needs to change; enabling it is one settings
  section, and any session started afterward gains the tool.
- **Because:** measured end to end, four links. (1) The Host-scope provider **is** mounted —
  `subagent-model-selection-settings` is a row of the **web-app** bundle
  (`dsh-web-app/cordis.patch.yml`), and `ctx.get('subagentModelSelection')` resolves live.
  (2) `subagentModelSelection.current()` returned `{enabled: false, allowedModels: []}`.
  (3) After writing `subagent-model-selection: {enabled: true, allowedModels:
  [{provider: deepseek-official, model: deepseek-flash}]}` into `$DSH_HOME/settings.yaml`, the
  same call returned `enabled: true` with that route and no restart — the settings document is
  hot-reloaded. (4) The file was restored, and the call returned `false` again. The registration
  gate agrees: `if (modelSelectionPolicy !== void 0) registerListSubagentModels(…)`
  (`dsh-tool-subagent/lib/index.js:389`), and the policy is empty while `enabled` is false. The
  schema default is explicit: `enabled: z.boolean().default(false)`
  (`lib/model-selection-settings.js:44`).
- **Rejected:** the two claims this repository had recorded. "The base composition does not
  mount it" was concluded from checking `dsh-base` alone — the row lives in the web-app bundle,
  and this deployment composes both. "It is silently inert" inverted the real behaviour: a
  missing provider **throws** (`lib/index.js:588`), and `lib/invariant.js:36-44` fails the step
  when a selectable tool exists without its projection.
- **Reversed by:** a settings document in which the section is absent (off) — which is exactly
  this deployment's state, and the reason the tool does not appear. This entry fixes the
  *mechanism*; whether the opt-in should be on is a user preference, not a finding.

## D-12: How did a two-part error survive into three documents?
- **Decided:** Because a claim was built from **one incomplete check** and then copied forward.
  The check was "grep `dsh-base` for the row"; the correct check was "ask the running runtime
  for the service", which was available the whole time and answers in one call.
- **Because:** the same false statement appears in `README.md`, `PROJECT.md` and `BOARD.md`,
  each time more confident than the last — and the second half ("silently inert") was never
  checked at all. It was inferred from "the tool is absent", which is a different question from
  "the setting is inert". The probe that settled it was one plugin and one call:
  `inject: ['subagentModelSelection']`, then `.current()`.
- **Rejected:** correcting only `README.md`. The memory layers are what the next session reads
  first, so a correction that stops at the README leaves the wrong claim exactly where it is
  most likely to be trusted.
- **Reversed by:** nothing — the rule this yields extends one already in `AGENTS.md` rule 3:
  **"the base composition does not mount it" is not a finding until every composed bundle has
  been checked**, and a deployment composes several. Grep one bundle and the answer is about
  that bundle only.

## D-13: Refcount or frozen first registration for the four inspect providers?
- **Decided:** **Frozen first registration, with no disposal of the four providers.** D-2's
  deliberate open is closed. The upstream fix this repository recommends is therefore two-part
  and precise: make `CordisInspectRegistryService.register()` idempotent for an
  already-registered provider id (return the existing disposer rather than throwing), and let
  the first registration own the provider for the life of the process. **No refcount.**
- **Because:** three reasons, in order of weight. (1) A refcount's dispose-at-zero branch
  removes the provider when the last consumer unloads, while `cordis_inspect_list` and
  `cordis_inspect_query` read the registry at **call** time — so a still-live tool in another
  session would find the provider gone. That is a new failure mode introduced to solve a
  problem the throw already solves. (2) The registry itself already has process lifetime: it is
  constructed by `DynamicCordisRunnerService` and never disposed
  (`dsh-cordis-host-runner/lib/index.js:1598`), so four manifests plus their query closures
  living as long as the registry costs nothing that is not already being paid. (3) A refcount
  is a **new mechanism** — grep for `refcount|refCount` in `dsh-cordis-host-runner/lib/index.js`
  returns no match — and it needs accounting to be correct on both increment and decrement,
  which is more ways to be wrong than a single first-writer-wins rule.
- **Rejected:** the `expert_architect`'s refcount recommendation, which was the half of its
  report that never reproduced. Also rejected: leaving D-2 open. It was recorded as "a design
  choice, not a measurement", and a design choice is exactly what a record can settle; carrying
  it as an open question made the board look unfinished for no gain.
- **Reversed by:** an upstream design in which provider lifetime is deliberately tied to
  consumer lifetime, or a measurement showing the four manifests are expensive enough to be
  worth reclaiming. Neither exists today, and the second would be surprising for a map of four
  entries.

## D-14: Does this record cite `file:line`?
- **Decided:** Only when the line number is itself the fact under discussion. Otherwise cite a
  **stable anchor** — a row id, a section title, a quoted phrase — because `file:line` is
  invalidated by every edit above it.
- **Because:** measured in this record, not hypothesised. `PROJECT.md` cited
  `agent.cordis.yml:670-671` for the `cordis_inspect_list` advice; by the time it was checked,
  those two lines were the section header and the corrected text had moved to `:712`. The
  citation had rotted **inside a single session** — the same session that wrote it — because
  the composition was edited four times in between. Two more citations survived by luck rather
  than design: `:415` and `:374-376` were both still correct only because the edits that moved
  other lines happened to leave those alone.
- **Rejected:** keeping line cites for precision. They read as more precise while being less
  durable than a quote, and a wrong line number is worse than no line number: it sends the
  reader to text that does not say what the record claims, which is exactly the failure mode
  this repository has already hit three times.
- **Reversed by:** a tool that rewrites citations on edit — at which point the anchor rule can
  relax, because the maintenance cost would no longer be paid by hand.

## D-15: May a session rooted in this repo write to `$DSH_HOME/settings.yaml` to settle a question?
- **Decided:** **Not without asking first.** The boundary in `AGENTS.md` covers `~/.dsh/**`, and
  `settings.yaml` is inside it. This session edited that file to prove the model-selection
  opt-in flips, then restored it — which produced a genuinely decisive result, and was still a
  boundary violation performed without consent.
- **Because:** the edit was reverified as restored (`subagent-model-selection` absent, the live
  service reading `enabled=false` again), so no harm survived. But "I reverted it" is a
  justification made after the fact, and the rule exists precisely because the user cannot see
  the write happen. A memory layer and a session log both looked identical before and after,
  which is the property that makes an unscoped write dangerous rather than merely rude.
- **Rejected:** treating it as acceptable because the file is hot-reloaded and the change was
  small. The size of the change is not the issue; the absence of consent is. Also rejected:
  deciding the question without the probe — a settings read alone could not show that the value
  flips, and D-11 rests on the flip.
- **Reversed by:** the user granting standing permission for probe-then-revert edits to
  `settings.yaml`, or a documented sandbox for them. Until then: ask, or record the question as
  open and let the next session with consent settle it.

## D-16: Does the strengthened verifier evidence standard improve findings?
- **Decided:** **Yes, and the evidence is the refusal rather than the agreement.** One
  `expert_verifier` call under the strengthened persona met all four of its hard requirements —
  verbatim quotes with path and line, a re-read at the revision in front of it, the command
  re-run before its output was pasted, and an explicitly named revision — and it **rejected the
  brief's own assertion** instead of confirming it.
- **Because:** the brief said "every one of the six delegation rows in the `team` group states
  `maxDepth: 2`, and no other value". The verifier returned `VERDICT unsound`, citing
  `tool-subagent-codex` and `tool-subagent-claude-code` at `maxDepth: provider-managed`. That
  qualification had been written down one turn earlier and was stripped when the brief was
  issued verbatim from the board — so the verifier was right and the brief was wrong. It also
  named its revision at **blob** granularity (`9eb8b39e…`, three-way confirmed against the
  `24ac033` blob, the current HEAD blob, and `hash-object` on disk) rather than citing a commit
  and reasoning from ancestry. The contrast that gives this weight is D-9: the same role, same
  task type, previously returned a headline finding that was **false** and printed a grep
  contradicting it. Same role, same task, opposite outcomes, the only change being the standard.
- **Rejected:** reading the compliance as the result. A report that obeys the format while
  confirming whatever it was handed is a rubber stamp; the property worth measuring is whether
  it will contradict its brief on evidence, and this one did.
- **Reversed by:** a run in which a verifier under this persona confirms an over-claimed brief,
  or asserts something its own pasted output contradicts. One refusal is strong evidence, not a
  guarantee, and the persona could still be satisfied while the finding is wrong — which is
  exactly what D-9 describes, so the two entries are read together.

## D-17: Is the `write`/`edit` filter on `expert_verifier` actually enforced?
- **Decided:** **Yes — enforcement observed, and the alternative explanations excluded by
  differential experiment.** The filtered tools are absent from the child's tool table *and* a
  forced call is rejected with `unknown tool`.
- **Because:** two lines of evidence, and the second is the one that matters. (1) Observation:
  the child's `TOOLS` list contains neither `write` nor `edit`; a forced `write` returned
  `Error: unknown tool "write"` and `edit` likewise, and the probe path left `Test-Path` false,
  so nothing was created. (2) **Differential control**, because absence alone cannot distinguish
  the filter from depth or inheritance: a probe subagent at the **same depth, same provider, and
  the same `applyChildComposition` code path** but **without** any `toolFilter` retains `write`
  and `edit`. The only declared difference is `toolFilter: {deny: [write, edit]}` on the
  `tool-expert-verifier` row. `pwsh` — the tool that row's comment says is deliberately *not*
  denied — survives in both, so the filter removed exactly the two names it names. Mechanism
  read from the installed packages: `if (composition.toolFilter !== void 0)
  childCtx.tools.restrict(composition.toolFilter);` (`dsh-subagent/lib/index.js:554`), with
  `toolFilter: true` advertised by the spawn provider and a fail-loud guard when a provider
  lacks it.
- **Rejected:** resting on the absence alone. "This child has no `write`" is equally consistent
  with a depth rule, an inheritance rule, or a different provider — the control run is what
  removes those, and it is cheap.
- **Reversed by:** a run in which an unfiltered subagent at the same depth also lacks the tools,
  or one in which a filtered child retains them. **Still not isolated, and not claimed:** that
  `restrict()` specifically — rather than another mechanism with the same observable effect —
  produced the rejection; and whether `toolFilter` is fail-loud on an unknown name, or how it
  composes with `allow`, is untested.

## D-18: Did this preset's thesis survive being tested on itself?
- **Decided:** **Partly, and the failure is in the human-readable layer.** The preset's claim is
  that a verifier with an evidence standard finds what a summary-follower misses. That happened:
  the verifier caught an over-claim in its own brief and refused it. The same preset's memory
  layer, meanwhile, carried a stale `In progress` table that said "Nothing delegated" while a
  dispatch was in flight, and no entry at all for the restart that destroyed the subagent
  registry.
- **Because:** the two facts sit in the same repository and the same day. The machine-checkable
  parts of this project — the composition, the mount, the tool table, the filter — were all
  verified by execution. The prose that records *what was done* was repeatedly found stale by an
  independent reader rather than by its author: D-5 vs D-10, PROJECT.md's pre-fix snapshots, and
  now the board's own `In progress` row. Three of this record's entries exist because someone
  else read the files.
- **Rejected:** treating the board as a passive log. A snapshot table with no timestamp is read
  as current whenever it is opened, so it needs either a timestamp or a statement of what it is
  a snapshot **of**. Both were missing.
- **Reversed by:** a session that catches its own stale layer before a second party does. Until
  that happens, the honest summary is that this project's verification discipline is stronger
  than its bookkeeping, and the bookkeeping is what a stranger reads first.

## D-19: Does `dsh-forge` present tools as `ptc` or as `both`?
- **Decided:** **`both`.** The PTC code-mode surface is composed as an addition — `run_code` plus
  the generated TypeScript SDK — rather than as a replacement for the native tool catalog.
- **Because:** a read of the collapse rule, not a preference. `dsh-tools/lib/index.js:2993-2995`
  is `collapses(name, scope, nested) { return !nested && this.modeFor(scope) === "ptc" && name
  !== "run_code" }`, and `wireSchemas` reduces the request to `run_code` alone at `:2735-2738`.
  Under `ptc`, therefore, **a model-direct call may name only `run_code`**, so `exit_plan_mode`,
  `ask_user_question` and `present` become reachable only as SDK sub-calls. Those sub-calls do
  work — the SDK binding at `:1207-1220` propagates `agent`, `parent` and `signal`, and
  `exit_plan_mode` needs exactly `exec.agent` (`dsh-plan-mode/lib/index.js:252-255`) — so the
  choice is about **reliability, not correctness**: a plan approval and a question to the user
  are tools whose whole value is an unambiguous direct invocation, and `both` keeps that while
  still shipping `run_code` for the multi-step chains that motivated PTC in the first place.
- **Rejected:** shipping `ptc` on the reasoning that a preset offering one tool "thinks harder".
  It is the same composition surface either way; `ptc` only removes the direct alternative, and
  it also discards the native schema as the fallback for any generated-SDK gap.
- **Reversed by:** a measurement showing the `tools:sdk` section and `run_code` do not reach the
  model under `mode: both`, or that the longer catalog measurably degrades tool selection in a
  real session. Either would move this to `ptc`, and the first would be a defect to report
  upstream rather than a configuration error here.

## D-20: Is a `standingKeyFor` mount check runnable for a second preset in this deployment?
- **Decided:** **No — not from this repo's own sessions, and this will not change by trying
  harder.** `dsh-forge` ships as *statically preflighted, never mounted*. The mount check is
  runnable only from a session on the **shipped `cordis` preset**, and every statement of
  `dsh-forge`'s verification status must say so.
- **Because:** measured, in this session, in this order. `dsh-tool-cordis` registers four
  **process-global** inspect providers (`Service`, `Event`, `Builtin`, `Tool`) whose registry
  throws on a duplicate id (`dsh-cordis-host-runner/lib/index.js:732`). The host takes those ids
  at boot (`dsh-web-app/cordis.patch.yml:122` → `cordis-host-runner`), so any other composition
  containing that row must gate it off or fail its whole mount — both presets here do. The
  consequence is not merely that the *row* is off: **this session's own tool table contains no
  `cordis_*` tool at all**, so `cordis_define` / `cordis_run` and the dynamic-plugin probe built
  on them are unavailable. The file grep that confirms the gate and the live table that confirms
  its absence agree.
- **Rejected:** (a) reading the composition carefully and calling it verified — a mount is the
  only evidence for "activates but contributes nothing", and no amount of care substitutes;
  (b) removing the gate locally "just to run the check" — the registration would collide with the
  host's already-claimed ids and fail the mount of the very preset being checked, which is a
  worse experiment than not running it; (c) composing a third preset that re-registers the
  providers — the same collision as (b), and it would corrupt a shared host registry to satisfy a
  local check.
- **Reversed by:** running `standingKeyFor('dsh-forge')` from a shipped-`cordis` session — the
  cheapest available experiment, and it fully answers the question. An upstream change making
  `CordisInspectRegistryService.register()` idempotent (D-8, D-13) would also reopen it, since
  the collision is what forces the gate.

## D-21: Should the four tool scripts keep a hardcoded preset id, or grow a registry?
- **Decided:** **A shared registry, `bin/presets.mjs`.** Each preset's id, repository directory,
  display name, upstream preset and expected tool list live there once; `install.mjs`,
  `verify.mjs`, `lint-skills.mjs` and `drift-check.mjs` read their paths from it. Every script
  takes `--preset <id>` and **defaults to `dsh-smith`**, so every pre-existing invocation keeps
  its exact meaning.
- **Because:** the alternative was four independent edits with four chances to leave one script
  pointing at the wrong preset — and all four of these scripts report a wrong path as a
  *successful* run against the wrong file, which is the silent-failure shape this repository
  keeps having to design against. Measured after generalising: with no `--preset`, lint reports
  the same five skills clean, drift reports the same 36/32 rows and the same six drifted rows,
  and install refuses to overwrite with the same message — the regression baseline held.
  `drift-check` needed one non-obvious field: **`upstreamPreset` is per-preset**, because
  `dsh-smith` descends from shipped `cordis` while `dsh-forge` descends from shipped `standard`,
  and comparing either against the other's ancestor reports every legitimate difference as
  drift.
- **Rejected:** deriving `repoDir` from `id` by convention. The directory name and the preset id
  are both load-bearing and independently renameable; an explicit field makes a mismatch a
  visible edit instead of two things that agree until one of them moves.
- **Reversed by:** a second consumer of the preset list appearing outside `bin/` (a CI config, a
  test harness) — that would argue for `package.json`'s `dsh.presets[]` becoming the single
  source, rather than a written-but-inert parallel copy of the same data.

## D-22: Does an adversarial review of a change I authored pay for itself?
- **Decided:** **Yes, and its value was in the documentation rather than the design.** One
  `expert_verifier` call on the `dsh-forge` change returned *"sound on the composition; unsound
  on the documentation"*: it confirmed all six load-bearing technical claims by re-reading source,
  and then found that **the numbers and evidence I printed around them were wrong in seven
  places.** No finding required touching `dsh-forge/agent.cordis.yml`'s rows; every defect was in
  what I said about them.
- **Because:** the most instructive of the seven, and the reason this entry exists rather than a
  quiet fix. I published the decomposition of the composition's 38 named rows four times as "4
  top-level rows + 3 group containers + 31 inside the groups". The **total** was right — I had
  measured it — and the **split was fabricated**: there are 20 rows at indent 0 (17 plain rows
  plus the 3 containers) and 18 at indent 4. Worse, PROJECT.md named exactly four top-level rows
  while listing three of them, and `docs/dsh-forge.md`'s own table two lines below was labelled
  「顶层」 while showing four of seventeen. Each sentence contradicted itself, and nothing caught it
  because a plausible split of a correct total reads exactly like a measured one. This is D-10's
  shape in a new costume: **the over-claim was not in a claim about the runtime, where my guard was
  up, but in a number about my own artefact, where I trusted the total to vouch for the parts.**
  The other six: an install row whose quoted evidence came from the *refused* path (`target:` and
  `found:` print on both paths, so they never proved success); a command line
  (`dsh --agent-preset <id>`) that does not exist — no package contains the string
  `--agent-preset` — repeated into a new file from the README; "seven delegating rows" stated
  without the qualifier that two more rows name `maxDepth` at `provider-managed`; a skip
  explanation whose sub-counts summed to 9 against a total of 10; `verify.mjs`'s INCONCLUSIVE
  advice pointing at a session where the check cannot run; and two of the four new skills never
  cued by the persona — while the persona *did* cue `dsh-expert-team`, a skill belonging to the
  other preset.
- **Rejected:** applying the fixes silently. A review whose findings vanish into a clean final
  state teaches the next session nothing about **where this author's errors concentrate**, and
  the concentration is the finding: the composition was right and the prose about it was not, in
  a session explicitly chartered to distrust prose. Also rejected: the reviewer's own arithmetic
  accepted unexamined — it said the 10 skips were "3 + 2 + 4" when the file shows 3 groups + **1**
  subpath + **1** unevaluated expression + **5** no-schema rows. Its correction of my error was
  itself slightly off, which is exactly why an expert report is a source, not a verdict (and the
  corrected breakdown is now in `docs/dsh-forge.md`).
- **Reversed by:** a session in which an independent review of a change finds nothing in the
  documentation — or one in which the author's own check catches a fabricated decomposition before
  a reviewer does. Until then, when this repository's docs state a breakdown, the parts get
  counted, not inferred from the total.

## D-23: Is D-20 still right — was the `dsh-forge` mount check really unrunnable?
- **Decided:** **Half of D-20 was right and half was wrong, and the wrong half mattered.**
  - **Right:** the dynamic-plugin probe route is closed in `dsh-smith` and `dsh-forge` sessions,
    so the check needs a session on the **shipped `cordis` preset**. Confirmed by measurement, not
    reasoning: live loader state shows `tool-cordis enabled=true fiberPhase=active` under the
    shipped `cordis` preset, `enabled=false fiberPhase=null` under `dsh-smith`, and no such entry
    under `dsh-forge` at all.
  - **Wrong, and D-20 asserted it:** that `bin/verify.mjs` was a way to run the check provided you
    stood in the right session. **It is not a way to run it from any session.** The script builds
    its own bare Cordis context — `root = new cordis.Context()`, `bin/verify.mjs:204` — which
    carries none of the harness registries, so `agentPresets` is absent *by construction* and it
    prints `INCONCLUSIVE — this runtime publishes no agentPresets service` with exit 1 from a plain
    shell **and from inside the shipped-`cordis` session where the probe route worked**, measured
    twice with byte-identical output. D-20's `Reversed by` clause named `standingKeyFor` as the
    remedy and bundled the script in as if location were the only obstacle; the obstacle was the
    script's construction.
- **Because:** the user, reading D-20 and `docs/dsh-forge.md`, ran the probe from the shipped
  `cordis` preset and got **`MOUNTED OK`** — `standingKeyFor('dsh-forge')` resolved a standing
  scope key, `compositionInventory()` reporting 35 rows active, 4 disabled by design
  (`tool-bash` and `tool-pwsh` platform gates, the two product-provider rows), `broken=none`. That
  also answers what the static pass structurally could not: **no row is mounted-but-contributing-
  nothing**, so the `compaction`/`toolResultPruner` realm pairing and `tool-presentation`'s wait on
  the host `codeRuntime` both came up active. So `dsh-forge` is now **mounted and verified**, not
  "statically preflighted, never mounted" — a status this record carried in four places.
- **Rejected:** (a) editing D-20 in place. The append-only rule exists for exactly this: D-20's
  reasoning about the probe route was sound and someone will need it again, while its conflation of
  "the script" with "the route" was the error, and only a new entry can say both. (b) Silently
  accepting the inventory's 35-active figure. The file has 38 named rows with 4 disabled, implying
  **34** enabled; 35 + 4 = 39. One counting method is off by one, the per-row output is what would
  settle it, and neither document now claims a number it cannot show.
- **Reversed by:** ~~running `standingKeyFor('dsh-forge')` from a shipped-`cordis` session~~ — done,
  and it passed. What would reverse the *surviving* half: an upstream change making
  `CordisInspectRegistryService.register()` idempotent (D-8, D-13), which would let a locally
  authored preset register the four providers and reopen the probe route inside its own sessions.
  What would reverse the `verify.mjs` half: making that script connect to a live harness runtime
  instead of constructing a bare one — at which point it becomes what its name promises.

## D-24: Should the `verify.mjs` defect be recorded as a defect, or quietly corrected?
- **Decided:** **Recorded, and the script corrected.** Its header comment and its INCONCLUSIVE
  advice were rewritten to say what it actually is — a diagnostic that boots its own runtime and
  cannot reach the roster — and to point at the dynamic-plugin probe route for the mount verdict.
- **Because:** the script has been printing advice that sends a reader to a session where the check
  still fails, and it had been doing so since before this session: I generalised it to `--preset`
  without questioning the one thing that decides whether it works. That is the same error class as
  D-22's — a plausible artefact that no one re-derived — and it is worse here, because a diagnostic
  whose advice is wrong is indistinguishable from a diagnostic whose deployment is wrong. The
  measured evidence is two byte-identical runs in two different session types, which is what makes
  it a defect rather than a hunch.
- **Rejected:** deleting the script or renaming it. It still does something real — it tells you
  whether *this machine's CLI* can reach a harness runtime at all, and it validates and counts the
  composition file it finds — and a reader who knows its limit is not misled by it. Deleting it
  would also remove the only place the "MOUNTED OK / MOUNT REJECTED / INCONCLUSIVE" distinction is
  written down.
- **Reversed by:** a version of the script that attaches to the live runtime (a `dsh`-hosted entry,
  or an injected `agentPresets` from a session), which would let it report a real verdict and make
  this entry a historical note about a limitation that was fixed rather than worked around.

## D-25: Did the composition file and the mount inventory really disagree by one row?
> **This entry settles the discrepancy D-23 recorded and could not resolve.** D-23's text still
> repeats the two wrong figures (`34` enabled, `35 + 4 = 39`) in its rejected-alternatives clause;
> they stand there only as the claim that was rejected, and **31 active** is the correct figure.
> D-23 is not edited, per the append-only rule — read it together with this entry.
- **Decided:** **No — the two counts agree, and both published numbers were wrong.** The
  composition has **38 named rows = 3 group containers + 35 leaf rows**, of which **31 are active**,
  **2 are `"conditional"`** (`tool-bash`, `tool-pwsh` — the `!!js` platform gates, exactly one of
  which runs on Windows) and **2 are `false`** (`tool-subagent-codex`, `tool-subagent-claude-code`).
  The one correct equation is **35 leaves − 4 disabled = 31 active**.
- **Because:** read from both counting paths rather than inferred, and then reproduced.
  `flattenRows` (`dsh-agent-presets/lib/index.js:991`) and `mountedCompositionRows` (`:1038`) both
  `continue` past `group: true` entries, so a row list is **leaves only** — the inventory's 35 is
  the leaf count, and it never included the 3 containers. An independent YAML parse of the file,
  applying that same rule and the same three-way enablement (`true` / `"conditional"` / `false`),
  returns exactly 35 rows with 31 true, 2 conditional, 2 false. The two errors were mine and both
  were arithmetic dressed as counting: (a) I labelled the total 35 as "`fiberPhase=active`" when 4
  of those rows are off, and (b) I derived "34 enabled" from `38 − 4` — subtracting from a total
  that includes the 3 containers no row list ever contains.
- **Rejected:** holding the reconciliation open for a per-row paste from the live inventory. My own
  first instinct was that only the runtime could settle it, and that was wrong: the rule that
  decides the question is **source code**, and it is four lines long. Waiting on a paste would have
  left a wrong number standing in two documents in order to preserve a claim about who could
  settle it. **The tool is authoritative only where the tool's semantics are unknown; once read,
  they are reproducible anywhere.**
- **Reversed by:** `compositionInventory()` returning a row count other than 35, or an `enabled`
  triple other than 31/2/2, for this revision — which would mean the two paths do not share the
  semantics read above. Also reversed by `flattenRows` or `mountedCompositionRows` changing to
  report containers, which would make the `38 = 3 + 35` split obsolete rather than wrong.

## D-26: Under `mode: both`, is the `write`/`edit` deny list enforced — and *how*?
- **Decided:** **Enforced, and the mechanism is stronger than the word "rejected" in D-17
  implied.** The two denied names are **absent from the child's SDK object**, so a forced call dies
  at property lookup — `TypeError: tools.write is not a function`, `instanceof ToolCallError ===
  false` — and the tool layer is never entered. D-17's observed `Error: unknown tool "write"` is
  not contradicted: that is the **dispatch-stage** refusal a native-schema call gets from
  `resolveExecution` → `UNKNOWN_TOOL` (`dsh-tools/lib/index.js:2906-2911`). Both are true, and the
  distinction matters because only the second is a guard; the PTC path has no binding to guard.
- **Because:** three readings from one delegated `expert_debugger` under a real `dsh-forge` session,
  plus a control. (1) **Table:** `propcount = 30`, with `Object.keys`, `getOwnPropertyNames` and
  `getOwnPropertySymbols` in agreement (`0` symbols, prototype `null`), `has_write=false`,
  `has_edit=false`, `has_ralph=true`. (2) **Prompt:** neither `write` nor `edit` appears as a member
  of the `tools:sdk` section, while `pwsh`/`read`/`grep` do — the grep that establishes this must
  target member syntax (`edit:`), because `edit` occurs in that section as a *value*
  (`update_goal`'s `action: "edit" | …`) and in the persona prose upstream of it. (3) **Call:**
  the two `TypeError`s above, with `tools.glob` succeeding in the same run, and `Test-Path` false
  afterwards. Mechanism read from the installed packages rather than inferred:
  `childCtx.tools.restrict(composition.toolFilter)` (`dsh-subagent/lib/index.js:554`) →
  `ToolLayer.admits` (`dsh-tools/lib/index.js:2546`) → `view(scope)` (`:2868`, the
  `layers.every(...)` gate) → `visible`; both `schemas()` and `sdkSchemas()` (`:2918`, `:2922-2923`)
  read that one `visible` map, so "absent from the native table" and "absent from the SDK section"
  are **one fact seen twice**, not two independent confirmations.
- **Control, which is what excludes the alternatives:** a plain `subagent` delegation — same depth,
  same spawn provider, same `applyChildComposition` path, and **no `toolFilter` on that row**
  (`dsh-forge/agent.cordis.yml:477-484`) — enumerated 32 names with both tools present and
  typeof `"function"`, and its `tools.edit(...)` was **really dispatched** to the code-runtime
  worker, returning a typed `ToolCallError` carrying `toolName: "edit"` (it failed on the
  read-before-write observation policy, a file-level reason that presupposes a live binding).
  `ralph` and `workflow` are composed rows (`:798`, `:792`), so the unfiltered count is an exact
  match for the composition rather than a superset.
- **Rejected:** (a) reporting the absence alone — three children at the same depth establish that
  the *environment* shows 32, which is what makes the filtered child's 30 attributable to the
  filter; (b) resting on the earlier `dsh-smith` result — it was taken under `native` presentation,
  and this question is specifically about PTC; (c) treating the child's self-report as the
  measurement. It was not: the first filtered report **omitted `ralph` from its prose list** while
  the runtime array contained it, and misquoted the type alias as `ToolNames` where the renderer
  emits `ToolName` (`dsh-tools/lib/index.js:1645`). The count was right; the transcription was not.
  A follow-up re-measurement on the same child reproduced 30 with `ralph` present and corrected
  both slips. **Have the runtime `console.log` the array, and compare against it — not against a
  model's retyping of it.**
- **Reversed by:** a filtered child retaining either binding in its SDK object, or a forced
  `tools.write` reaching the tool layer and failing with a `ToolCallError` rather than a
  `TypeError` — either would mean the removal happens at dispatch rather than at presentation.
  **Not claimed:** that `expert_verifier` was measured separately (it was not — its row
  `dsh-forge/agent.cordis.yml:548-558` is byte-equal in `toolFilter`, `provider`, `maxDepth` and
  `backgroundMode`, so testing one covers both *by that equality*, not by observation); and that
  the filter is a sandbox boundary, which it explicitly is not — `pwsh` is deliberately retained
  and a shell can write files.

## D-27: Was "the deny list holds under PTC" the right claim to have made?
- **Decided:** **It was true, and it was the wrong formulation — the observation is strictly stronger
  than the claim it was tested against.** The verified statement is not *"a filtered call is
  rejected"* but ***"the binding does not exist"***: under `ptc`/`both` the denied names are absent
  from the child's SDK object, so a forced call dies at property lookup with
  `TypeError: tools.write is not a function` and the tool layer is never entered. D-26 carries the
  mechanism and the control; **this entry records that the correction was to my own expectation, not
  only to the old wording in D-17**, and that both documents written before the measurement
  (`README.md`'s 已关闭 section and `docs/dsh-forge.md`) needed the same amendment.
- **Because:** every framing I wrote beforehand implied a **guard** — a call arriving and being
  turned away. On this platform there is nothing to turn away. And a second consequence, which is
  the part most likely to mislead a later reader: I had listed "absent from the mounted table" and
  "absent from the SDK section" as two checks, and they are **one fact seen twice**, because
  `schemas()` and `sdkSchemas()` both read the same `view(scope).visible` map. A checklist whose two
  items are one item invites a reader to treat agreement as independent confirmation, which is the
  error D-22 recorded in a different costume — *a fabricated decomposition under a correct total*.
  Here it was *two witnesses who are the same witness*.
- **Rejected:** silently updating the wording and moving on. The prediction is the artifact worth
  keeping: **"holds" was testable and passed, "is absent" is what the platform actually does**, and a
  next session inherits the second only if someone writes down that the first was a coarser guess.
  Also rejected: recording the nine-tool list as the inventory. It is a **floor**: the session's table
  carried 32 names including `ralph` and `workflow` (composed at `agent.cordis.yml:798`, `:792`), so
  the checklist's job was to be checkable, not exhaustive — and `docs/dsh-forge.md` now says so.
- **Reversed by:** a filtered child whose SDK object *has* the member and whose forced call returns a
  `ToolCallError` instead of a `TypeError`, which would mean removal at dispatch and put the guard
  framing back. **Instrumentation caveat, recorded because it bit this measurement:** a child's
  self-reported list is a transcription, not a reading — the first filtered report dropped `ralph`
  from its prose list while the runtime array held it, and misquoted `type ToolName` as
  `type ToolNames`. Have the runtime print the array and compare against that.

> **D-28 and D-29 are deliberately absent.** They decided the fate of a balance plugin that this
> repository used to carry; at the user's request that plugin's source *and its records* were
> deleted outright, so both entries were removed here rather than superseded. The numbers are not
> reused, so D-27 → D-30 is a gap by design and nothing is missing from the file.

## D-30: Does dsh need a knowledge base or a database built next?

- **Decided:** **Neither.** Build the missing **model-side retrieval tool**, and leave the storage and
  injection surfaces alone.
- **Because:** the evidence places every part of this capability except one.

  **(a) Storage exists and is in use.** The KV stack — `dsh-storage` + `dsh-storage-json`
  (`root: dshHomePath('storages')`) + `dsh-storage-domain` (`backend: json`) — is mounted as three
  rows at `dsh-base/cordis.patch.yml:145-156`, and session logs are durable JSONL/Zstd under
  `$DSH_HOME/sessions` (`dsh-base/cordis.patch.yml:110-113`). Measured on disk:
  `~/.dsh/storages/workspace.json` plus one JSON record per session under
  `~/.dsh/storages/session_projcache/sessions/`. **No `.db`/`.sqlite`/`.sqlite3` file exists anywhere
  under `~/.dsh`** — verified with a control that found the `.json` files it would have had to find.
  *(Deliberately no counts: both populations grow on every session — the projcache went 130 → 137
  across the two readings this session, so a figure here would be stale before it was read. Re-measure
  with the paths above; D-16 is the standing rule.)*

  **(b) The corpus and its injection surface exist.** `dsh-session-reference` is mounted at
  `dsh-web-app/cordis.patch.yml:78-79`; it turns a user's `@[label](dsh-session:<base64url-id>)`
  mention into a bounded, untrusted, immutable `<referenced-sessions>` snapshot appended as a second
  user-role message (`dsh-session-reference/README.md:32,36`; framing built at
  `lib/index.js:394-401`). Trust handling and a context-relative budget are already implemented:
  per-source `max(65536, floor(contextWindow x 4 x referenceContextFraction))` bytes, default
  fraction `0.2` (`README.md:48-53`).

  **(c) The gate is initiation, and it is hard.** That injection fires from the `agent/pre-step`
  listener on a **user-authored** mention (`lib/index.js:467`), so the model cannot start it. Its
  hard ceiling is `maxReferences <= 3` ("must not exceed 3", `README.md:48`), and its projection
  keeps user/assistant text only — tools, reasoning and injected context are excluded
  (`README.md:69`). Ranked search is installed but switched off: `path: ':memory:'`,
  `openAt: never` at `dsh-base/cordis.patch.yml:129-133`, restated at
  `dsh-web-app/cordis.patch.yml:27-30`, and **not overridden** — the live profile overlay
  `~/.dsh/profiles/web/cordis.patch.yml` is a bare `[]` — its stale comment block, which explained
  a removed bundle's row, was deleted in a later housekeeping pass and the tree still composed
  **152 named rows** afterwards. The deployment's effective bundle list is two entries
  (`~/.dsh/profiles/web/package.json`: `dsh-base`, `dsh-web-app`) — it was three until a community
  bundle was removed at the user's request, which is the removal this same request made to
  `dsh.profile.bundles`.

  **(d) No model-facing consumer exists.** `dsh-tool-session-query`, which
  `dsh-session-query/README.md:128` names as the model-facing consumer, **is not installed** in the
  tree. The union of `dsh-tool-*` **rows** across this repo's two presets is **16** packages
  (measured by parsing `- id:` blocks, not by grepping the file — a bare grep returns 17 because it
  also matches `@deepseek-ai/dsh-tool-pwsh-persistent` in a *comment* at
  `dsh-forge/agent.cordis.yml:260`, which is exactly the count-vs-cite trap), none of them
  session/DB/KB. `dsh-session-query`'s own README (`:150`) states a model tool must supply its own
  authorization, so that burden is real work, not configuration.

  **(e) No vector capability to build on.** `embedding`/`vector`/`cosine`/`rerank` appear **only** in
  unrelated senses ("argv vector", "embedding a value in a message"), and "semantic" throughout this
  tree means literal case-insensitive text extraction for FTS, never similarity.

- **Rejected:** (1) **Build a separate knowledge-base engine** — the injection surface, its byte
  budget and its trust model already exist; a second one would duplicate them and pay the same
  prompt-budget cost. (2) **Deploy a new database** — the medium, schema-validated domains and
  atomic publish already exist, and nothing measured suffers from a storage gap. (3) **Generic
  RAG/embeddings** — no vector capability ships anywhere in the tree, so it is a wholly new
  dependency; and the 3-source ceiling caps how much retrieved material can be injected anyway, so
  recall is not the binding constraint. (4) **Leave the question to the next session** — it would
  re-derive this whole inventory, which is exactly the cost these layers exist to remove.
- **Reversed by:** any of three observations. **(i)** Enabling the index
  (`openAt: first-search` + a durable `path`) and then reading a real search result — if full-text
  recall over the 137-log corpus proves sufficient for the model's real questions, the tool is a thin
  wrapper and the KB framing was the mistake, not the tool. **(ii)** A measured case where
  `maxReferences: 3` truncates the knowledge actually needed, which would force a different
  injection design. **(iii)** The `run_code` question recorded under **Open questions** on
  `BOARD.md` resolving as "a preset other than these two served the session" — that would invalidate
  part (d)'s preset-union evidence.

## D-31: How does a self-authored plugin serve an authenticated route to this deployment's Web GUI?

- **Decided:** Author the plugin as a **standalone package outside this repository**
  (`$DSH_HOME/plugins/dsh-account-balance/`), name it so it cannot be confused with the removed
  balance work, register it as a **web-profile dependency** through
  `dsh plugin --profile web add <path>`, and mount it with **one `insert:` row** in
  `$DSH_HOME/profiles/web/cordis.patch.yml` whose `name` is the **bare package name**.
  The route is registered through **`ctx.connection.fetch.register()`**, never through
  `webServer.register()`.

- **Because:** five things were measured on the running deployment, and three of them are
  general facts this repository did not have.

  **(a) A package-directory row never reaches the client boot graph, and usually fails the boot.**
  `dsh-client-modules` resolves a row through Node's internal ESM resolver and then walks up from
  the resolved module's *directory* looking for a manifest
  (`lib/index.js:679-726`). A directory path yields `ERR_UNSUPPORTED_DIR_IMPORT`, caught at
  `:705-707` → no graph row, and the row's own `import` throws the same way
  (`cordis-plugin-loader/lib/index.js:274`). Measured in-process: a **bare package name** resolves,
  a directory path does not. After the switch the boot manifest carried
  `dsh-account-balance` as entry 54 of 54, and the served bundle contained `dshBal_badge`.

  **(b) A root-tree row applies before `connection` exists — this was the real bug.** The first
  version used `ctx.get('connection')` with an absence check and confirmed its own absence by
  appending to a diagnostic file: inside `apply`, `connection`, `credentials` and the `fetch`
  registry were all `undefined`, and the suite of context services was only
  `get,set,provide,accessor,mixin,runtime,effect,inject,plugin,on,once,parallel,emit,serial,bail,
  waterfall,…`. The row therefore mounted, reached the boot graph, served its badge, and registered
  **no route** — a 404 that no log line explained. Fixed by declaring the hard dependency that the
  shipped `/api` route owners declare (`dsh-client-ui-deliverables/lib/index.js` and
  `dsh-session-log-export/lib/index.js` both carry `inject` with `connection` in it); after that
  `/api/balance` answered 200.

  **(c) A cache helper that returns its own entry type answers 200 with the amount missing.** The
  single-flight cache returned `{ok:true, value}` instead of `value`, and because the route spread
  the result into a hand-built envelope, every field in the envelope still rendered and only the
  three fields read *through* the value were absent. **A wrong answer, not an error** — the failure
  mode worth remembering. Both the envelope shape and the values are now asserted.

  **(d) The authentication fence sharpens an existing finding rather than contradicting it.**
  `PROJECT.md` records that every `webServer` route sits outside the browser gate. Measured here:
  `GET /api/balance` **without** a cookie is **401**, and the same request **with** the cookie is
  **200**. The difference is the registration path —
  `dsh-client-connection/lib/index.js:768-781` applies `requestRejection` (Host/Origin fence, then
  the browser cookie) before it bridges to the exact-route table, while `webServer.register()`
  bypasses that handler entirely. So the earlier claim is right about the *escape hatch* and wrong
  if read as "any route a plugin adds is unauthenticated": the **connection Fetch-route registry is
  the authenticated way to add one**, and it is what a plugin should use.

  **(e) The route must not carry the credential.** The key is resolved per request through the
  `credentials` seam from the reference name `DEEPSEEK_API_KEY`, so it never enters the composition
  file or the served bundle. Asserted, not assumed: the served 11 MB batch was searched for the
  secret value (35 chars) and contained it **zero** times.

- **Rejected:** (1) **Keeping the package in this repository.** `AGENTS.md` rule 7 says this repo
  ships presets and nothing else, and a vendored plugin must also join the root `package.json`
  `files` allowlist or be silently absent from the published tarball. A deployment-local package in
  `$DSH_HOME/plugins/` needs neither, and it is where a plugin with no preset provenance belongs.
  (2) **Reusing the `dsh-balance` name.** `AGENTS.md:104-108` records that the user had a plugin of
  that name removed outright, source and records together. The new package is
  `dsh-account-balance`, written from scratch in this session, and it is mounted in a profile — the
  two things the history forbids are looking for the old one and restoring it, neither of which
  happened. (3) **A dynamic Cordis package** — `dsh-cordis-host-runner/README.md` states definitions
  live only in process memory and a DSH restart clears them, so it cannot be a durable answer.
  (4) **`ctx.get('connection')` with an optional guard** — measured wrong in (b).
  (5) **A `schemastery` `Config`.** pnpm's strict linking means the plugin's own bare specifiers
  resolve from the link's real path, outside every `node_modules`, so `import '@deepseek-ai/
  schemastery'` fails with `ERR_MODULE_NOT_FOUND`. Cordis needs exactly one thing from `Config` —
  `runtime.Config["~standard"].validate(config)` (`@deepseek-ai/cordis/lib/index.js:955-961`) — so
  the plugin ships a hand-written Standard Schema object. Verified by calling the loader's **own**
  `resolveConfig` against it: defaults fill, and a bad field throws
  ``ValidationError: invalid config: - $.refreshSeconds expected an integer from 0 through 86400 but got -1``.

- **Reversed by:** any of **(i)** a DSH release where a plugin's directory-path row resolves and
  scans (then the bare-name dependency stops being necessary); **(ii)** a release where the root
  context already provides `connection` at `apply` time (the `inject` becomes harmless but no longer
  load-bearing); **(iii)** the profile's `cordis.patch.yml` losing the `account-balance` row *and*
  `dsh plugin --profile web remove dsh-account-balance` being run — that is the whole rollback, and
  it is what "unmounted" would mean here; **(iv)** an upgrade that overwrites the plugin package,
  which lives outside this repository and is therefore not covered by any of its scripts.

## D-32: What parents a new commit on the API push route, and why did `bin/push-api.ps1` diverge?

- **Decided:** The parent of the first new commit is **the current remote tip**, never the remote
  commit that the local commit's parent maps to. `bin/push-api-ref.ps1` is added to the repository as
  the tool that embodies this, and `bin/push-api.ps1` is **left in place, not repaired** — the
  rationale for that split is below.

- **Because:** the observable failure was a 422 with no useful message and a repo left in a
  two-headed state, and every step of it was measured.

  **(a) The trap is a content mapping read as an ancestry relation.** An API-created commit is
  re-encoded, so the remote tip is never equal to a local SHA; two bases express that, and pairing
  them position by position is a statement about **content**: `local commit i` carries the same tree
  and message as `remote commit i`. It says nothing about which commit may parent a new one. Measured
  here with a one-commit range: pairing said `a820fa7 -> 3d83f37`, and `3d83f37` is the remote tip
  itself, so parenting there was right *by accident*. Parenting at the mapped **base**
  (`731776a3…`) instead produced a commit whose parent was `731776a3…` — the same parent the current
  remote tip has — i.e. a **sibling**, not a descendant.

  **(b) The diagnosis was the `compare` endpoint, not the error text.** After the failed ref update,
  the created commit existed and was readable with a correct parent and tree, yet was an orphan;
  `GET /repos/…/compare/main...<new>` answered **`status=diverged ahead=1 behind=1`**. That single
  line says "siblings", which no amount of reading the 422 text would. Re-run with the parent at the
  tip, the same compare answered `status=ahead ahead=2 behind=0` and the ref moved.

  **(c) The ref update is the only step that fails, so each failed attempt leaves an orphan commit.**
  Three orphan commits were created on the remote by these attempts (`5018d9bc`, `c71084de`, and the
  first script's commit reported as `d7e3ab5`). They are unreachable and harmless on GitHub, but they
  are the residue of "the push looked like it ran". The run is safe to repeat because blob and tree
  objects are content-addressed and were already present — the successful run uploaded **0 blobs and
  0 trees**.

  **(d) `bin/push-api.ps1`'s `-Trace` switch is not in scope where it prints.** `Invoke-Api` reads
  `$Trace`, but `-File` runs the script as a child process, and a function does not see a switch
  parameter of its enclosing *script* scope. Measured in isolation: a function reading an enclosing
  script's `param([switch]$Trace)` prints nothing, while the same switch declared in the function's
  own `param()` block prints. This does not cause the 422 — `-RemoteBase` binds correctly, verified
  with a throwaway script — but it is why the trace printed **zero** `[TRACE]` lines across three
  `-Trace` runs, and why the body that would have answered the question in one shot was never
  printed. The flag's entire stated purpose is to print the body.

  **(e) Why the fix is a second script rather than an edit.** `bin/push-api.ps1` is the tool that has
  pushed this repository successfully in earlier sessions; its parent logic and its scope defect are
  real but **not reproduced by me on the path that succeeded then** — I only ever saw the divergent
  outcome, three times, on a one-commit range whose previous commit had itself been API-created. The
  difference may be a multi-commit batch, or an invocation through `&` rather than `-File`. Editing a
  working tool on the strength of a path I could not reproduce is exactly the trade this repository's
  rules refuse; adding a tool that verifies its own inputs and refuses to run on a wrong pairing is
  not. The new script also checks the id of every blob, tree, and commit it sends against `git`'s own
  value, which turns each of the three documented API-push defect classes into a named throw instead
  of a silent wrong result.

- **Rejected:** (1) **Repairing `push-api.ps1`'s parent assignment in place.** Not reproducible on the
  path that matters, so the edit would be a guess dressed as a fix. (2) **Re-parenting the divergent
  commit by rewriting the remote ref to it with `-Force`.** It would have "worked" — the tree was
  already correct — but it would have dropped `3d83f37` (a commit on the remote and not local, so its
  loss would be unrecoverable from this clone) to avoid understanding why the push was rejected.
  (3) **Trusting the script's exit code or its `ref updated` line.** The ref update is one of three
  writes, and the earlier recorded defect in this same script was an API success with a wrong tree.
  The new script re-reads the ref and re-reads the commit, and fails when either disagrees.

- **Reversed by:** a successful multi-commit push through `bin/push-api.ps1` with `-RemoteBase` set,
  recorded with the `compare` output showing `status=ahead behind=0`. That would establish the
  one-commit case as the only broken shape, and the two scripts could then be merged with the parent
  rule taken from this one. Also reversed by a future PowerShell where a function does see its
  enclosing script's switch parameter, which would make (d) obsolete.

## D-33: Where does the balance plugin's source live, and what does an API push do to an EMPTY repository?

- **Decided:** The plugin is a **standalone public repository** —
  `https://github.com/ABccgh/dsh-account-balance`, root commit `e3d9a98`, topics including
  `deepseek-harness-plugins`. Its **working tree is the same directory the deployment loads**
  (`$DSH_HOME/plugins/dsh-account-balance`), so source and runtime are one copy rather than two that
  can drift. `bin/push-api-ref.ps1` gained an initialization path (`-Init`, `-Force`) for a target
  repository that has no commits.

- **Because:** four facts were measured, and the first two are properties of GitHub's API that no
  amount of reading this repository would have produced.

  **(a) A repository with NO commits cannot accept git objects.** `POST /git/blobs` answers
  **`409 Git Repository is empty.`** The git database endpoints are unusable until the repository
  owns at least one commit, so the only way in is the Contents API, which creates the first commit
  and the default branch in one call. **The script does not do this for you, and that is a deliberate
  refusal rather than a gap.** An earlier version automated it — write a throwaway file through the
  Contents API, delete it again — and the branch that results is **rooted in two commits that are not
  the payload**, with the real history sitting on top of them. That was measured on the plugin
  repository, judged not worth shipping, and removed. The route that does leave a clean history is
  two steps, and the second one is this script:

  ```sh
  # 1. one Contents-API write, so the repository owns a commit at all
  # 2. the real push, parented at the remote tip by -Force
  pwsh -File bin/push-api-ref.ps1 -RemoteRepo <repo> -Force
  ```

  `-Force` names the remote tip as the first pushed commit's parent and then moves the branch onto
  the local history, so the bootstrap commit becomes unreachable — the correct outcome for a file
  whose only job was to make the repository non-empty. This is how `ABccgh/dsh-account-balance` was
  created, and its branch now has **one root commit that is the payload**.

  **(b) Two cheaper-looking escapes are both refused, and a third one lies.** `POST /git/trees` with
  an empty `tree` array answers **`422 Invalid tree info`** (so an empty tree cannot be created
  directly to reset the branch), and `PUT /contents` with empty content answers
  **`422 content is not valid Base64`** (so a zero-byte placeholder cannot stand in for a delete).
  The third is worse than a refusal: `/compare` against a SHA the repository does **not** hold
  answers `status: identical` rather than an error, which reads exactly like success — so
  reachability must be decided by walking the remote's first-parent chain, never by `compare`.

  **(c) An absent ref does not answer 404.** `GET /git/refs/heads/<branch>` on an empty repository
  answers **`409`**, not `404` — so an "is the branch absent?" test that keys on 404 is wrong. The
  script treats any failure of that GET as "no ref" and keeps the guards that matter: the repository
  must be reachable at all, and an `-Init` run against a repository that already has the branch stops
  with a message naming the flag and both alternatives. That last guard was **added after the fact**:
  without it, `-Init` ran on with an empty `-RemoteBase` and died several steps later on
  ``history does not contain -RemoteBase `` — with nothing after the colon.

  **(d) `parents = @()` is DROPPED by `ConvertTo-Json`, which changes the commit.** The API call is
  built as a PowerShell hashtable, and an empty array member serializes to nothing — so a root commit
  silently came out with a parent. The fix is to **omit the key** for a root commit and add it only
  when a parent exists, which is also what the API wants. The same run then reproduced the local
  commit's SHA **exactly** (`e3d9a98` both sides): when the message, tree, author, committer and
  parent list all survive the round trip, re-encoding is identity, and the "API commits get different
  SHAs" rule in `AGENTS.md` is a consequence of the metadata differing rather than of the transport.

- **Rejected:** (1) **A separate copy of the plugin inside `dsh-smith`.** The reason the package was
  kept out of that repository in the first place (its rule 7) has not changed, and two copies of a
  400-line plugin will drift. (2) **Deleting the target repository and recreating it to retry the
  bootstrap.** GitHub refuses to delete the default branch, and a recreated repository would have
  been a second public artefact for no gain; a force-move onto the local history leaves the
  half-bootstrapped commit unreferenced instead. (3) **Publishing to npm.** `"private"` was removed so
  that publishing is *possible*, and nothing was published. (4) **Inventing a `-Base` value to satisfy
  the required-parameter check** when the force path needs no range. The guard was relaxed to accept
  `-Init` or `-Force` in its place, because a caller inventing a SHA is how a wrong parent gets sent.

- **Reversed by:** **(i)** the plugin being moved into a preset distribution, at which point the
  "one directory is both source and runtime" property ends and this record's central claim no longer
  holds; **(ii)** a GitHub API change that lets objects be created in an empty repository, which would
  delete the bootstrap branch of the init path; **(iii)** the repository being renamed or transferred,
  which would orphan the `origin` remote configured in the working tree and the `repository.url` in
  `package.json`.

## D-34: How is the Tencent `ima` knowledge base integrated — desktop automation, or its official OpenAPI?

- **Decided:** Over the **official ima OpenAPI** (`https://ima.qq.com`, base path `/openapi/wiki/v1`,
  HTTP POST JSON, headers `ima-openapi-clientid` / `ima-openapi-apikey`), as a **host-plane Cordis
  plugin that lives outside this repository** at `$DSH_HOME/plugins/dsh-ima-kb`. **Not** through
  CDP/desktop automation, **not** through the reverse-engineered private cookie API, and **not**
  by parsing local files.

- **Because:** every alternative was measured closed before the plugin was written, and the two
  probes that matter most were re-run independently while writing this record.

  **(a) The client is a Chromium shell with no reachable debug surface.** `D:\ima.copilot` is
  version 2.6.9.5083, ships `chrome.dll` and `.pak` files, and has **no Electron runtime**. The
  brief that commissioned this record measured CDP absent with **no ima process running**; re-measured
  here with the app **actually running**, which is the stronger test: **12** `ima.copilot` processes,
  exactly **one** listening socket across all of them (`127.0.0.1:5283`, an internal IPC port),
  **no** `DevToolsActivePort` file anywhere under `%LOCALAPPDATA%\ima.copilot`, **no**
  `remote-debugging` token in any ima process command line, and **nothing** listening on ports
  9222–9230. Five surveyed community implementations are plain HTTPS clients with zero CDP usage.

  **(b) The knowledge base is cloud-side and account-bound, so there is no local integration path.**
  A recursive scan of `%LOCALAPPDATA%\ima.copilot\User Data\` found **no local index and no vector
  store** — only IM SDK sqlite files and browser caches. *(Scan reported by the building session;
  not repeated here.)*

  **(c) The endpoint is real and auth-gated, re-measured here.** `POST /openapi/wiki/v1/search_knowledge_base`
  with unset credentials answers **HTTP 401** — confirmed independently while writing this entry, so
  the host is live and the failure is authentication rather than a missing route. Credentials are
  minted at `https://ima.qq.com/agent-interface` and are **separate from the desktop app's login**
  (`lib/client.js:18,21,179-180` for host/path/headers; `:151,206` for the mint URL).

  **(d) Host plane, and no service published.** The row is one `insert:` entry in
  `$DSH_HOME/profiles/web/cordis.patch.yml` (`id: ima-kb`, `name: 'dsh-ima-kb'`) with seven config
  keys. Host plane because a knowledge base is an **account-level** resource shared across sessions;
  it publishes **no Cordis service** and only registers into `ctx.tools`, so it needs no `isolate`
  realm and cannot collide on a service name. Installed with the sanctioned writer
  `dsh plugin --profile web add <path>` (exit 0), which created
  `profiles/web/node_modules/dsh-ima-kb` → `../../../plugins/dsh-ima-kb`.

  **(e) The credentials never enter the composition.** Only the **reference names**
  `IMA_OPENAPI_CLIENTID` and `IMA_OPENAPI_APIKEY` appear in the patch file; the values live in
  `$DSH_HOME/.credentials.yaml` under `version: 1` → `refs:`, which `dsh-credentials-local` watches
  with chokidar (`watch: true`), so an external edit is picked up **without a restart**. Re-read
  while writing this record: both reference names are present under `refs:`. *(Their values were
  observed during that read and are deliberately not reproduced anywhere in this record.)*

- **Rejected:** (1) **CDP / desktop automation** — no debug surface exists to drive (a), and the
  re-measurement was taken with the app running precisely so this could not be an artifact of a
  stopped process. (2) **The private cookie API** — reverse-engineered, unversioned, breaks on client
  updates, and keyed to a login that is a *different* credential from the OpenAPI pair. (3) **Parsing
  local files** — there is no local index to parse. (4) **Vendoring the plugin into this repository** —
  `AGENTS.md` rule 7: this repo ships presets and nothing else, and a vendored plugin would also have
  to join the root `package.json` `files` allowlist or be silently absent from the published tarball.
  (5) **A session-scoped (preset) row** — the capability outlives one session by construction, which
  is the plane test, and a preset row would give each agent its own client and credential resolution
  for a shared account-level resource.

- **Reversed by:** any of **(i)** an ima build that ships a reachable remote-debugging port, which
  would make CDP *possible* — not necessarily better, but it would reopen the question; **(ii)** a
  local index or vector store appearing under `User Data`, which would create a filesystem route;
  **(iii)** the OpenAPI being withdrawn or gated behind a paid tier, which would force the
  private-API route back onto the table; **(iv)** a measured need for per-session credentials or
  per-session knowledge-base visibility, which would move the row from the host plane to a preset.

## D-35: May the `dsh-ima-kb` host half import its dependencies normally?

- **Decided:** **No bare-specifier static imports in the plugin's host half.** The
  parameter-spec → JSON-Schema compiler, the `defineTool` equivalent, and the `Config` Standard-Schema
  validator are all **implemented in-package**, against the contracts read out of
  `@deepseek-ai/dsh-tools` and `cordis`. Relative imports between the package's own files are
  unaffected and are present.

- **Because:** the sanctioned install **symlinks** the package, and Node resolves a symlinked
  module's own bare specifiers from the link's **real path** — which has no `node_modules` above it.
  Measured both ways: importing the package **by name from the profile directory** fails with
  `ERR_MODULE_NOT_FOUND: Cannot find package '@deepseek-ai/schemastery' imported from
  C:\Users\…\.dsh\plugins\dsh-ima-kb\lib\index.js`, while the **identical two imports from a file
  inside the profile directory succeed** (control) — so the failure is the resolution base, not the
  package. Re-verified while writing this record: the link is real
  (`profiles/web/node_modules/dsh-ima-kb`, `LinkType: SymbolicLink` →
  `..\..\..\plugins\dsh-ima-kb`), and a scan for **bare-specifier** imports across all three `lib/*.js`
  files returns **zero**.

  **The distinction is the whole point, and it is sharper than the brief that commissioned this
  entry.** "This file imports nothing" is what the plugin's own header comment claims
  (`lib/index.js:4-6`), and it is **false as written**: `lib/index.js:45-46` and `fanout.js:13` are
  relative imports, and a scan for `^\s*import ` returns 2 lines in `index.js` and 1 in `fanout.js`.
  The constraint is on **bare specifiers only**; relative imports always resolve against the module's
  own real path and are safe. A later session that reads the header as literally as this record first
  did would "fix" a file that is already correct.

  **Why the in-package reimplementation is safe rather than a fork.** Cordis asks a plugin's `Config`
  for exactly one thing — `runtime.Config['~standard'].validate(config)`, synchronously — so a
  hand-written Standard Schema object satisfies the loader without a schema library. And the two
  helpers are small, contract-shaped functions, not behaviour: `defineTool`'s own body compiles the
  spec once and stores the result.

  **One trap this avoided, and the mechanism was re-read from source here.** `defineTool`
  **precompiles** `options.parameters` into JSON Schema — `dsh-tools/lib/index.js:846`
  (`const parameters = parameterSchemaSpecToJsonSchema(options.parameters)`), which is what lands on
  the tool object at `:852` and what `validate` closes over at `:848`. A definition object that
  implements the rest of the contract but omits that compiled `parameters` field **still registers
  successfully** and presents the model **no parameters at all** — a silent failure, not an error.

  **No duplicate-module hazard, measured.** `profiles/node_modules/@deepseek-ai/*` are **junctions**
  into the npx checkout (re-read here: `cordis` and `dsh-tools` both target
  `…\npm-cache\_npx\1e7f6d9597241db0\node_modules\@deepseek-ai\…`), so they are **one physical
  install** and cannot produce two module instances of a service class.

  **A future session must not "fix" this by adding imports.** Doing so reintroduces exactly the
  measured failure above.

- **Rejected:** (1) **Adding a `dependencies` block or a nested `node_modules`** — pnpm's strict
  linking is the reason the real path has no `node_modules`, and the sanctioned writer would not
  create one; hand-creating it is a hand edit under `~/.dsh` (`AGENTS.md` boundaries). (2) **Copying
  the package into the profile instead of linking it** — that defeats the sanctioned writer and
  creates the second copy that D-33 rejected for the balance plugin. (3) **Publishing the plugin to
  npm so the specifiers resolve from a real `node_modules`** — a real option, but it trades a
  self-contained local package for a release process, for two small helper functions. (4) **Trusting
  the file's own header comment** — it is wrong, and this entry exists partly because it was believed
  first (see the sharp distinction above).

- **Reversed by:** **(i)** pnpm resolving the plugin through a **copy** rather than a symlink, or a
  `node-linker=hoisted` profile layout that puts a resolvable `node_modules` above the real path;
  **(ii)** a loader that imports a row's module resolved from the **profile** directory rather than
  the module's real path; **(iii)** the plugin being published to npm and mounted by version range,
  at which point ordinary imports become correct and the in-package helpers become dead weight to
  delete.

## D-36: Whose account of the ima OpenAPI is authoritative — the third-party documentation, or the live service?

- **Decided:** **The live service, measured.** Where the widely-copied third-party documentation and
  the running API disagree, the code follows the measurement, and this record treats the measurement
  as the fact. Ten divergences now stand on the record; **three of them are limit facts that would
  ship a broken call if the documentation were believed.**

- **Because:** the plugin was driven against the live service with real credentials, and the API
  contradicted its documentation in both directions — shapes it documents that do not exist, and
  ceilings it documents that are wrong. The live run **caught a real defect of exactly this kind**.
  All ten facts below are **measured by the building session against ima 2.6.9.5083**; they are
  recorded at the strength the session measured them, not as readings of any document.

  1. **Field names are inconsistent across endpoints.** `search_knowledge_base` returns
     `kb_id` / `kb_name` (plus `member_count`, `content_count`, `description`, `creator`,
     `role_type`, `base_type`), while `get_knowledge_base` and `get_addable_knowledge_base_list`
     return `id` / `name`. There is no single record shape to code against.
  2. **`search_knowledge` returns only `info_list`** — **no `is_end`, no `next_cursor`**. The
     documented pagination does not exist, so a client cannot know it reached the end.
  3. **The 100-hit cap is real and silent.** Querying an **18,500-item** library for a high-frequency
     term returned **exactly 100** rows **with no truncation signal**. The plugin surfaces this as a
     caveat rather than pretending the result is complete (`fanout.js:16` `HIT_CAP = 100`;
     warning rendered at `:175`).
  4. **`highlight_content` is present on every hit and was empty in all 143 hits across three
     different queries.** Search proves a document **exists**; it does **not** prove the query text is
     in the body. Any ranking that assumes the highlight is populated would rank nothing.
  5. **`get_media_info` returns a usable URL only for `media_type: 2` (网页) inside a knowledge base
     the account owns.** Subscribed libraries answer
     `220030 没有权限通过skill获取订阅知识库的文件`; PDFs, notes and folders in *owned* libraries answer
     `220030 该文件获取失败，请至ima内查看处理`. There is **no `download_url`** in this build. So this
     integration can find and **point at** a document; it cannot read most bodies.
  6. **The documented "root folder id equals knowledge_base_id" is wrong in practice.** Passing
     `knowledge_base_id` as `folder_id` is rejected with `222000 文件夹不存在`. The real root id comes
     from `get_knowledge_list` → `current_path[0].folder_id`, and it **differs** from the knowledge
     base id.
  7. **`search_knowledge_base`'s `limit` ceiling is 20, not the documented 50.** `limit: 50` →
     `code 51, invalid SearchKnowledgeBaseReq.Limit: value must be inside range (0, 20]`. This is the
     defect the live run caught: the first version sent 50, the service rejected it, and the fix was
     to cap at 20 and **walk the cursor** to enumerate the full catalogue.
  8. **Folders appear in `knowledge_list` with `media_type: 99`**, a value absent from the documented
     enum — so an enum-driven client would mis-handle every folder.
  9. **The note module is partial.** `openapi/note/v1/list_notebook` answers `code 0`, but
     `search_note` with the documented parameter shape returns
     `100001 ListNoteBook param is error`. The plugin therefore does **knowledge bases only** — this is
     a scoped-down capability, not an oversight.
  10. **URL import works end to end.** `import_urls` returned `ret_code 0` plus a `media_id`, and the
      new entry appeared in a subsequent `get_knowledge_list`. `create_media` returned `code 0` with a
      real COS credential, so **file upload is reachable but was not implemented**.

- **Rejected:** (1) **Coding to the documented shapes.** It would have shipped `limit: 50` (broken),
  cursor pagination that no endpoint returns, a `download_url` that does not exist, and a root-folder
  rule that 404s. (2) **Treating the third-party documentation as a summary of the same API version.**
  The divergences are not stale prose about an older build; they are shapes present in documents and
  absent from the service. (3) **Widening scope to the note module** to make the integration look
  complete — (9) says the documented parameter shape fails, so notes would have been guesswork.
  (4) **Implementing file upload** on the strength of a `create_media` `code 0` alone — obtaining a
  COS grant is not the same as a completed upload plus `add_knowledge`, and neither was exercised.

- **Reversed by:** an ima API revision that restores `is_end` / `next_cursor`, raises the `limit`
  ceiling above 20, returns a `download_url`, accepts `knowledge_base_id` as `folder_id`, adds
  `media_type: 99` to the published enum, or makes `search_note` accept its documented parameters.
  Also reversed by evidence that the third-party documentation tracks a **newer** API version than
  2.6.9.5083 — in which case the documentation is a forward-looking source and the divergence is a
  version gap rather than a documentation defect.

## D-37: Is D-36's reading of the ima note module right?

- **Decided:** **No — D-36's fact 9 is superseded, and its "the plugin therefore does knowledge bases
  only" is withdrawn.** The note module is **partial to `search_note` alone**: note **create, read and
  list all work**, and the plugin now ships three note tools.

- **Because:** the correction was made by exercising the endpoints rather than by re-reading a
  document. Measured: `openapi/note/v1/import_doc` **creates a note and returns a real `doc_id`**;
  `get_doc_content` **reads it back**; `list_notebook` / `list_note` **list it**. Only `search_note`
  fails — and it fails for **both** the `query` and the `keyword` parameter spellings, both answering
  `100001 ListNoteBook param is error`. That second half matters: the earlier entry read the same
  error as "the documented parameter shape is wrong", which implies a client-side fix. **No spelling
  tried works**, so the defect is on the service side and the plugin correctly declares search
  unsupported rather than guessing further.

- **Rejected:** (1) **Leaving D-36's fact 9 standing** — which is why this entry exists rather than an
  edit: `DECISIONS.md` is append-only, and a corrected entry is superseded, never rewritten.
  (2) **Declaring the whole note module out of scope** on the strength of the one broken endpoint —
  that was D-36's conclusion, and it discarded three working capabilities. (3) **Retrying
  `search_note` with more parameter spellings** after `query` and `keyword` both failed; the error
  text names the request type rather than the field, so further guessing has no signal to guide it.

- **Reversed by:** `search_note` accepting any parameter spelling and returning results, which would
  make note search a fourth note tool; or the create/read/list endpoints failing on a later ima
  build, which would put the module back to unsatisfied.

## D-38: How is the ima COS file upload authenticated — a hand-rolled signer, or Tencent's own SDK?

- **Decided:** **Tencent's official `cos-nodejs-sdk-v5`**, installed into the **plugin's own**
  `node_modules` and loaded by **dynamic** import. A hand-rolled COS signer must **not** be
  reintroduced without re-running the experiment that falsified it.

- **Because:** the hand-written signer was not merely distrusted — it was **disproven**, and three
  further traps were measured on the way to a working upload.

  **(a) The hand-rolled signer is falsified, and the experiment isolated the cause.** Five derivation
  formulations all returned `SignatureDoesNotMatch`. The decisive observation is that COS echoed a
  `<FormatString>` **byte-identical** to the canonical string being sent (`put\n/{key}\n\n`) while
  reporting a **different hash** for it — so the canonical string, the request shape and the
  credential id were all correct, and the **derived signing key was the only remaining variable**. A
  control confirmed the credential itself was being passed properly: dropping `x-cos-security-token`
  produced `InvalidAccessKeyId`, which proves the token is part of a **session** credential and that
  it *had* been supplied. *Do not reintroduce a hand-rolled signer without re-running that
  experiment — a later session will otherwise re-derive five wrong formulations.*

  **(b) `bucket_name` already contains the appid.** The service returns
  `bucket_name: ima-share-kb-1258344701` alongside `appid: 1258344701`, so composing
  `${bucket}-${appid}` doubles the suffix and COS answers **`NoSuchBucket`**. The
  documented-looking composition is wrong; the field is already complete.

  **(c) `custom_domain` is the CDN host and refuses writes.** `ima-share-kb.image.myqcloud.com`
  rejects a PUT with **403 and an empty body**, carrying `server: Lego Server` and `x-cache-lookup` —
  the **CDN edge** rejects it before COS ever sees it, which is why there is no useful error text.
  Writes must target the COS origin, `${bucket}.cos.${region}.myqcloud.com`.

  **(d) The SDK is loaded by dynamic import, and the reason is D-35.** A **static** import of
  `cos-nodejs-sdk-v5` would reproduce the symlink-realpath failure, because the SDK resolves from the
  plugin's real path. Loaded dynamically at call time it costs nothing until an upload is attempted —
  measured in the plugin at `lib/client.js:533`
  (`;({ default: COS } = await import('cos-nodejs-sdk-v5'))`), with a readable in-product message when
  it is missing (`:536`).

  **(e) Verified end to end, not by success strings.** A real Markdown file was uploaded and
  `get_knowledge_list` then showed it **inside the knowledge base** (`type=7`,
  `dsh-ima-upload-probe.md`). A tool that returns "success" proves the call was accepted; only the
  read-back proves an object exists. This is the standard D-36's fact 10 was held to as well.

- **Rejected:** (1) **The hand-rolled signer** — falsified in (a); keeping it would have shipped a
  feature that never worked behind an error message (`SignatureDoesNotMatch`) that points at the
  wrong layer. (2) **A static import of the SDK** — reintroduces the D-35 failure. (3) **Writing to
  `custom_domain`** — a CDN that returns 403 with no body, i.e. an unfixable-looking failure.
  (4) **Composing `bucket_name` with `appid`** — produces `NoSuchBucket`. (5) **Leaving file upload
  unimplemented**, which is what D-36 recorded; that was right given only a `create_media` `code 0`,
  and wrong once the upload was actually driven to a verified object.

- **Reversed by:** **(i)** the returned `bucket_name` no longer carrying the appid, or the service
  documenting `custom_domain` as write-capable — either would invalidate a trap above; **(ii)** a COS
  API revision that changes the signature derivation, which would make the SDK the wrong client
  rather than the hand-rolled signer the wrong approach; **(iii)** the plugin gaining a real
  `node_modules` at its resolved path (the D-35 reversal), at which point a static import becomes
  correct and cheaper.

## D-39: Does the ima OpenAPI allow deleting anything the plugin creates?

- **Decided:** **No.** The ima open API exposes **no delete capability at all**, for either knowledge
  bases or notes. **The consequence is the operative half of this entry: everything this plugin
  creates in the user's account can only be removed by hand in the ima client.** The plugin's README
  states this, and its check script **deliberately no longer exercises note creation**, because every
  run left behind a note that nothing could remove.

- **Because:** every candidate path was probed and **all of them 404**: on the knowledge-base side
  `delete_knowledge`, `del_knowledge`, `delete_media`; on the note side `delete_doc`, `del_doc`,
  `delete_note`, `remove_doc`, `trash_doc`. Eight paths across two modules, none of which exists —
  this is a capability the API does not have, not a route that was named wrongly. *(Measured by the
  building session; documented in the plugin's own `README.md`.)* This is the same class of finding
  as D-36's fact 2: the service is narrower than its surface suggests, and the narrowing has a cost
  the **caller** pays rather than the client.

- **Rejected:** (1) **Probing further delete spellings** — eight across two modules establishes
  absence for any practical purpose, and a ninth 404 would not change the decision. (2) **Keeping
  note creation in the check script** — it made every verification run a permanent write to the
  user's account. The script now omits it, which is why the artifacts recorded in `PROJECT.md` are a
  closed set rather than a growing one. (3) **Treating the write path as unusable because it is
  irreversible** — URL import and file upload are genuinely useful; the honest response is to state
  the irreversibility where the user will see it (the README and the tool descriptions), not to
  remove working capability.

- **Reversed by:** any of the eight probed paths answering something other than 404, or a new
  documented delete endpoint in a later ima API revision — at which point the plugin can offer
  cleanup and the README's warning is removed rather than softened.

## D-40: Does the `dsh-ima-kb` standing mount check pass — and what does it actually prove?

- **Decided:** **It passes, and it proves less than its name suggests.** Six presets returned
  `MOUNT OK`, and `dsh-ima-kb` is confirmed to be a host-plane row rather than a row of any preset.
  But `standingKeyFor` proves **"it did not throw"** — the composition is usable and the standing
  mount key was ensured — and **not** that any individual row contributes. That second question is a
  different one and it **stays open**.

- **Because:** the user drove the dynamic Cordis plugin probe themselves and pasted the **raw runtime
  output** — contract query → `cordis_define` → `cordis_run` → call the tool → return values. Every
  fact below is **measured by the user, pasted raw**; none of it is a transcription of a child's
  report, and it is the strongest form of evidence this repository has a procedure for.

  **(a) All six presets mount clean.** `standingKeyFor` ran for `standard`, `ptc`, `minimal`,
  `cordis`, `dsh-forge`, `dsh-smith`: **six `MOUNT OK`, zero failures**, each returning a scope key of
  the form `{"agentPreset":"<id>"}` with the correct `trust` — `system` for the four shipped presets,
  `user` for the two local ones. **None** of the four documented failure shapes appeared:
  `Cannot find package`, `invalid config:`, `did not activate`, `published process-global service`.

  **(b) `compositionInventory` answered from live Loader entries, not from files.** 6 presets,
  **160 rows** total (28 / 29 / 6 / 29 / 35 / 33), every `broken` **null**. The discriminator that these
  are live standing mount entries rather than a file parse: `fiberState === 2` on **every** row with
  `enabled: true`, and `undefined` on **every** `enabled: false` row. Note this independently
  reproduces the `dsh-forge` **leaf-row count of 35** that D-23 and D-25 established by a completely
  different route — a file parse and a runtime inventory agreeing.

  **(c) `dsh-ima-kb` appears in none of the 160 rows.** That is the direct confirmation that it is a
  **host-plane** row and not a row of any preset, which is what D-34 chose and what nothing before this
  probe had measured. Control: passing `dsh-ima-kb` as a **preset id** answers
  `agent-preset/not-found` — the correct behaviour, and useful precisely because it shows the probe
  distinguishes the two namespaces rather than answering for anything asked.

  **(d) `AGENTS.md` rule 5 now rests on a runtime reading, for the first time.** Measured at runtime
  rather than by grepping a file: `dsh-tool-cordis` is `enabled: true` in `cordis`;
  `enabled: false` with `fiberState: undefined` in `dsh-smith`; and **absent entirely** from
  `dsh-forge`. Rule 5 asserted exactly this from file greps; it is now corroborated from the loaded
  composition. This is rule 4's preference for the runtime probe over the file grep, satisfied on the
  claim that mattered most to it.

  **(e) The other half was confirmed live by the user.** A fresh session's tool table **contains
  `ima_kb_list`** — so the row is not merely mounted, it reaches a model.

  **(f) `bin/verify.mjs` was not run, and the user declined it for the right reason.** Per rule 5 the
  script builds its own bare Cordis context, so `agentPresets` is absent **by construction** and it
  could only print `INCONCLUSIVE`. **Its absence is not a gap in this record** — running it would have
  produced no information, and the user said so. This is the first time a reader has applied that
  correction rather than re-deriving it, which is what D-24 was written for.

  **(g) The boundary, stated by the user and not to be softened.** `standingKeyFor` proves the
  composition is **usable**; it does **not** prove that any individual row **contributes**. A row can
  mount and do nothing, and this check cannot see it. That is the same failure class `AGENTS.md`'s
  Boundaries section warns `preflight.mjs` and `bin/verify.mjs` cannot see either — and the correction
  this entry forces is that **`standingKeyFor` does not close it**, which that section previously
  implied it did.

- **Rejected:** (1) **Treating `MOUNT OK` as "the plugin works".** It is a statement about the
  composition, not about the contribution; (g) is the boundary and the earlier `PROJECT.md` wording was
  corrected for exactly this overstatement. (2) **Running `bin/verify.mjs` "to be thorough"** — it is
  measured incapable of reaching the roster from any session (D-24), so running it would have added a
  misleading INCONCLUSIVE line and nothing else. (3) **Inferring the ima row's plane from the
  composition file** — the 160-row absence is a runtime fact and is strictly better evidence than
  reading `cordis.patch.yml`.

- **Reversed by:** **(i)** a `standingKeyFor` call that **throws** for one of these six presets, which
  would mean a regression in a composition since this probe; **(ii)** an implementation change where
  `standingKeyFor` starts asserting per-row contribution, which would make it answer the question (g)
  leaves open; **(iii)** `dsh-ima-kb` appearing inside a preset's row list, which would falsify the
  host-plane decision in D-34.

## D-41: What is the real `agentPresets` inspect contract, and what does guessing its field names cost?

- **Decided:** Read the contract from the live service and use **its** names. The published surface is
  `list()`, `standingKeyFor(id?)` and `compositionInventory()`, and the row and composition types are
  `{ entryId, moduleName, enabled, condition?, fiberState? }` and
  `{ id, trust, name?, isDefault, broken?, rows }`. **There is no `r.id`, no `r.name`, and no
  `r.disabled`** — and code written against those names **does not throw**: it silently reads
  `undefined`.

- **Because:** the contract was read live through the `Service` inspect provider (Host), measured by
  the user and pasted raw:

  - `async list(): Promise<AgentPreset[]>`
  - `async standingKeyFor(id?: string): Promise<ScopeKey>` — contract text: *throws when the preset is
    unknown or its composition is unusable*. Note `id` is **optional**, and it takes an
    **agent-preset id** (which is why (c) of D-40's control behaves as it does).
  - `async compositionInventory(): Promise<AgentPresetComposition[]>`

  **The worked example, and it is the point of this entry.** This session introduced a defect that the
  probe then found: an output-parsing **fallback branch** had been written against the guessed field
  names (`r.id` / `r.name` / `r.disabled`). Because the real contract uses different names, every row
  rendered as **`undefined=undefined` with no exception raised** — a silent empty read. The user fixed
  it against the real names (`entryId` / `moduleName` / `enabled` / `fiberState`) by **updating the same
  dynamic Plugin** rather than defining a second one, which is the right move: a second definition
  would have left the broken one retained and ambiguous.

  **The general lesson, and why it is worth its own entry.** A guessed field name that does not exist is
  **strictly worse than an error**, because a throw names the problem while `undefined` renders as a
  plausible-looking or empty result. This is the same family as **D-31(c)** — a cache helper returning
  its own entry type answered **200 with the amount missing** — and both are instances of a wrong
  answer being harder to notice than a failure. `AGENTS.md` rule 4b already carries "a predicted claim
  may be coarser than the measured one"; this is its sibling: **a guessed contract may be silently
  empty rather than wrong.**

- **Rejected:** (1) **Coding against the type names implied by earlier notes** — those names were
  inferred, and the inference was wrong in three of the fields. (2) **Treating the silent `undefined`
  as a rendering bug in the fallback path** — the fallback was doing exactly what it was told; the
  field names were the defect. (3) **Keeping a corrected *second* dynamic Plugin definition** — the
  fix belonged in the existing definition, and duplicating it would leave the broken version retained.
  (4) **Recording the probe's code as a reusable artifact** — it lives only in a dynamic probe whose
  Plugin definition is **stopped but retained**, i.e. in process memory and nowhere else
  (`dsh-cordis-host-runner/README.md`: definitions are cleared by a DSH restart). It is a demonstration,
  not a durable tool.

- **Reversed by:** a published type declaration in the installed packages **contradicting** the live
  contract — in which case the live service still wins (rule 4) but the divergence is itself worth an
  entry; or a future release renaming these fields, at which point every reader must re-query the
  contract rather than trust this list.

## D-42: Does mounting a new host-plane row require a `web` profile restart?

- **Decided:** **No, and the earlier advice in this record that one was required is superseded and
  must not be repeated.** The `ima-kb` row reached a live session's tool table with no restart.

- **Because:** the user's own live confirmation is the measurement — a fresh session's tool table
  **contains `ima_kb_list`** — and the mechanism is visible in the profile rather than inferred:
  `patchReload: "live"` in `profiles/web/package.json`, together with the reconciled
  `.package-map.json`. The restart was not merely unnecessary, it would have been **harmful**: it would
  have **terminated the session that was serving the user**. So the superseded advice was not a
  harmless precaution — following it would have destroyed the session doing the measuring.

- **Rejected:** (1) **Restarting "to make it take effect"** — measured unnecessary, and destructive to
  the live session. (2) **Keeping the old advice as a safe default** — it is measured false here, and a
  false precaution that costs a session is worse than no advice. (3) **Generalizing to "no host-plane
  row ever needs a restart"** — deliberately **not** claimed; see the tension recorded below.

- **Reversed by:** `patchReload` being changed away from `live`, or an installed build where a row's
  host half binds something only at boot. **A tension this entry does not resolve, recorded rather than
  smoothed over:** `PROJECT.md`'s balance-plugin subsection (D-31) states that the balance row's
  **host half needed a restart**, and that restart was left to the user. That claim was not re-measured
  here, and it now sits uneasily beside this entry. It is carried as an open item on `BOARD.md`; the
  honest position is that the `ima-kb` case is measured and the balance case is inherited.

## D-43: Is the balance row's "the host half needs a restart" claim still right?

- **Decided:** **No — the clause is superseded and must not be repeated as current advice.** The
  balance case now rests on the **same evidence shape as D-42**: a running process that came up with
  the row already present in the patch layer. The tension D-42 recorded is **closed**, not carried.

- **Because:** the claim under test is `PROJECT.md`'s balance subsection (D-31), verbatim: *"The user's
  own `dsh web` on 3080 was never restarted or killed — `patchReload: live` picked the row up, but the
  host half needs a restart, which is the one step left to the user."* Three readings were taken to
  test it. **All three are measured, and I reproduced all three independently while writing this
  entry** rather than transcribing them:

  1. **The process serving 3080 started *after* the patch layer was written.** PID **15116** is `node`,
     `StartTime` **2026-09-12 10:17:17**, still live (`HasExited = False`), and it **owns the listener
     on `127.0.0.1:3080`** — which is what ties that PID to the GUI rather than merely to *some*
     process.
  2. **The patch layer was written 4 minutes 31 seconds earlier.** `$DSH_HOME/profiles/web/cordis.patch.yml`
     `LastWriteTime` = **2026-09-12 10:12:46**. That single file carries **both** the `account-balance`
     row and the `ima-kb` row, so the process came up with **both rows already present**.
  3. **The balance route is registered and live in that process.** `GET http://127.0.0.1:3080/api/balance`
     answers **HTTP 401** without the browser cookie — the documented pre-handler rejection.

  **Three levels, kept distinct, because blurring them is how this claim went wrong the first time:**

  - **Certainly false:** *"the host half needs a restart"* as a requirement for composing a new
    host-plane row in **this** profile. Measured false **twice over** — the `ima-kb` row by the user's
    tool-table reading (D-42), the balance row by readings 1–3 above.
  - **Actually measured:** the three readings above. Nothing more.
  - **Inferred, and labelled as such:** the likely operative mechanism is `patchReload: "live"` in
    `profiles/web/package.json`, which hot-reloads the patch layer. **This was not isolated** — no
    experiment held everything else constant — so it is recorded as the *plausible* mechanism, not as
    the measured cause.

  **What reading 3 does and does not prove, since the line must not be blurred.** 401 is the
  documented **unauthenticated** answer, so it proves the route is **reachable and registered**, not
  that it answers **correctly**. The 200-with-cookie case was verified earlier on the **3081**
  instance (D-31) and is **not** re-measured here. A route that is registered and returns 401 to an
  anonymous caller is evidence about registration, never about payload.

  **And a caution about how this gets written down.** The original clause **may simply have been wrong
  when written.** There is **no evidence about what the balance author observed at the time**, and no
  process history before 10:17:17 to settle it — the readings above establish the *current* state, not
  what was true then. So this entry supersedes the clause as **current advice**; it does **not**
  rewrite the earlier moment as a mistake with a known cause. Those are different claims and only the
  first is supported.

  **What stays open regardless.** Neither this entry nor D-42 shows that either row **contributes**
  anything at the semantic level — a row can be composed, live, and inert. That is BOARD question 9
  and it remains open.

- **Rejected:** (1) **Leaving item 10 open as "inherited, not measured"** — it was cheap to measure and
  the measurement was taken; carrying a resolved tension as open is the stale-record failure these
  layers exist to prevent. (2) **Marking the old clause a mistake** — unsupported, per the caution
  above. (3) **Recording `patchReload: "live"` as the cause** — it is a plausible mechanism that was
  not isolated, and promoting it would repeat the earlier error in the opposite direction.
  (4) **Treating the 401 as "the balance route works"** — it is a reachability reading; the
  correctness reading lives on 3081 and was not repeated here. (5) **Generalizing to "no host-plane
  row ever needs a restart"** — still deliberately **not** claimed (D-42's rejection stands).
  (6) **Extending D-42 rather than adding this entry** — `DECISIONS.md` is append-only, and this is a
  separate question about a different row; superseding it in a new entry is the file's convention.

- **Reversed by:** **(i)** a measured case where a row written into `cordis.patch.yml` does **not**
  take effect in a running process, which would restore the restart requirement for that case;
  **(ii)** process evidence from before 10:17:17 showing the balance host half genuinely did need a
  restart when the clause was written — that would make the original claim *correct then and obsolete
  now* rather than simply wrong, and this entry's caution is deliberately written so that outcome does
  not require a rewrite; **(iii)** isolation of the actual reload mechanism, which would move
  `patchReload: "live"` from inferred to measured.

## D-44: Does the `dsh-ima-kb` row *contribute* — and which circuit did the measurement actually exercise?

- **Decided:** **It contributes, measured live rather than inferred — closed for this one tool's live
  path, and for nothing else.** BOARD question 9 is closed *for the ima row*: a **real session's**
  `ima_kb_list` call returned **7 knowledge bases**, which no composition-only check could have produced.
  The claim this entry establishes and nothing broader: **`ima_kb_list`'s path works in production.**
  The other eight tools are **not** production-verified and must not be described as if they were.

- **Because:** the measurement is an **ordinary session**, not a probe and not the building session's
  own check script. The user asked an agent in a normal session to call `ima_kb_list`, and reported the
  tool's actual output: **7 knowledge bases** — owned/创建者 **3** (`曦曦的知识库` 4 entries,
  `Crusader Kings III Wiki` 416, `明日方舟 Wiki` 18500) and subscribed/普通成员 **4**
  (`我超爱看中国历史` 619, `崩坏星穹铁道剧情文案` 578, `小说写作知识库` 795, `明日方舟` 2457).

  **Two independent routes agree.** That set and those membership counts match **exactly** the
  independent measurement the building session took earlier (its live check script listed the same 7
  with the same member/role/base-type split). Two routes reaching the same facts is the strongest form
  of agreement this repository has, and it is what makes this an observation rather than a single
  reading.

  **Why this one matters more than every earlier check, and the point of the entry.** **None of the
  earlier verification could have caught the failure that mattered here.** The building session's check
  script stubbed the `credentials` service **by hand**, so it never exercised **Cordis service
  injection**. A tool that registers but cannot resolve `ctx.credentials` **passes every earlier check
  and is still inert** — it is composed, live, mount-clean, `preflight`-clean and `verify`-clean while
  answering nothing. This live call is the **first and only** evidence that, in the real runtime:

  - the host-plane row's `apply` ran;
  - Cordis resolved the injected `credentials` **and** `tools` services to real host instances;
  - the credential reference resolved from `$DSH_HOME/.credentials.yaml` **through the seam** — the
    plugin resolves both references at call time via
    `ImaClient.fromCredentials(ctx.credentials, config.clientIdRef, config.apiKeyRef, …)`
    (`lib/index.js:422`; `credentials.resolve(...)` at `lib/client.js:140-143`), so the seam is crossed
    on every call rather than once at mount;
  - the live HTTP request to `ima.qq.com` was made and answered;
  - the response was normalised and projected to the model as text
    (`output.render` → the knowledge-base listing, `lib/index.js:459-470`).

  **That whole circuit is now measured in production, not in a harness of my own construction.**

  **The per-tool boundary, deliberately sharp, because this one tool's path is the only thing
  measured.** `ima_import_url`, `ima_upload_file`, `ima_note_create` / `get` / `list`, `ima_kb_search`,
  `ima_kb_browse` and `ima_media_info` were exercised only by the building session's **sandboxed check
  script** (which stubbed credentials) or **not at all in a real session**. Note that three of those are
  **read** tools as well — `ima_kb_search`, `ima_kb_browse`, `ima_media_info` — so the boundary is
  **not** "reads are verified and writes are not"; it is exactly one tool. The live paths of those eight
  rest on that weaker evidence and nothing better. *Instrumental note, read from source here and not a
  substitute for a live call:*
  all nine tools share the one credential seam — each registers `client()`, which is the `:422`
  `fromCredentials` call, and **no tool touches `ctx.credentials` directly** — so what is proven common
  to all nine is the **seam**; what remains unproven per tool is **its own endpoint, parameters and
  write path**.

  **The general lesson, which is why this is an entry and not just a status change.** **A tool
  registration is not evidence that the tool works; only a call in a real session, resolving real
  injected services, is.** And **"does this row contribute" is answerable per-tool, not per-row**, for a
  row that registers several tools — a row whose first tool works can hide eight that do not.

  **One observation carried as open, deliberately not as a defect.** For `我超爱看中国历史` the two
  readings agree on **619 entries**, while the building session observed `member_count` as **27406** at
  one point and **27407** later. The entry counts agree and the member count moved between readings.
  This is recorded as a **benign, unexplained observation**: the member count of a large subscribed
  library changes as people join, and **nothing depends on it**. **No cause is asserted**, and it is
  **not** written up as a discrepancy in the tool.

- **Rejected:** (1) **Treating the mount check as the contribution check** — D-40's boundary, still
  correct: `standingKeyFor`, `preflight` and `verify.mjs` each miss this class, and **the class is now
  closed by a call rather than by any of them**. (2) **Treating the check script's nine registered
  tools as nine working tools** — it stubbed the very seam whose failure is invisible, so its green
  result is not evidence about injection. (3) **Extending the conclusion to the whole tool surface** —
  the honest statement is one tool measured live and eight not. (4) **Calling the `member_count` move a
  bug** — nothing depends on it, the entry counts agree, and the cause is unmeasured; recording a
  plausible cause would be the same overreach D-43 refused. (5) **Recording the raw tool output as the
  evidence artifact** — it stays as reported in `PROJECT.md`, and this entry cites the figures rather
  than reproducing a payload.

- **Reversed by:** **(i)** a `ima_kb_list` call in a real session that returns a refusal or a fabricated
  success — specifically `ima 调用失败：…` or the missing-credential message — which would move the row
  back to unverified; **(ii)** evidence that the session that produced the 7 did **not** resolve the
  credential through the seam (a cached, environment-provided or otherwise synthetic answer), since
  that is the single step this call exists to prove; **(iii)** a change to the injection or credential
  resolution path that leaves registration intact — the exact failure an earlier check cannot see, so
  it must be re-measured by a call rather than by a mount.

## D-45: Can either push script push a commit whose parent exists only on the remote?

- **Decided:** **No — and the limitation is structural, not a usage error.** Both scripts derive
  parent identity from a range walk over commits that exist in the **local** object database, so
  neither can express "put this commit on top of a parent I do not have". The gap belongs to the two
  scripts, not to the GitHub API: `POST /git/commits` accepts a remote-only parent happily — that is
  precisely what the working route does. Recorded because it will recur for **any** repository whose
  remote history starts with a server-side commit (`auto_init`, a README bootstrap, or a
  `Contents-API` write), which is exactly what `dsh-ima-kb` has.

  - **`bin/push-api.ps1`** walks `$Base..HEAD` (`bin/push-api.ps1:167`), so `$Base` must be a
    **local** commit that is an ancestor of `HEAD`. When `HEAD`'s parent exists only on the remote
    there is no valid local base: naming a different local ancestor would upload that history too,
    and the API rejects a commit whose `parents[0]` it does not hold (`422`). Its `-RemoteBase`
    **does** let you name the remote parent correctly — it is only the base walk that cannot
    participate. And when the base *is* `HEAD` the range is empty, which **crashes rather than
    erroring cleanly**: `GitBytes` returns an empty byte array (`:64-80`), PowerShell's pipeline
    flattens that to `$null` on the way out of the function, and the caller at `:82` then calls
    `[System.Text.Encoding]::UTF8.GetString($null)`.
  - **`bin/push-api-ref.ps1`** *can* name a remote-only parent, but **refuses when the two range
    lengths disagree** (`bin/push-api-ref.ps1:248-249`). Against a root that carries no payload the
    remote range is **always 0 vs the payload's n**, so the refusal is unavoidable. **`-AllowUnrelated`
    does not rescue it**, and this is the finding worth carrying: that flag governs only the
    **first-parent ancestry walk** earlier in the script (`:218-221`), while the pairing check is a
    separate test that never consults it. Measured by passing the flag explicitly: it still threw.
    `-Init` is not an escape either — it requires an **empty** ref (`:245-247`), so it cannot help a
    repository that already has commits.

  **The working shape, recorded as prose because no script was committed.** A scratch script — written
  to `%TEMP%`, used, then deleted, deliberately **not** added to any repository — keeps
  `push-api-ref.ps1`'s parenting rule (parent the first uploaded commit at the **remote tip**, then
  force the ref) and drops only its pairing requirement. It walks a local range, uploads blobs as
  **raw base64** so blob SHAs survive, verifies every created tree SHA against
  `git rev-parse <sha>^{tree}` and refuses to commit otherwise, and reads each message through a
  **file**. Two facts from the same work were already true of the repo scripts and are restated rather
  than discovered: `POST /git/trees` needs a **bare** entry name, and an empty repository refuses
  git-database objects with `409` so it needs one `Contents-API` write first.

  **The bootstrap step turned out to be unnecessary for a repository created with `auto_init`:** such
  a repository already owns a root commit, so it answers no `409` at all. The `Contents-API` write
  that was made left **no payload behind** — the force-push put the local root's tree on the branch —
  but its commit **survived as an ancestor** and had to be dropped when the commit was re-created
  with no parents, leaving the clean two-commit root. That is worth knowing against `AGENTS.md`'s
  existing note that a bootstrap commit ends up merely *unreachable*: **measured here it was the
  ancestor of the pushed history, not an unreachable orphan.**

- **Because:** the two failure paths were **reproduced in this session**, from this repository's own
  files, and the pushed result was **re-queried from the GitHub API** rather than taken from the
  report of the session that performed the push.

  **Reproduced here.** A minimal replica of `bin/push-api.ps1`'s `GitBytes` (`:64-80`) and `GitText`
  (`:82`) run against `HEAD..HEAD` returns **`$null`**, and the `GetString` call then throws
  `MethodInvocationException: … "Value cannot be null. (Parameter 'bytes')"` — with two controls: the
  same function on a non-empty range returns a 41-element byte array that decodes to 41 chars, and a
  genuinely empty `[byte[]]@()` passed to the same call returns length 0 **without** throwing. So the
  null comes from PowerShell's empty-array-to-`$null` flattening, not from the method. The pairing
  branch in `push-api-ref.ps1` was read at `:218-221`, `:224`, `:245-247` and `:248-249`, which is
  where the `-AllowUnrelated`-does-not-override-the-pairing-check claim is grounded. **Not run:** the
  scripts end to end, because no repository here is still in the broken state.

  **Verified against the remote, independently.** `ABccgh/dsh-ima-kb`, branch `main`, tip
  `208e9d0c5066e48507b2e66b795588ca362bc104`, whose tree is
  `9df69b5b633be520aa89ffa0200e222d1dc4b04c` — **equal to `git rev-parse HEAD^{tree}` in the local
  clone** (`$DSH_HOME/plugins/dsh-ima-kb`), which is the strong form the push tooling itself demands.
  The recursive remote path list holds **9 files** and matches the local `git ls-files` **exactly**,
  with the sole extra API entry being the `lib/` tree object — so **no path segment is doubled**. The
  root commit is a true root: **zero parents**, tree `9eb29b2`. The newline trap is genuinely avoided:
  the root's message is 1,614 chars with **49 LF, 0 CR, no trailing newline** — 50 lines intact, so
  the file-based message route worked. Two facts worth keeping: the **local** plugin history is
  **two commits, `6c1324a` then `8b9719b`**, which are **not** the remote's SHAs, and `8b9719b`'s tree
  equals the remote tip's tree; the **branch's tip SHA therefore still differs by re-encoding while
  the trees agree** — the documented refinement, not a defect. The local tree is clean and
  `node_modules/` is untracked. **A test would have caught nothing here:** the failure mode this
  entry is about is a push that cannot start, so the evidence is the remote's own state.

  **Reported but NOT re-measured here, and it must not be read as verified:** that
  `git replace <remote-sha> <local-placeholder>` fails with `Objects must be of the same type …`,
  that `git fetch` fails at the same TLS layer as push, that the GCM-stored token's identity is
  `ABccgh` with scopes `gist, repo, workflow` (so `DELETE /repos/…` answers **403**), and the scratch
  script's behaviour. These come from the session that did the push; no re-measurement of any was
  attempted, and none should be assumed. **One related reading was taken here and is worth
  distinguishing:** the **GitHub HTTPS API is reachable from a session in this workspace**, so the
  push transport works where `git`'s own transport does not. *Inferred, and labelled:* that is
  consistent with `git fetch` failing at the TLS layer while the REST route succeeds, but it does
  **not** confirm the fetch failure — the API endpoint and `git-upload-pack` are different transports.

  **Credential hygiene, re-checked while writing this entry:** no ima credential **value** fragment
  appears in `AGENTS.md` or `docs/agent-notes/*.md`. The names `IMA_OPENAPI_CLIENTID` and
  `IMA_OPENAPI_APIKEY` do appear, as reference names only, and that is the intended form. **No
  credential value is transcribed anywhere in this record.**

- **Rejected:** (1) **Recording the limitation as a usage error** — the crash path is a defect in the
  script (`$null` reaching `GetString`), reproducible and independent of the invocation. (2)
  **Naming `-AllowUnrelated` as the way through** — measured not to override the pairing check, which
  is exactly the wrong advice a reader would otherwise derive from its name. (3) **Reusing a magic
  `-Base`/`-RemoteBase` pair** — there is no local base under a remote-only parent, and the API
  rejects a commit whose parent it does not hold. (4) **Recreating the repository to get a clean
  history** — not available with the current credential, and it would discard a public repository
  rather than fit the tool. (5) **Committing the scratch script** — it is a one-off that duplicates
  `push-api-ref.ps1` minus a guard, and the repo's two scripts are the maintained surface; the
  *shape* is recorded instead. (6) **Treating the local/remote SHA difference as a failed push** —
  the trees are identical, and "compare trees" is the rule this repo already states.

- **Reversed by:** **(i)** a change to `bin/push-api-ref.ps1` that accepts an explicitly named
  remote-only root — e.g. a mode that takes the remote tip as the parent of the first uploaded
  commit and skips both the local-base walk and the pairing check — at which point the scratch script
  is redundant and this entry's limitation is closed; **(ii)** a fix to `bin/push-api.ps1`'s empty-range
  path so it **errors cleanly** instead of throwing `Value cannot be null` (that removes the
  *robustness defect* while leaving the structural limitation); **(iii)** a repository here whose
  remote history is not rooted in a server-side commit, which would show the case does not arise
  whenever local and remote roots are the same object.

## Note, not an entry: the D-46 gap

*(This heading deliberately does **not** match the `## D-<number>` entry pattern, so that a search
for entries reports D-46 as cleanly absent instead of matching this note. An earlier version of this
note was headed `## D-46 is cited elsewhere but is NOT in this file`, which **matched that pattern**
and made the gap look like an entry — the same class of defect as a check that measures its own
query rather than the system.)*

*(The gap itself: `AGENTS.md:233,251` and `PROJECT.md:426` all cite **D-46** as the entry that
supersedes D-45's superseded remote pair — those citations are **pre-existing text**, not introduced
by the session that wrote this note. `DECISIONS.md` contains no D-46 entry: the `## D-<number>`
headings run 1–27, 30–50, skipping **28/29** (deliberately absent, explained at line 658) and **46**.
This note's author did not delete it and cannot see what happened to it; inventing a replacement
would be worse than leaving the gap visible. What D-46 is about is recoverable from those citations;
only its text is missing.)*

## D-47: Where do GitHub capabilities belong, and what does the ingress actually prove?

- **Decided:** GitHub support is **three host-plane `insert:` rows in
  `profiles/web/cordis.patch.yml`** plus **one out-of-repo plugin package** (`$DSH_HOME/plugins/dsh-github`)
  mounted as **two sibling rows**. Specifically:

  | id | package | role |
  | --- | --- | --- |
  | `webhook-runtime` | `@deepseek-ai/dsh-webhook` | publishes `ctx.webhookRuntime` |
  | `webhook-github` | `@deepseek-ai/dsh-webhook-github` | registers the exact route `/github` on the **existing** 3080 `webServer` |
  | `github` | `dsh-github` (rule) | `insert` order 3, registers the `kind: "github"` rule |
  | `github` | `dsh-github` (tools) | same package, second row, registers 11 `github_*` tools |

  No realm anywhere, and **no preset composes any of it**.

- **Because:** the plane rule decides it, not convenience. `dsh-webhook` calls
  `super(ctx, "webhookRuntime")` (`dsh-webhook/lib/index.js:203`) — it **publishes a service**, and
  that service is consumed by a sibling host row and by the out-of-repo plugin. A per-session copy
  would both starve those consumers and collide on the second session, and a **preset** publishing
  it would be rejected by the mount audit. So it is host-plane by construction, and its six injected
  services all have provider rows in this composition (`agents` ← `dsh-agent/lib/index.js:299`;
  `agentDefaultModel`, `permissionPresets`, `sessionTitle` ← `dsh-base` rows; `agentPresets` ←
  `dsh-web-app`; `workspaceRegistry` ← `dsh-workspace/lib/index.js:333`) — verified by grepping each
  provider's own `super(ctx, …)` call, not by assuming a row id implies a service name.

- **The ingress contract, measured live on 127.0.0.1:3081** (a second instance; the user's 3080 was
  never restarted or killed):

  | request | code | meaning |
  | --- | --- | --- |
  | `GET /github` | `405` | adapter's own method guard — but see the trap |
  | `POST /github`, wrong content-type | `415` | content-type gate |
  | `POST /github`, JSON, no headers | `400` | header gate (`requiredHeader` runs before the secret) |
  | `POST /github`, headers, **no secret in refs** | `503` | `credential === undefined` → *"GitHub webhook secret is unavailable"* |
  | `POST /github`, headers, secret present, **bad signature** | `401` | HMAC rejected |
  | `POST /github`, **valid HMAC** | `202` + a real session | the whole chain works |

  **The trap, and it is the reason this ladder is written down:** `405` is a **false positive**.
  The web-app's fallback seat answers an **unmatched** path with the same `405`, so
  `POST /definitely-not-a-route-xyz` and `POST /github` are indistinguishable while the route is
  absent. The discriminator is `503` versus `401`, which needs no valid signature because the
  adapter resolves the secret (`dsh-webhook-github/lib/types/handler.js:75-78`) **before** it
  verifies the HMAC. **A `503` here is therefore positive evidence that the row mounted, and a
  `405` is not evidence of anything.**

- **The session the rule creates, and what proved it.** A signed POST answered `202`, and the
  session store then contained `webhook-a627e8f0-2b95-48a7-9032-42b35d375102` whose header reads
  `cwd: D:\DeepSeek Harness\github-worktrees\ABccgh-dsh-smith`, `agentPreset: dsh-forge`,
  `delegationDepth: 0`. **The session log is header-only** (the shape this repository already
  records), so the log cannot show the prompt; the **projection** can, and it did — the record
  carries `permissions.preset: workspace-write`, `modelSelection` `deepseek-flash` at
  `reasoningEffort: max`, `sessionStats` with `turns: 1`, and non-zero `tokenUsage`. **A non-zero
  token count is the strong form of "the prompt was admitted and processed"**, and it is stronger
  than a text search, which would have to guess which projection row holds the conversation.

  > **Correction to an assumption this session held:** a first instance on 3081 answered `404` for
  > `GET /github` — i.e. *not* the fallback's `405`. That instance had booted from a composition
  > that did not yet carry the rows, and a **fresh** instance mounted them with no config change.
  > So the `404`-versus-`405` distinction was a staleness artifact, not a routing fact, and the
  > ladder above was re-measured on the clean boot.

- **Not moved into a preset, deliberately:** the tools are registered into the host `tools`
  registry, so they are visible in **every session of every preset**. That is what "available in
  every session" requires and is also why a mistake here is global.

- **Reversed by:** (i) a decision that GitHub tools should be per-preset, which would move the tool
  row into a preset and require an `isolate` realm because `tools` is consumed host-side; (ii) a
  dedicated ingress listener on another port, which the adapter README supports
  (`isolate: { webServer: true }`) and which this deployment does not need — the existing
  `webServer` already owns the socket; (iii) any preset that composes `@deepseek-ai/dsh-webhook`,
  which would fail the mount with `service "webhookRuntime" has been registered at <Owner>`.

## D-48: Is D-45's push limitation closed, and what does the new CI guard actually catch?

- **Decided:** **D-45's limitation is closed in code, and only in code.** Both reversal clauses are
  implemented:

  - **`bin/push-api-ref.ps1` gains `-RemoteOnlyParent`** — the mode D-45 named as "(i) a change …
    that accepts an explicitly named remote-only root". It skips the pairing check, skips the
    remote-range walk (there is no `-RemoteBase` to walk back to), and parents the first uploaded
    commit at the **current remote tip**, so the ref move stays a fast-forward and needs no
    `-Force`. The ancestry walk is skipped too, and deliberately: the caller has asserted there is
    no local counterpart for the remote ancestry, so the walk could only report a divergence the
    flag already asserts. Nothing is lost, because the **API's own `422 Update is not a fast
    forward`** is a stronger guard than a bounded 200-hop chain walk and is enforced server-side.
  - **`bin/push-api.ps1` now errors cleanly on an empty range** — D-45's clause (ii). Measured before
    and after: the old shape reached `[Text.Encoding]::UTF8.GetString($null)`; the new one throws
    `no commits in <base>..HEAD — -Base resolves to HEAD …`. The root cause is fixed as well as
    guarded (`return ,$ms.ToArray()`, because PowerShell flattens an empty array to `$null` across a
    return — the same comma rule this repository already records for `@()` in a value position).

- **Measured, and the boundary stated rather than blurred:**
  - **Syntax:** both scripts parse with zero errors (`[Parser]::ParseFile`).
  - **The empty-range guard's scope:** exit 1 with the named error for `-Base <HEAD>`, **exit 0** for
    `-Base <HEAD~1>` over the same tree — so the guard is specific to an empty range and does not
    disturb a real one.
  - **Argument validation:** `-RemoteOnlyParent` with `-Init` and with `-Force` both refuse with
    their own message, and `-Init` alone still behaves exactly as before (control run).
  - **`-RemoteOnlyParent`'s happy path was NOT executed end to end.** It needs a live
    `GH_TOKEN`, and this session had none (no `GH_TOKEN` in the environment, `git-credential-manager`
    is not on `PATH`, and no `gh`). Every attempt therefore stopped at
    `target repository … is not reachable with this token` — the script's own reachability guard,
    which fires before the mode is ever reached. **This is the honest boundary: the limitation is
    closed in the code and unproven in a real push.**

- **A defect this found in the new code itself, recorded because it is the kind a passing test
  hides:** the first version of the mutual-exclusivity check sat **after** the `-Init` branch, so
  `-RemoteOnlyParent -Init` never reached it and died on the `-Init` path's own, less specific
  error. The check now lives with the other argument validation at the top. It was found by running
  the flag combination, not by reading the diff.

- **The CI workflow, and the one failure it exists for.** `.github/workflows/checks.yml` runs the
  four checks that work without a deployment, on `windows-latest` (the platform this package
  actually ships for), with `permissions: contents: read` and **no `secrets.*` reference anywhere**
  so a fork's pull request is safe. It deliberately does **not** run `verify.mjs` (bare Context, always
  INCONCLUSIVE), `install.mjs` (writes `${DSH_HOME}`), or `drift-check.mjs` (needs an installed
  harness) — and the workflow's own header says so, so a future reader does not "fix" it by adding
  them.

  The load-bearing step is `bin/check-pack.mjs`, which reads the **packed tarball** rather than the
  working tree. Every other check here reads the tree, so all of them pass whether or not
  `package.json`'s `files` allowlist is right; the tarball is the only artifact where the difference
  shows. **It was falsified, and the first falsification attempt was itself wrong:**

  | mutation (on a COPY in `%TEMP%`, never the real tree) | result |
  | --- | --- |
  | drop `bin` from `files` | **PACK OK** — and this is correct, not a gap: npm force-includes files named by the `bin` map |
  | drop `dsh-smith` from `files` | **PACK FAILED, 4 findings** — the real footgun, caught |
  | restore the allowlist | **PACK OK** (control) |

  So the guard is demonstrated to fail on the case it was written for and to pass when repaired.

- **Reversed by:** (i) a real `-RemoteOnlyParent` push, which is the only thing that can promote
  the mode from "closed in code" to "measured"; (ii) a CI workflow that cannot go green cheaply —
  the first green run is what authorizes keeping it; (iii) any decision to publish the tarball
  differently, which would make `check-pack.mjs` assert the wrong surface.

- **A citation corrected, because it was wrong when written.** The claim that this repository has
  "no CI by deliberate choice (D-33)" is **not in D-33**. D-33 is about the balance plugin's source
  location and empty-repository behaviour; the no-CI sentences live in `BOARD.md`, items 7 and 8, and
  both concern the **plugin** repositories. Their reasoning — "the working tree is what the deployment
  loads, so the repo copy merely drifts" — does **not** transfer to `dsh-smith`, which is loaded only
  through `bin/install.mjs`. There was therefore no recorded decision forbidding CI here, only an
  unexamined default.

## D-49: Three credential values were printed into a session transcript — what is the consequence?

- **Decided:** the values of `DEEPSEEK_API_KEY`, `IMA_OPENAPI_APIKEY` and `IMA_OPENAPI_CLIENTID`
  were **exposed into this session's transcript** by a mistake in this session's own diagnostic
  command, and they must be treated as compromised and rotated. **No value is reproduced in this
  record or anywhere else in `docs/agent-notes/`.**

- **Because:** the intent was to list credential **reference names only**, and the command was
  wrong. It used `Select-String -Pattern '^\s{2}(\w+):'` and piped `.Line` — which is the **whole
  line**, not the captured group — so every `name: value` pair in `$DSH_HOME/.credentials.yaml` was
  printed verbatim. A read that meant to answer "which refs exist" answered "here are the secrets".
  This is the same class of error this repository already warns about in other contexts: **a
  pattern that matches is not the same as the capture you meant**, and the difference is invisible
  in a successful run that prints plausible output.

- **The consequence, stated precisely, without over- or under-reading it:**
  - The exposure is to the **session record**, which this deployment persists under
    `$DSH_HOME/sessions/` and to the model provider as conversation content. It is not a public
    leak on its own, and whether it is a breach depends on who can read that material — a question
    this record does not answer and should not guess at.
  - **Every value is independently rotatable by the human**, and each is the recommended remedy
    rather than analysis: the DeepSeek key at its console, and the two ima values at
    `https://ima.qq.com/agent-interface` (credentials are minted there and are separate from the
    desktop app's login — D-34).
  - Rotation requires **no restart**: `dsh-credentials-local` registers a watcher
    (`watch: true`, per this file's ima subsection), which was independently demonstrated this
    session — after the reference was added, the adapter went from `503` to `401` with no process
    restart.

- **What changed as a result:** the working practice for the rest of this session was to read that
  file only through a **key-only projection** and to name references, never values. `GITHUB_TOKEN`
  and `GITHUB_WEBHOOK_SECRET` were added by name; the webhook secret this session generated is a
  fresh value whose only purpose is local verification, and it is therefore not sensitive in the
  same way — but it is still not reproduced in these records.

- **Reversed by:** (i) the human rotating all three and confirming it, which closes the exposure
  materially while leaving this record as history; (ii) evidence that the session store is not
  readable beyond this machine, which would narrow the exposure without removing the reason to
  rotate.

## D-50: Does this deployment need GitHub file-write or asset-upload tools?

- **Decided:** **No — deliberately, and the gap is intentional rather than unfinished.** The
  `dsh-github` tool set stays at **11 tools, 9 of them read-only**. The three that write act on
  **issues and pull requests**; nothing writes file contents into a repository and nothing uploads
  binary assets. Pushing content to GitHub from a session is done by running
  **`bin/push-api-ref.ps1` through the ordinary `pwsh` tool**.

- **Because:**
  - **The capability already exists on the verified path.** `bin/push-api-ref.ps1` reproduces
    `git push` over the REST API and is the maintained artifact: blob bytes come from
    `git cat-file blob` rather than the working tree **because `.gitattributes` text normalization
    means the checked-out file can differ from the blob**; every blob/tree id is verified against
    `git`'s own value and the script refuses to commit on a mismatch; the resulting remote tree is
    compared against `git rev-parse HEAD^{tree}`. A `github_file_write` tool would be a **second,
    less guarded route** to the same outcome — the duplication this repository's editing rules
    already discourage.
  - **It would widen the credential for nothing.** A file-write tool needs `contents: write`; the
    script needs no GitHub token beyond what a push already uses.
  - **The blast radius is global.** Host-plane tools are visible in **every session of every
    preset**, so a "modify my repository" binding is not scoped to one agent or one task.
  - **DSH's own upload need is already met, and separately.** The Web GUI's attachment path is
    composed in `dsh-web-app` (`attachment-local` + `dsh-client-file-upload` +
    `dsh-client-ui-attachment`), it stores bytes **outside the append-only session log** and passes
    the model a content-addressed file path — measured on this deployment:
    `$DSH_HOME/attachments/v1/objects/` held **6 objects / 0.18 MB**, including the image the user
    had just attached. So "can DSH accept an upload" was never the open question; the open question
    was whether **GitHub** needed a write tool, and the answer is no.
  - **The two candidates, named so a later reader need not re-derive them:** a single-file
    create/update via `PUT /repos/{owner}/{repo}/contents/{path}` (base64 body, the current `sha`
    for updates, a commit message), and release-asset upload via `uploads.github.com`. The second is
    the one whose **network reachability was never tested** here — this machine reaches
    `api.github.com` and `codeload`, but a GitHub release-asset download already hung (D-47's
    addendum), so that path cannot be assumed to work.

- **Reversed by:** an explicit new request for repository writes from inside a session — and if one
  comes, **the script path is tried first**, because it is already verified end to end. A future
  session must **not** treat the 11-tool list as an incomplete set to finish: the plugin's own
  README says so in its Tools section, which is the guard against exactly that instinct.

## D-51: The GitHub project was cancelled — what was removed, and what deliberately was not?

- **Decided:** the user **cancelled the GitHub integration project** and asked for a full teardown.
  **Removed:** the three host-plane rows (`webhook-runtime`, `webhook-github`, `github`), the
  out-of-repo plugin `$DSH_HOME/plugins/dsh-github` (9 files), its `link:` dependency in the web
  profile, the profile-local `dsh-github-check.mjs`, the two credential refs it introduced
  (`GITHUB_WEBHOOK_SECRET`, `GITHUB_TOKEN`), the user-level `NODE_OPTIONS=--use-system-ca`, the
  desktop `restart-dsh-web.cmd`, the `%TEMP%` scratch files, and the `github-worktrees/` checkout.
  **D-47 through D-50 are NOT deleted** — this file is append-only, so they stand as history and are
  superseded by this entry.

- **Because — and this is the part worth carrying: cancelling an *integration* is not the same as
  reverting everything the work touched.** Three classes of change were kept deliberately, and a
  later session must not "finish the cleanup" by deleting them:

  | Kept | Why it is not part of the cancelled project |
  | --- | --- |
  | `bin/check-pack.mjs` + `.github/workflows/checks.yml` | They guard **this repository's own** published tarball. The `files`-allowlist failure they catch is undetectable by any check that reads the working tree, which is every other script in `bin/`. Nothing about them is GitHub-API-specific. |
  | `bin/push-api-ref.ps1`'s `-RemoteOnlyParent`, and `bin/push-api.ps1`'s named empty-range error | Fixes to **this repository's own** push tooling, which answers D-45's reversal clauses (i) and (ii). Reverting would reintroduce a documented crash and a documented structural limitation. |
  | The measurements in `PROJECT.md` | The `405` false-positive result, `git clone`'s `CRYPT_E_NO_REVOCATION_CHECK`, the `NODE_OPTIONS` propagation trap, and the quick-tunnel hostname behaviour are **facts about this machine and these products**, true whether or not any GitHub plugin exists. |

- **The teardown's own ordering constraint, stated because it is easy to get backwards.**
  `webhookRuntime` is a **process-global singleton published by one of the three rows**, and the
  other two rows consume it. So the rows must be removed **together**: deleting only the provider
  leaves the adapter and the plugin reporting `waiting for webhookRuntime` — a half-removed
  composition that looks like a broken mount rather than a completed teardown. The dependency itself
  was removed with the sanctioned writer (`dsh plugin --profile web remove dsh-github`) rather than
  by editing the profile's `package.json`, per `AGENTS.md` rule 7.

- **A record defect this entry fixes, because it was mine.** The note explaining the missing D-46 was
  headed `## D-46 is cited elsewhere but is NOT in this file`, which **matches the `## D-<number>`
  entry pattern** — so a search for entries reported D-46 as present when only the note was. The
  heading is now `## Note, not an entry: the D-46 gap`. The underlying gap is **pre-existing**:
  `AGENTS.md:233,251` and `PROJECT.md:426` cite D-46 as superseding D-45's superseded pair, and no
  D-46 entry exists. **D-46 stays unassigned**, and this session did not invent one.

- **Reversed by:** a new request to rebuild GitHub support. If that comes, **read D-47 through D-50
  first** — they carry the measured contracts (the adapter's 503-before-401 ordering, the exact
  config surface, the `output.schema`/`parameters` registration requirement, the token permission
  map, and the `NODE_OPTIONS` transport fix) so the work does not have to be re-derived. Note that
  the plugin's own README went with the plugin, so those records are now the only copy of that
  reasoning.


## D-52: Which write route ingests the CK3 Wiki into ima — URL import or Markdown upload?

- **Decided:** Ingest the article corpus with **`import_urls`** (the wiki's own URLs), and keep the
  generated Markdown as a checked **local mirror** rather than as the write payload. A bulk
  `ima_import_urls` and a bulk `ima_upload_dir` tool were both added to `dsh-ima-kb`, but the
  corpus goes in by URL.
- **Because:** measured on the live account, `import_urls` derives `media_id` **from the URL**, so
  importing the same URL twice returned a **byte-identical media_id and left the entry count
  unchanged** (two imports of `https://ck3.paradoxwikis.com/Casus_belli`: 13 → 13 entries). That
  makes re-import an in-place refresh. `add_knowledge` (file upload) has **no upsert input** — no
  `media_id` in its request — so every re-upload would be a NEW permanent entry. Since **ima's
  OpenAPI has no delete at all** (`delete_knowledge` / `delete_media` / `delete_doc` and seven other
  spellings all return 404), only the URL route can satisfy "keep it current" without growing the
  knowledge base forever. Two further measured facts support it: the account's own
  `明日方舟 Wiki` (18,500 entries, all `media_type: 2`) is the working precedent for this route at
  scale, and uploaded Markdown can never be read back (`get_media_info` answers `220030` for
  `media_type: 7`).
- **Rejected:** **Markdown upload as the primary route** — it produces the better artefact (controlled
  titles, provenance header, no dependence on ima's extractor) but is append-only, so a refreshed
  page would leave the stale copy standing forever; the first version of the plan chose it and was
  reversed by the count experiment above. Also rejected: **version-suffixed filenames** as the
  freshness mechanism — they buy nothing over the in-place upsert and turn every edit into another
  permanent entry. And **hand-written COS signing** remains out of the question: five hand-derived
  variants all produced `SignatureDoesNotMatch` (the existing README's record), so the official
  `cos-nodejs-sdk-v5` stays the only path.
- **Reversed by:** a measurement that URL re-import does **not** dedupe (two imports producing two
  media_ids), or that ima's server-side fetcher cannot retrieve these pages — the same probe that
  settled the first question settled this one, so both are re-checked by importing one URL twice and
  comparing `media_id` and the entry count.

## D-53: Why does the wiki converter use one output buffer per scope instead of per element?

- **Decided:** `tools/ck3wiki/lib/convert.mjs` keeps **one output buffer per scope**; structural
  frames carry no text. Text resolves to its nearest **capturing** ancestor (`cell`, `tableRow`,
  `heading`, `caption`, `link`) rather than to the frame on top; a frame that did not receive its own
  end tag must **not** run its structural close action; and only headings keep a marker, substituted
  in document order.
- **Because:** the per-frame-buffer version failed four ways in a row, each producing a corpus that
  still looked complete. Measured on the 169 KB `Faith` page and on synthetic cases: (1) appending to
  "the current frame" made **the entire prose body vanish** — text inside a `<div>` went into a
  buffer discarded at close; (2) running close actions while unwinding made **one `</div>` inside a
  table emit and clear the whole table**; (3) resolving text to the frame on top turned every
  heading into plain prose, because `<h2>` wraps its text in `<span class="mw-headline">`; and (4)
  an independent adversarial review then found that `renderTable` reset its cursor per call, so
  **every table after the first was filled with the first table's cells**, that each cell's text was
  emitted twice, that a lazy link-label regex made **130 links on one page swallow the following
  prose**, and that `</b>` never closed its delimiter. The architecture above is what makes each of
  those structurally impossible rather than merely fixed.
- **Rejected:** **streaming capture in frames with their own buffers** (the original design, and the
  source of all four defects); **regex post-processing over the finished text to recover link labels**
  (cannot know where a link ends — it guessed "next blank line"); **a keyed placeholder map for
  headings and cells** (tried, then abandoned: the map and the emit stream can silently diverge, and
  one variant produced an empty corpus with live statistics).
- **Reversed by:** a page where the new architecture loses content the old one kept. The test that
  would show it is `node verify-convert.mjs --checkall` **reporting an audit failure**, plus
  `node falsify.mjs` going non-zero — that file is the pinned regression test for exactly these four
  defects, and its validity was established in the negative: re-breaking the cursor on a copy makes
  it fail.

## D-54: A wiki that answers a bot challenge to Node's `fetch` — fix the plugin, or keep it local?

- **Decided:** Keep the workaround **local to `tools/ck3wiki`** (a `curl.exe` transport driven through
  `child_process`). Do **not** change `@deepseek-ai/dsh-web-fetch-http`.
- **Because:** `ck3.paradoxwikis.com` sits behind a Fastly challenge that returns HTTP 200 with an
  HTML page, and its discrimination is: a browser-like `User-Agent` **and** the presence of
  `Accept-Language`. Measured repeatedly: Chrome UA + `Accept-Language: en-US,en;q=0.9` → real JSON
  5/5 and 4/4; the same without `Accept-Language` → challenge; curl's own UA, `python-requests/2.31`,
  or UA-alone → challenge; `Accept-Language: *` → real JSON; and **Node 26's own `fetch` is
  challenged even with both headers**. The installed `dsh-web-fetch-http` sends a **fixed** header set
  — `user-agent` (`deepseek-harness/0.0.1 (+https://github.com/deepseek-ai)`, described in its own
  source as "an explicit product agent, never a browser disguise") and `accept` — with **no
  `Accept-Language`** and no way to add a header through config. DSH's own `web_fetch` did retrieve
  one wiki page successfully, so the gate is intermittent rather than absolute; but a host-plane row
  that crawls hundreds of pages cannot rely on that, and the challenge is a property of one third-party
  host, not a defect in DSH's fetch seam.
- **Rejected:** **adding a browser UA or a header override to `dsh-web-fetch-http`** — it changes
  host-plane behaviour for every session and every site to serve a one-off crawl, and its deliberate
  no-disguise UA is a policy choice, not an oversight. Also rejected: using DSH's `web_fetch` as the
  crawler — one URL per call, model tokens per page, and no retry-on-challenge.
- **Reversed by:** a requirement to crawl multiple gated hosts, or a decision that the fetch seam
  should expose per-request headers. Either would move this into the host plane, and the measured
  recipe (`User-Agent` + `Accept-Language`, HTTP/1.1 vs 2 irrelevant) is what such a change would need.

## D-55: On the ima OpenAPI, what does an HTTP 403 mean — and can the API create a knowledge base?

- **Decided:** Treat **HTTP 403 from the ima OpenAPI as a rate limit first**, not as a credential
  failure; space requests and back off exponentially. Separately: the API **can** create both a
  knowledge base and a folder, so the plugin exposes `ima_kb_create` and `ima_kb_mkdir` rather than
  telling the user to create them by hand.
- **Because:** a bulk import of 922 URLs accepted the first **484** and then answered
  `HTTP 403` for every batch after it (about 0.3–0.7 s/batch, roughly 50 requests/second). Three
  measurements settle what that 403 was: an immediate authenticated read (`search_knowledge_base`)
  **succeeded in 837 ms**; that read reported the knowledge base as holding **exactly 484 entries**,
  i.e. exactly what the local state file recorded; and a re-run of the remainder with **1 concurrent
  batch, a 1.2 s gap and exponential back-off on 403** completed the other 438 URLs with **zero**
  failures. The plugin's own error text ("ima 拒绝凭证…请重新生成") is accurate about the HTTP status
  and wrong about the cause, which is worth knowing before it sends someone to regenerate a key.
  On the second question, both endpoints exist and their required fields were pinned by **rejected**
  requests: `create_knowledge_base` demands `Name` matching `^\S[\S ]{0,23}\S?$` (1–25 chars) and
  `Type` ∈ {`KBT_MINE_KB`, `KBT_SHARED_KB`, `KBT_SUBSCRIBED_CREATE_KB`}; `create_folder` demands
  `knowledge_base_id` and `name` (≤255). Field discovery by invalid request creates nothing, which
  is what makes it usable on an API with no delete.
- **Rejected:** **regenerating the credentials** — the first hypothesis, and it would have broken a
  working setup; the single read that succeeded disproved it in under a second. Also rejected:
  **parallel import at the rate the service tolerates early on** — 3 concurrent batches is what
  reached the limit, so the tool's `bulkConcurrency` default stays low. And rejected:
  **the claim that the API can only consume folder ids** — the plugin's README asserted it, and
  probing `create_folder` with a deliberately non-existent knowledge base id returned
  `220004 invalid knowledge_base_id` instead of `404`, which is what a real route looks like.
- **Reversed by:** a 403 that persists across a single spaced request while other authenticated
  calls also fail — that would be a genuine credential problem. The check is one read, not a bulk
  retry: `search_knowledge_base` answering `code 0` means the key is fine.

## D-56: Does `-RemoteOnlyParent` actually push, and what does the topics API require?

- **Decided:** Use `bin/push-api-ref.ps1 -RemoteOnlyParent` as the push route for this
  deployment's plugin repositories, invoked **from the repository being pushed** with a **full
  SHA** in `-Base`. For repository topics, send the **normalised slug** (`deepseek-harness-plugins`)
  in the PUT body and treat a bare HTTP 500 as transient.
- **Because:** the flag had **never been exercised in a real push** — `AGENTS.md` recorded it as
  code-complete but "NOT measured", pending a live `GH_TOKEN`. This session supplied one, and the
  push completed: `refs/heads/main` moved `4e2d9cc` → **`53a3f66`**, the new commit **parents at
  `4e2d9cc`** (so the move was a fast-forward and `-Force` was never needed), and five checks pass
  **against the API rather than against the script's own report** — remote tree `ebdd375` equals
  the local tree, one parent, 9 blobs byte-identical to `git ls-files`, no doubled path segment,
  and the 18-line commit message intact (the failure mode that once collapsed a message to one
  line was avoided because the script reads the commit OBJECT, not a command-line string).
  Two operational facts were measured the hard way on the way there. **(1)** The script runs git
  as `git -C $PWD`, so it operates on the **caller's** repository: run from `D:\DeepSeek Harness`
  it reported `no local commits in <sha>..HEAD` for a range that exists in the plugin repo, and a
  short SHA fails for the same reason. **(2)** The topics endpoint rejects the display form —
  `PUT /repos/{owner}/{repo}/topics` with `"DeepSeek Harness Plugins"` answers
  `422 must start with a lowercase letter or number, consist of 50 characters or less` — while
  `deepseek-harness-plugins` is accepted and rendered back with capitals, which is why the
  comparison must be normalised on both sides.
- **Rejected:** **`git push`** — retested this session with the token in the URL and it still fails
  at the TLS layer with `schannel: CRYPT_E_NO_REVOCATION_CHECK (0x80092012)`, i.e. the
  credential is not the problem and no token can fix it. Also rejected: **git's OpenSSL backend**,
  because no CA bundle exists anywhere on this machine (`C:\Program Files\Git`, the npm caches and
  the PowerShell tree were all searched) so `http.sslBackend=openssl` has nothing to verify with.
  Also rejected: **`-Force`** — unnecessary once the parent is the remote tip, and
  `-RemoteOnlyParent` is explicitly mutually exclusive with it.
- **Reversed by:** a push where the remote tip has a **local counterpart** (then plain
  `-Base`/`-RemoteBase` pairing is the right mode and this flag would be wrong), or a change to the
  topics API that accepts display-case input. The cheapest re-check that the route still works is
  `-DryRun`, which prints the commit→parent→tree plan without touching the ref.

## D-57: Why was the CK3 Wiki project cancelled, and by what rule was the cleanup layered?

- **Decided:** Cancel the CK3 Wiki → ima 知识库 project on the user's instruction, and clean up under
  the rule this repository already records for `%TEMP%`: **删除按归因分层 —— 确定归因的删，
  无法归因的一律不动。** Concretely: **固化有效工作到仓库，然后才删生成物与一次性脚本**；保留
  重建语料与跑回归测试所必需的 **9 个文件**；`ima` 服务端的数据**不删也删不掉**，交回用户在
  ima 客户端手工处理。
- **Because:** the project's two deliverables were **already complete** — the local mirror (916 files,
  15.9 MiB, `data/manifest.json`) and the knowledge base `Crusader Kings III Wiki` (913 entries) —
  and the three items this board listed as open were all closed at cancellation: the **title backfill
  had completed** (measured: all 913 titles carry `<wiki title> - CK3 Wiki`; the board's `85 → 104`
  and `coverage.json`'s `backfilled: 220` are superseded readings), the plugin repo was in sync, and
  the local mirror had served its purpose. Two facts made "delete the local artifacts" safe rather
  than lossy: the corpus is **regenerable** (`node tools/ck3wiki/extract.mjs`), and it was already
  `.gitignore`d, so nothing in git had to change to drop it. Two facts made "delete only some of the
  scripts" necessary rather than convenient: **`lib/http.mjs` has three importers**
  (`extract.mjs:31`, `probe-html.mjs:3`, `verify-convert.mjs:14`) and is the only copy of this
  site's Fastly-gate bypass conditions, and `falsify.mjs` is the **only regression test** for the
  four silent converter defects D-53 records.
  The reason the cleanup **started** with commits rather than deletions is the finding that shaped
  this decision: `dsh-smith` was carrying **2253 lines of uncommitted, already-decided work** —
  the D-48/D-56 `bin/push-api*.ps1` fixes, the `check-pack` suite, and 2007 lines of agent-notes.
  Those changes implement what this repository's own documents describe as *done*
  (`AGENTS.md`: "push-api.ps1 now throws … instead of crashing"; D-56: "THE HAPPY PATH IS NOW
  MEASURED"), so a cleanup that began by deleting the working tree would have destroyed work that
  the documentation claims exists. They were committed first, as four topic-scoped commits.
  **The ima side is a capability boundary, not a cleanup gap:** the OpenAPI has **no delete
  endpoint at all** (ten spellings, all 404), so the 913 server-side entries and the 12 probe
  entries in `曦曦的知识库` can only be removed by the user, in the ima client.
- **Rejected:** **deleting `%TEMP%` by time window** — that directory simultaneously holds other
  software's UUID temp files, other sessions' working directories, and application logs; only
  `ck3review` (attributable to this project by content and mtime) and this session's own probe
  scripts were removed. Also rejected: **deleting `lib/http.mjs`, `falsify.mjs` or
  `verify-convert.mjs`** with the rest of the tooling, because that would trade 19.41 MB of
  regenerable data for the permanent loss of the rebuild path and the regression test. Also
  rejected: **rewriting D-52/D-53/D-54** — this file is append-only and their reasoning is still
  correct; only the *status* changed, which is what this entry and the `PROJECT.md` banner record.
  Also rejected: **treating the ima entries as removable** — with no delete endpoint, and the URL
  import route being an in-place upsert, importing cannot subtract either.
  **And one claim that arrived during planning and was rejected on measurement:** an independent
  architecture review asserted the join key is `md5(percent-DECODED url)` and that failing to
  decode loses ~29% of rows. Tested against **three real `media_id`s captured live from the API**,
  the measurement says the **opposite**: `md5(encoded url)` matches byte-for-byte
  (`8817f51f…`, `921c07eb…`, `d3da2528…`) while `md5(decoded)` matches **none**. The review's own
  re-run of its probe was not reproducible either — its script resolves `data/manifest.json`
  relatively and exits 1 with `ENOENT` from the workspace root. The review's *other* findings were
  confirmed and are recorded here: **916 manifest rows → only 913 distinct URLs and 913 distinct
  titles**, with exactly **3 titles duplicated across partitions** (`Crusader Kings III Wiki:Style`
  and `…:Versioning` in `00_Articles`+`10_Project`, `Dragon Age: Thedas at War` in
  `00_Articles`+`50_Categories`) — and the partition arithmetic `430−2=428`, `202−1=201` shows ima
  kept **one copy each**, which is the missing half of the 922 → 913 explanation.
- **Reversed by:** the user reopening the project, which is a scope decision rather than a
  measurement. If it is reopened, the next step is **content reading** — and that work must inherit
  two measured facts: the join key is **`md5(percent-ENCODED url)`** hashed exactly as the manifest
  writes it (title join is a valid cross-check at 912/913, the single miss being the `CK3 Wiki`
  redirect), and the `media_id` layout is
  `weburl_<32 hex>_<md5(url) as 32 hex><folder_id as decimal 16 chars>` with **no separator** —
  the existing `ingest.mjs:90` and `README.md:105` describe it as
  `weburl_<前缀>_<md5>_<目录 id>`, i.e. with an underscore that is not there, and both should be
  corrected before anyone parses that id again.

## D-58: D-57's own counts, after the deletion it ordered — nine files or eight, and how many importers?

- **Decided:** Correct two counts that D-57 carries, by **appending** rather than editing (this file
  is append-only): after the cleanup **`tools/ck3wiki/` holds 8 tracked files, not 9**, and
  **`lib/http.mjs` has two importers, not three** — the third, `probe-html.mjs:3`, was deleted by
  D-57 itself. Nothing about the decision changes: the enumerated files are exactly the ones kept,
  `lib/http.mjs` is still the only copy of that site's Fastly-gate bypass conditions, and
  `falsify.mjs` is still the only regression test for the four silent converter defects D-53 records.
  **`AGENTS.md` gains no corpus statistics from this** — only the rule-level fact that
  `tools/ck3wiki/` is tracked *on purpose* and is not a cleanup target; the join key and the
  duplicate-title arithmetic stay in D-57 and the `PROJECT.md` banner, where a reader arrives with
  that question.
- **Because:** measured on the committed tree, not re-read. `git ls-files tools` returns exactly
  eight paths — `README.md`, `extract.mjs`, `falsify.mjs`, `ingest.mjs`, `lib/convert.mjs`,
  `lib/http.mjs`, `package.json`, `verify-convert.mjs` — and `git show --stat 0016c18` lists the
  same eight. D-57's own enumeration is eight items under the label "9", so only the number was
  wrong; that same wrong nine had been copied into `BOARD.md` and `PROJECT.md`'s cancellation
  banner, and all three are now corrected. (An older **11 files** reading, still in `PROJECT.md`,
  describes the pre-cleanup directory — it is kept as history with the current count beside it.)
  A grep for `lib/http.mjs` across the surviving tree returns `extract.mjs:31` and
  `verify-convert.mjs:14` only. One more census has drifted the same way and is left where it is,
  because this file is append-only: the `## Note, not an entry: the D-46 gap` above reads that the
  entries run `1–27, 30–50`, which was accurate when it was written — the inventory now runs to
  **57**, and that is the figure `BOARD.md` carries. (Its other citation, "explained at line 658",
  still points at the D-28/D-29 note, re-checked.)
- **And one consequence of the deletion that belongs with these, because it changes what a reversal
  check costs:** D-52, D-53 and D-54 stand as decisions — the cancellation changed their *status*,
  not their reasoning — but their reversal conditions are no longer all runnable offline.
  `falsify.mjs` runs with **no corpus at all**: its five cases are inline HTML and its only import
  is `lib/convert.mjs`, so D-53's pinned regression test survives the deletion intact.
  `node verify-convert.mjs --checkall` does not: it reads `data/_raw`, and **no surviving script
  writes that directory** — `extract.mjs` produces `data/out/**` and `data/manifest.json`, while
  only `verify-convert.mjs --fetch` (network, through the gate bypass) creates `data/_raw`. So
  re-opening the converter means fetching pages first, and D-52's "import one URL twice and compare
  `media_id`" re-check needs live URLs rather than the deleted local mirror.
- **A number the record does not close, flagged rather than reconciled.** D-57 names two causes for
  the `922 → 913` difference — one redirect and three titles duplicated across partitions — which
  is four of the nine; the same record corrects ns10 from **254** to **248**, and `BOARD.md`'s
  extraction note explains **six** Template titles returned twice by `allpages` pagination (`922`
  manifest entries for `916` files), which reads like a third cause and would make the submitted
  list 916 rather than 922. The corpus and the coverage script are both deleted, so this cannot be
  settled from the tree; it is recorded as an open question on the board instead.
- **Rejected:** editing D-57's text, which append-only forbids even for a digit — and the digit is
  the argument for the rule rather than against it, because any reader can count. Also rejected:
  treating the importer count as still three because it was true when D-57 was written — the
  sentence reads as present tense about the surviving files, and one of the files it names is the
  one the same decision deletes, so it is the kind of claim that misleads precisely the reader who
  goes to check it.
- **Reversed by:** a measurement showing nine tracked paths under `tools/ck3wiki/`, or a third
  importer of `lib/http.mjs`. Both are one command: `git ls-files tools`, and a grep for
  `lib/http.mjs`.

## D-59: Does the CK3 `922 → 913` reconciliation close, or is it unanswerable now?

- **Decided:** It **closes**, and the answer is reading **(ii)**:
  **`922 − 6 = 916 − 3 = 913`**. The **6** is the Template titles `list=allpages` pagination returned
  twice; the **3** is the distinct URLs that are also duplicated across partitions; the **922 was a
  fetch/listing count, never a submission count**. Recorded because D-58 filed this as an open board
  question and asserted the check "cannot be settled from the tree" — that verdict was wrong, and a
  wrong "unanswerable" is worse than an open question, because it stops the next reader from looking.
- **Because:** the settling evidence is **a comparison already in the record**, not a new
  experiment. At planning time the knowledge base was enumerated **live, per partition, in 22 paged
  calls**: **`428 / 4 / 12 / 20 / 248 / 201`**. The manifest's partitions are
  **`430 / 4 / 12 / 20 / 248 / 202`**. **Four of the six partitions agree exactly** — including
  `ns10 = 248` on both sides — and that agreement is the load-bearing part: because `ns10` already
  reads **248** in the manifest, the six Template dedupes happened **before** manifest time, which
  is precisely what rules out reading (i) (that 922 was submitted verbatim). The only two partitions
  that differ are exactly the two that hold the duplicates: `00_Articles` **−2** and
  `50_Categories` **−1**, summing to **3** — the three duplicate-URL keys this file already names
  (`Crusader Kings III Wiki:Style`, `Crusader Kings III Wiki:Versioning`, each in
  `00_Articles`+`10_Project`, and `Dragon Age: Thedas at War` in `00_Articles`+`50_Categories`).
  So the gap of nine is **6 + 3**, both terms accounted for, with no remainder — and the earlier
  note that the two named causes "account for four of the nine" was comparing submissions against a
  number that was never a submission count.
- **Rejected:** **calling it unanswerable** (D-58's conclusion) — the needed measurement is a
  per-partition enumeration of the knowledge base, and that had already been run and written down
  *before* `data/` was deleted, so the deletion never destroyed the evidence. Also rejected:
  **regenerating the corpus to re-establish it** — unnecessary, since the manifest's partition counts
  are the weaker half of the comparison and are recoverable from the notes alone.
  Also rejected: **editing D-58's text**, which append-only forbids; D-58's pointer to a board open
  question is superseded by this entry and by the board item now marked CLOSED.
- **Reversed by:** a per-partition enumeration of the knowledge base disagreeing with
  `428 / 4 / 12 / 20 / 248 / 201`, or a manifest whose `counts.duplicateTitlesDropped` is not **6**.
  The first is still re-runnable **only while the knowledge base exists** — the user is deleting it
  by hand, since ima's OpenAPI has no delete endpoint — and it needs the corpus regenerated for the
  manifest half; after the KB is gone, this entry stands as the terminal record.

## D-60: Which transport reads a CK3 wiki page — Node's own `fetch`, or a spawned `curl.exe`?

- **Decided:** **`curl.exe` spawned through `node:child_process`**, for every page read by a
  plugin. The headers are a browser `User-Agent` **plus** an `Accept-Language`; each response is
  checked for a challenge body and retried with backoff. A plugin that reads this site with
  `fetch`/undici is not "slightly less reliable" — it fails **28 times in 30**, and every failure
  arrives as **HTTP 200**, so a caller that trusts the status code records a challenge page as an
  article.
- **Because:** a 30-URL controlled comparison, same two headers on both arms, run in one session:

  | transport | `mw-parser-output` present (a real page) |
  | --- | --- |
  | `curl.exe` + browser UA + `Accept-Language: en-US,en;q=0.9` | **30 / 30** |
  | Node's built-in `fetch`, identical headers | **2 / 30** (`0` TLS errors — 28 challenge bodies) |

  Node's `fetch` was also retried with `NODE_OPTIONS=--use-system-ca`; the body was the same 3,036-byte
  challenge page, so this is **not** the certificate defect this file records elsewhere and no TLS
  flag fixes it. **This refines D-54** ("keep the workaround local; do not change
  `dsh-web-fetch-http`") without reversing it: D-54 is about not bending the *shared* fetch seam for
  one third-party host, and this entry is the stronger, narrower statement that a plugin built for
  **this** host must not use that seam at all. The two coexist — the seam stays as it is, and the
  CK3 read path does not go through it.
- **Rejected:** **`fetch` with the same headers** (2/30, and its failure mode is a 200);
  **`web_fetch` as the read path** — it *does* pass the gate interactively, but it returns the raw
  rendered HTML and truncates it, and the measured output for `Duchy_buildings` was 176 KB of markup
  that included the icon walls (`<img alt="" src="/images/thumb/…">`) a reader must not be handed;
  and **changing `dsh-web-fetch-http`'s headers** to browser-shaped ones, which D-54 already
  rejected on principle and which no longer has a reason to be reconsidered.
- **Reversed by:** a repeat of the 30-URL comparison in which Node's `fetch` returns real page HTML
  for essentially all of them (the site's gate being lifted or relaxed is the plausible cause). The
  check is one script; it took a few minutes and it is worth re-running before any future session
  argues about this from memory.

## D-61: Does `bin/preflight.mjs` validate the config of a plugin that exports an object-form schema?

- **Decided:** **No — and it reports that as a `skip`, not as a pass.** Its config check is reached
  only when `typeof Schema === 'function'` (`bin/preflight.mjs:178`; a non-function export returns
  `{ kind: 'no-schema' }`, which the caller prints as `skip <id> (<pkg> exports no usable Config
  schema)`). A plugin that exports the **plain-object** Standard Schema — the form the sanctioned
  `dsh-ima-kb` uses, because a symlinked plugin may not import `@deepseek-ai/schemastery` (D-35) —
  therefore has **its entire config surface unvalidated by preflight**, while the run still ends in
  `PREFLIGHT PASSED`.
- **Because:** two independent readings agree, one of them a measurement. The code reading is the
  three lines above. The measurement is a live `node bin/preflight.mjs` on `dsh-smith`, which prints
  `skip` for `command-goal`, `plan-mode`, `command-compact`, `tool-subagent-control`,
  `tool-subagent-list-agents` and `tool-ask-user`, and ends `validated: 21   skipped: 10   failed: 0`
  / `PREFLIGHT PASSED`. The `skipped: 10` figure that `README.md` has carried all along was
  therefore never a set of "groups and JS-expression rows" — at least six of those ten are rows whose
  schema this script declines to read.
- **Rejected:** **treating `PREFLIGHT PASSED` as "every config validated"** — that is what the
  script's own summary line invites ("every row resolved, and every config this script could read")
  and what this repo's documents have said in shorter form. Also rejected as the remedy:
  **re-exporting the schemas as functions to satisfy `typeof`** — that would be a plugin changed to
  please a checker, and it would not make the loader behave any differently. What the *loader* does
  with an object-form `Config` is unchanged: it calls `runtime.Config['~standard'].validate(config)`,
  so mount-time validation still happens. Only the offline static check is blind.
- **Reversed by:** `bin/preflight.mjs` learning to read an object-form `~standard` validator; or a
  session in which a row exporting the object form is reported as `invalid` by this script. Until
  then, config validation for such plugins belongs in their own `test/falsify.mjs`, and any document
  claiming preflight covers their configs is wrong.

## D-62: Should the CK3 agent keep its campaign-advisory half, or be narrowed to mod development only?

- **Decided:** **Narrow it to mod development only.** The preset is `dsh-ck3-mod`, the earlier
  `dsh-ck3` (campaign advice ＋ mod development over the ima knowledge base) is retired, and the
  wiki-retrieval plugin `dsh-ck3-wiki` is **deleted outright** rather than left unmounted. The expert
  team goes from five roles to three: `expert_modd` (the only writer, pinned to
  `reasoningEffort: max`), `expert_verifier` (`toolFilter: { deny: [write, edit] }`, inherited
  effort), `expert_chronicler` (inherited effort).
- **Because:** the user asked for it in those words — first adding "mod development" to four
  requirements, then narrowing to「只要 mod 开发」and「只保留必要的，其他的删除」— and measurement
  agrees the two halves were never coupled: a grep over the `ck3-mod-authoring` skill for
  `ck3_read|ck3_search|ima_kb_*|知识库` returned **zero** hits, and the surviving plugin
  `dsh-ck3-modcheck` is self-contained (`name = 'ck3-modcheck'`, `inject: ['fs']`, one tool, no wiki
  dependency). Every retrieval row and the whole wiki plugin served the *other* half only.
- **Rejected:** **keeping `dsh-ck3-wiki` unmounted "just in case"** — the user said delete, and what
  it costs to keep is not disk but a **second copy of the converter** whose defects are silent;
  deleting it also leaves the repository with exactly one copy of `convert.mjs`
  (`tools/ck3wiki/lib/`), which is the copy D-53's regression test covers. Also rejected:
  **retiring it through `dsh plugin remove`** — it was never in any profile's dependencies, so a
  profile-level remove would have been a no-op and deleting the directory was the whole job. Also
  rejected: **dropping `expert_verifier` too**, against the user's explicit choice of three roles —
  a mod with an unbalanced brace produces no error anywhere, so a reviewer that runs the checker
  itself is the one role this domain cannot do without.
- **Reversed by:** the user asking for campaign advice again. Note what that costs, because it is not
  a config toggle: the wiki plugin is **gone** (its transport work, five tools and 38/38 test suite
  would be rebuilt from nothing) and four expert personas would be rewritten. What survives in the
  record is D-60's transport finding and the converter — which is why that entry is the part worth
  keeping.

## D-63: Why did no preset row naming an installed plugin resolve in `bin/preflight.mjs`?

- **Decided:** because **its resolver base was wrong, and the error was total rather than
  intermittent.** The script built its resolver from `join(DSH_HOME, 'profiles', 'package.json')` —
  one directory *above* any profile — while the harness resolves a preset's bare specifiers against
  **the profile's own directory**: `dsh-agent-presets` reads `agentCtx.baseUrl` and hands it to the
  loader as `harnessBase` (`lib/index.js:1297-1299`, `:647-675`). The consequence was that **every**
  plugin row in **every** preset reported `Cannot find package: <name>`, however correctly it was
  installed, while the harness composed the same row without a warning. Fixed this session:
  `bin/preflight.mjs` discovers the profile (`--profile <name>`, else a directory under `profiles/`
  owning a `package.json`, preferring `web`) and prints which profile it resolved against.
- **Because:** two independent measurements agreed. **From `$DSH_HOME/profiles`**:
  `dsh-ima-kb`, `dsh-account-balance` and `dsh-ck3-modcheck` all failed `require.resolve` and all
  three `profiles/node_modules/<name>` probes missed — so the failure was not specific to the new
  row. **From `$DSH_HOME/profiles/web`**: all three resolved, `dsh-ck3-modcheck` to
  `C:\Users\曦曦\.dsh\plugins\dsh-ck3-modcheck\lib\index.js`. The runtime settled it independently:
  **`dsh --profile web --dump-config` composes the `ck3-modcheck` row with `modDir: D:\CK3Mods` and
  prints no patch warning**, so the loader — the thing that actually matters — was never confused.
  After the fix: `preflight --preset dsh-ck3-mod` → `validated: 16   skipped: 9   failed: 0`, with
  `dsh-smith` (`21/10/0`) and `dsh-forge` (`24/10/0`) unchanged, so the shared script has no
  regression.
- **Rejected:** **deleting the `tool-ck3-modcheck` row to make the check pass** — the script was
  wrong, not the composition, and the runtime proof above says the row is correct. Also rejected:
  **declaring the row "expected-FAIL" in the docs and moving on** (the position this file held for
  about an hour) — that would have written a falsehood into `README.md`, `AGENTS.md` and
  `.github/workflows/checks.yml` and left the defect for the next plugin author. Also rejected:
  **giving the row an explicit `config:` block** to dodge the resolution, for the same reason.
- **Reversed by:** a session in which `node bin/preflight.mjs --preset dsh-ck3-mod` fails to resolve
  `dsh-ck3-modcheck` **while `dsh --profile web --dump-config` composes that row** — which would mean
  the discovery picks the wrong profile (e.g. a second profile with a `package.json` sorting before
  `web`). The `resolving rows against profile: <name>` line the script now prints settles that in one
  line, which is the check.

## D-64: Was the localization entry pattern right, or did it flag the game's own files?

- **Decided:** **it was wrong, and the fix is measured rather than guessed.** `LOCALIZATION_ENTRY`
  required a version counter and a space before the value (`:\d*\s+"`), which flagged **742 entries
  of the vanilla corpus** — every one of them a `key: "value"` line carrying no counter, some with a
  trailing `# …` comment. The pattern is now
  `/^\s*([A-Za-z0-9_.\-']+):(?:\d+)?\s*".*"(?:\s*#.*)?\s*$/`. After the fix the same check over the
  same 122 files reports **0 findings**.
- **Because:** the numbers come from the plugin's own exported function run over all of
  `game\localization\english`: **122 files, 75,291 entry-like lines**. The non-alphanumeric characters
  occurring *inside a key* are `.` (15,614×), `-` (498×) and `'` (2×, `b_mansa'l-kharaz`); `#` occurs
  97× but only as the comment marker, which the check skips before reaching the pattern. Two
  independent sources agree the counter is optional: those **742** counterless vanilla entries, and
  the wiki's `Localization` page (revid 32485) — *"The number after the : is optional and it does
  nothing for modders… completely deprecated."* That sentence also **corrects a claim this session
  briefed into the preset**: the counter had been described as marking an entry for retranslation,
  which the page contradicts. The persona and the `expert_modd` persona now state the
  optional/deprecated reading and the measured 742.
- **Rejected:** **leaving it and documenting the false positives** — a check that cries wolf on the
  game's own 122 files trains its reader to ignore it, which is the failure mode this repository's
  `tools/ck3wiki/verify-convert.mjs` already records ("宁可没有检查，也不要一个会喊狼来了的检查"). Also
  rejected: **treating the first 522-finding sample as a real reading** — it came from a probe whose
  own "entry-like" gate was looser than the checker's, so it measured the probe rather than the
  plugin; the 742 figure comes from calling the plugin's exported function directly.
- **Reversed by:** running `checkLocalizationFile` over the vanilla corpus and getting a non-zero
  count, or finding a real mod localization line whose only defect is one of the now-tolerated shapes
  (a missing counter, or a trailing comment). The regression that catches a future over-relaxation is
  the plugin's own suite (**51/51**), which pins the entry-shape assertions independently of the
  vanilla corpus.

## D-65: Which of the CK3 modding checks carry their own evidence, and which were guesses dressed as checks?

- **Decided:** **Retire the tag-vocabulary check; keep everything else and add the checks that a
  measured gap analysis showed were missing.** Six checks were added (`mod-key-missing` /
  `mod-key-empty` / `supported-version-missing`, `replace-path-unknown` /
  `replace-path-destructive`, `mod-folder-mismatch`, `path-case-mismatch`,
  `unexpected-extension`, `duplicate-localization-key`, `descriptor-disagrees`, `script-has-bom`,
  `event-namespace-missing` / `event-id-namespace-mismatch` / `event-id-out-of-range` /
  `event-file-empty`, `text-not-utf8`, `vanilla-file-overridden` /
  `vanilla-single-file-database-override`), the plugin grew a **second tool**
  (`ck3_mod_status`) and **four extra config keys** were retired/added around it, and the whole
  suite is now **91 assertions** with **36 codes**.
- **Because:** every add was driven by an executed scenario, not by reading. Twelve adversarial
  scenarios were built against real CK3 failure modes; **11 of the 12 passed silently** before this
  round. The provenance of each new rule is an external sentence, and the three that matter most:
  the wiki's `Mod structure` **"Required?" table** (`version`/`name`/`path` = Yes;
  `supported_version` = "Required for file alongside mod folder; not required for descriptor.mod");
  its `replace_path` row ("Doesn't load vanilla files for the specified path"); and its override rule
  ("If a mod has the same file as the game, it replaces all the contents of the file… Avoid doing this
  unless you intend to overwrite the whole file!") together with the measured fact that a NEW filename
  is additive (`common\governments\` carries both `00_` and `01_`).
- **Rejected:** **keeping the tag-vocabulary check** — it compared against a 21-item list transcribed
  from a wiki page flagged "last verified for version 1.1" (2023) while the install is 1.19.0.6; **no
  tag list exists on disk** (the launcher fetches it over the network and four plausible endpoints
  answer 403 unauthenticated), and the launcher's own database stored `tags: ["1.16 'Chamfron'"]` — a
  game-version string — with the mod's status `ready_to_play`. A check that flags valid mods, whose
  only suggested remedy is the one edit its reader would make, is worse than no check. Also rejected:
  **driving field validation from the `_*.info` files** — measured, only **6 of 162** contain a
  parseable `Valid <thing>:` list, so the feature would be built on underspecified input; they are
  kept as citable documentation instead. Also rejected: **adding a `logs\` reader now** — the
  directory does not exist on this machine (the game has never been launched), so it would be a
  reader that cannot be tested.
- **Because the new checks could themselves cry wolf, two calibrations are now permanent assertions
  in the suite:** the encoding check reports **0 findings over the entire vanilla tree** (2,536
  `common` scripts + 536 event scripts), and the namespace check reports **exactly 20 over all 536
  vanilla event files** (19 prefix mismatches + 1 file declaring none) — which independently
  reproduces the `516 of 536 conform` census a separate pass reported.
- **Reversed by:** a vanilla calibration going non-zero (the encoding count, or the namespace count
  moving off 20) — that means a check has started flagging the game's own files. The tag verdict is
  reversed by a canonical, current tag list becoming readable from the install or from a document
  that is verified for the running version.

## D-66: Does the launcher's own database belong inside a validator's read surface?

- **Decided:** **Yes, read-only, through a second tool (`ck3_mod_status`) rather than as more output
  on `ck3_modcheck`.** It reads `launcher-v2.sqlite` with the **built-in `node:sqlite`** (no
  dependency, no subprocess, verified importable on this deployment's Node v26.8.1) and reports the
  launcher's view — registered mods, `status`/`metadataStatus`, and the active playset with each
  mod's `enabled` and `position` — then cross-checks it against the disk.
- **Because:** three questions a mod author actually has are unanswerable from files alone: *does the
  launcher recognise this mod, is it enabled, and where does it sit in the load order?* The wiki makes
  the third load-bearing ("The mod lower in the playset will overwrite identical files from above"),
  and the launcher's `status` column is a **stronger verdict than anything this tool computes**,
  because the launcher validates against the real game data. Measured on this machine: the database
  exists (118,784 bytes), carries one mod row and a playset with `enabled: 1, position: 0`, and the
  new tool renders all of it correctly against that live file.
- **Rejected:** **folding it into `ck3_modcheck`** — a caller wanting a static verdict should not pay
  for a database read, and a caller wanting the launcher's verdict should not run 21 file checks to
  get it. Also rejected: **reconstructing a mod's path from `modDir`** — the first revision did, and
  reported a "dead entry" for a mod the launcher had recorded at
  `Documents\…\Crusader Kings III\mod\111`; the launcher's own `dirPath` column is authoritative and
  a mod may legitimately live outside the workspace. Also rejected: **writing anything to that
  database** — it belongs to the launcher.
- **Reversed by:** the user declining the read surface (it touches a private database under the user
  profile, which is why it is recorded here), or a launcher version whose schema no longer carries
  `playsets_mods.position` / `mods.dirPath`. Both are one command to check: `dsh --profile web
  --dump-config` (the row and its config) plus the tool's own output against the live file.

## D-67: What may a runtime-log reader claim, given that a clean game already writes 512 warnings?

- **Decided:** `ck3_mod_evidence` **counts and reports, and raises a finding for exactly one thing:
  event reachability.** It never treats a non-empty log as a defect, and it distinguishes three states
  a naive reader collapses into one: **unavailable** (`logs\` absent — the game has never run),
  **present but not flushed** (the directory and its files exist at **0 bytes**), and **populated**.
  The middle one is why the tool exists in this shape: an empty `error.log` and an `error.log` with no
  errors are **indistinguishable from the bytes**, so the reader reports `flushed: false` as its own
  answer rather than reporting "no errors".
- **Because:** measured on this machine's **first** launch of CK3 1.19.0.6, with `dlc_load.json`
  reading `enabled_mods: []` — a clean, unmodded baseline:

  | Observation | Reading |
  | --- | --- |
  | At 23:17:39 the game created **16 log files, every one 0 bytes** | "created" is not "logging"; a reader built against zero bytes would have proved nothing |
  | 45 s later, still **0 of 16** | the state persists while the game loads |
  | Eventually `debug.log` **326,754 B**, `setup.log` **36,864 B** | the engine flushes as it goes |
  | `setup.log` carried **512 W-level** lines and **0 E-level** | a non-empty log is not evidence of a problem |
  | Its first line: `[W][provincetemplate.cpp:158]: Province 10186 has no pixels!` | **vanilla's own warnings, with no mod enabled** |

  The wiki says the same in words: *"the log will report errors even in an unmodded game. Launch the
  game without any mods and let it run for a while to learn which errors are common and not caused by
  you."* So a reader that flagged a non-empty log would fire on a vanilla install. The one signal
  genuinely about the author's content is `event_log.csv`: Patch 1.5 records that it stores "the # of
  times each event has been checked, and the # of times each option has gotten picked", so
  `checked = 0` says nothing calls that event — the one CK3 failure **no static parse can reach**,
  which is why this plane exists at all.
- **Also measured, and encoded:** the real log line format is
  `[HH:MM:SS][LEVEL][source:line]: message`, levels `D`/`I`/`W`/`E`. `debug.log` contained **25 lines
  that do not match it** (multi-line continuations), so unparsed lines are **counted and preserved**
  rather than dropped — a changed format must stay visible instead of parsing to zero findings.
- **CORRECTION, forced by a second measurement after a campaign was actually started.** This entry
  first recorded that `event_log.csv` "is absent at the main menu and appears once a campaign runs".
  **That is wrong.** With the game launched, a campaign open, and 16 log files present,
  `event_log.csv` **still does not exist**, and — the decisive part — **`event_log` appears nowhere in
  `log_settings_live.json` or `log_settings_release.json`**. So the file is **opt-in**, which is
  exactly what the Patch 1.5 wording said all along (*"if enabled"*); it is not a thing a campaign
  produces by itself. The tool's text was corrected to say so, and the reachability check must now be
  described as **implemented and tested, but never yet triggered on real data**.
- **A second count defect, found the same way.** The same two E-level messages appeared in
  **`debug.log` + `error.log` + `game.log`** — the engine fans one message out to several sinks — so a
  per-file sum reported **6 E-level for 2 distinct errors, an exact 3× inflation**. The reader now
  deduplicates by message text (stripping the timestamp), keeps the list of sinks per message, and the
  report leads with the distinct count. Measured: raw 6 → distinct 2.
- **And a measured baseline that is stronger than the one first recorded.** With `enabled_mods: []`,
  `error.log` is not merely capable of holding vanilla noise — it *did*:
  `[E][landed_title_name_util.cpp:853]: Failed to find any valid flavorization for title` and
  `[E][character.cpp:1813]: Failed to find any valid flavorization for character '议潮 张' …`. Two
  E-level errors, from the game, with no mod loaded. This is why the tool reports counts and raises no
  finding from log content.
- **Rejected:** **shipping a stored baseline in this round** — the clean run is now measured, but a
  baseline is a *machine artifact* that moves with game version and DLC set, so baking today's noise
  into the tool would enshrine it. The report states the numbers and explains them instead. Also
  rejected: **surfacing `error.log` contents as findings** — with no mod loaded that file was *still
  empty* while `setup.log` carried 512 warnings, so "errors in the log" is not yet a calibrated signal.
  Also rejected: **waiting until `event_log.csv` exists before shipping the tool** — it is absent at
  the main menu (a campaign has to run), and the reader must say "cannot read it" in exactly that case
  rather than return an empty result.
- **Reversed by:** a launch in which `event_log.csv` exists and the reader miscounts its rows (the
  header is read by name, so a renamed column surfaces as `null` rather than a wrong number); or
  evidence that a non-empty `error.log` *is* reliably the mod's fault on a machine whose baseline is
  known.

## D-68: Why does `event_log.csv` never appear, and what actually produces it?

- **Decided:** **it is not produced by the logging system at all, and the two obvious remedies are
  both wrong.** It is written by a **console command**, whose name in this build is **`event_queue`**,
  and reaching it requires a `-debug_mode` launch. The procedure is therefore
  **① `-debug_mode` → ② load a campaign → ③ run `event_queue` in the console**, after which
  `logs\event_log.csv` exists and the reachability check has real data.
- **Because:** measured in this order, each reading narrowing the next.

  | Reading | What it rules out |
  | --- | --- |
  | `event_log` and `csv` appear in **none** of `log_settings_live.json`, `_release.json`, `_debug.json` | "it is a log setting" |
  | The 16 files in `logs\` correspond **one-to-one** with the `loggers[].sinks[].file_name` union (debug, error, game, setup, system, text, profile, message, memory, gui_warnings, code_revisions, custom_automated_stats, dedicated_server, **database_conflicts**, multiplayer, pdxsdk) | "it is a sink I have not found yet" — every sink is accounted for and none is an event log |
  | `ck3.exe` contains `Event debug info written to logs/event_log.csv` | the feature exists in this build |
  | Adjacent in the same console-command string pool: `logs/`, `logs/%s/%s.csv`, **`event_queue`**, `== HELP LOG ==`, `Invalid arguments count.`, and the `console_command_implementation.cpp` path | the writer is a console command, and names the token |
  | The other two `event_queue` occurrences sit in `jomini_event_queue_manager.cpp` | an unrelated function of the same name is not the command |

  One further reading came out of the same pass and explains an earlier puzzle: both live and release
  settings carry **`flush_interval_seconds = 3`** at top level, so **"16 files, all 0 bytes" is an
  expected window rather than an anomaly** — measured at 0/16 forty-five seconds after start, with
  content appearing later. That is the empirical justification for `readRuntimeEvidence`'s second
  state, which had until then been designed from reasoning about what a loading game "should" look
  like.
- **Rejected:** **"it needs to be enabled" as an answer** — the previous wording was directionally
  right and practically useless: it named no file to change, no flag to pass, and no command to run,
  which is exactly the state that leaves a reader stuck. Also rejected: **editing
  `log_settings_*.json` to add an event sink** — measured to be the wrong direction, since the writer
  is not in that system and a hand-added sink would be inert. Also rejected: **treating the absent file
  as a permanent limitation** — the feature is present in the binary, so this is a missing *procedure*,
  not a missing capability.
- **Reversed by:** running `event_queue` under `-debug_mode` and getting **no** `event_log.csv` (the
  token is a strong lead from string adjacency, **not** a command anyone has executed), or getting a
  file whose header names its columns differently than `event`/`checked` — in which case the reader's
  by-name lookup returns `null` and the candidates in `parseEventLog`'s `find()` must be widened to the
  real header.

## D-69: Has the unlocking command been run since D-68 named it? (No — and absence is now proven exhaustively.)

- **Decided:** **the "row 2" state is confirmed rather than advanced — the one command in D-68's procedure
  is still unexecuted, and that is now a *measurement over the whole machine* instead of an absence in one
  directory.** The reachability plane still holds **no real data**; the next step is unchanged and still
  belongs to the user.
- **Because:** three independent readings, in this order.
  - The app's own report calls `ck3_mod_evidence` once and prints **"没有 `event_log.csv`"** — consistent
    with D-68, so the tool's behaviour has not silently changed.
  - `logs\` holds **16 files**, 11 of them 0 bytes (`code_revisions`, `custom_automated_stats`,
    `database_conflicts`, `gui_warnings`, `memory`, `message`, `multiplayer`, `pdxsdk`, `profile`, `system`,
    `text`) and 5 with content (`debug.log` 601,714 B, `setup.log` 36,864 B, `game.log` 1,854 B,
    `error.log` 288 B, `dedicated_server.log` 144 B). All 16 carry the **2026/9/14 23:17:39–23:26:22**
    window, i.e. this is still the same *one* launch D-67/D-68 measured.
  - A recursive filename search for `*event_log*` over **all of `D:\`** and over the **entire user profile**
    returns **nothing**. The previous statement ("still does not exist") was about one directory; this one
    rules out a copy elsewhere, which is what a reader would need in order to be wrong.
  - Re-confirmed independently this session, not carried over: `event_log` and `csv` appear in **none** of
    `log_settings_live.json` (9,162 B), `_release.json` (9,522 B), `_debug.json` (10,417 B).
  - Re-extracted from `ck3.exe` (95,206,088 B) rather than quoted: `event_queue` at byte offset
    **68103024**, `event_counts` at **68114472**, and `Event debug info written to logs/event_log.csv`
    alongside `console_command_implementation.cpp` — the same pool D-68 identified.
- **Rejected:** **re-arguing D-68's conclusion.** It was already right; what was missing was proof that its
  premise had not since changed, and that is exactly what the three searches above supply. Also rejected:
  **softening the tool's wording to "may be missing"** — the machine-wide search makes plain absence the
  accurate reading, and a hedged sentence is what let the earlier "if enabled" wording go stale.
- **Reversed by:** `logs\event_log.csv` appearing (one file, any source) or a launch whose log timestamps
  postdate 2026/9/14 23:26:22 — either would mean a new run happened and the readings above describe the past.

## D-70: What does `ck3_modcheck` pass on, and which load-blocking defects can it not see?

- **Decided:** **`ck3_modcheck`'s zero-finding verdict is compatible with a mod that (a) can never show the
  player anything and (b) cannot be loaded at all.** Measured on the generator's own sample mod, which the
  checker reports as **`errors: 0   warnings: 0   total findings: 0`**. Four distinct defect classes were
  found in it by reading it against vanilla, and the checker names none of them. The distinction to hold is
  **file-structure validity versus load-and-run validity**, and the checker only speaks to the first.
- **Because:** each defect has its own ground truth, and none of them is a parse failure.
  - **Unreachable event (the class D-67 was built for — and the check still cannot run).**
    `D:\CK3Mods\smoketest\events\smoketest_events.txt` defines `smoketest.0001`, and a grep of the whole mod
    for `trigger_event` / `on_action` / `smoketest.0001` returns **no call site**: the decision in
    `common\decisions\smoketest_decisions.txt` sets only `add_gold = 50`. So nothing can ever fire the event,
    and the only plane that could have said so is the one blocked in D-68/D-69.
  - **A property CK3 does not document.** `is_triggered_only = yes` — the CK2 spelling — occurs in the whole
    vanilla `game\` tree **exactly once, inside a `#` comment**
    (`game\events\education_and_childhood\chinese_disciple_events.txt:922`), and appears nowhere in the event
    template `game\events\_events.info`. **Measured boundary, stated as such:** this establishes that vanilla
    never uses it, **not** that the engine rejects it — `_events.info` opens with "May not be exhaustive".
    The defect that stands on its own is the missing call site above, the property is corroboration.
  - **An invalid `theme`.** `theme = realm_management` is not a key in
    `game\common\event_themes\00_event_themes.txt`, which `_events.info:216` names as the authority ("For a
    list, check: 00_event_themes.txt"), and `realm_management` occurs **nowhere** in the vanilla `game\` tree.
    The near-miss keys that do exist are `realm` (line 472) and `ruler_objectives` (line 2901). The point
    about `theme` is *icon, background and sound* — so this one degrades the event rather than blocking it.
  - **A missing localization key.** `common\decisions\smoketest_decisions.txt` defines the decision
    `smoketest_decision`, and `localization\english\smoketest_l_english.yml` contains only
    `smoketest_greeting`. A key with no entry renders raw in the interface, and this is precisely the class
    the checker's localization pass is aimed at — it verifies each *present* entry's shape, not the
    *referenced-but-absent* key.
  - **And the load blocker, which is not a file defect at all.**
    `C:\Users\曦曦\Documents\Paradox Interactive\Crusader Kings III\mod\` is **empty**, while `ck3_mod_status`
    reads the launcher's registry as exactly one mod, **"1111"**, recorded at `...\mod\111` — a folder that
    does not exist (`WARN launcher-entry-dead`), and the launcher itself marks it `unsubscribed` /
    `not_applied` (`ERROR launcher-reports-problem`). `smoketest` is therefore in **no playset**, so the
    launcher will not load it however correct its files are. A checker that only reads the mod's own tree
    cannot see this by construction, and `ck3_modcheck` says so in its own words: it does not establish that
    the game loads the mod.
- **Rejected:** **reading a zero-finding verdict as "this mod works"** — that is the exact
  succeed-on-disk-and-be-ignored failure this whole plane exists against, and it just happened one layer
  above the files. Also rejected: **treating `is_triggered_only` as proven invalid** — see the measured
  boundary above; the honest statement is "absent from vanilla and undocumented", which is enough to remove
  it but not enough to call the engine's behaviour known. Also rejected: **filing the launcher finding as a
  checker defect** — the checker's stated contract excludes it, so the gap is in the *procedure* (register
  the mod with the launcher, then check), not in the tool.
- **Reversed by:** a `smoketest` load in which the decision appears named rather than raw **and** the event
  window is somehow reached without a call site — which would mean the event fires by a path this reading
  missed; or a `ck3_modcheck` release that reports any of the four above (at which point this entry becomes
  the record of a fixed gap rather than an open one).
- **Follow-up, same session — the generator has been corrected, and the running Host has NOT picked it up.**
  The four file-level defects were not artifacts of a stale sample: `scaffoldMod` in
  `$DSH_HOME\plugins\dsh-ck3-modcheck\lib\rules.mjs` emitted all of them, and its own suite **passed 107/107
  while doing so** — because every assertion tests *structure* (`scaffoldMod: the generated mod passes every
  check with ZERO findings`) and none tested *function*. Corrected in place: `theme = realm` (not
  `realm_management`), `is_triggered_only` dropped, the decision's `effect` now carries
  `trigger_event = <ns>.0001` **only when the events system was also requested**, the decision-level
  `icon = "decision_icon.png"` replaced by the documented
  `picture = { reference = "gfx/interface/illustrations/decisions/decision_misc.dds" }`
  (`_decisions.info:16`–`:24`), and the localization file now also emits `<name>_decision` and
  `<name>_decision_desc` when decisions are requested. Suite re-run after the edit: **107/107, still passing**.
  Generated output validated in a fresh process: **0 findings** on an ASCII path (`D:\ck3regenproof`, since
  deleted) — and the *same* output reported 2 `non-ascii-path` findings when generated under `%TEMP%`, whose
  path contains `曦`, which is the ASCII check behaving correctly rather than a defect.
  **The live `D:\CK3Mods\smoketest` is STILL the old content.** Proven cause, not assumed: `ck3_mod_init`
  reported creating all 5 files and their timestamps read **2026-09-15 19:29:11**, yet the bytes are the old
  ones — so the write succeeded and the *generator in memory* is old. The Host process booted **19:08:30**,
  before `rules.mjs` was written at **19:28:42**, and a plugin's module is loaded at boot. **A Host restart is
  required before the tool emits the corrected shape**, and until then the sample mod must be re-generated
  rather than trusted.
  **Still open, and not a file defect:** D-72's launcher-scan question — a corrected skeleton at `D:\CK3Mods`
  is still outside the launch the launcher was observed to scan.

## D-71: Two byte-level tooling traps, measured on this machine — one of which produced a wrong reading before it was caught.

- **Decided:** **`-shl` on a `[byte]` is silently a no-op in this PowerShell build, and it must never be used
  for byte arithmetic; cast to `[int]` first or multiply.** Separately, **`node:sqlite` cannot open the
  launcher's `launcher-v2.sqlite`** even though the file is structurally valid, so the launcher DB is readable
  only through the tool. Both cost real readings this session and neither raised an error.
- **Because:**
  - `$b = [byte[]](…); [byte]16 -shl 8` → **`0`**, while `[int]16 -shl 8` → **`4096`** and
    `[int]([byte]16) -shl 8` → **`4096`** (pwsh **7.7.0-preview.4**, `LanguageMode = FullLanguage`). The
    documented-looking expression `($b[16] -shl 8) + $b[17]` therefore reads the SQLite page size as **`0`**.
    It was caught only because the derived numbers were nonsense together and the cell_count read back as `1`.
  - Re-derived without the shift: `page_size = 4096`, `db_size_pages = 29`, and **29 × 4096 = 118,784 = the
    exact file length**, so the header is *coherent* — the first reading was the artifact, not the file.
  - `node:sqlite` (`node v26.8.1`, `DatabaseSync`) still refuses that file: **`ERR_SQLITE_ERROR` /
    `errcode 26` / `file is not a database`**, identically under `{}`, `{readOnly:true}` and
    `{readOnly:true, allowExtension:false}`. The magic is the genuine `SQLite format 3\0`. Not diagnosed
    further — the verdict that mattered (`smoketest` is in no playset) was taken from `ck3_mod_status`, which
    reads the same file successfully, so this is a **tooling boundary, not a finding about the launcher**.
- **Rejected:** **quoting the first header reading** — it would have put "page_size = 0" into the record, and
  a `0` page size is the kind of number a later session would build on without checking. Also rejected:
  **writing a bespoke SQLite parser to work around `node:sqlite`** — the DB exposes no fact the tool does not
  already surface, and a second reader would be one more thing to keep in step.
- **Reversed by:** `[byte]16 -shl 8` returning `4096` on a future PowerShell (the trap is build-specific), or
  a `node:sqlite` that opens this file (at which point the limitation is that version's, not the runtime's).

## D-72: Does the launcher scan `D:\CK3Mods` at all? (Not observably — and the `modDir`/scan-dir mismatch is a project-level issue.)

- **Decided:** **on this machine the launcher's mod discovery is not reaching `D:\CK3Mods`, and the fix is
  *not* to move the mods — it is to make the `.mod` descriptor visible to the launcher while the mod's files
  stay on an ASCII path.** The wiki's own remedy for a non-ASCII account name points at exactly that shape.
  **The recommendation below is documented-and-inferred, not tested; the test is a launcher restart, which I did
  not perform.**
- **Because:** read from the launcher's own log, `%LOCALAPPDATA%\Paradox Interactive\launcher-v2\logs\launcher-2026-09-14.log`
  (458 lines, 56,240 B), not inferred:
  - It **does** scan, twice, once per launcher run: `14:44:44.575` (pid 1524) `[Mods scanning task]: Start scanning
    mods for ck3` → `:641` `Finished scanning mods for ck3` (**66 ms**); and again at `15:16:48.721` → `:49.079`
    (**358 ms**). Neither scan logs a single mod.
  - Its inputs are named: `[SteamService]: Getting subscribed Steam workshop items` → `Expecting 0 items` /
    `Got "0" workshop items in total`, and `[SettingsService]: Initialized SettingsService for
    ~\Documents\Paradox Interactive\Crusader Kings III\mods_registry.json`.
  - **`mods_registry.json` does not exist on disk** (`ABSENT`, while `pdl_settings.txt`, `launcher-v2.sqlite`
    and `dlc_load.json` all do), and `playsets_backup\` is **empty**. So the only mod the DB knows is the
    hand-made dead `"1111"` entry D-70 recorded, and the string `smoketest` appears **nowhere** in any launcher
    log — nor does `CK3Mods`.
  - The one mod the launcher ever registered, it registered **through its own UI**: `[ModHandler]: Opening mods
    upload window` (12:45:27) … `[ModService]: Updating mods with new sizes: [ { size: 80, id: '82454ef3-…' } ]`
    — and an 80-byte `.mod` is exactly a descriptor with no content, i.e. the upload-window flow, not a scan.
- **The tension, and how the page itself resolves it.** `Mod_structure` revid 18579 says in one place "Each mod
  requires two parts. **Both must be located in the folder above** and share the same name … otherwise, the game
  launcher will *not* recognise the mod", and in another (Creating initial files → Directory) *"Directory cannot
  include non English characters. If your Windows account name have such characters you must use a directory
  outside your Documents folder."* On an account named `曦曦` those two cannot both be satisfied by one location.
  The page resolves it elsewhere: `path` "Sets which folder is the mod's folder. Note that it is no longer
  relative to the main *Crusader Kings III* folder, but rather to the Crusader Kings III user folder ….
  **Alternatively, one can use the entire path**", with the example
  `path="C:/Users/Example/Documents/Paradox Interactive/Crusader Kings III/mod/my_mod"` — an absolute path whose
  equivalent here is the one `smoketest.mod` already carries, `path="D:/CK3Mods/smoketest"`. The resulting shape
  is also the shape Steam Workshop mods already use, so it is not an invention.
- **Rejected:** **moving the mods under `Documents\Paradox Interactive\Crusader Kings III\mod`** — that path
  contains `曦曦`, which is the one condition the wiki states must not occur, and it is the silent failure this
  whole plane exists against. Also rejected: **changing the checker's `modDir` to the user mod folder** — the
  authored files are legitimately elsewhere; the missing piece is a descriptor in the scan directory, not a
  different place to write content. Also rejected: **calling the launcher's silence an error** — it logs no
  warning at all, which is the normal shape of this failure.
- **Reversed by:** a launcher restart in which `D:\CK3Mods\smoketest` appears in the picker (scan does reach it
  after all), or a mod placed in `...\Crusader Kings III\mod\` that the launcher also fails to list (which would
  move the cause somewhere other than the path).

## D-73: Was D-70's "the Host holds the old generator" claim ever *proven* — and how much of `ck3_modcheck`'s blind spot is closable?

- **Decided:** **two answers, and the second is the useful one.** (1) D-70's restart claim was **inferred from
  mtimes and is now measured directly against the running process** — it is confirmed, and the method that
  settles this class of question is *calling the tool the running Host serves*, not comparing timestamps.
  (2) The blind spot is **only partly closable by comparing against vanilla**: a key/identifier-existence check
  would catch **2 of the 6** defects, not all of them. So "build a vanilla key index" is a real capability but
  an incomplete answer, and its cost is now measured rather than guessed.
- **Because — (1) the proof, and why the earlier evidence could not carry it.** D-70's three facts were a stale
  *sample*, its `19:29:11` mtimes, and the Host's `19:08:30` boot time. None of them observes what the running
  process *emits now*: a stale file shows that **some** write wrote old bytes, not that the next one will.
  The direct test is free because the decision is already a tool this session can call. `smoketest` was deleted
  first so nothing stale could contaminate the reading, then **`ck3_mod_init`** (served by PID **16276**) was
  called for a new name `hoststate`, and its bytes were read back:

  | key | emitted by the RUNNING Host | what `rules.mjs` on disk now writes |
  | --- | --- | --- |
  | decision | `icon = "decision_icon.png"` | `picture = { reference = "…/decision_misc.dds" }` |
  | event | `theme = realm_management` ＋ `is_triggered_only = yes` | `theme = realm`, no `is_triggered_only` |
  | decision `effect` | no `trigger_event` | `trigger_event = hoststate.0001` |
  | localization | 1 entry, 60 B | 3 entries |

  All six stale defects reproduced, with the source on disk already corrected — **conclusive, not inferred**.
  Probe artifacts deleted; `D:\CK3Mods` is empty. Also measured: the tool's own report said
  **"0 findings — the generated skeleton passes every check"**, so it certifies the defective output. **A restart
  fixes the generator; it does not fix that self-report**, which is the same blind spot below.
- **Because — (2) the six defects do not divide the way it looks.** Classified by *what a vanilla-comparison
  check could see*:

  | defect | catchable by "this key/identifier exists in vanilla"? |
  | --- | --- |
  | `is_triggered_only = yes` | **yes** — 0 occurrences in the whole vanilla tree (its single hit is inside a `#` comment, `chinese_disciple_events.txt:922`) |
  | `theme = realm_management` | **yes (value domain)** — vanilla event scripts use **36** distinct themes; not one of them |
  | decision missing `picture` | no — an **absent** key is not a bad key |
  | decision missing `trigger_event` | no — same; and "the event has no call site" is unreachable by design (D-67) |
  | `icon = "decision_icon.png"` | no — the key is legitimate and used **116** times in vanilla decisions; the **value** is wrong (`.png`: **0** in vanilla decisions, `.dds`: **419**) |

  Measured cost of the index that would deliver those two: `common` + `events` + `history` =
  **4,180 files / 185.7 MB**, enumeration **9.2 s**, and parsing **138,038** distinct keys takes **225 s**
  (~3.2 MB as JSON). Viable only if built **once and cached**, or narrowed to the handful of non-terminal
  keys the generator itself emits — a check whose data is already in hand and which is therefore nearly free.
- **Rejected:** **re-deriving the restart claim from mtimes a third time** — the class of evidence that produced
  the inference cannot upgrade it. Also rejected: **calling the six defects the checker's fault** — five are
  *absent-or-wrong-value* properties that no structural pass reaches, and the checker's own text already
  disclaims load-and-run validity (D-70). Also rejected: **building a 225-second full-tree key index into the
  default check path** — it would make every run unusably slow to catch one class, when the same signal is
  available from the generator's own emitted key set.
- **Reversed by:** a Host restart after which `ck3_mod_init` still emits `icon = "decision_icon.png"`
  (which would move the cause off module caching), or a mod that passes a vanilla key-existence check and still
  fails to load (which would show the index buys even less than the two above).

## D-74: D-73's own cost figure was wrong by 95×, and both gaps it named are now closed in code.

- **Decided:** **three things, one of which is a correction of my own record.** (1) D-73's "225 s to build a
  vanilla key index" was an artifact of the *measurement tool* — a PowerShell loop — not a property of the
  data; the same scan written in-process takes **2.4 s**, so no index file and no 225-second design constraint
  was ever needed. (2) The generator's six defects are now **caught by the suite** rather than only by a human
  reading the output: the suite went 107 → **121** assertions and the new ones are *functional*, falsified by
  planting three of the original defects back. (3) The validator gained two checks that name **two of the six**
  — and the other four remain unreachable, for the separations D-73 already recorded.
- **Because — the cost correction, which is the part worth remembering.** D-73 measured the index build with a
  PowerShell loop over 185.7 MB and got 225 s. Re-measured with the module's own reader (`collectFiles` plus a
  cheap `includes('=')` rejection before the regex), over `common` + `events` + `history`:

  | | D-73's figure | re-measured |
  | --- | --- | --- |
  | files | 4,180 | **3,785** |
  | bytes | 185.7 MB | **114.4 MB** |
  | build time | 225 s | **2.4 s** |
  | distinct keys | 138,038 | **130,536** |

  So D-73's conclusion — "viable only if built once and cached, or narrowed to the generator's own keys" — was
  reasoning from a bad number. The real position is better: a full scan is affordable inline, and the in-process
  cache exists only so several mods in one call pay once. **The lesson is not "PowerShell is slow"; it is that a
  cost estimate produced by the measuring tool inherits that tool's constant factor, and I nearly designed
  around it.** (The file and byte counts differ too because the two scans used different walkers; both find the
  same keys, and `is_triggered_only` is absent from both — which is the property that matters.)
- **Because — the generator assertions, and how they were proven real.** The new block reads the emitted bytes
  and asserts invariants, each coupled to a known-bad value it must reject: no depth-1 `icon` while
  `picture = { reference = …dds }` is present; the event's `theme` is one of the **151** names read from the
  install's own `00_event_themes.txt` (so the assertion tests the game, not a hand-copied list); no
  `is_triggered_only` anywhere; the decision's `effect` calls the generated event id; the events-only variant
  has no call site; and every key the scripts reference is defined in the `.yml`. **Falsified by planting the
  original defects back**, one at a time, with `rules.mjs` restored byte-identically after each: the bad theme
  produced 1 FAIL, the restored depth-1 `icon` produced 2, and deleting the call site produced 1. A suite that
  cannot fail is the thing that let the six through in the first place, so this was not optional.
- **Because — the two new checks, and their measured behaviour against the real install.**
  `vanilla-key-unknown` compares a mod's **depth-1** properties against the key set the install actually uses;
  `event-theme-unknown` compares every `theme` value against the declared theme list. The depth cut was chosen
  by measurement, not taste: including depth-0 keys adds the mod's own object names (`good_decision`,
  `good.0001`) as permanent false positives, while depth ≥ 1 leaves **exactly the defect**. Measured on
  `D:\CK3Mods` against the real install: a **correct** skeleton → **0 findings** (2.4 s cold); the **stale**
  skeleton → **2 findings** naming `is_triggered_only` and `realm_management` (10 ms warm). Severity is `warn`
  for both, because D-70's boundary still holds — "absent from vanilla" is not "the engine rejects it" — and the
  assertions include one that fails if any message starts claiming a verdict the check does not have.
- **Rejected:** **building the index file D-73 proposed** — the 2.4 s reading makes an on-disk artifact pure
  overhead, and a cached file is one more thing to invalidate. Also rejected: **leaving the new assertions out
  because the checker already passes the skeleton** — that reasoning is exactly the 107/107 trap. Also rejected:
  **claiming the six defects are now covered** — four are not, and the two that are are named; the missing
  `picture`, the missing call site in the reachability sense, the `.png` value and the missing localization
  entries are each a *presence* question this check cannot ask.
- **Reversed by:** a re-measurement showing the in-process scan is far slower on a machine with cold storage
  (which would restore the caching question), or a real `event_log.csv` whose header defeats
  `parseEventLog` — the parser's tolerance was measured over **8 plausible formats** (delimiter, column order,
  quoting, CRLF, extra columns, uppercase header) plus 2 unreadable shapes, and all 8 read identically while
  both unreadable shapes return `null` rather than an empty report, but none of that is a real file.

## D-75: `event_log.csv` is NEVER created — the unlock was run, and it proved the earlier diagnosis wrong.

- **Decided:** **`event_queue` is a real console command and it works, but it does not write `event_log.csv` in
  this build; it prints into `debug.log`.** D-68/D-69's "unlock is three steps, then the file appears" is
  **superseded**: no step produces the file. The reasoning that originally established the command name drew its
  evidence from **string-pool adjacency**, and that technique produced a false conclusion — both strings are in
  the binary, but they belong to **different code paths**. The event-reachability signal is therefore still
  unavailable, and now for a **known** reason rather than an untried one.
- **Because — the unlock was actually run, and it left three independent traces.** The user executed the command
  inside a loaded campaign. Measured afterwards:
  - **The engine's own command history agrees it ran.** `console_history.txt` holds exactly one line,
    `event_queue`. That file is the game's record of typed console input, so it settles "did the unlock happen"
    without depending on anyone's account of it.
  - **The log shows it running and reporting.** `debug.log:5594`
    `[20:16:11][D][console.cpp:1164]: Running console command: event_queue`, then `:5595`
    `[D][console_command_implementation.cpp:820]: Total items in queue: 2107`.
  - **And nothing else appeared.** Recursive search for `event_log*` across **all of `C:\` and all of `D:\`**
    returned **zero hits**. The game was still running (verified by PID) and `debug.log` was byte-identical
    across two reads six seconds apart, so this is not an unflushed buffer.
- **Because — the binary settles *why*, and it is not "the name was wrong".** The implementation of
  `event_queue` contains **no file write at all**. Its complete set of format strings, read as raw bytes at
  offset `72187380`:

  ```
  "Total items in queue: %d\n"  "nullptr"  "- OnActions: %d\n"  "- Events: %d\n"
  "\t%s\t%d\n"  "\n-- EVENTS --\n"  "\n-- ON_ACTIONS --\n"  "event_queue_update"
  ```

  Every one of those appears in the observed output, which is how the command was confirmed rather than
  assumed. The `Event debug info written to logs/event_log.csv` string **does** exist — offset `68104256` — but
  it sits with `logs/` and `logs/%s/%s.csv` immediately before **`help event_queue`**, next to
  `See game.log for full help details.` (raw bytes at `68103980`: `…No help for you! … borken console. please…
  make it stop … See game.log for full help details.`). That cluster is the **`help` command's log redirect**,
  and its sibling string `Event queue data written to game log` names where the event output really goes —
  which the measurement confirms: `game.log` has **0** matching lines, `debug.log` has them all.
- **Because — the output is truncated, and that is the part that governs correctness.** `event_queue` printed a
  header claiming **`- Events: 2063` / `- OnActions: 44`**, while the file contains only **29** event rows and
  **2** on_action rows, then blank lines and EOF. So this block yields **real fire counts for 29 events**
  (`diarchy.0011` 693, `councillor_spouse_background.0001` 584, …) and **nothing about the other 2034**. **An id
  absent from this list is not "never fired"** — it is usually "past the cut". Emitting `event-never-fired` from
  it would manufacture false positives at a scale that makes the check worse than no check, which is why the
  tool now says so where it used to hand out the three-step recipe.
- **Rejected:** **re-running the unlock or hunting a different command name** — the command ran, was recorded,
  reported, and wrote nothing; a name that works cannot be diagnosed from a name that works. Also rejected:
  **treating the 29 rows as a partial `event_log`** — see the truncation above. Also rejected: **deleting
  `parseEventLog`** — its format tolerance is real and pinned (D-74), and if a future build or a mod-side tool
  ever emits that file the reader is already correct.
- **Still open, and named rather than hand-waved:** the sibling command **`event_counts`** exists in the same
  binary help dump (offset `68114472`, help string `Print event debug counts`) and is the natural candidate for a
  **complete** count table. It has **not been run** — `console_history.txt` still holds only `event_queue`, which
  also corrects a mid-conversation claim that it had been. Whether it prints a full list, writes a file, or only
  draws on screen is **unmeasured**, and no tool behaviour is built on it.
- **Reversed by:** `event_counts` producing a complete id→count table (which would make the never-fired check
  genuinely runnable), or an `event_log.csv` appearing from any other code path or build.

## D-76: Can an agent "gain experience"? — yes, as a bounded pipeline, and the live evidence is in this turn's prompt.

- **Decided:** **"experience" is implementable on this harness, but not as learning.** No weight update path
  exists, so the achievable thing is a **disciplined, bounded pipeline that guarantees retrieval** — and the
  four existing memory layers already solved *storage*. The measured failure was **retrieval**: D-74's own
  95×-wrong cost estimate (225 s vs 2.4 s) was designed around by an agent that had the correction written in
  `DECISIONS.md` and did not read it. The build is `dsh-agent-memory`, one out-of-repo host-plane plugin with
  two tools, plus a managed region of `~/.dsh/AGENTS.md`; **no preset was modified**, deliberately.
- **Because — the injection problem was already solved, and only its content was unmanaged.**
  `@deepseek-ai/dsh-agent-instructions` reads the **user-global `~/.dsh/AGENTS.md`** in every preset (the path is
  hardcoded — `dsh-agent-instructions/lib/index.js:141,148`, `:756`), and re-checks it **each turn** against a
  per-session version cache (`reconcileInstructionContext:907`, `versionStatesFor:864`, `:1011-1013`) rather
  than freezing it at boot. So the correct move was **not** to invent a second injection path via
  `ctx.systemPrompt` (which would mean registering into a host-owned assembly, with scope-shadowing and ordering
  to get wrong) but to **own one delimited region of the file that path already reads**. Measured reason the file
  chosen is the *user-global* one and not a project file: the three user presets **disagree** on
  `instructionFileCandidates` (`dsh-ck3-mod` adds `CLAUDE.md`/`MODDING.md`; the other two use defaults), but all
  three list `AGENTS.md` and all three cap at `maxBytes: 196608`. Only the user-global path is preset-independent.
- **Because — the budget is the design, not a parameter.** `AGENTS.md` is in context **every turn**. The repo's
  own copy is already **31,290 B**, while `DECISIONS.md` (236,914 B) and `PROJECT.md` (125,252 B) can never be
  injected wholesale — a 372 KB corpus against a per-turn budget. So `memory_consolidate` computes the UTF-8 byte
  length **before writing any byte** and **refuses** on overage, naming the largest entries. **Silent truncation
  is the one outcome worse than an error**, because it looks like the mechanism is working while it drops
  experience; the refusal is asserted.
  Two related semantics came from the declarations rather than from taste: `maxBytes` truncates a rendered batch
  (`lib/index.js:120-123`) while `maxSourceBytes` **silently discards a whole file** (`lib/types/config.d.ts:16`,
  default `1048576` at `:19`) — which is why this design adds **no new discovered file** and writes inside one
  the loader already reads.
- **Because — the live proof is not a test result, it is this turn's own prompt.** After the first
  `memory_consolidate` run, the managed block appeared **in the very next turn's system reminder**, attributed to
  `~/.dsh/AGENTS.md` — **with no Host restart**. That is the mechanism demonstrating itself rather than being
  argued for, and it cleanly separates the two halves: **the experience layer is live now; only the two tools need
  the restart.** Recording that split matters, because "needs a restart" is exactly the kind of claim D-73 had to
  prove by calling the running process.
- **Because — the implementation is the deployment's proven shape, and its two real defects were found by the
  test rather than by reading.** The plugin follows `dsh-ck3-modcheck` exactly: `export const name`,
  `inject: ['fs','tools']`, a hand-written plain-object `Config`, and a **local** `defineTool` +
  `parameterSchemaSpecToJsonSchema` (`dsh-ck3-modcheck/lib/index.js:211,284`). Two defects the 29-assertion suite
  caught:
  - **`resolve` is not an existence test.** The first version refused to write any file that did not already
    exist, because it read `resolve` as the existence check. It is documented as *"the stable target"*
    (`dsh-fs/lib/types/index.d.ts:83`) — unconditional, which is what makes it usable for writes — while
    existence is **`lstat`**, *"undefined for an absent path"* (`:142`). Verified against the real provider:
    `dsh-fs-local/lib/index.js:770-781`, `if (!info) return void 0` at `:775`.
  - **An empty block must not be written.** With no lessons recorded, the first version still wrote a block full
    of boilerplate into a file loaded every turn. It now writes **nothing** when there is nothing to say.
  Neither was visible by reading the code; both are asserted with the specific bad value they must reject.
- **Rejected:** **touching `ctx.systemPrompt` or `ctx.skills`** to inject dynamically — a second injection path
  where a proven one already exists, and a registration into host-owned registries that brings scope and ordering
  problems for no gain. Also rejected: **deleting the managed block when the lessons file is missing** — a
  synchronous cleanup would silently destroy every injected lesson the moment its source path was wrong; the
  tool refuses instead. Also rejected: **building this as a dynamic plugin** (`cordis_define`) — dynamic plugins
  are process-local and temporary, which contradicts "loaded in every session"; the skill's own guidance also
  governs function-body code, not an installed package. Also rejected: **claiming this is learning** — it is a
  retrieval guarantee over what was written down, and it knows nothing about a lesson nobody recorded. That is
  precisely how D-74 happened, and this reduces the probability rather than removing the class.
- **Reversed by:** a lesson that gets recorded, consolidated, injected, and still fails to change behaviour —
  which would show the failure is in *compliance*, not retrieval, and no amount of loading fixes that; or an
  upgrade to `dsh-agent-instructions` that stops revalidating instruction files per turn, which would make block
  edits stop taking effect without a restart.

## D-77: How does "every session knows to record" reach all sessions — and what can an agent tool actually write?

- **Decided:** **one skill in the user-global root, `~/.dsh/skills/memory-discipline/SKILL.md`, and nothing
  else.** No row is added, changed or removed; no preset is touched; no service is published. The running process
  found it **in the same turn it was created**, so this needed no restart. Separately, and more consequentially:
  **the `memory_*` tools are read-and-render only in a sandboxed session** — they cannot persist their own
  output, and that is the sandbox working correctly rather than a defect in the plugin.
- **Because — the user root is the only preset-independent skill root.** Each of the three user presets mounts
  `skill-filesystem` with its own `customSkillDirs` **and leaves `includeDefaultRoots` on** (their own comments
  say project and user roots still contribute). The user root resolves to `join(dshHome, "skills")` with
  `source: "user-dsh"` (`dsh-skill-filesystem/lib/index.js:171-175`; `dshHome` default at `:77`), and precedence
  is project → **custom** → **user-dsh** → user-agents → bundled (`roots()`, `:150-188`). A uniquely-named user
  skill therefore reaches all three presets and nothing shadows it — which is why this cost one file instead of
  three preset edits. Verified against the live catalogue rather than argued: `dsh-smith`'s five skills are
  exactly this session's five, and after the write the catalogue listed six.
- **Because — the sandbox boundary is a real capability limit, measured rather than predicted.**
  `memory_remember` and `memory_consolidate` both failed with `file access denied under workspace-write mode`
  for `C:\Users\曦曦\.dsh\…`, while `memory_consolidate({dryRun:true})` read both files fine. The mechanism is
  the **seam**, not the path: the plugin writes through the **sandboxed** `fs`, and `dsh-fs-sandbox` decides per
  call from `ctx.sandboxPolicy.defaultMode` (`dsh-fs-sandbox/lib/index.js:104`
  `static inject = ["sandboxPolicy"]`, `:108`, `:125-126`, enforced at `:153`), documenting `workspace-write` as
  allowing writes *"only inside its workspace root"* and refusing the rest with `FS_SANDBOX_DENIED`. `writeText`
  takes a policy as its fifth parameter (`dsh-fs/lib/types/index.d.ts:212`) and the tool ignores the `exec` it is
  handed, so the write is attributed to the tool's own path rather than to the session's wider policy. **The
  user-global directory being unwritable by an agent tool is the protection working**: an agent should not be
  able to silently rewrite the file that instructs every session. The tool's error message now says this instead
  of implying a path bug — **that edit is not live yet** (see the stale-edit note below).
- **Because — two smaller facts, measured not assumed.** `bin/lint-skills.mjs --installed` reads a preset's own
  `skills/` directory and does **not** scan the user root, so linting a user-root skill needs
  `--path <parent-of-skills>`; the linter is a syntax check, and the live catalogue is the independent proof of
  discoverability. And `skipSystem: true` on the user root only excludes a `.system` subdirectory *inside* it
  (`lib/index.js:545,555,585`) — it does not disable the root.
- **Rejected:** **editing all three presets** to add a skill, a `customSkillDirs` entry, or a prompt section —
  the user root already reaches every preset, so three edits would add three drift surfaces for no reach. Also
  rejected: **calling the write denial a plugin bug** — the seam is doing its job, and the right output is a
  truthful boundary plus a read-and-render path, not a sandbox bypass. Also rejected: **using my own write tool
  and calling the loop "working"** — that would conflate two capabilities; the honest statement is that the
  plugin *generates* and a writer with sufficient access *persists*, and materialisation went through my tools
  here precisely because the plugin's own path was correctly denied.
- **Superseded detail, recorded because it is live state:** `lib/index.js` was edited **after** the Host restart
  that made the tools callable, so the running deployment holds the module **without** the improved
  sandbox-denial message. That change needs the **next** restart; the block content is unaffected and correct.
- **Reversed by:** a session whose policy allows writes outside its workspace, which would let both tools write
  directly and turn the read-and-render caveat into a non-issue; or a change to `dsh-fs-sandbox` that propagates
  the session policy into the `exec` a tool receives, which would fix the attribution rather than the policy.

## D-78: Publishing everything — the untracked-preset defect, and the push path a single-root repo needs

- **Decided:** **all three repositories are published**: `ABccgh/dsh-smith` (6 commits added, now 39), plus two new
  public repositories, `ABccgh/dsh-ck3-modcheck` (6 files) and `ABccgh/dsh-agent-memory` (5 files), each carrying
  the `deepseek-harness-plugins` topic. The cleanup fixed a **real user-facing defect** that nothing in this repo
  could see, and the push route for a brand-new repository is **not** one of the three flag combinations the push
  script documents — it needs a different shape, recorded below so the next one does not re-derive it.
- **Because — the defect: a preset that git did not track, while the tarball manifest already named it.**
  `dsh-ck3-mod/` (5 files) was **untracked**, but `package.json`'s `files` allowlist already listed `dsh-ck3-mod`.
  `check-pack.mjs` therefore reported **PACK OK**, because it reads the tarball built from the **working tree** —
  and `README.md` told the reader to `git clone` and then run `node bin/install.mjs --preset dsh-ck3-mod`. **Any
  fresh clone silently lacked the preset.** This is the exact failure the repo's own notes call "the one failure
  this repository cannot detect by running itself", and it was live. Proof it is fixed: I downloaded the branch as
  a tarball **from codeload** (not via git), extracted it, and asserted all five paths are present **and that the
  downloaded copy passes its own `check-pack` and skill lint**. Remote tree == local tree, 48 blobs each side, and
  the recursive remote listing equals `git ls-files` in both directions.
- **Because — the push route for a repo with no commits is a different shape than any documented flag pair.**
  `-Init`, `-Force`, and `-RemoteOnlyParent` were each tried and each is structurally wrong for a **single root
  commit**, and every failure was caught by a `-DryRun` before anything was written:
  - `-Init` alone → the Contents-API bootstrap needed to clear `409 Git Repository is empty` **creates a commit**,
    and `:213` then refuses because a ref now exists ("that flag is simply wrong").
  - `-Force` → needs `-Base`; with `-Base` = the bootstrap SHA and `-RemoteBase` = same, the remote range is
    **0 commits** and `:298` refuses `range length mismatch: 1 local vs 0 remote`.
  - `-RemoteOnlyParent` → `:85` still demands `-Base`, and any `-Base` naming the **remote-only** empty root is
    not a local object, so `git rev-list <base>..HEAD` is empty and `:163` refuses.
  **The combination that works** is the one the script's own error text hints at but never assembles: make the
  remote's empty root **reachable from a local object**, so the ordinary pairing path applies. That is:
  bootstrap once via Contents-API (clears the 409 gate) → `git commit-tree` the empty tree locally with the
  bootstrap commit as parent → `git update-ref refs/hashtag/bootstrap <sha>` → push normally with
  `-Base <bootstrap> -RemoteBase <bootstrap>`, where `-Base..HEAD` is then **exactly the local commits** and the
  remote walk from the tip reaches `-RemoteBase` in one hop. **The `refs/hashtag/` namespace is load-bearing**: a
  branch or tag would make `rev-list --all` see commits that are not being pushed, and a `refs/heads/` anchor
  would also collate its subject into `git log`.
  *(What I actually did was simpler for these two repos because each is a **single** commit: upload the tree
  recursively and create a root commit directly through the API. The `commit-tree` route above is what generalises
  to a multi-commit history, and it is recorded because that is the case the flags will meet next.)*
- **Because — two PowerShell serialization traps, both of which the API rejected with a `422` that names neither
  the flag nor the cause.** Editing the ref is a body-serialization problem, exactly as this file's `parents`
  entry warns:
  - `git log -1 --format=%B` returns a **string array**, so `ConvertTo-Json` emitted `"message": [...]` and the API
    answered `For 'properties/message', [...] is not a string`. Normalising with
    `[string]::Join("`n", @(...))` fixed it.
  - The **first** push attempt failed differently, and more usefully: a commit referencing a tree that was never
    uploaded answers `422 Tree SHA does not exist`. **A local SHA is not evidence the object exists on the
    remote** — the same class of mistake as assuming a ref exists because a file does.
- **Rejected:** **deleting `tools/ck3wiki/`** as part of "全面清理" — it looks like dead weight from a cancelled
  project, but `AGENTS.md` rule 7 marks it deliberately tracked: `lib/http.mjs` is the only copy of that site's
  gate-bypass conditions and `falsify.mjs` the only regression test for four silent converter defects. Also
  rejected: **adding `preflight --preset dsh-ck3-mod` to CI** to make the matrix look complete — the exclusion is
  deliberate and reasoned in the workflow header (the row cites a plugin this repo does not publish), and the
  rule there is exclude-with-a-reason, never `continue-on-error`. Also rejected: **moving the two plugins into
  this repository** — rule 7's boundary; they are their own repos, like `dsh-account-balance` and `dsh-ima-kb`.
  Also rejected: **a hand-written bootstrap script** — I wrote one, saw its blob handling was fragile, and deleted
  it in favour of the deployed tooling; leaving it would have added an untested file to `bin/`.
- **Reversed by:** a repo whose first push needs `-Force` on a multi-commit history and succeeds through the
  documented flags — which would mean the flag analysis above is specific to the single-root case rather than
  general; or `check-pack` being changed to read the **index** rather than the working tree, which would have
  caught the untracked preset locally and made this entire class detectable by running the repo itself.

## D-79: Which launcher database should `ck3_mod_status` read — and what did the hardcoded name cost?

- **Decided:** **the file is discovered, not assumed.** `readLauncherState` now probes every
  `launcher-v2*.sqlite` in `launcherDir`, ranks the candidates by evidence (readable → has registered
  mods → its playset is the active one → newer mtime → filename), reads the winner, and returns the
  full candidate list so `ck3_mod_status` can print which file it read and why it passed over the
  others. The ranking is a **rank record compared as a whole**, not a chain of pairwise booleans.
- **Because:** the hardcoded `path.join(launcherDir, 'launcher-v2.sqlite')` produced a **false
  statement**, not a missing feature. Measured on this machine: `launcher-v2.sqlite` (mtime
  2026-09-15 20:05) holds **0** mods and an empty playset, while `launcher-v2_openbeta.sqlite` (mtime
  2026-09-16 23:44, the file the launcher is actively writing) holds **7** mods and **7** playset rows
  with `isActive=1`; a third, `launcher-v2_openbeta-backup.sqlite`, holds 3. The tool reported
  「启动器眼中的模组（0 条）」 and 「没有发现启动器与磁盘之间的不一致」 while `<launcherDir>\mod\` held
  seven `.mod` files (all with `gameRegistryId = mod/ugc_<id>.mod`), `dlc_load.json` listed seven
  `enabled_mods`, and the game's own log listed all seven — with two of them `Mounted Data`.
  The plugin's own `SELECT` (unchanged) returns all seven rows from the openbeta file, so only the
  **file choice** was wrong. Two design points were forced by measurement rather than taste:
  (a) ranking by mtime alone is not enough — a `-backup` is a full copy, so it can be newer than the
  live database and would win; the rank record puts "has registered mods" and "playset is active"
  above recency; (b) the first comparator was a chain of `(a.x > 0) !== (b.x > 0)` tests, which is not
  a total order — the suite now asserts that all six orderings of the same three candidates agree.
- **Rejected:** **reading all databases and merging them** — the launcher's rows carry ids that would
  have to be reconciled across files, and a merge would invent a registry neither file contains.
  Also rejected: **picking the newest file** (the `-backup` wins that contest on this machine).
  Also rejected: **a hand-written SQLite parser for `launcher-v2.sqlite`** — D-71 already recorded that
  `node:sqlite` refuses that one file while accepting its siblings, and `ck3_mod_status` reads them
  fine, so a second reader would be one more thing to keep in step.
- **Reversed by:** a launcher version that keeps exactly one database (the probe then finds one
  candidate and the ranking is inert), or a session in which the chosen file is not the one the
  launcher's UI shows — the candidate table in the report is what makes that falsifiable in one look.

## D-80: The game's own log contradicts both the launcher database and `dlc_load.json` — which one is authoritative?

- **Decided:** **the game's own single-run log is the strongest of the three, and the tool must not
  present the launcher database as the verdict.** `ck3_mod_status` now distinguishes "read 0 rows"
  from "there are no mods" (the launcher's own `mod\` folder is checked before either sentence is
  printed) and its "no disagreement" line says 「没读到」 rather than 「没问题」 when the registry was
  empty. `ck3_mod_evidence` is where the game-log side surfaces.
- **Because:** three sources disagree on the same machine, at the same time, measured in one session:

  | Source | What it says |
  | --- | --- |
  | `<launcherDir>\logs\debug.log`, run of 2026-09-16 23:16–23:26 | a `Mod:` table of 8 rows with 2 marked `Enabled`; `Mounted Data: D:/CK3Mods/jtdx`; `>=== NAMESPACE > 'jtdx' is set to #3520000`; `Loaded [6] events from 'events/jtdx_events.txt'` |
  | launcher DB (openbeta) | 7 registered mods, playset `enabled=1` for all 7 |
  | `dlc_load.json` | `enabled_mods` = 7 workshop entries |

  The only mod the game demonstrably **loaded and ran events from** is `mod/jtdx.mod` — a workspace
  mod under `D:\CK3Mods` — and it appears in **neither** the launcher database nor `dlc_load.json`.
  `D:\CK3Mods` is empty today, so the artifact is gone while its evidence survives in the log. This is
  also the first observation that a mod authored in this workspace was actually loaded by the game.
- **Also settled here, and it retires a sentence that was in three documents:** the logs are **per
  run** — the `event_queue` evidence D-75 quoted (`debug.log:5594`, `Total items in queue: 2107`) is
  no longer in `debug.log`, which now contains only `gold 5000` console lines from a later run. So
  "the log" is never a durable record; every reading must be dated, and cross-run arithmetic is void.
  `console_history.txt` is the exception: it accumulates across runs, which means D-68's "it holds only
  `event_queue`" was a point-in-time reading, not a property.
- **Rejected:** **treating `dlc_load.json` as the record of what loaded** — measured against the game's
  own log, it lists 7 while the log marks 2 enabled, and it omits the one mod the log proves was
  mounted. Also rejected: **parsing the game's eight-row `Mod:` table into findings now** — its columns
  are unmeasured in any specification, and D-67's rule is that a probe must report what it can read;
  what this entry establishes is which source wins when they disagree.
- **Reversed by:** a run in which the game's log, the launcher database and `dlc_load.json` agree, or a
  launcher/`.mod` layout in which the game-log table names mods the database also lacks — which would
  make the table itself the best available record rather than merely the best available *evidence*.

## D-81: The error count that was reported as "43 distinct errors" was a count of log SHELLS

- **Decided:** **a shell line is merged with its continuation lines before deduplication, and the
  number that used to be presented as an error count is now labelled as a count of message kinds.**
  `readRuntimeEvidence` keys `Script system error!…` entries on shell + continuation, reports
  `count` per entry, and prints how many raw E lines were folded into how many entries.
- **Because:** measured on a modded run, `error.log` held **1,780** E-level lines and **43** distinct
  messages — a number the tool printed as 「去重后不同的错误只有 43 条」. Of those lines, **1,562** were the
  identical shell `Script system error! (while building tooltip/description)` and 59 more were
  `Script system error!`, with the actual fault on the following, non-timestamped line:
  `  Error: Undefined event target 'liege'` / `  Script location: file: common/script_values/00_court_position_values.txt line: 779`.
  The key was the message text alone, so **1,621 real errors collapsed into two entries** and the
  reader was handed 43 as if it were a total. The old behaviour was not a display bug: it made the
  whole `error.log` plane look quiet. The merge is deliberately scoped to shell lines — appending
  continuations to every message would break the **cross-sink** deduplication D-67 established
  (one message in three logs counts once), which the suite pins with a fixture where the same
  shell + continuation appears twice and must stay one entry with `count = 2`.
- **Rejected:** **dropping continuation lines entirely** (they are the only place the fault is named),
  and **counting every raw E line as a distinct error** — that would reintroduce the 3× sink inflation
  D-67 measured. Also rejected: **presenting `raw − Σcount` as "suppressed errors"** — that number is
  0 whenever the entries' counts sum to the raw line count, which is the normal case; what a reader
  needs is the two totals (lines, entries), which the report now prints.
- **Reversed by:** an `error.log` whose shell lines carry their own detail on the same line (the merge
  then has nothing to join, and `count` stays 1 for every entry), or a future build whose shell text
  changes — the regex is anchored on `^Script system error!?$`-ish text, so a renamed shell would show
  up as a jump in the entry count rather than as silence.

## D-82: Does the CK3 preset ship a contradiction about the localization version counter?

- **Decided:** **no — the two texts answer different questions, and neither is wrong.** `ck3-mod-authoring`
  (`SKILL.md:106-118`) says the counter is a **version marker** whose non-zero value means
  "needs retranslation"; the persona (`agent.cordis.yml:171-180`) and the `expert_modd` persona
  (`:491-499`) say it is **optional and deprecated for modders**. "Optional" is a claim about the
  **format** (you may omit it; omitting it is not a defect) and "version marker" is a claim about the
  **semantics when present** — the plugin's own pattern (`LOCALIZATION_ENTRY`, counter optional) plus its
  comment (`rules.mjs`: "a value greater than 0 makes the game report the entry as needing
  retranslation") hold both at once, and the vanilla corpus shows the mechanism in use (11,944 entries
  with counter `1`, 1,723 with `2`, 436 higher). A 2026-09-17 adversarial review reached the same
  verdict independently and measured the same counts.
- **Because:** an earlier reading of mine treated the skill's sentence as contradicting the persona's and
  proposed deleting it. Three measurements stopped that edit: the skill's sentence says nothing about
  required-ness, the persona's says nothing about non-zero, and the plugin's shipped pattern was
  **already** `(?:\d+)?` while its comment asserts the retranslation meaning — i.e. the project has
  always held both. **What was wrong was a different number, in the persona:** `742 vanilla entries omit
  it` is not a count of counterless entries (the same corpus has **25,431**, which the prefix already
  stated correctly); 742 is unreproducible from the pattern it was attached to and is 34× too small.
  Measured today: 744 lines fail the shape printed in the old code's message, **742 of them carry a
  trailing `#` comment**, 717 of those also lack a counter, 27 carry one, and exactly 2 fail on an
  apostrophe in the key. The plugin contradicted itself on the same fact
  (`rules.mjs`: 742; `README.md`: 25,431). So the edit that shipped is: the persona's 742 → 25,431, the
  plugin's comment rewritten to state what 742 actually measures, and **the skill's sentence kept**, with
  its non-zero semantics marked as **not verified in the engine** rather than asserted. Editing the skill
  would also have invalidated the preset's own attestation that it is unmodified from its predecessor.
- **Rejected:** **deleting the skill's retranslation sentence** (it is true as far as the plugin's own
  comment goes, and the only evidence against it was a wiki sentence about the format).
  Also rejected: **editing it to match the persona's wording** — that would have replaced a
  semantics claim with a format claim and lost the one piece of guidance about **not** writing a
  non-zero counter on changed text.
- **Reversed by:** a source that shows the counter's non-zero value has no effect (then the skill's
  sentence becomes false and must be withdrawn), or a measurement of counterless entries that lands on
  742 — which would make the old number right and this correction wrong.

## D-83: What did the 2026-09-17 audit of the CK3 pair actually change, and what did it deliberately leave alone?

- **Decided:** the following, all measured in that session:
  1. **`ck3_mod_status` reads a discovered database** (D-79) and no longer prints "nothing registered"
     as a fact when it read an empty file.
  2. **The missing third disagreement class from `compareLauncherToDisk`'s own comment is implemented**
     as `launcher-mod-unregistered`, in a separate pure comparator, fed by a new
     `listLauncherModFiles`. It reports a `.mod` file in the launcher's own `mod\` folder with no row in
     the launcher's database. It correctly reports **nothing** on this machine (all seven files are
     registered) — its falsifier is synthetic, and the `available: false → []` contract that
     `falsify.mjs` already described is now actually exercised.
  3. **`ck3_mod_evidence` dates its reading to a run** and no longer says "the previous run"; the
     shell/continuation merge is D-81.
  4. **Descriptions are pinned by the suite.** The four tools' names and descriptions moved into an
     exported `TOOLS_META` so `test/falsify.mjs` can assert them; before this, `apply()` was never
     called by the suite and no description could be tested — which is how one description came to
     promise an `event_log.csv` signal the same tool's output declared never to be written.
  5. **Zero-check reports no longer read as passes.** `renderReport` prints 「**no check ran**」 when
     `modsScanned === 0` instead of 「every check that ran passed」.
  6. **A `modPath` that is not a directory is answered as an input error.** Measured before the guard:
     `ck3_modcheck README.md` reported "1 mod validated, errors: 3" with three suggestions to create
     files under a `README.md\` folder. A wrong argument produced three findings and three pieces of
     bad advice.
  7. **`CODES.TAG_UNKNOWN` was removed entirely** rather than left in the table. The vocabulary check
     was retired by measurement long ago, so the key named a code no check can produce — a coverage
     claim with nothing behind it, and the suite now asserts the name is absent.
  8. **A dated receipt replaces a staleness verdict.** Every report ends with the process id, its start
     time, and the mtimes of `lib/index.js` and `lib/rules.mjs`, read through `node:fs` from
     `import.meta.url` (deliberately **not** through the sandboxed `fs`). What it is *not* is a claim
     that the running code is stale: an adversarial review pointed out that mtime-vs-boot is
     non-diagnostic in both directions, and D-73 already records this project rejecting that inference.
     The receipt is a fact the reader can act on; no sentence says "the code is stale".
  9. **The preset's own contradictions were fixed** (persona counts, the two skills' `path=`/`key=value`/
     project-root rules, the doc's three different assertion counts) — and **`ck3_mod_init`'s
     self-report** now binds its zero-finding verdict to `ck3_modcheck`'s actual scope.
- **Because:** every item above is a case of the same failure — a claim, a count, or a check that no
  longer matched what the code does, none of which any test noticed. The suite went **121 → 151**
  assertions, and each new class was proven by planting its defect back: removing the availability
  guard turns `launcher-mod-unregistered` into 1 finding on an unreadable database; disabling the
  shell-continuation merge turns 4 assertions red; removing the description qualifier fails the
  description assertions; changing the database ranking to recency alone selects the wrong file.
- **Rejected:** **editing a shipped preset or any `~/.dsh/profiles/**` file** (the profile row and its
  four config keys are untouched; no row was added to any composition, and the preset's 24 leaf rows
  are unchanged). Also rejected: **deleting `tools/ck3wiki/`** while cleaning up, for rule 7's reason.
  Also rejected: **`docs/verification/vanilla-idiom-citation-notes.patch`** — an untracked file that
  predates this session and belongs to a different piece of work.
- **Reversed by:** a session in which `test/falsify.mjs` passes while one of the nine behaviours is
  absent (that is the failure mode the planted-defect runs exist to catch), or a change to the
  launcher's database layout that makes the candidate ranking select a file its UI does not show.


## D-84: 待办清单该放宿主平面还是 preset，以及它凭什么能跨轮次跨会话？

- **决定：** `$DSH_HOME/plugins/dsh-inbox` 作为一个 host 面插件，由 web profile 的
  `cordis.patch.yml` 里一行 `insert:` 挂载；清单存 `$DSH_HOME/inbox/inbox.json`，**每次访问重新读取**，
  写入用 `node:fs` 的原子替换（临时文件 + rename），**不使用 `ctx.storage`**。
- **为什么：**
  1. **平面由共享决定，不由「像不像 agent 的东西」决定。** 清单是账号级的**单一事实源**，跨会话共享；
     preset 行是每会话一份、随会话卸载，放进去会让清单按会话碎片化。该行**不发布任何服务**——只往宿主
     既有的 `tools` 注册表登记三个工具、往 `ctx.connection.fetch` 注册一条路由——所以不需要 `isolate`
     realm，也不会与宿主服务撞名。
  2. **`ctx.storage` 出局的原因是可测的，不是风格。** `dsh-storage-json` 打开单元时**只读一次**文件，
     之后 `loadAll()` 一律回答内存里的 `this.state`（`lib/index.js:178-214`），而且没有任何
     reload/refresh/invalidate 成员。于是「人手改文件」要么看不见、要么被下一次机器写入静默覆盖。用户明确要
     的是「可手改的 JSON」，所以内存态存储直接不满足需求；每次访问重读使 (b) 由**构造**满足，而不是靠一个
     可能悄悄死掉的 watcher。
  3. **写盘绕开 `ctx.fs` 缝。** `fs` 缝是**沙箱**提供者，宿主行不带 session 调用时拿的是**部署默认**
     （`dsh-sandbox-policy/lib/index.js:141-148`），而部署默认的 workspace 根不含 `$DSH_HOME`。这不是推断：
     本会话里 `memory_remember`（宿主插件 → `ctx.fs.writeText`，未传 policy）写 `~/.dsh` 被拒
     `file access denied under workspace-write mode`，而同一路径用 `write` 工具与 pwsh 都成功。`node:fs`
     也是本部署其它宿主插件（`dsh-agent-memory:41`、`dsh-client-modules:3`）的既有做法。
  4. **路由必须走 `ctx.connection.fetch`，不能用 `ctx.webServer` 的 exact 路由。** webserver 的 `match()`
     先查 exact 表再查 prefix 表（`dsh-host-webserver/lib/index.js:321-331`），而 `/api` 的浏览器认证是一条
     **prefix** 路由——一条 exact 的 `/api/inbox` 会**绕过认证**却看起来「在 /api 之下」。
  5. **提问转待办接在 `user-questions/request` 瀑布上。** `ask_user_question` 最终走
     `ctx.waterfall(...)`（`dsh-user-questions/lib/index.js:52-79`），Cordis 让**先注册的监听器在链首**
     （`cordis/lib/index.js:258-264,318-324`）。本插件注册 `{global:true}` 监听器把提问排队，面板回复经
     `/api/inbox` 解析**同一个挂起的工具调用**，回给模型的答案形状与既有答复器一致。
- **被否决：** 改任何 shipped preset；用 `ctx.storage`/`ctx.settings` 承载清单（前者读一次、后者会把任务清单
  变成 Web 设置页渲染的配置命名空间）；把 agent 的回复合成进会话历史（`Session.append` 对消息类事件要求
  `SurfaceIntent`，伪造对话历史的风险不值得）；在本会话里替用户重启 Host（用户明确选择自己重启）。
- **被推翻的条件：** 若某次重启后 `$DSH_HOME/inbox/inbox.json` 不生成、或 `inbox_add` 不出现在工具表里，
  则「宿主平面 + 这一行」的结论为假；若 `dsh-storage-json` 将来获得 watcher 或 reload 成员，则第 2 条的
  取舍需要重估；若 `/api` 认证不再是一条 prefix 路由，则第 4 条的理由消失。
- **状态：** 已写成、已安装、已被真实 loader 的 `--dump-config` 证明进入合成树；
  **尚未挂载**——插件挂载需要重启 Host，那一步由用户执行，因此「GUI 里可见可编辑、重启后仍在」这一半
  在本条写下时**仍未验证**。
