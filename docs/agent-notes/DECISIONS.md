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

