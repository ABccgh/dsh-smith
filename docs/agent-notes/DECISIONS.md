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
  `disabled: !!js ctx.get('cordisInspect') !== void 0` (`dsh-smith/agent.cordis.yml:677-679`),
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

