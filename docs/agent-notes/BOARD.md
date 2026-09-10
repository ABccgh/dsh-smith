# Board

## Objective

Two presets now ship from this repository: `dsh-smith` (builds harness agents and Cordis
plugins, unchanged) and `dsh-forge` (software delivery, new). Both are installed, and
`dsh-forge` is now **mount-validated**. What is open, and nothing else:

1. **`dsh-forge`'s tool surface is VERIFIED — closed this session.** All three checklist items
   in `docs/dsh-forge.md` were measured in a real `dsh-forge` session and are recorded there:
   the tool table, `run_code` + the generated `tools:sdk` section, and the `deny: [write, edit]`
   filter under `mode: both`. The filter result is stronger than the word "rejected" implied —
   the two bindings are **absent from the SDK object**, so the call dies at property lookup
   (`TypeError: tools.write is not a function`) before any dispatch, and a **same-depth,
   same-provider control without a `toolFilter`** retains both, which excludes depth and
   inheritance. D-26 records the correction this forced on D-17's wording.
2. **`bin/verify.mjs` cannot reach the roster from any session** (D-24). Corrected in its text;
   making it a real check would need it to attach to a live runtime instead of booting a bare one.
3. **The local commits are unpushed** whenever no remote is configured. A workspace fact, not a
   preset defect.

> The row-count question is **closed**: 38 named rows = 3 group containers + **35 leaf rows**, of
> which **31 active**, 2 `conditional`, 2 `disabled`. Both counting paths skip containers
> (`dsh-agent-presets/lib/index.js:991`, `:1038`). Both figures this board previously carried were
> wrong, and D-25 records why.

> This board was rewritten this session. Its previous objective ("close the last two
> verifications on this preset") was satisfied: both closed, recorded in `PROJECT.md`, with the
> surviving caveats kept in D-17.

## In progress

| Role | Child id | Question |
| --- | --- | --- |
| — | — | No verification of `dsh-forge` is in flight. A snapshot; date it if it stops being true. |

## Settled this session

| # | Item | Status | How it was established |
| --- | --- | --- | --- |
| 1 | Second preset, or change `dsh-smith`? | **Second preset** | User's call, after the two roles were read out of `preset.yml` and the shipped set. `dsh-smith/**` was not touched. |
| 2 | PTC or both for the new preset? | **`both`** | `collapses()` at `dsh-tools/lib/index.js:2993-2995` collapses model-direct calls to `run_code` alone under `ptc`; the SDK binding at `:1207-1220` propagates `agent`/`parent`/`signal`, so `exit_plan_mode` would still work — reliability, not correctness. See D-19. |
| 3 | Is a mount check runnable for `dsh-forge` from here? | **No** | This session's own tool table has no `cordis_*` at all: the host takes the four process-global provider ids at boot, so every other composition must gate the row off. See D-20. |
| 4 | Do the ported scripts still behave as before? | **Yes** | With no `--preset`: 5 skills lint clean; drift 36/32 rows with the same six drifted rows; install refuses to overwrite with the same message. |
| 5 | Does the new static preflight actually detect defects? | **Yes — falsified** | `mode: nope` → `$.mode expected "native" \| "ptc" \| "both" but got "nope"`; a renamed package → `package does not resolve`. Both exit 1. |
| 6 | Does `dsh-forge` parse and validate? | **Yes, 0 failures** | `bin/preflight.mjs --preset dsh-forge`: `validated: 24   skipped: 10   failed: 0` over 38 named rows. The 10 skips are named in `docs/dsh-forge.md` — skipping is not passing. |
| 7 | Persistent shell rows? | **Not composed, deliberately** | `dsh-tool-pwsh-persistent`/`-bash-persistent` inject `["tools","terminals"]`, and no bundle composes `dsh-terminal`; adding the row would fail the mount on a `waiting for terminals` row. A host-plane change, not a preset one. |
| 8 | Did an independent adversarial review of this change earn its cost? | **Yes — 7 documentation defects, 0 composition defects** | One `expert_verifier` call confirmed all six technical claims and found that the prose around them was wrong in seven places; the change was then re-verified and re-installed. Recorded as D-22, including the one finding of its own that was itself slightly off. |
| 9 | Does `dsh-forge` mount? | **Yes — `MOUNTED OK`** | The dynamic-plugin probe from a session on the shipped `cordis` preset: `standingKeyFor('dsh-forge')` resolved a standing scope key; `compositionInventory()` listed 35 leaf rows — 31 active, 2 `conditional`, 2 disabled — with `broken=none`, so no row is mounted-but-contributing-nothing. See D-23 and `docs/dsh-forge.md`. |
| 10 | Can `bin/verify.mjs` run the mount check? | **No — from any session** | It builds its own bare Cordis context (`bin/verify.mjs:204`), so `agentPresets` is absent by construction. Measured twice, byte-identical: a plain shell and the shipped-`cordis` session that *could* run the probe both printed `INCONCLUSIVE — this runtime publishes no agentPresets service`. D-24; header and advice corrected. |
| 11 | Did the file and the inventory really disagree by a row? | **No — both errors were ours** | `flattenRows` (`:991`) and `mountedCompositionRows` (`:1038`) both skip `group: true` entries, so a row list is leaves only: **38 = 3 groups + 35 leaves**, of which **31 active**. "35 active" mislabelled the total and "34 = 38 − 4" subtracted from a total that includes the 3 containers. D-25. |
| 12 | Do `run_code` and the `tools:sdk` section reach a model? | **Yes — both, measured** | This session's own table has `run_code` and executes it; a delegated child's prompt carried the `Program-only SDK bindings:` block and its `await tools.glob(...)` returned 15 paths. The SDK section is not merely rendered — it is **callable**. Sibling of `wireSchemas`'s `both` branch (`dsh-tools/lib/index.js:2739-2742`). |
| 13 | Does `deny: [write, edit]` hold under `mode: both`? | **Yes — and it is absence, not rejection** | Filtered `expert_debugger`: 30 names, `write`/`edit` absent from table *and* SDK section, forced calls → `TypeError: tools.write is not a function` (`instanceof ToolCallError === false`), `glob` control succeeded. Control at same depth/provider without `toolFilter`: 32 names, both present, `edit` really dispatched. D-26. |
| 14 | Is the workspace's installed preset what this repo says it is? | **Yes — byte-identical** | `Get-FileHash` on `~/.dsh/.agent-presets/dsh-forge/agent.cordis.yml` and `dsh-forge/agent.cordis.yml` agree: `C8353AF1D7B05193AF88D5DDC085D2B4B79B422DFDEA93C0D2AF70C0414A86A1`. So no measurement here is contaminated by hand-edit drift — the failure mode `AGENTS.md` rule 6 exists to prevent. |

## Open questions

1. **CLOSED — does `mode: both` send the SDK without collapsing the catalog?** **Yes.** Measured
   in a real `dsh-forge` session: the tool table carries the full catalog (32 names) *and*
   `run_code`, and a delegated child successfully executed `await tools.glob(...)` — an SDK binding
   that resolves only if the `tools:sdk` section was rendered into its prompt. `wireSchemas`'s
   `both` branch returning the full list (`dsh-tools/lib/index.js:2739-2742`) is therefore
   confirmed end to end rather than by reading. See `docs/dsh-forge.md`.
2. **CLOSED — do the read-only experts stay read-only under `mode: both`?** **Yes, and the
   mechanism is not a guard.** A delegated `expert_debugger` (`deny: [write, edit]`, byte-equal
   config to `expert_verifier`) enumerated 30 names with `write`/`edit` absent from both the
   mounted table and the SDK section; forced calls threw `TypeError: tools.write is not a function`
   (`instanceof ToolCallError === false`) while `tools.glob` succeeded. The differential control —
   same depth, same spawn provider, no `toolFilter` — retained both and dispatched a real `edit`.
   This is the one design signal that neither a mount nor `preflight.mjs` can touch, because the
   filter is applied per child at spawn (`dsh-subagent/lib/index.js:554`) and no check here ever
   spawns a child. D-26.
3. **OPEN — does a `repeat-tool-reminder` row in a preset co-exist with the host's?** The host
   composes the same package (`dsh-base/cordis.patch.yml:419-422`); the preset's row installs its
   own scoped listeners. Both should fire. Untested, and the failure mode would be a doubled
   reminder, not a failed mount — worth one observation rather than a work item.
4. **OPEN — is a clean mount in *this* process evidence about a *new* one?** The mount check ran in
   the current process. The cold-process case is reasoned (`!!js` gates read `process.platform` and
   `cordisInspect`, same values in a cold process) and not measured, because measuring it means
   starting a second harness process — which would start a second server.
5. **OPEN, new and small — is `ralph` visible to a child at delegation depth 1?** The measurements
   above say **yes**: three separate children at depth 1 all enumerated 32 names with
   `has_ralph=true`, and `composeFrom` binds a child to its parent's exact generation
   (`dsh-agent-presets/lib/index.js:1508-1524`, *"the same tool registrations"*). But this rests
   **entirely on child self-reports**, and one of them initially omitted `ralph` from its prose
   list. Nothing in this repo asserts an answer either way, so there is no defect to chase — only
   an unmeasured claim, and the cheap check is enumerating from a child whose row is *known* to be
   depth-sensitive. Recorded rather than dismissed because the same round trip that closed items 1
   and 2 raised it.

## Next

1. ~~Open a new session on 「DSH 研发工坊 · DSH Forge」 and work the three-item checklist~~ —
   **done.** All three closed in `session-8b8072a6`, at a preset whose file hash matched the repo
   copy. `docs/dsh-forge.md` now records the measurements under 三项的实测结果, and its checklist
   is kept as the source of the criteria rather than as pending work.
2. Keep `AGENTS.md` rules 5, 6 and the boundaries current: the mount check needs the shipped
   `cordis` preset, `verify.mjs` is a diagnostic, and the two owned preset directories are written
   only through `bin/install.mjs --preset <id>`.
3. **Count with the tool's own semantics before publishing a breakdown.** Two counting paths in
   `dsh-agent-presets` skip group containers; this session published three wrong numbers from
   grepping the file directly (D-22, D-25). When a document states a decomposition, parse it or
   print it — do not derive it from a total.
4. **A child's self-reported list is a transcription, not a reading** (D-27). The filtered child
   dropped `ralph` from its prose while the runtime array held it, and misquoted a type alias. Have
   the runtime print the array and compare against that.
5. **When a report is captured, record the revision it was taken at, and re-measure before
   restating any number from it** (D-14, D-16).
