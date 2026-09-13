# Board

## Objective

**Current: CK3 Wiki 镜像 —— CANCELLED and fully cleaned up（用户于本次会话取消，D-57）。**
交付物 `tools/ck3wiki/`（工具 + `falsify.mjs` + README）与知识库 `Crusader Kings III Wiki`
（`iYD6qed-…`，913 条）**两者都已交付**；本次按用户要求取消项目并做全面清理：删掉 934 个
生成物文件（19.41 MB，可重建）、5 个一次性/探针脚本与 `$DSH_HOME\profiles\web\` 的四个 CK3
脚本，**保留 8 个可重建语料与跑回归测试所必需的文件**（`git ls-files tools` 实测 8 条，**D-58**
订正了 D-57 的「9」；理由与全部实测计数见 `PROJECT.md`
该节的取消订正块与 **D-57**）。
**一处必须由用户手工完成、API 做不到的事**：ima 服务端那 913 条无法删除（该接口没有删除
端点），只能在 ima 客户端里手工删库。设计决策 **D-52**（URL 导入而非 Markdown 上传）、
**D-53**（converter 每作用域一个缓冲）、**D-54**（门绕过留在本地、不碰 `dsh-web-fetch-http`）
**保持不变**，其历史文本一字未改。

State, as of this writing:

| | |
| --- | --- |
| Converter | **sound** — 8 pilot pages pass every audit; 4 independent defects found by review and fixed; `falsify.mjs` pins all 4 and was validated in the negative |
| Extraction | **DONE** — 922 pages fetched, 0 fetch failures, 15.9 MiB, 482 s, 0 gate challenges in 980 requests; all 430 articles pass the audit at a median text recall of 0.99. **916 distinct files, all 916 verified against the manifest by digest** |
| Ingest | **DONE** — knowledge base `Crusader Kings III Wiki` (`iYD6qed-…`), 6 folders, 922 URLs submitted, **913 unique entries**, with the two causes D-57 records: the wiki's main page resolved to `CK3 Wiki`, **and 3 titles were duplicated across partitions** (`430−2=428`, `202−1=201`, i.e. ima kept one copy of each). *(The two causes do not arithmetically close the gap of 9 — open question 12.)* Coverage by URL slug: **429/430 articles, 100 % of the other five partitions** |
| Plugin | `dsh-ima-kb` gained **4** tools (`ima_import_urls`, `ima_upload_dir`, `ima_kb_create`, `ima_kb_mkdir`); 13 tools, 10 config keys, verified by `profiles/web/check-ima-kb.mjs` (stubbed services; **not** a Cordis-injection proof). Changes committed locally as `e300cca` |

**A defect found after "done", recorded because the check that finds it did not exist.** The corpus
had **922 manifest entries for 916 files**: `list=allpages` pagination returned six Template titles
twice, each was fetched twice, and the second write overwrote the first — so the manifest carried
two entries for one path whose `sha256` no longer matched disk. The **content was never wrong** (the
second fetch of a title is the same page); the **manifest was**. Repaired by `repair-manifest.mjs`
(one entry per path, every digest recomputed from disk, re-verified: **916 match, 0 mismatch**), and
`extract.mjs` now deduplicates titles before fetching and re-reads every written file to verify its
own manifest — so a rerun cannot reintroduce it. The lesson is the one this board already carries in
another form: **an audit that checks content quality will not notice a file that was never
distinctly written.**

**These three items were the milestone's open set; all three are now closed (D-57):**

1. **Title backfill: COMPLETE.** The two readings above (**85 → 104** of 913) were early
   samples. Measured at cancellation: **all 913 titles carry `<wiki title> - CK3 Wiki`**, including
   namespaced pages. The old number is a superseded reading, not an outstanding risk —
   `data/coverage.json`'s `backfilled: 220` is stale, must not be quoted — and the file itself is
   gone with `data/`, so it cannot be re-read at all.
2. **Two permanent leftovers in `曦曦的知识库` remain, and still no API can remove them:**
   `this-page-does-not-exist.md` and the 12 CK3 probe entries the architecture review wrote there
   (11 URLs + that file). Deleting the local mirror does **not** touch these — they are the user's
   to delete in the ima client, together with the `Crusader Kings III Wiki` knowledge base itself.
3. **The plugin repository is IN SYNC, and the push route that had never been proven has
   been proven.** Pushed with `bin/push-api-ref.ps1 -RemoteOnlyParent`
   (see **D-56**); `refs/heads/main` moved `4e2d9cc` → **`53a3f66`**, and the new commit
   **parents at `4e2d9cc`** so the move was a fast-forward. Verified *against the API*, not
   from the script's own report — remote tree **`ebdd375`** equals the local tree; one parent;
   **9 blobs identical to `git ls-files`**; no doubled path segments; the 18-line commit
   message intact. All five checks pass.

**Also done this session: all four owned repositories carry the `DeepSeek Harness Plugins`
topic**, with no existing topic dropped (`dsh-smith` 9, `dsh-account-balance` 7, `dsh-desktop`
1, `dsh-ima-kb` 1). Two measured facts from that, worth keeping: the topics **PUT rejects the
display form** `"DeepSeek Harness Plugins"` with `422 must start with a lowercase letter or
number` — the body must carry the normalised slug `deepseek-harness-plugins`, even though
GitHub renders it back with capitals; and `dsh-desktop`'s first write answered a bare
**HTTP 500** which succeeded unchanged on retry, so a 500 there is transient rather than a
validation problem.

**One credential-shaped finding, recorded because the next session will trip over it.** The
token supplied for this work was found in **`%APPDATA%\DSH Desktop\Partitions\dsh-desktop\
Local Storage\leveldb\000025.log`** — the user's own **typed draft** of the request, which the
Web GUI persists as browser Local Storage. It was **not written by any command here**: every
call passed it through `$env:GH_TOKEN` in a child process, and a search for the token's
distinguishing fragment across `D:\DeepSeek Harness`, `$DSH_HOME`, `%TEMP%` and `%APPDATA%`
found it in that one file and nowhere else. **The harness's own stores are clean:** 178 session
and 178 storage files were scanned and matched nothing, and session logs are zstd-compressed
in any case. **Deliberately NOT cleaned:** the file is held open by four live `DSH Desktop`
processes, and editing a locked LevelDB is how an application's storage gets corrupted — so
the correct action is the user's, in the app, and the effective one is **revoking the token at
GitHub**, which invalidates it everywhere at once.

Everything below is the pre-existing objective of this repository and is unaffected.

Two presets ship from this repository — `dsh-smith` (builds harness agents and Cordis plugins)
and `dsh-forge` (software delivery) — and those two directories are the whole owned surface
(`AGENTS.md` rule 7). What is open, and nothing else:

0. **GitHub integration: CANCELLED and fully torn down (D-51) — this is closed, not pending.**
   The user cancelled the project, so the deployment no longer carries it: **no**
   `webhook-runtime` / `webhook-github` / `github` rows, **no** `$DSH_HOME/plugins/dsh-github`,
   **no** `GITHUB_WEBHOOK_SECRET` or `GITHUB_TOKEN` ref, `/github` unrouted, the user-level
   `NODE_OPTIONS` reverted, and the desktop launcher deleted. D-47–D-50 are superseded by D-51 but
   **deliberately retained**, and `PROJECT.md`'s GitHub section is banner-marked as non-current.
   **What survives, because none of it is GitHub-API-specific:** `bin/check-pack.mjs` +
   `.github/workflows/checks.yml` (they guard *this* repo's published tarball), the
   `-RemoteOnlyParent` / empty-range fixes to `bin/push-api*.ps1` (they close D-45), and the
   machine-level measurements (`405` is a false positive; `git clone` fails with
   `CRYPT_E_NO_REVOCATION_CHECK` while the HTTPS API works; a quick tunnel's hostname changes on
   every restart). **Do not rebuild it without reading D-47–D-50 first** — with
   the plugin's own README deleted, those entries are now the only copy of that reasoning.
   **Two artifacts that this list previously counted as survivors were removed in D-57, because
   they did not survive after all:** `github-gate.mjs` at the repo root (it forwarded `POST
   /github`, a route that no longer exists — dead by construction, not by choice) and
   `.gitignore`'s `github-worktrees/` rule (dead config: the directory it guarded is absent from
   disk). Both were deleted; the gitignore change left a one-line note saying why.
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
3. **The local commits are unpushed.** A workspace fact, not a preset defect. **This repo right
   now:** `origin` is configured (`github.com/ABccgh/dsh-smith`) and `main` has **no upstream**
   (`git rev-parse main@{upstream}` → *no upstream configured*), so the four commits this session
   made — `e3ec4a4`, `a980f67`, `0016c18`, `b6ecb19` — are local-only; the remote's state was
   **not** queried, because git's transport is dead from this machine (below). **The push-tooling
   gap is CLOSED *and now measured*:** `bin/push-api-ref.ps1` gained `-RemoteOnlyParent` for a
   range whose first parent exists only on the remote and `bin/push-api.ps1` errors cleanly instead
   of crashing on an empty range (**D-48**), and the flag's happy path was then pushed for real,
   with five checks taken **against the API** (**D-56**) — the "unproven in a real push" reading
   this item used to carry is superseded.
4. **Outside the repository — the `dsh-ima-kb` mount check is DONE** (open question 8, D-40): six
   presets `MOUNT OK`, `dsh-ima-kb` in none of the 160 preset rows, and `ima_kb_list` present in a
   live session's tool table. **Question 9 is closed too, for `ima_kb_list`'s live path** (D-44): a real
   session's call returned 7 knowledge bases, which `standingKeyFor` could not have shown. What survives
   is narrower and is recorded in `PROJECT.md` — eight of the nine tools are not production-verified,
   including the other three read tools. Nothing under `D:\DeepSeek Harness` is blocked by it: the plugin
   is not in this tree.
5. **The D-46 gap — still a gap, but its record defect is fixed.** The two `push-api` bullets in
   `AGENTS.md` (the `parents`/`if` bullet and the `auto_init` bullet) and `PROJECT.md:426` all cite
   **D-46**, and `DECISIONS.md` has no such entry: its `## D-<number>` headings run 1–27 and
   30–**57** (55 entries plus the note), skipping **28/29** (deliberately absent, explained
   in-file) and **46**. Those citations are **pre-existing**; the session that recorded this did not
   delete the entry and could not see what happened to it, so **D-46 stays unassigned rather than
   invented**. The line numbers this item used to name — `AGENTS.md:233,251` — rotted, and moved
   again during this very pass, which is why it now names the two bullets instead of their lines.
   **What was fixed:** the explanatory note had been headed `## D-46 is cited elsewhere but is NOT
   in this file`, which **matched the `## D-<number>` entry pattern** — so a search for entries
   reported D-46 as present when only the note was. It is now headed `## Note, not an entry: the
   D-46 gap`, making D-46 cleanly absent to any pattern-based lookup. Do not renumber or "restore" it.

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
| — | — | No verification is in flight. A snapshot; date it if it stops being true. |

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
| 15 | Should this repository carry anything other than presets, and should the profile's balance bundle stay? | **No to carrying plugins, and the bundle was removed — then the user asked for a balance badge and got one this session.** | The first two steps were the user's call. The repo's fork was deleted with its records after it turned out never to have been mounted (its own route still answered 404). The community bundle the profile actually loaded was removed with the sanctioned writer — `dsh plugin --profile web remove dsh-deepseek-balance`, exit 0 — which reconciles `dsh.profile.bundles` itself (`dsh/lib/plugin-Ddi42qoW.js:46-78`), so the layer list is not left pointing at an unresolvable package (a boot failure per `dsh-app-boot/lib/index.js:831`). **Then the user asked for the GUI to show the balance**, so a from-scratch plugin was written — not restored from either removed artifact. Current state, re-measured for this row: bundles are still `dsh-base` + `dsh-web-app`; `dsh --profile web --dump-config` composes one balance row, `id: account-balance` / `name: dsh-account-balance`; the profile's dependency is `dsh-account-balance: link:…/.dsh/plugins/dsh-account-balance`; and there is **no** `dsh-deepseek-balance` reference anywhere. The plugin lives **outside** this repository, which is why the two-directory surface in `AGENTS.md` rule 7 is unchanged. |
| 16 | Does the `dsh-ima-kb` row *contribute*, or is it merely mounted? | **It contributes — measured live for `ima_kb_list`, and only there** | An **ordinary session's** `ima_kb_list` call returned **7 knowledge bases**, matching the building session's independent reading exactly in set and in membership counts. The check script stubbed `credentials`, so it never exercised **Cordis service injection** — the one failure this class hides. The other eight tools are not covered; per-tool boundary in `PROJECT.md`. D-44. |
| 17 | Do the two shipped webhook packages need `dsh plugin add` to be usable as rows? | **No — both resolve by row name already** | Importing `@deepseek-ai/dsh-webhook` and `@deepseek-ai/dsh-webhook-github` **by name from the profile directory** returned their full export lists, which is the resolution the loader itself performs (`cordis-plugin-loader/lib/index.js:279-282`, `baseUrl` anchored at the profile). The mechanism is `$DSH_HOME/profiles/node_modules` being maintained as a mirror of the installation's dependency closure. Only the new plugin needed the sanctioned writer. |
| 18 | Does `POST /github` answering `405` mean the route is mounted? | **No — it is a false positive** | The web-app's fallback seat answers an *unmatched* path with the same `405`, so `POST /github` and `POST /definitely-not-a-route-xyz` are byte-identical while the route is absent. **Both were probed.** The discriminator is `503` (mounted, secret unresolvable) versus `401` (secret present, signature wrong), because the adapter resolves the secret before verifying the HMAC (`dsh-webhook-github/lib/types/handler.js:75-78`). D-47. |
| 19 | Does the GitHub ingress actually create a session? | **Yes — measured, and the PROMPT was admitted too** | A locally signed POST answered `202`; the store then held `webhook-a627e8f0-…` with `cwd` = the fetched checkout, `agentPreset: dsh-forge`, `delegationDepth: 0`. The session log is header-only, so the **projection** was read instead: `permissions.preset: workspace-write`, `modelSelection` `deepseek-flash`/`max`, `sessionStats.turns: 1`, **non-zero `tokenUsage`**. A non-zero token count is stronger evidence than a text search, because it proves the prompt was processed rather than merely stored. D-47. |
| 20 | Does `git clone` work on this machine? | **No — and that changed the design** | `schannel: next InitializeSecurityContext failed: CRYPT_E_NO_REVOCATION_CHECK (0x80092012)`, the same revocation-endpoint defect this file already records for `git push`. GitHub's HTTPS API and **codeload are reachable where git's transport is not**, so the rule's checkout fetches a tarball over `fetch` and extracts it in-process, with `git clone` kept only as a fallback. Measured: 9 files in 755 ms, reuse on the second call, path-escape guards all false for `..`, absolute, and backslash entries. D-47. |
| 21 | Is the new tarball guard real, or does it just always pass? | **Real — falsified and repaired** | On a **copy** in `%TEMP%`: dropping `dsh-smith` from `package.json`'s `files` produced **PACK FAILED, 4 findings**; restoring it produced **PACK OK**. Dropping `bin` produced PACK OK **and that is correct** — npm force-includes whatever the `bin` map names, so the first falsification attempt was itself wrong, not the guard. D-48. |

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
6. **OPEN, new — does a session served by `dsh-smith` have `run_code` and the `tools:sdk` section?**
   Three artifacts were read this session and they disagree, so no cause is asserted here.
   `docs/dsh-smith.md` contains no `run_code` mention; both preset compositions declare **no**
   `code-runtime` row (`dsh-smith/agent.cordis.yml`, `dsh-forge/agent.cordis.yml` — the latter only
   *recommends* adding one, in a comment); yet the session that wrote D-30 had `run_code` in its own
   tool catalog and a `Program-only SDK bindings:` block in its own prompt. Both **installed** preset
   copies are byte-identical to this repo (`77E34CB76EF2B41D`, `C8353AF1D7B05193`), so this is **not**
   hand-edit drift under rule 6. The probe is a runtime read of the mounted preset — `agentPresets`'
   projection, per rule 2 — and it is **not runnable from this session**. Until it runs, the honest
   statement is "these three artifacts disagree", never "a different preset served the session": that
   inference is exactly the trap D-4 records.
7. **OPEN, new and standing — who pushes the balance plugin now that it has its own repository?**
   Its working tree is the directory the deployment loads, so a code change there takes effect on the
   next `dsh web` restart *without* any git action, and the GitHub repository drifts silently until
   someone pushes. There is **no** CI, no submodule, and no watcher by design (D-33). Pushing means
   the two-step route in `AGENTS.md`'s boundaries — `git push` does not work on this network — and
   that route is not reachable from the plugin's own directory, so it has to be driven with
   `-RemoteRepo dsh-account-balance`. The cheap check that the two agree:
   `git -C $DSH_HOME/plugins/dsh-account-balance status --porcelain` is clean **and** the remote tip's
   tree equals `git rev-parse HEAD^{tree}` — the same tree comparison every other push here uses.
8. **CLOSED — does `dsh-ima-kb` mount, and do its tools reach a session's tool table? YES to both.**
   The user drove the dynamic-plugin probe themselves from a session on the shipped `cordis` preset
   and pasted the **raw runtime output** (contract query → `cordis_define` → `cordis_run` → call →
   values). Six presets — `standard`, `ptc`, `minimal`, `cordis`, `dsh-forge`, `dsh-smith` — returned
   **`MOUNT OK`, zero failures**, with the four documented failure shapes all absent.
   `compositionInventory` answered from **live Loader entries** (6 presets, **160 rows**, every
   `broken` null; `fiberState === 2` on every enabled row), and **`dsh-ima-kb` is in none of the 160**
   — the direct confirmation that it is a host-plane row, with `agent-preset/not-found` as the control
   when it is passed as a preset id. The other half is the user's own live reading: a fresh session's
   tool table **contains `ima_kb_list`**. See **D-40**. `bin/verify.mjs` was **not** run, correctly —
   it builds a bare Context and could only print INCONCLUSIVE (D-24).
9. **CLOSED for `ima_kb_list`'s live path — does any *individual row* contribute? YES, measured live.**
   The user asked an agent in an **ordinary session** to call `ima_kb_list`; it returned **7 knowledge
   bases**, matching the building session's independent reading exactly in set and in membership counts.
   That is the first and only evidence that, in the real runtime, the row's `apply` ran, Cordis resolved
   the injected `credentials` and `tools` services to host instances, the reference resolved from
   `$DSH_HOME/.credentials.yaml` **through the seam**, the HTTP call to `ima.qq.com` was answered, and the
   response reached the model as text. **Why the earlier checks could not have caught this one:** the
   building session's check script **stubbed `credentials` by hand**, so **Cordis service injection was
   never exercised** — a tool that registers but cannot resolve `ctx.credentials` passes `standingKeyFor`,
   `preflight` and `verify.mjs` alike and is still inert. **The surviving gap is per-tool, not per-row**:
   see `PROJECT.md`'s ima subsection for the live-vs-stubbed split across the nine tools.
   > **Do not re-open this as "does the row contribute".** What is unmeasured is narrower and named in
   > `PROJECT.md`: `ima_import_url`, `ima_upload_file`, `ima_note_create` / `get` / `list`,
   > `ima_kb_search`, `ima_kb_browse` and `ima_media_info` have **no** live measurement — the check
   > script that exercised them stubbed the seam. All nine share the credential seam; each one's own
   > endpoint and write path does not inherit this verdict. See **D-44**.

10. **CLOSED — the balance row's "host half needed a restart" claim is superseded, and it was measured
    rather than argued.** Three readings, all reproduced independently on this record's behalf:
    PID **15116** (`node`) started **2026-09-12 10:17:17** and **owns the listener on `127.0.0.1:3080`**;
    `profiles/web/cordis.patch.yml` was last written **2026-09-12 10:12:46**, i.e. **4m31s before**
    that process started, and it carries **both** the `account-balance` and `ima-kb` rows; and
    `GET /api/balance` on 3080 answers **401**, so the route is registered and live in that process.
    The process came up with the row already present — the **same evidence shape as the ima case**
    (D-42), now evidenced twice. See **D-43**. Kept distinct there: the restart requirement is
    *certainly false*; the three readings are what was *measured* (401 proves reachability, **not**
    correct answers — the 200-with-cookie case lives on 3081 and was not re-measured); and
    `patchReload: "live"` is the *inferred* mechanism, **not isolated**. The original clause may simply
    have been wrong when written — there is no process history before 10:17:17, so it is superseded as
    current advice, not rewritten as a mistake with a known cause.

11. **LIVE ARTIFACT, outside this repo — `dsh-ima-kb` is published, REWRITTEN, and it now carries the
    same standing drift risk as the balance plugin (item 7).** `https://github.com/ABccgh/dsh-ima-kb` —
    public, branch `main`, **two commits, and the auto_init bootstrap commit is now nowhere in its
    ancestry.** The repository was **deleted and re-created** (`auto_init: true`) and the history
    re-uploaded as a **root + child**, with the ref force-moved; **re-measured here** by querying the
    GitHub API myself, not restated from the pushing session's report:
    - tip **`4e2d9cc68a6e8f8a4f41ca2de1a203293b45e6b4`** ("docs(readme): 开头那句工具数从 5 改成 9"),
      **1 parent** = the root;
    - root **`28d22d13fc63cddf618bea8d3673003f9b81ad3e`** ("feat: 腾讯 ima 知识库接入 DSH（9 个工具）"),
      **0 parents**, tree `9eb29b2`;
    - tip's tree **`9df69b5b633be520aa89ffa0200e222d1dc4b04c`**, which **equals
      `git rev-parse HEAD^{tree}` in the plugin's working tree** — the strong form every push here is
      checked by;
    - the recursive remote list is **9 blobs** plus the `lib` tree object, matching the local
      `git ls-files` **exactly**, so no path segment is doubled (`node_modules/` untracked).

    **The earlier pair `208e9d0…` (tip) / root is superseded and is history, not current state** — it
    is the *remote* pair that the rewrite replaced, and the only remaining mentions of it are the
    historical entries in this file, `PROJECT.md` and `DECISIONS.md` (**D-45 alone still carries it as
    current**, and append-only forbids editing it; the current answer is here and in D-46). The
    **local** history is a different pair again — `6c1324a` then `8b9719b`, whose SHAs are not the
    remote's, while `8b9719b`'s tree still equals the remote tip's tree. **The resync is clean**
    (re-measured here): `git status --porcelain` in the plugin's working tree is **empty**. See
    **D-46**. **The risk, stated the same way as item 7:** that working tree
    (`$DSH_HOME/plugins/dsh-ima-kb`) is the directory the deployment loads, so an edit there changes
    behaviour with **no git action at all**, while the GitHub copy drifts silently until someone
    pushes; there is **no CI, no submodule and no watcher, by design** (D-33). Cheap check that the two
    agree: `git -C $DSH_HOME/plugins/dsh-ima-kb status --porcelain` is clean **and** the remote tip's
    tree equals `git rev-parse HEAD^{tree}` — the same comparison every other push here uses.
    **Push is not reachable from a normal session here, and that is now measured rather than assumed:**
    the local history's root has no local ancestor, and **neither** `bin/push-api.ps1` nor
    `bin/push-api-ref.ps1` can push a commit whose parent exists only on the remote — `-AllowUnrelated`
    does not override the pairing refusal. The route that worked was a **scratch API push**
    (`%TEMP%`, deleted, and deliberately **not** committed to any repository); its shape is recorded in
    prose in **D-45**, and the scripts themselves were **not** modified. Nothing under
    `D:\DeepSeek Harness` is blocked by any of this: the plugin is not in this tree, and a re-measure
    here confirmed **zero** ima-shaped tracked paths in it.

> **Correction to the earlier version of item 8, recorded because it was wrong and a reader may still
> hold it:** the previous text said confirming the tools reach a live tool table **does need a `web`
> profile restart**. That is **false and superseded** (D-42). No restart was needed, and one would
> have **terminated the session serving the user**. Do not repeat the old phrasing.

> **Carried open earlier this session and now CLOSED as harmless, recorded so it is not re-opened.**
> The worry was that the running harness holds an in-memory credential snapshot and could rewrite
> `$DSH_HOME/.credentials.yaml` on an unrelated write, dropping the two new `refs:` keys the plugin
> depends on. Measured after all the plugin work: the file still holds **all three** refs —
> `DEEPSEEK_API_KEY`, `IMA_OPENAPI_APIKEY`, `IMA_OPENAPI_CLIENTID`. No guard is needed. Unlikely and
> unmeasured was the right way to hold it; **measured harmless** is the right way to record it.

> **Two side effects this milestone left in the user's ima account, which only the ima client can
> undo** — the OpenAPI has no delete endpoint at all (D-39): **5** notes titled 「DSH × ima 联调记录」
> and the file `dsh-ima-upload-probe.md` in `曦曦的知识库`, plus an earlier URL import of
> `https://github.com/deepseek-ai/deepseek-harness` into the same knowledge base. The user has been
> told. The note count was first reported as 3 and the measured figure is 5.

12. **CLOSED — the `922 → 913` reconciliation DOES close, and the check was already run (D-59).**
    Reading **(ii)** is the right one, and it is now proved rather than inferred:
    **`922 (listings) − 6 (Template titles `list=allpages` returned twice) = 916 (manifest rows);
    916 − 3 (distinct URLs duplicated across partitions) = 913 (knowledge base).**
    The proof is a comparison already in the record, not a new experiment: at planning time the KB
    was enumerated **live, per partition, with 22 paged calls** — `428 / 4 / 12 / 20 / 248 / 201` —
    and the manifest's partitions are `430 / 4 / 12 / 20 / 248 / 202`. **Four of the six partitions
    agree EXACTLY**, including `ns10 = 248` on both sides, which is what places the six Template
    dedupes *before* manifest time and therefore rules out reading (i). The two that differ are
    exactly `00_Articles` (−2) and `50_Categories` (−1) — sum **3**, precisely the three
    duplicate-URL keys D-57 names (`Crusader Kings III Wiki:Style`, `…:Versioning`,
    `Dragon Age: Thedas at War`), each of which sits in one of those two partitions.
    So the gap of nine decomposes **6 + 3**, both terms accounted for, and **922 was a
    fetch/listing count, never a submission count**. The earlier "possibly unanswerable
    from now on" verdict was wrong: the evidence needed was a live per-partition enumeration,
    and that had already been performed and written down before the corpus was deleted.

## Next

0. **CK3 milestone — CANCELLED, cleaned up and CLOSED (D-57); nothing of it is pending work
   here.** Extraction, ingest, the plugin push and the repository topics were all finished and
   verified, and the cancellation has since removed the generated corpus. What is left is not work
   in this workspace:
   (a) the **title backfill is COMPLETE** — the `85 → 104 of 913` readings are superseded (all 913
   titles carry `<wiki title> - CK3 Wiki`, measured before the deletion; item 1 above), and the
   re-run instruction is dead with its tool: `coverage-ck3.mjs` was one of the four `profiles/web`
   CK3 scripts deleted, and the `data/` it read no longer exists. The COUNT stays settled at
   **913** — see open question 12 on how the causes for it add up;
   (b) the 13 leftover items in `曦曦的知识库` are the user's to delete in the ima client — no API
   can remove them;
   (c) `tools/ck3wiki/` is **tracked, not untracked** (`0016c18`, **8** files — D-58 corrects
   D-57's "9"): the generated `data/` is gitignored **and deleted** (`node tools/ck3wiki/extract.mjs`
   rebuilds it), and the directory stays out of the tarball because it is not in `package.json`'s
   `files`.
   **Two lessons worth keeping from this milestone.** *On the ima API:* a **403 is the rate
   limiter, not a dead credential** — proven by an authenticated read succeeding immediately
   after, and by the knowledge base reporting exactly the count the local run had recorded. Add
   spacing and back off; do not go looking for a new key. *On this machine's push route:*
   `-RemoteOnlyParent` **works in a real push** (D-56), and the pushing script runs git against
   **its own cwd** — so it must be invoked with the working directory set to the repository being
   pushed, and `-Base` must be a **full SHA**.
1. ~~Open a new session on 「DSH 研发工坊 · DSH Forge」 and work the three-item checklist~~ —
   **done.** All three closed in `session-8b8072a6`, at a preset whose file hash matched the repo
   copy. `docs/dsh-forge.md` now records the measurements under 三项的实测结果, and its checklist
   is kept as the source of the criteria rather than as pending work.
2. Keep `AGENTS.md` rules 5, 6, 7 and the boundaries current: the mount check needs the shipped
   `cordis` preset, `verify.mjs` is a diagnostic, the two owned preset directories are written
   only through `bin/install.mjs --preset <id>`, and those two directories are the whole owned
   surface — a plugin is a different kind of thing and is never installed with `bin/install.mjs`.
   **Added this session:** rule 7's balance parenthetical now says explicitly that the history it
   records does *not* forbid the feature, because a from-scratch plugin was written and mounted
   after the removals it describes. Read that paragraph as history, not as a standing ban.
3. **Count with the tool's own semantics before publishing a breakdown.** Two counting paths in
   `dsh-agent-presets` skip group containers; this session published three wrong numbers from
   grepping the file directly (D-22, D-25). When a document states a decomposition, parse it or
   print it — do not derive it from a total.
4. **A child's self-reported list is a transcription, not a reading** (D-27). The filtered child
   dropped `ralph` from its prose while the runtime array held it, and misquoted a type alias. Have
   the runtime print the array and compare against that.
5. **When a report is captured, record the revision it was taken at, and re-measure before
   restating any number from it** (D-14, D-16).
6. **A test that passes is a claim about what it asserted, not about what it named.** This session
   produced three examples in one file: the empty-state assertion used `/\d/` and tripped on the
   clock in the same tree; a "stored layout" case seeded `localStorage` *before* the browser
   globals were reinstalled and was silently discarded; and the first version of the client suite
   rendered the *loading* state while claiming to test the empty state. All three were caught only
   by reading the failure output, not by the suite going green.
