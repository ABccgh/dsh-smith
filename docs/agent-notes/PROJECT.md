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

- **The installed preset is byte-identical to this repo's copy.** SHA-256
  `A6D2A9C1F647E2EDCA9DA328CC780649CF80054A6293851B9F6A4C9FEE5DE051`, 40032 bytes, both
  at `dsh-smith/agent.cordis.yml` and at the installed path above. A session on `dsh-smith`
  is therefore running exactly this file, not a stale install.
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
  The census is a moving target — a later recount saw 117, the extra one being the delegated
  child session created during this session.

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
| `expert_*` reach the model tool table | **Yes** — all four present, enumerated from a live `dsh-smith` session |
| The personas emit their contracted blocks | **2 of 4 measured, both yes** — `expert_architect`'s *final* report was exactly `DECISION`, `BOUNDARIES`, `TRADEOFFS`, `RISKS`, `ACCEPTANCE` in order, and `expert_chronicler`'s was exactly `RECORDED`, `DERIVED`, `OPEN`. `expert_verifier` / `expert_protocol` were never called. |
| `tool-cordis` landing in a cold process | **Gated off in a warm process**, where the registry provably exists; cold start not reproduced |
| `package.json` valid under npm | **Yes** — `npm pack --dry-run` exits 0: 15 files, 56.3 kB packed / 154.0 kB unpacked, all four `bin` targets included and each beginning `#!/usr/bin/env node` |
| shields.io badge renders | **Resolves** — HTTP 200, an SVG labelled `topics` / `DeepSeek Harness Plugins` |

Also verified this session: `node bin/lint-skills.mjs` reports **all five skills lint clean**.

## Known gaps

- **The `cordis_*` tools are absent by design** (D-1), and the absence was confirmed against
  the live table above rather than inferred.
- **Cold start is unreproduced.** Every measurement here comes from one warm GUI process.
- **`expert_verifier` and `expert_protocol` have never been invoked**; their output contracts
  are unmeasured. (`expert_chronicler` is exercised by this report, but a persona judging its
  own contract is not independent evidence of it.)
- The optional rows stay absent by design: `tool-bash` (non-Windows gate), `tool-cordis`
  (gate, see D-1), `tool-subagent-codex`, `tool-subagent-claude-code` (product providers that
  production `dsh` does not install). `subagent_codex` / `subagent_claude_code` are verified
  absent from the live table.
- There is no `.npmignore`, so npm falls back to `.gitignore` rules (the `gitignore-fallback`
  warning in `npm pack --dry-run`).
- `@deepseek-ai/dsh-tool-subagent-report` is a **broken junction** in this deployment
  (`node_modules/@deepseek-ai/dsh-tool-subagent-report` resolves to a missing target). Check
  `lib/` existence, not the directory entry, before planning against any package.
- `modelSelectionSettings: true` on the generic `subagent` row (`agent.cordis.yml` line 403)
  depends on a host row the base composition does not mount, so `list_subagent_models` is
  expected never to appear. Unconfirmed — the live table was not enumerated against that
  expectation specifically.
- The installed-copy hash is a **point-in-time** equality; it says nothing about whether the
  copy stays in sync after a later edit to `dsh-smith/**` without re-running `install.mjs`.

## Stale claims to re-check

- **The README's `cordis_*` claim is wrong and needs rewriting (user's decision, not ours).**
  It says a `dsh-smith` session "gets `cordis_*` tools only if some other live composition in
  the same process already registered them". The source says the opposite in structure: the
  four *providers* (`Service`, `Event`, `Builtin`, `Tool`) are process-global and colliding,
  while the model-facing `cordis_*` *tools* are registered per session by this row's `apply`.
  A disabled row therefore yields no `cordis_*` tools in that session no matter what any other
  composition registered — which is exactly what the live table shows.
- The `register()` doc comment in `dsh-cordis-host-runner/lib/types/inspect-registry.d.ts`
  line 38 says "returns idempotent disposer", which reads as "duplicate registration is safe".
  The implementation is precise about both halves: it **throws** on a duplicate id at line 732,
  and it **does** return a disposer at line 738 whose re-invocation is safe. "Idempotent"
  describes the disposer, not the registration. Trust the implementation over the summary.
- A persona's **interim** message is not evidence of its final shape: the expert call's interim
  summary opened `# 1. DECISION` with a condensed core, while its final report was exactly the
  five contracted blocks. Judge a persona's contract on the final report only.
