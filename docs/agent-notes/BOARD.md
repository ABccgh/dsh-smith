# Board

## Objective

The README's 验证状态 section is now fully backed: five of five gaps measured, and the two that
were previously "unreproduced / unmeasured" are closed by **mechanism** as well as observation.
What remains open is one question for the human (the tarball's contents, D-6).

## In progress

| Role | Child id | Question |
| --- | --- | --- |
| — | — | Nothing delegated; no expert call is outstanding. |

## Settled this session

| # | Item | Status | How it was established |
| --- | --- | --- | --- |
| 1 | `cordis_*` absent in a fresh process | **Never, by mechanism** | The row is `disabled` (a skip, not a wait) with no `inject:` at all, and the registry exists from host boot — so this preset is never the one that registers the tools. Re-measured after a harness restart: zero `cordis_*`. See D-3. |
| 2 | `expert_verifier` / `expert_protocol` block contracts | **Both yes** | One call each; the final messages were exactly `VERDICT`/`FINDINGS`/`SURVIVED`/`GAPS` and `ANSWER`/`EVIDENCE`/`CONFLICTS`/`UNKNOWN`, in order, matching the persona text at `agent.cordis.yml:499-505` and `:538-543`. All four experts are now measured. |
| 3 | `list_subagent_models` exists? | **No — explained** | It is registered only when a model-selection policy resolves, which needs the **Host**-scope `…/model-selection-settings` provider the base composition does not mount. `modelSelectionSettings: true` at L403 is inert here. |
| 4 | Does omitting `maxDepth` inherit the team cap? | **No — defaults to 3** | Schema `.default(3)` is applied by Cordis before `apply`; the expert rows omit the key, so 3. Reachable chain is 3 levels (lead 0 → expert 1 → helper 2). See D-5. |
| 5 | Which preset actually served this session? | **`dsh-smith`; the header is unreliable** | Header says `standard`, its own children say `dsh-smith`, and the shipped `standard` has no `expert_*` row. The projection, not the header, is authoritative. See D-4. |
| — | `expert_verifier` report accuracy | **Headline finding false** | It claimed `maxDepth: 2` on all four expert rows and cited a two-revisions-stale commit. Re-grep: six hits, none on an expert row. Its replacement depth arithmetic was wrong in the other direction. |
| — | Tarball contents | **Drifted: 15 → 19 files** | `npm pack --dry-run` reproduces 19 files / 65.5 kB, including `AGENTS.md` and all three `docs/agent-notes/*.md`. |

## Open questions

1. **Should the npm tarball ship the memory layers?** Currently it does, by accident of having
   no `files` allowlist. D-6 recommends git-only. **This one needs the human** — it is a
   publish-surface choice, not a measurement.
2. **Refcount or frozen first registration as the upstream fix?** See D-2. The architect
   recommended a refcount; no `refcount` / `refCount` token exists in
   `dsh-cordis-host-runner/lib/index.js`, and its dispose-at-zero branch could remove a
   provider a live tool still needs. **Resolved by:** a stated provider-lifetime rule, which is
   a design choice, not a measurement.
3. **Should `agent.cordis.yml:670-671` stop telling sessions to run `cordis_inspect_list`?**
   The line names as the check exactly the tool the gate removes. Low stakes, one line, and it
   is the preset's own text — so it is a preset edit with the usual mount validation, not a
   finding anyone needs to re-derive.

## Next

1. Ask the human about D-6 (tarball contents), then either add a `files` allowlist or record
   shipping the notes as deliberate.
2. If the comments are to be corrected: `agent.cordis.yml:374-376` labels the reachable depths
   1/2/3 where the arithmetic gives 0/1/2, and `:670-671` names an unusable instrument. Both are
   text-only row comments — edit `dsh-smith/**`, mount-validate with `bin/verify.mjs`, then
   re-install with `node bin/install.mjs` (never hand-edit the installed copy).
3. `docs/agent-notes/**` and `AGENTS.md` are committed, so the layers travel with the code.
   Keep them that way, and keep them out of the published tarball unless that is chosen
   deliberately (see 1).
