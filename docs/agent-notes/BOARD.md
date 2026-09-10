# Board

## Objective

Finish the verification the README's 验证状态 section promises, then let the user decide the
documentation rewrite. Four of five gaps now have measured answers; the fifth is measured only
in a warm process.

## In progress

| Role | Child id | Question |
| --- | --- | --- |
| `expert_architect` | `b57ca14f-b0a7-4f0e-b6da-3db360e5ac29` | **Done** — final report matched its contracted blocks; the child session its call created is the evidence for preset inheritance. |
| `expert_chronicler` | (this turn) | Fold this session's verified findings into the layers, and serve as the live test of the chronicler persona's three-block contract. |

## Settled this session

| # | Item | Status | How it was established |
| --- | --- | --- | --- |
| 1 | `expert_*` reach the model tool table | **Yes** | The live session's own tool table holds all four `expert_*`, plus `subagent` / `subagent_fork`, and lacks `subagent_codex` / `subagent_claude_code` exactly as their `disabled: true` rows predict. Preset declares the `toolName:` values at `agent.cordis.yml` lines 402, 423, 433, 471, 523, 554, 590, 599 (verified by grep). |
| 2 | Personas emit their contracted blocks | **1 of 4 measured** | `expert_architect`'s final report was exactly `DECISION` / `BOUNDARIES` / `TRADEOFFS` / `RISKS` / `ACCEPTANCE` in order. `expert_verifier` and `expert_protocol` were never called; `expert_chronicler` is under test by this report and cannot independently certify itself. |
| 3 | `tool-cordis` in a cold process | **Warm process answered; cold unreproduced** | No `cordis_*` tool appears in the live table. The registry is built inside `DynamicCordisRunnerService` (line 1598), whose host row is unconditional and never disposed — so the gate is true for the process's whole life on this deployment. |
| 4 | `package.json` valid under npm | **Yes** | `npm pack --dry-run` exits 0: 15 files, 56.3 kB packed / 154.0 kB unpacked, all four `bin` targets included, each with a `#!/usr/bin/env node` shebang. Only warning: `gitignore-fallback`. |
| 5 | shields.io badge renders | **Resolves** | HTTP 200, SVG labelled `topics` / `DeepSeek Harness Plugins`. Browser fidelity unprovable from here; the URL is not broken. |
| — | `bin/lint-skills.mjs` | **Clean** | Reports all five skills lint clean. |

## Open questions

1. **Does the `cordis_*` absence survive a cold start?** The gate
   `ctx.get('cordisInspect') !== void 0` is true for the life of a web-app process; an
   environment without the host row would leave the row *waiting* on its declared `inject`
   rather than activated. **Resolved by:** restart the harness, open one fresh `dsh-smith`
   session, call `cordis_inspect_list` (or enumerate the tool table) — one check answers both
   this and whether the tools can ever appear here.
2. **Was `tool-cordis` ever active in any session on this machine?** **Not answerable from
   logs** — every `sessions/**/session*.jsonl.zstd` holds only a session header, so any
   conclusion from grepping them is void. Only a fresh live session can answer it.
3. **Do `expert_verifier` and `expert_protocol` emit their contracted blocks?** Never
   invoked. **Resolved by:** one cheap call to each, then compare the final report's blocks
   against the persona text. An interim message is not evidence.
4. **Does `list_subagent_models` exist?** `modelSelectionSettings: true` on the `subagent`
   row (`agent.cordis.yml` line 403) depends on a host row the base composition does not
   mount. **Resolved by:** enumerating a live tool table against that expectation.
5. **Refcount or frozen first registration as the upstream fix?** See D-2. The architect
   recommended a refcount; no `refcount` / `refCount` token exists in
   `dsh-cordis-host-runner/lib/index.js`, and its dispose-at-zero branch could remove a
   provider a live tool still needs. **Resolved by:** a stated provider-lifetime rule, which
   is a design choice, not a measurement.
6. **Should the README's `cordis_*` claim be rewritten?** **DECIDED — yes, and done.** The
   user authorized it, and the lead session of this repository (the one that built the preset,
   not the session that wrote this board) replaced the section. The correction was structural,
   exactly as this board's evidence said: the four *providers* are process-global and
   colliding, the seven *tools* are registered per session by the row's `apply`. The rewritten
   README also records that the gate is true for the **life of the process** (a lifetime
   argument, from the constructor at `dsh-cordis-host-runner/lib/index.js:1598`), so a
   `dsh-smith` session never receives `cordis_*` — not "sometimes", never.

   > **Lesson worth keeping.** This entry said "user's decision — do not edit `README.md` from
   > here", and that was correct for *this* session to conclude: the decision needed a human.
   > It was a boundary between sessions, not a permanent block, and once the human gave the
   > answer the edit belonged to whoever held the authorization. A board note that says "do
   > not" should also say **who may**, or the next session reads it as a wall.

## Next

1. Close open question 3 — one cheap call each to `expert_verifier` and `expert_protocol`,
   then compare the FINAL report's blocks against the persona text.
2. Close open question 1 — restart the harness, open one fresh `dsh-smith` session, and
   enumerate its tool table. The lifetime argument says nothing changes; confirm it.
3. Open question 2 is **answered and closed**: session logs cannot answer it at all. A census
   of all 93 `sessions/**/session*.jsonl.zstd` decoded header-only, with a working control
   (`agentPreset` is present in the header of every one). Grepping them proves nothing.
4. `docs/agent-notes/**` and `AGENTS.md` are now committed to this repository, so the memory
   layers travel with the code they describe. Keep them that way: a memory layer that only
   exists on one machine is not durable memory.
