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

