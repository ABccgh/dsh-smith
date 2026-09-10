# DeepSeek Harness (package `dsh-smith`) — chronicle

## What this is

`dsh-smith` is a DeepSeek Harness **agent preset**, published as the npm package `dsh-smith`.
The npm package root, the git root, and this memory root are the **same directory**,
`D:\DeepSeek Harness`; the preset source directory is `D:\DeepSeek Harness\dsh-smith\`, and
`node bin/install.mjs` copies it to `${DSH_HOME}/.agent-presets/dsh-smith/`. (The working
directory of a session in this tree is spelled `--D-DeepSeek~0020Harness--` in the sessions
store; that is a path encoding, not a second project.)

## Architecture (verified)

Every line names how it was established. Session date of record: 2026-09-10.

- **The installed preset is byte-identical to this repo's copy — re-measured, and the earlier
  figures in this file are historical.** Current: SHA-256
  `77E34CB76EF2B41D06FE8278FCD0875EC9C19EE3059884D89DA44B4AE25C13DB`, **43,211 bytes / 730
  lines**, both at `dsh-smith/agent.cordis.yml` and at the installed path above. A session on
  `dsh-smith` is therefore running exactly this file, not a stale install.

  > Superseded figures that still appear below, kept because they are the measurements the
  > surrounding paragraphs were written from: `A6D2A9C1…DE051` at **40,032 bytes**, and a
  > **19-file / 65.5 kB** tarball. Both were true when written and neither is true of HEAD. Any
  > sentence resting on them describes a past revision — check the number before repeating the
  > claim, and prefer the current pair above.
- **Deployment version 0.1.5-rc.1**, from
  `${DSH_HOME}/profiles/node_modules/@deepseek-ai/dsh-base/package.json`.
- **Host composition** = profile `web`: bundles `@deepseek-ai/dsh-base` +
  `@deepseek-ai/dsh-web-app`, then `profiles/web/cordis.patch.yml` (which inserts one
  community row, `deepseek-balance`, and nothing else).
- **`cordisInspect` is a host-plane service of the web-app bundle**, not of `dsh-base`: row
  `cordis-host-runner` / `@deepseek-ai/dsh-cordis-host-runner` is at
  `@deepseek-ai/dsh-web-app/cordis.patch.yml` lines 122-123; `dsh-base` does not depend on
  that package at all.
- **The registry is constructed inside `DynamicCordisRunnerService`, not by the row itself.**
  `dsh-cordis-host-runner/lib/index.js` line 1598: `this.inspectRegistry = new
  CordisInspectRegistryService(ctx)`, inside that class's constructor (class starts line
  1416). The row is unconditional, with no `disabled` and no config, so on any boot where the
  web-app bundle is composed the registry exists and is never disposed. That is the whole of
  the "the gate is always true on this deployment" argument — a **lifetime** argument, not an
  ordering one.
- **The live session's tool table (headline result).** A session on the `dsh-smith` preset
  reaches the model with: `expert_architect`, `expert_verifier`, `expert_protocol`,
  `expert_chronicler`, `subagent`, `subagent_fork`, `workflow`, `ralph`, `pwsh`, the file
  tools, `job_*`, the `goal` tools, `skill`, `exit_plan_mode`, `todo_write`,
  `ask_user_question`, `web_*`, `present`. It has **no** `cordis_*` tool of any kind
  (`cordis_inspect_list`, `cordis_inspect_query`, `cordis_define`, `cordis_run`,
  `cordis_stop`, `cordis_undefine`), and **no** `subagent_codex` / `subagent_claude_code` —
  matching those two rows' `disabled: true`. Source for the expected set:
  `dsh-smith/agent.cordis.yml` declares `toolName:` at lines 402, 423, 433, 471, 523, 554
  (six reachable) and 590, 599 (two disabled).
- **A `disabled: !!js` gate is evaluated, not applied.** `@deepseek-ai/cordis-plugin-loader/lib/index.js`
  line 289 builds the predicate as `new Function("ctx","expr", … with (ctx) { return eval(expr) } …)`,
  the `disabled` getter at lines 359-378 evaluates it, and line 391 returns before `init()`.
  A gate that throws disables only its own row and cannot crash the session; a gate that is
  false leaves the row to activate normally.
- **`@deepseek-ai/dsh-tool-cordis` injects four services and registers four host providers at
  apply time**: `inject = ["tools","systemPrompt","dynamicCordisRunner","cordisInspect"]`,
  and `hostInspectProviders()` returns exactly the ids **`Service`, `Event`, `Builtin`,
  `Tool`** — `dsh-tool-cordis/lib/index.js` lines 9095-9101 (inject, no service propagated)
  and 9030-9055; registration is at line 9113, unconditional.
- **The duplicate-provider throw is real.** `dsh-cordis-host-runner/lib/index.js` line 732:
  `if (this.providers.has(manifest.id)) throw new Error(...)` with the message
  `Host Cordis inspect provider "<id>" is already registered`; line 738 returns a disposer
  that is safe to call twice. Read in `lib/index.js` and `lib/types/inspect-registry.d.ts`.
- **`listTools` is agent-scoped**: the `Tool` provider's `query` is
  `ctx.tools.schemas(context.agent)` (`dsh-tool-cordis/lib/index.js` line 9051). A standing-key
  query returning an empty list is the correct answer for a non-agent scope, not a defect.
- **A delegated child session inherits this preset.** One observed instance is enough to
  falsify "a child gets a default preset": the expert call this
  session made created `sessions\--D-DeepSeek~0020Harness--\b57ca14f-b0a7-4f0e-b6da-3db360e5ac29\session.v3.jsonl.zstd`,
  whose header reads `{"origin":"subagent","delegationDepth":1,"agentPreset":"dsh-smith",
  "parentSession":"session-d8ef0988-…"}`. The brief for this milestone states the mechanism as
  inheritance at session-creation time; that mechanism itself was not read from source here.
- **Session logs hold no evidence of tool use.** Those `.jsonl.zstd` files contain only a
  session header (`type`, `version`, `id`, `createdAt`, `cwd`, `parentSession`, `isSeeded`,
  `origin`, `delegationDepth`, `agentPreset`) — no turns, no tool calls, no tool table. A scan
  matching **all 116** `.zstd` files present at that moment (by extension, so both the
  `session.jsonl.zstd` and `session.v3.jsonl.zstd` names were covered) found zero hits for
  `pwsh`, `exit_plan_mode`, `todo_write`, or any `cordis_` string; a control-calibrated scan
  was needed precisely because a zero-hit result from these files proves nothing on its own.
  The census is a moving target: a recount during the same session saw 117, and this session
  saw **120** (`109 session.jsonl.zstd` + `11 session.v3.jsonl.zstd`), every one still
  header-only, with no second file of any kind in the sessions store. **The `.v3` name is not
  a child marker**: the root session of this very repo carries `session.v3.jsonl.zstd`.
- **`agentPreset` in a header is a creation-time hint; the projection is the authority.**
  The header field is optional (`dsh-session-format/lib/types/types.d.ts:19`). The web-app
  composition sets the default preset id in its own row — `dsh-web-app/cordis.patch.yml:481-484`,
  `id: agent-presets` with `config.default: standard` — and the API reports a session's preset
  from `ctx.sessionProjections.stateOf(session, 'agentPreset')`
  (`dsh-api-session-controller/lib/index.js:363` and `:522`), a projection whose `init` merely
  adopts the header while its `apply` is driven by the `agent-preset/selected` event carrying
  the **mounted** preset id (`dsh-agent-presets/lib/index.js`, and its projection definition at
  `lib/index.js:1071-1079`). **Measured divergence, same tree and same tool table:** the root
  session of this repo reads `"agentPreset":"standard"` while the two expert children it
  spawned, one delegation deeper, read `"agentPreset":"dsh-smith"`. Plain `standard` cannot
  explain the root session at all — the shipped `standard` composition
  (`dsh-agent-presets/presets/standard/agent.cordis.yml`, 12928 B) declares `subagent` and
  `subagent_fork` but **no `expert_*` row**, while this repo's preset (40032 B) declares all
  four. So a header's value is evidence *that the field was written*, never evidence of which
  composition served the session. (Inference, labelled: the projection for this session should
  read `dsh-smith`; the confirming read is a projection query, not a log decode.)
- **The `tool-cordis` row is `disabled`, which is a stronger statement than "gated".**
  The `tool-cordis` row of `dsh-smith/agent.cordis.yml` is `id: tool-cordis` / `disabled: !!js
  ctx.get('cordisInspect') !== void 0`, and the row declares **no `inject:` at all** (grep of
  `inject|disabled:|!!js` over the file returns lines 217, 221, 587, 596, 679 and no inject
  key). So the row cannot "wait on a service": it either loads and contributes, or is skipped.
  Because the registry exists from host-composition boot (above), the predicate is true, the
  row is skipped, and `dsh-smith` therefore **can never** be the composition that registers the
  `cordis_*` tools. The absence is a property of this preset, not of mount order.
- **Omitting `maxDepth` on a `tool-subagent` row resolves to 3, not 2 — and all six delegation
  rows therefore state it explicitly. CORRECTED: this paragraph used to describe the pre-fix
  state and was left standing after the fix.** The mechanism is unchanged and still the reason
  the omission mattered: the row schema is
  `maxDepth: z.union([z.natural().max(Number.MAX_SAFE_INTEGER), z.const("provider-managed")]).default(3)`
  (`dsh-tool-subagent/lib/index.js:269`), and Cordis applies schema defaults before `apply`
  runs (`cordis/lib/index.js:955-957`, `resolveConfig` → `Config["~standard"].validate(config)`
  at plugin instantiation; proof of application is `dsh-tool-subagent/lib/index.js:508`, which
  branches on `typeof config.maxDepth === "number"` and so can only ever see the defaulted
  value). **What changed:** the four expert rows used to omit the key and resolve to 3, which at
  depth 1 gave an expert subtree one level MORE than the lead's own tools. All six delegation
  rows — `subagent`, `subagent_fork`, and the four experts — now state `maxDepth: 2`.
  The recursion that results: the lead is depth 0 (`delegationDepthOf` treats absence as
  top-level zero, `dsh-subagent/lib/index.js:135-147`), a delegated expert is depth 1, and
  `resolveChildDepth` throws only when `childDepth > maxDepth` (`dsh-subagent/lib/types/child-agent.js:32-41`),
  so with a cap of 2 a depth-1 agent may spawn a depth-2 grandchild and a depth-3 attempt is
  rejected. Deepest chain = 3 levels, labelled 0/1/2.

  > The superseded paragraph also carried stale measurements — `maxDepth` at L405/L425 where it
  > is now L417/L437, expert rows at L429/L467/L519/L550 where they are now L441/L480/L550/L582,
  > and a 40,032-byte file size where it is now 43,211. Same lesson as D-14: quote, do not cite
  > a line number, and re-measure before restating a size.


## Component map

| Path | Responsibility |
| --- | --- |
| `package.json` | npm root; `bin` map of four launchers plus `dsh.presetId` / `presetRoot` / `installTarget` |
| `README.md` | user-facing documentation, including the tool-cordis limitation section and the 验证状态 table |
| `bin/install.mjs` | copies `dsh-smith/` into the harness home; warns when the target lacks harness markers |
| `bin/verify.mjs` | mount check via `agentPresets.standingKeyFor(id)`; distinguishes MOUNTED / REJECTED / INCONCLUSIVE |
| `bin/lint-skills.mjs` | frontmatter lint over the five skills |
| `bin/drift-check.mjs` | row-by-row diff against the shipped `cordis` preset; reports, never syncs |
| `dsh-smith/agent.cordis.yml` | the composition under test (682 lines) |
| `dsh-smith/skills/**` | exactly five skills; two copied unmodified from the shipped `cordis` preset (with a correction banner), three original |

## Current state

The README's five "验证状态" gaps have measured answers. Four are closed; the fifth is closed
for a warm GUI process only. See `BOARD.md` for the objective and `DECISIONS.md` for the
settled questions.

| Item | Outcome |
| --- | --- |
| `expert_*` reach the model tool table | **Yes** — all four present, re-enumerated from a fresh root session of this repo after a harness restart, and again in the delegated children |
| The personas emit their contracted blocks | **4 of 4 measured, all yes** — `expert_architect` gave exactly `DECISION`/`BOUNDARIES`/`TRADEOFFS`/`RISKS`/`ACCEPTANCE`, `expert_chronicler` exactly `RECORDED`/`DERIVED`/`OPEN`, and this session `expert_verifier` exactly `VERDICT`/`FINDINGS`/`SURVIVED`/`GAPS` and `expert_protocol` exactly `ANSWER`/`EVIDENCE`/`CONFLICTS`/`UNKNOWN`. All four matched their persona text block-for-block in order, from the **final** message of each child. |
| `tool-cordis` landing in a cold process | **Never — decided, not just unobserved.** The row is `disabled` (not `inject`-gated), the predicate is true from host boot, so the row is skipped for the process's life. Measured again in a fresh post-restart session: zero `cordis_*` tools. |
| `package.json` valid under npm | **Yes** — `npm pack --dry-run` exits 0, but the packed set has **grown from 15 files / 56.3 kB to 19 files / 65.5 kB packed, 179.2 kB unpacked**, because `AGENTS.md`, `.gitattributes` and `docs/agent-notes/*.md` are now committed and nothing excludes them. See the gap below. |
| shields.io badge renders | **Resolves** — HTTP 200, an SVG labelled `topics` / `DeepSeek Harness Plugins` |

Also verified this session: `node bin/lint-skills.mjs` reports **all five skills lint clean**;
the installed preset was byte-identical to the repo copy at the revision this line was written
from (`A6D2A9C1…DE051`, 40,032 B — see the supersession note at the top of this section for the
current figures).

## Known gaps

- **CLOSED — the tarball no longer ships the memory layers.** D-7 added
  `"files": ["bin", "dsh-smith", "README.md", "LICENSE"]` to `package.json`, and it was
  measured: **14 files / 58.1 kB**, with `AGENTS.md`, all three `docs/agent-notes/*.md`,
  `.gitattributes` and `.gitignore` excluded, and nothing the preset needs dropped. Kept here
  rather than deleted because the paragraph below records what the exposure was and why a
  `files` list — not an `.npmignore` — is what closes it.

  > The superseded text, for the record: "The published tarball now ships the memory layers.
  > `npm pack --dry-run` lists 19 files including `AGENTS.md`, `.gitattributes` and the three
  > `docs/agent-notes/*.md`; `package.json` has no `files` allowlist, so npm falls back to
  > `.gitignore` (`gitignore-fallback`)." All of that was true before D-7.
- **The `cordis_*` tools are absent by design** (D-1), and the absence was confirmed against
  the live table rather than inferred. **CORRECTED — the advice this entry quotes has since
  been fixed, and the entry was describing a state that no longer exists.** The composition's
  tool-cordis comment used to say "Check which case you are in with `cordis_inspect_list`",
  which cannot be followed from a `dsh-smith` session because the tool it names is exactly the
  one the gate removes. That block was rewritten: it now says explicitly *not* to check with
  `cordis_inspect_list`, and directs the reader to a `cordis`-preset session instead. The
  citation to `agent.cordis.yml:670-671` was also wrong by the time it was read — the lines
  there are the section header, and the corrected text is further down.

  > **Line numbers in this file rot, and one of them rotted inside a single session.** Prefer a
  > stable anchor — a row id, a quoted phrase, a section title — over `file:line`, which is
  > invalidated by every edit above it. Quote enough text to locate the thing; cite the line
  > only when the line number is itself the fact under discussion.
- **`list_subagent_models` is absent because the opt-in is off, not because a row is missing
  — CORRECTED, and the earlier entry was wrong twice.** The mechanism half was right: the tool
  registers only when a model-selection policy resolves
  (`dsh-tool-subagent/lib/index.js:389`,
  `if (modelSelectionPolicy !== void 0) registerListSubagentModels(...)`), and that needs the
  Host-scope provider `@deepseek-ai/dsh-tool-subagent/model-selection-settings`. Two
  corrections: (a) that provider **is** mounted, by the **web-app** bundle
  (`dsh-web-app/cordis.patch.yml`) — the earlier check looked only at `dsh-base` and concluded
  from its absence there; (b) the failure mode is **loud**, not silent: a missing provider
  throws `tool-subagent: \`modelSelectionSettings\` requires … in the Host scope`
  (`lib/index.js:588`), and `lib/invariant.js:36-44` fails the step when a selectable tool
  exists without its projection. Measured on this deployment:
  `subagentModelSelection.current()` returned `enabled=false, allowedModels=[]`; after writing
  `subagent-model-selection: {enabled: true, allowedModels: [{provider: deepseek-official,
  model: deepseek-flash}]}` into `$DSH_HOME/settings.yaml` the same call returned `true` with
  one route (hot-reloaded); the file was then restored and it returned `false`. So
  `modelSelectionSettings: true` on the `subagent` row of `agent.cordis.yml` is **wired and waiting**, and
  `enabled`'s schema default is `false` (`lib/model-selection-settings.js:44`).
- **The optional rows stay absent by design**: `tool-bash` (non-Windows gate), `tool-cordis`
  (gate, see D-1), `tool-subagent-codex`, `tool-subagent-claude-code` (product providers that
  production `dsh` does not install). `subagent_codex` / `subagent_claude_code` are verified
  absent from the live table.
- **`@deepseek-ai/dsh-tool-subagent-report` is a broken junction** in this deployment
  (`node_modules/@deepseek-ai/dsh-tool-subagent-report` resolves to a missing target). Check
  `lib/` existence, not the directory entry, before planning against any package.
- **The installed DSH packages do not live in this repo.** `D:\DeepSeek Harness\node_modules`
  has no `@deepseek-ai` directory; every package read for this record came from the npx
  checkout (`C:\Users\曦曦\AppData\Local\npm-cache\_npx\1e7f6d9597241db0\node_modules\@deepseek-ai\`).
- The installed-copy hash is a **point-in-time** equality; it says nothing about whether the
  copy stays in sync after a later edit to `dsh-smith/**` without re-running `install.mjs`.

## Stale claims to re-check

- **The README's `cordis_*` claim was wrong and has been rewritten (this session's earlier
  revision).** The replacement — the row is skipped outright, so `dsh-smith` never provides the
  tools — matches the source and the live table.
- **An expert report is a source, not a finding.** The `expert_verifier` call this session
  returned `FINDINGS` whose headline defect was false: it asserted `maxDepth: 2` sits on "all
  four delegation/expert rows" and cited commit `8cf70e9` as proof. A re-grep of the same file
  **as it stood then (40,032 bytes; it is 43,211 now)** returns six `maxDepth` hits — L374 was
  the comment, L405/L425 the two correct rows, L412 an unrelated key, L592/L601 the two
  product-provider rows — and the four expert rows carry none; `8cf70e9` is two revisions behind
  the `HEAD` of that time. Its depth arithmetic was also wrong in the other direction (it
  proposed "lead + one child", i.e. two levels, where three are reachable). Both the false claim
  and the arithmetic were caught only by re-running
  the check — which is why this file records the re-grep, not the report.
- The `register()` doc comment in `dsh-cordis-host-runner/lib/types/inspect-registry.d.ts`
  line 38 says "returns idempotent disposer", which reads as "duplicate registration is safe".
  The implementation is precise about both halves: it **throws** on a duplicate id at line 732,
  and it **does** return a disposer at line 738 whose re-invocation is safe. "Idempotent"
  describes the disposer, not the registration. Trust the implementation over the summary.
- A persona's **interim** message is not evidence of its final shape: the expert call's interim
  summary opened `# 1. DECISION` with a condensed core, while its final report was exactly the
  five contracted blocks. Judge a persona's contract on the final report only.
