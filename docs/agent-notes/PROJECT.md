# DeepSeek Harness (package `dsh-smith`) — chronicle

> **Scope note, added when the second preset shipped.** Everything below this note is the
> `dsh-smith` preset's record and stays scoped to it. `dsh-forge` — the software-delivery
> preset added later — has its own subsection under `## Current state` and its own user-facing
> page at `docs/dsh-forge.md`. Where a sentence here says "this preset" without naming one, read
> it as `dsh-smith`; the two presets have **different lineages** (`dsh-smith` ← shipped `cordis`,
> `dsh-forge` ← shipped `standard`), so any statement about drift, inheritance, or a shared row
> applies to one of them, never to both.

## What this is

`dsh-smith` is a DeepSeek Harness **agent preset**, published as the npm package `dsh-smith`.
The npm package root, the git root, and this memory root are the **same directory**,
`D:\DeepSeek Harness`; the preset source directory is `D:\DeepSeek Harness\dsh-smith\`, and
`node bin/install.mjs` copies it to `${DSH_HOME}/.agent-presets/dsh-smith/`. (The working
directory of a session in this tree is spelled `--D-DeepSeek~0020Harness--` in the sessions
store; that is a path encoding, not a second project.)

### How a push actually gets out of this machine (measured, end to end)

`git push` cannot work here, and the reason was narrowed this session: **it is not the sandbox and
not a credentials problem — the certificate-revocation endpoints are unreachable from this network**,
so schannel fails the handshake (`CRYPT_E_NO_REVOCATION_CHECK`) before git ever asks for a
credential. Confirmed from **two** shells, this session's and the user's own `PowerShell 7.7.0`:
identical error, and in the user's terminal **no GCM prompt ever appeared**, which is the tell that
authentication is not reached. Two workarounds were tested and both fail, so do not spend time
re-deriving them: `-c http.schannelCheckRevoke=false` is ignored (git for Windows does not expose
that switch to the schannel backend — upstream still open, [libgit2#6724](https://github.com/libgit2/libgit2/issues/6724)),
and `-c http.sslBackend=openssl` dies on `unable to get local issuer certificate` because no CA
bundle ships with it.

**The route that works is two steps, and the first one is the step previously unrecorded:**

1. **Get a live credential into GCM without git's transport.**
   `git-credential-manager github login --username <acct> --device --force`. It uses GCM's own
   HTTPS stack plus a browser, so the broken schannel path is bypassed entirely. Measured: this
   replaced a dead `ghp_` token with a working `gho_` OAuth token (scopes `gist, repo, workflow`).
   **`--force` matters** — without it GCM may hand back the expired record, since an account
   already exists. This is the step an earlier pass missed: it read the stored token, found it
   40 chars and well formed, and still got `401 Bad credentials`; the shape of a token says
   nothing about whether it is alive. **Always prove a token with `GET /user` before pushing.**
2. **Push through the API**, with **both** bases given explicitly:
   `pwsh -File bin/push-api.ps1 -Base <local base> -RemoteBase <remote tip>`. Reading the current
   remote tip needs no credential for this public repo:
   `GET /repos/<owner>/<repo>/git/ref/heads/main`.
   **`-RemoteBase` is always the remote's current tip, and it changes on every push** — so no SHA
   is recorded here as an input. For the record of what this batch did: the first push followed
   remote tip `b9059b0` (= local `f2f08d3`), the second followed `94a9d4b` (= local `32feca8`), and
   the tip after it was `731776a` (= local `732b5bd`). Those are history. Query the ref and use
   what it returns.

**The trap in step 2, worth more than the rest of this note.** `-RemoteBase` is *not* your local
base. API-created commits are re-encoded, so the remote's copy of your base has a **different SHA
that does not exist locally**, and the default (`$RemoteBase = $Base`) then sends a parent the API
rejects with `Each SHA in the 'parents' parameter must be exactly 40 characters` — an error that
names neither the flag nor the reason. Measured this session: local `b94c904` is remote `b9059b0`,
same message, different SHA. **If you do not fetch the real remote tip first, you will hit this.**

**What the push costs and what it proves.** 12 commits, 59 blobs, 43 trees, exit 0. Local SHAs are
untouched; only the remote's tip identity differs. Both runs this session produced the *same*
mapping, so the operation is idempotent. Verify with the check `bin/push-api.ps1`'s header demands —
compare the pushed **tree SHA** against `git rev-parse HEAD^{tree}` (they matched exactly,
`536be942…`), then diff the remote path list against `git ls-files` for doubled segments. A matching
tree hash is the strong form: identical content at identical paths.

**One failure that was never explained, recorded so a later session does not trust it.** The first
API push of that batch died with the `parents` 422 above even though `-RemoteBase` was passed as a
full 40-char hex SHA; every component was then measured correct in isolation (the binding, the
`ConvertTo-Json` shape — it *does* emit `["sha"]`, not a bare string — and the parent's existence),
and the identical command then succeeded twice. Treat it as transient and un- reproduced, not as a
latent bug: an unverified diagnosis is worse than a recorded unknown. `bin/push-api.ps1 -Trace`
prints each request body and is the instrument to reach for if it returns.

> **Addendum (added this session): it returned, and it is not transient.** The same script, run three
> times on a **one-commit** range, created a commit each time and then failed the ref update with a
> **different** 422: `Update is not a fast forward`. The cause was found rather than guessed, and it
> is a *shape* the previous note could not see because it only ever described the multi-commit batch:
> **the parent of the first new commit must be the current remote tip.** Pairing the two bases
> position by position maps *content*, not *ancestry*, and the mapped base is already in the remote
> history — so parenting there makes the new commit a **sibling** of the tip. `GET
> /repos/…/compare/main...<new>` said it in one line: `status=diverged ahead=1 behind=1`. With the
> parent set to the tip the same compare answered `status=ahead ahead=2 behind=0` and the ref moved.
>
> Two further measurements from the same session: `bin/push-api.ps1 -Trace` printed **zero** trace
> lines because a function does not see its enclosing *script* scope's switch parameter under
> `-File` (verified in isolation) — so the instrument this note recommends was silently inert, which
> is why the diagnosis took the compare endpoint instead of the request body. And each failed attempt
> leaves the commit it created as an orphan on the remote: three exist from these attempts
> (`5018d9bc`, `c71084de`, and the first run's). The push itself is idempotent — the successful run
> uploaded **0 blobs and 0 trees**, because every object was already content-addressed on the remote.
> **`bin/push-api-ref.ps1`** is added for this shape: it walks both ranges, refuses to run when their
> lengths disagree, parents the new commit at the tip, and verifies every blob/tree/commit id it
> sends against `git`'s own value. See **D-32**.

> **Addendum 2 (added this session): the same script now initializes an EMPTY repository, and two
> GitHub API facts had to be measured to do it.** `POST /git/blobs` answers
> **`409 Git Repository is empty.`** — a repository with no commits cannot accept git objects at all,
> so the only way in is the Contents API, which creates the first commit and the default branch
> together. The two tidier escapes both fail: `POST /git/trees` with an empty array is
> **`422 Invalid tree info`**, and `PUT /contents` with empty content is
> **`422 content is not valid Base64`**. A third fact bites a caller rather than the API: an absent
> ref answers **`409`**, not `404`, so "is the branch absent?" must not key on 404. And a PowerShell
> detail that changes the object: **`ConvertTo-Json` drops an empty array**, so `parents = @()`
> vanished and a root commit came out with a parent — the key must be omitted instead, after which
> the created commit's SHA reproduced the local one **exactly** (`e3d9a98` on both sides), which is
> the sharpest available statement that "API commits get different SHAs" is about metadata
> differing, not about the transport. See **D-33**.

### The balance plugin is its own repository now (added this session)

`https://github.com/ABccgh/dsh-account-balance` — public, root commit `e3d9a98`, 7 files, topics
including `deepseek-harness-plugins` (the tag the `dsh-smith` badge already points at). Its working
tree **is** the directory the deployment loads (`$DSH_HOME/plugins/dsh-account-balance`), so there is
one copy of the source and it is the running one — no second tree to drift from. The `dsh-smith`
repository stays what it was: presets only.

That repository remains **unpublished to npm**: `"private"` was removed so publishing is possible,
and nothing was published. Its local clone has `origin` configured and `core.autocrlf=false` with a
`.gitattributes` pinning LF, so the working tree and the stored blobs agree — which matters because
the push tooling uploads bytes obtained from `git cat-file blob`.

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
  `@deepseek-ai/dsh-web-app`, then `profiles/web/cordis.patch.yml`. That overlay is an empty
  `[]`: it inserts no row of its own, so the two bundles above are the whole composition.
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

### Knowledge and retrieval — one gate, not one missing layer (added this session)

The question "does dsh need a knowledge base or a database" resolves to **neither**; the missing
piece is a **model-facing retrieval tool**. Verified this session (`file:line` per line):

| Piece | State | Where it was read |
| --- | --- | --- |
| Durable KV storage | mounted and in use | `dsh-base/cordis.patch.yml:145-156`; one JSON record per session under `~/.dsh/storages/session_projcache/sessions/`, plus `~/.dsh/storages/workspace.json` |
| Session logs | durable JSONL/Zstd | `dsh-base/cordis.patch.yml:110-113`; one log per session under `~/.dsh/sessions` |
| Ranked full-text index | installed, **switched off** | `dsh-base/cordis.patch.yml:129-133` (`path: ':memory:'`, `openAt: never`), restated `dsh-web-app/cordis.patch.yml:27-30`; **no `.db`/`.sqlite` under `~/.dsh`** |
| Effective bundle list | three bundles, overlay empty | `~/.dsh/profiles/web/package.json:9-13`; `~/.dsh/profiles/web/cordis.patch.yml` = `[]` |
| Cross-session injection | mounted, **user-initiated only** | `dsh-web-app/cordis.patch.yml:78-79`; fires on `agent/pre-step` at `dsh-session-reference/lib/index.js:467`; framing `lib/index.js:394-401` |
| Injection budget | already implemented | per source `max(65536, floor(contextWindow x 4 x referenceContextFraction))`, fraction `0.2`; **`maxReferences <= 3`** — `dsh-session-reference/README.md:48-53` |
| Projection scope | conversation text only | tools, reasoning and injected context excluded — `dsh-session-reference/README.md:69` |
| Model-facing retrieval tool | **does not exist** | `dsh-tool-session-query` not installed; union of `dsh-tool-*` **rows** across this repo's two presets = **16** packages, none session/DB/KB |
| Vector / embedding capability | **none anywhere** | `embedding`/`vector`/`cosine`/`rerank` appear only in unrelated senses |

**No counts in that table, deliberately.** Both populations grow on every session — the projcache
went **130 → 137** between two readings taken in the same session — so a figure recorded here is
stale before it is read, the same trap this file already records for byte sizes (D-14, D-16).
Re-measure from the paths instead.

Consequences worth keeping: `/resume` does **not** use the search backend — it resolves through
`observeSession` + `agents.resume` (`dsh-api-session-controller/lib/index.js:373-384`), so exact
reads are unaffected by the disabled index. `dsh-tool-cordis` lists `sessionQuery` with
`searchSessions` in its introspection catalog (`dsh-tool-cordis/lib/index.js:2828,2840`), but its own
tool description forbids treating an Inspect method as callable (`:9116`) — a catalog entry is **not**
a callable surface. If the model-side tool is ever written, its authorization burden is its own
(`dsh-session-query/README.md:150`).

Decision recorded as D-30.

## Component map

| Path | Responsibility |
| --- | --- |
| `package.json` | npm root; `bin` map of five launchers plus `dsh.presets[]` (one entry per shipped preset) |
| `README.md` | user-facing documentation for `dsh-smith`; carries the tool-cordis limitation, the 验证状态 table, and a pointer to `docs/dsh-forge.md` |
| `docs/dsh-forge.md` | user-facing documentation for `dsh-forge`, including its own 验证状态 tiers |
| `bin/presets.mjs` | **the preset registry**: id → repo dir, display name, upstream preset, expected tools. The other four scripts read their paths from it, so a preset id is defined once |
| `bin/install.mjs` | copies `<repoDir>/` into the harness home; `--preset <id>`, defaults to `dsh-smith` |
| `bin/verify.mjs` | mount check via `agentPresets.standingKeyFor(id)`; distinguishes MOUNTED / REJECTED / INCONCLUSIVE |
| `bin/preflight.mjs` | **static half of the mount check**: resolves every row's package and validates every config against that plugin's own `Config` schema. Prints the failure classes it cannot see |
| `bin/lint-skills.mjs` | frontmatter lint over a preset's skills |
| `bin/drift-check.mjs` | row-by-row diff against that preset's **own** upstream; reports, never syncs |
| `dsh-smith/agent.cordis.yml` | the `dsh-smith` composition |
| `dsh-smith/skills/**` | exactly five skills; two copied unmodified from the shipped `cordis` preset (with a correction banner), three original |
| `dsh-forge/agent.cordis.yml` | the `dsh-forge` composition (38 named rows) |
| `dsh-forge/skills/**` | exactly four skills, all original |

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

### A balance badge, mounted at the user's request (added this session)

The user asked for the DSH Web GUI to show the account balance. It now does, and the two facts worth
carrying forward are **how a self-authored plugin gets mounted here** and **where this plugin lives**.

**The deployment change, measured rather than described.** One package outside this repository —
`$DSH_HOME/plugins/dsh-account-balance/` (`package.json`, `lib/index.js`, `lib/client.js`) — is
linked into the web profile by `dsh plugin --profile web add <path>` and mounted by one `insert:` row
in `$DSH_HOME/profiles/web/cordis.patch.yml` with `name: 'dsh-account-balance'` (bare package name)
and five config keys. It serves `GET /api/balance` and occupies `sidebar.footer.action` with a
`Pill` badge beside the Cordis panel. Its host half is a client-only UI package's host half (an empty
`apply`) plus the route; its browser half is **hand-written**, with no bundler — a classic script that
calls `window.__ModuleLoader__.load({id, factory})`, which the module system accepts because the only
thing validated is that the file exists and is readable
(`dsh-client-modules/lib/index.js:750-764`).

**The three failures this walked through, each caught by a measurement rather than a reading, plus
one naming decision made before anything was written** — the full reasoning is **D-31**:

| Attempt | Symptom | Cause |
| --- | --- | --- |
| `name: 'C:\…\plugins\<package dir>'` | no boot-graph row, and the row's import would fail | directory paths are not resolvable by the ESM loader; the scan walks up from a *module* |
| `ctx.get('connection')` with an absence guard | `/api/balance` answered **404** with nothing logged | a root-tree row applies **before** `connection` is provided |
| single-flight cache returning its own entry | `/api/balance` answered **200** with the amount **absent** | only the fields read *through* the value were missing — a wrong answer, not an error |
| the package's name | none — nothing was ever written under the first name chosen | `AGENTS.md:104-108` records a `dsh-balance` plugin the user had removed; renamed to `dsh-account-balance` and written from scratch |

**Verified end to end on a second instance, never on the user's session.** A `dsh --profile web
--port 3081 --no-open` instance: `GET /api/balance` **401** without the cookie, **200** with it,
`cache-control: no-store`, body
`{"ok":true,"source":"https://api.deepseek.com/user/balance","fetchedAt":…,"ttlMs":30000,
"refreshSeconds":60,"isAvailable":true,"balances":[{"currency":"CNY","total":"10.17","granted":"0.00",
"toppedUp":"10.17"}]}`, and a second call reusing the same `fetchedAt` (the cache). The boot manifest
carried the entry and the served batch contained the plugin's own CSS class. The credential value
(35 chars) appears **zero** times in the served bundle. The user's own `dsh web` on 3080 was never
restarted or killed — `patchReload: live` picked the row up, but the host half needs a restart, which
is the one step left to the user.

### Every `webServer` route is outside the browser authentication gate

*(This finding was measured while a balance route existed. It is kept because it is not about that
route — see the supersession note at the end of this subsection.)*

The route answered **200 without any cookie** while `GET /` on the same deployment answered **401**.
The dispatcher returns on a named route before consulting the fallback that carries the only auth
(`dsh-host-webserver/lib/index.js:232-243`), so **every `webServer` route is outside the browser
authentication gate** — reachable by any process that can reach the port. Harmless on this
deployment's loopback bind, and the concrete price the moment anyone runs `dsh web --host 0.0.0.0`:
on this profile the route in question served the account balance of whichever provider key was
configured, over the LAN, with no credential. That route has since been removed (below), so the
**live** exposure is whatever else a `webServer` route carries — the dispatcher ordering is the
finding, and it is unchanged.

> **Supersession note.** This subsection replaced a longer one recording a forked balance plugin
> that this repository used to carry. The fork's source, its tests, its records and the whole
> provenance assessment were **deleted outright at the user's request** — not reverted, not
> archived, and deliberately not preserved in a git commit: it had never been committed or pushed,
> so nothing anywhere retains a copy. Three things that were said in the deleted text and are worth
> being explicit about, since a later session will otherwise re-derive them:
>
> 1. **The fork was never mounted, so its deletion changed nothing in the deployment.** No profile
>    ever listed *it*, `standingKeyFor` never ran on it, and its own route was still answering
>    **404** immediately before it was deleted. Its tests passing proved its behaviour against stub
>    vendors, never that a row mounts in a real composition (rule 5).
> 2. **The route that demonstrated the finding below was a different package, since removed too.**
>    That was the community package the profile actually loaded (not this repo's fork). At the
>    user's request it was then removed from the deployment by the sanctioned writer —
>    `dsh plugin --profile web remove dsh-deepseek-balance`, exit 0 — which also reconciled
>    `dsh.profile.bundles` against the installed state
>    (`dsh/lib/plugin-Ddi42qoW.js:46-78`, so the layer list cannot be left pointing at a package
>    that no longer resolves, which `dsh-app-boot/lib/index.js:831` would otherwise make a boot
>    failure). Verified after: the bundle list is down to `dsh-base` + `dsh-web-app`, its
>    `node_modules` entry is gone, the lockfile importer is `{}`, and `dsh --profile web
>    --dump-config` composes **no** balance row. Consequence for the finding above: **the probe
>    that demonstrated it can no longer be repeated** — re-derive it from the cited dispatcher
>    code, not from a route.
> 3. **The finding itself still holds and is still unfixed.** It was the one claim in the deleted
>    text that was never about the plugin, which is why it is restated here rather than dropped
>    with the rest.
>
> **Addendum (added this session).** The claim above is about the `webServer.register()` escape
> hatch, and it is right about that — but it must not be read as "any route a plugin adds is
> unauthenticated", because that reading is **false and was measured false**. A route registered in
> the connection shell's Fetch-route registry is authenticated: on the 3081 instance,
> `GET /api/balance` answered **401** with no cookie and **200** with one, because
> `dsh-client-connection/lib/index.js:768-781` applies `requestRejection` before it bridges to that
> table. So there are two paths, and a plugin serving account data must use the second one. The
> earlier note that "the probe can no longer be repeated" is also superseded: the authenticated
> path now has a live probe on this deployment, and the unauthenticated path can be re-derived from
> the cited dispatcher code.

### `dsh-forge` — the second preset (added this session)

Its user-facing record is `docs/dsh-forge.md`. What belongs in the chronicle is the verified
fact base and, more importantly, **the boundary of what was verified** — and this subsection was
itself corrected twice, first by an independent adversarial review and then by the user actually
running the mount check, so it is the freshest evidence in this file.

| Item | Outcome |
| --- | --- |
| Preset exists and installs | **Yes.** The success path prints `installed: C:\Users\曦曦\.dsh\.agent-presets\dsh-forge` and `contents: agent.cordis.yml, preset.yml, skills`, exit 0. **Recorded precisely because the first version of this row quoted the refusal path instead**: `target:` and `found:` are printed on *both* paths (`bin/install.mjs:95-108` refusal, `:137-138` success), so they are not evidence of a completed install — a reader re-running the command to confirm gets exit 1 and cannot tell whether the record or the install is broken. The install write is the sanctioned one; nothing was hand-edited under `~/.dsh`. |
| The installed copy equals the repo copy | **Yes** — SHA-256 `C8353AF1D7B05193AF88D5DDC085D2B4B79B422DFDEA93C0D2AF70C0414A86A1`, **53,772 bytes / 882 lines**, identical at `dsh-forge/agent.cordis.yml` and at the installed path, re-checked file-by-file after the persona edits below forced a re-install. (This supersedes `5F5B8163…2873` / 53,063 B / 872 lines, which was correct before those edits.) A session on `dsh-forge` therefore runs exactly this file, not a stale install. Re-check this after any edit to `dsh-forge/**` — the equality is point-in-time, and this very session demonstrated the trap: editing the composition invalidated the recorded hash until `--force` re-installed it. |
| Its four skills lint | **Yes** — `node bin/lint-skills.mjs --preset dsh-forge`: four `ok` lines, `all 4 skill(s) lint clean`, exit 0 |
| Every row resolves and every readable config validates | **Yes, 0 failures** — `node bin/preflight.mjs --preset dsh-forge`: `validated: 24   skipped: 10   failed: 0` over 38 named rows |
| The static preflight can actually fail | **Yes — falsified deliberately.** A copy with `mode: both` → `mode: nope` returned `$.mode expected "native" \| "ptc" \| "both" but got "nope"` (exit 1); a copy with `tool-fs`'s package renamed to a nonexistent one returned `package does not resolve` (exit 1). Both temp copies were deleted. A check that cannot fail proves nothing, which is why this row exists. Reinforced by an independent adversarial review (`expert_verifier`), which reproduced `validated: 22   skipped: 10   failed: 2` with both defects planted in one run, and separately confirmed that `{}` yields `$.mode missing required value`. |
| **The tool surface reaches a model, under `both`** | **Yes — closed in a real session, the last item the mount check could not answer.** This session's table carries **32** names — the full catalog *and* `run_code` — so `wireSchemas`'s `both` branch does not collapse it (`dsh-tools/lib/index.js:2739-2742`). The nine rows `docs/dsh-forge.md` asks about are all present, `subagent_codex`/`subagent_claude_code` are exactly absent (their `disabled: true`), and so are `ralph` and `workflow` — composed at `:798` and `:792`, which makes 32 an **exact** match rather than "at least the nine". The doc's nine is a floor, not an inventory. |
| **`run_code` + the `tools:sdk` section are not merely rendered — they are callable** | **Yes.** A delegated child's prompt carried the block introduced by `Program-only SDK bindings:` (`interface ToolArgsMap` / `ToolOutputMap` / `declare const tools`), and its `await tools.glob({pattern:"*.md", path:"D:\\DeepSeek Harness"})` returned **15 paths**. The section is generated per scope by `sdkSection()` (`dsh-tools/lib/index.js:2647-2661`) and a successful *call* through it is what distinguishes "the text was appended" from "the SDK is wired". `run_code` itself is correctly **not** a member of the `tools` object and **not** in the SDK type — it is the presentation transport (`:2780`), so its absence from both lists is structural and is a useful negative control. |
| **`deny: [write, edit]` holds under `mode: both`** | **Yes — and it is removal at presentation, not a guard.** Filtered `expert_debugger`: `propcount = 30`, `write`/`edit` absent from the mounted table *and* the SDK section, `has_ralph=true`; forced calls threw `TypeError: tools.write is not a function` with `instanceof ToolCallError === false`, i.e. **the tool layer was never entered**, while `tools.glob` succeeded and `Test-Path` stayed false. Differential control (plain `subagent`, same depth/provider/path, no `toolFilter` on `:477-484`): **32** names, both present as functions, and `tools.edit` **really dispatched** to the code-runtime worker returning a typed `ToolCallError` with `toolName: "edit"`. This corrects the *wording* of D-17, not its verdict — see D-26. |
| Independent adversarial review of this change | **Run, and it found real defects — all documentation, none in the composition.** Its verdict: *"sound on the composition; unsound on the documentation."* It confirmed all six load-bearing technical claims by re-reading source (the collapse rule and both citations, `run_code`'s non-registrability verbatim, `tool-cordis`'s genuine absence from `dsh-forge`, the realm/capability facts, and every number I published). Its findings, all now fixed, are recorded as D-22 rather than quietly applied. It also volunteered the one thing I had not asked for and needed: the row arithmetic I published was **fabricated** — right total, invented decomposition. |
| The old scripts still behave as before | **Yes, byte-for-byte in behaviour** — with no `--preset`: lint reports the same five skills clean, drift reports `36 rows` local / `32` upstream with the same six drifted rows, install refuses to overwrite with the same message |
| `dsh-smith/agent.cordis.yml` was not touched | **Yes** — `git status --short dsh-smith` is empty |
| The tarball still excludes the memory layers, now with both presets | **Yes** — `npm pack --dry-run`: **22 files, 94.2 kB packed / 270.7 kB unpacked**, measured at the final revision of this change (earlier measurements this session: 92.9/266.7, then 93.1/267.2, then 93.7/269.0 — same 22-file set every time, sizes moving with each edit, which is the point: a byte figure is a fact about a revision, never a standing fact). Both preset directories are present and complete; `AGENTS.md`, `docs/**`, `.gitignore` and `.gitattributes` are all excluded. Supersedes the earlier `14 files / 58.1 kB` figure, which predates `dsh-forge/`, `bin/preflight.mjs` and `bin/presets.mjs`; that one in turn superseded a `19 files / 65.5 kB` figure from before the `files` allowlist existed. |
| **`standingKeyFor('dsh-forge')`** | **RUN, AND IT PASSED — `MOUNTED OK`.** Via the dynamic-plugin probe from a session on the **shipped `cordis` preset**, where `tool-cordis` is `enabled=true` and `cordis_*` therefore exists. `compositionInventory()` from the resulting standing mount lists **35 leaf rows** (the 3 group containers are skipped by the same `flattenRows`/`mountedCompositionRows` rule): **31 active**, **2 `conditional`** (`tool-bash` / `tool-pwsh` platform gates), **2 `false`** (`tool-subagent-codex`, `tool-subagent-claude-code`), `broken=none`. It also settles what the static pass could not: **no row is "mounted but contributing nothing"** — the `compaction`/`toolResultPruner` realm pairing and `tool-presentation`'s wait on the host `codeRuntime` both came up active. |
| **Row-count reconciliation** | **CLOSED — 38 = 3 groups + 35 leaves; 31 active, 2 `conditional`, 2 disabled.** Both counting paths skip group containers (`flattenRows`, `dsh-agent-presets/lib/index.js:991`; `mountedCompositionRows`, `:1038`), so the inventory's 35 is the **leaf** count and agrees with an independent YAML-parse of the file. **Both numbers this record published were wrong**: "35 active" mislabelled the total as the active count, and "34 enabled" was `38 − 4`, an arithmetic error because 38 includes the 3 containers that never appear in a row list. The one correct equation is **35 leaves − 4 disabled = 31 active** (on Windows `tool-bash` is off by its `!!js` gate and `tool-pwsh` is on, so exactly one of the two platform-gated rows runs). |
| **`bin/verify.mjs` is not the mount check, and no session fixes it** | **Defect found and corrected.** The script builds its own bare runtime (`new cordis.Context()`, `bin/verify.mjs:204`), so `agentPresets` is absent **by construction** and it prints `INCONCLUSIVE — this runtime publishes no agentPresets service` **from every session** — measured twice, byte-identical, once in an ordinary shell and once inside a shipped-`cordis` session with `tool-cordis` active. This complements D-20 rather than contradicting it: D-20 says the *probe route* is closed in locally authored presets, and this adds that the *script route* is closed everywhere. Its header comment and its INCONCLUSIVE advice have been rewritten; it now says it is a diagnostic and points at the probe route. |

> A row reading "The tool table a `dsh-forge` session reaches — **NOT MEASURED**" was deleted here. It
> was true when written and was overtaken twice in the same session, first by the mount check and then
> by the real-session measurements two rows above it — so the table contradicted itself in adjacent
> lines. Kept as a note rather than silently removed because the shape recurs: **a status row is only
> as current as the last measurement in the file it sits in**, and this one sat directly above its own
> refutation.

**The row count, measured rather than reasoned.** `Select-String -Pattern '^\s*- id: \S' dsh-forge/agent.cordis.yml`
returns **38**. Measured by indentation: **20 rows at indent 0** and **18 at indent 4**. The 20 are
**17 plain plugin rows plus 3 group containers** (`thinking`, `compaction`, `team`), and the 18 sit
inside those containers. Note the number differs from `drift-check`'s for `dsh-smith` (36) because
the two compositions are different files, not because either count is wrong.

> An earlier version of this paragraph said "4 top-level rows … + 31 rows inside those groups".
> Both halves were wrong and mutually inconsistent, and the four names it listed were simply the
> first four it happened to look at. The lesson is the one this file keeps relearning: a
> decomposition is a **measurement**, and a plausible-looking split of a correct total is still a
> fabricated number. Count the indents.

**The delegating-row count, measured.** Seven rows state `maxDepth: 2`: L474 `tool-subagent`,
L493 `tool-subagent-fork`, and L503/L544/L625/L688/L725 the five expert rows. Two more rows —
`tool-subagent-codex` and `tool-subagent-claude-code`, both `disabled: true` — state
`maxDepth: provider-managed`, which is a cap owned by a product runtime rather than a number. So
"all delegating rows are capped at 2" is true only of the **seven enabled** ones; the claim must
be written that way, or it is the over-claim D-10 exists to correct. Those seven stating the cap is
what makes the recursion bound a single number: agent(0) → expert(1) → helper(2).

**The file parses to the structures it was written to intend, not merely to valid YAML.** A
`schema` check cannot see this class of defect at all — a block scalar whose indentation strips
the wrong prefix is still a string, still validates, and silently loses its shape. Parsed the
composition with the profile's own `yaml` module and the same `!!js` tag shape the loader uses,
then read the values back:

- `persona.prefix` — 4,487 chars / 72 lines, first line `You are DSH Forge, a software development
  agent. …`, last line `are worth the wait.`
- `persona.suffix` — 5,173 chars / 84 lines, first line `# Working protocol`
- `plan-mode.config.section` — 3,365 chars / 21 lines, **zero leading indent on line 2** (the
  14-space source indentation is stripped correctly, so the protocol reaches the model as prose
  rather than as an indented block)
- `tool-presentation.config` → `{"mode":"both"}`; `repeat-tool-reminder.config` →
  `{"thresholds":[3,6,10],"argumentsPreviewChars":2000}`; `tool-result-pruner.config` →
  `{"thresholdChars":16384,"headChars":8192,"tailChars":4096}`
- `skill-filesystem.config` → `{"customSkillDirs":[{"__jsExpr":"process.getBuiltinModule('node:url')
  .fileURLToPath(new URL('skills/', baseUrl))"}]}` — the expression survives as a tagged node, which
  is what the loader evaluates against `baseUrl`, so the preset's own `skills/` directory resolves
  wherever the preset is copied to
- the five expert rows carry exactly the intended budgets and filters: `toolName` set per row,
  `maxDepth: 2` on all five, `reasoningEffort: max` on architect / verifier / debugger and
  **absent** (inherited) on protocol / chronicler, and `toolFilter.deny` equal to `["write","edit"]`
  on verifier and debugger with no `toolFilter` on the other three

## Known gaps- **CLOSED — the tarball no longer ships the memory layers.** D-7 added
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
- **CLOSED — `dsh-forge` has been mount-validated: `MOUNTED OK`.** Via the dynamic-plugin probe
  from a session on the **shipped `cordis` preset**, with `compositionInventory()` listing 35 leaf
  rows (31 active, 2 `conditional`, 2 `false`) and `broken=none`. The obstacle the previous version
  of this entry described was real and is kept below, because it still bounds **every future
  preset** and it still explains why the check needs that specific session:

  1. `dsh-tool-cordis` registers four **process-global** inspect providers into `cordisInspect`,
     and that registry keys by id and **throws** on a duplicate
     (`dsh-cordis-host-runner/lib/types/inspect-registry.d.ts:38` documents the disposer as
     idempotent; the implementation throws at `lib/index.js:732` on a duplicate id).
  2. The host takes those four ids at boot: `dsh-web-app/cordis.patch.yml:122` composes
     `cordis-host-runner`, whose constructor builds the registry and registers the providers.
  3. Therefore **any other composition containing that row must gate it off**, or its whole
     mount fails. `dsh-smith` gates it off; `dsh-forge` does not contain it at all.
  4. Measured live loader state, confirming the consequence rather than reasoning about it: the
     shipped `cordis` preset reports `tool-cordis enabled=true fiberPhase=active`, `dsh-smith`
     reports `enabled=false fiberPhase=null`, and `dsh-forge` has no such entry. So the probe route
     is open **only** in the shipped `cordis` preset — which is where the check was then run.

  **A second correction this closure produced, and it is the sharper one: `node bin/verify.mjs`
  cannot run this check from ANY session.** The script builds its own bare Cordis context
  (`new cordis.Context()`, `bin/verify.mjs:204`), so `agentPresets` is absent by construction and
  it prints `INCONCLUSIVE — this runtime publishes no agentPresets service` **including inside the
  shipped-`cordis` session where the probe route worked** — measured twice, byte-identical output.
  The earlier version of this entry told readers to "run that session's own verify" as if the
  problem were the session; the problem is the script's construction. Its header and its
  INCONCLUSIVE advice now say so. The route that actually reaches the roster is the dynamic-plugin
  probe, and it is the one the mount verdict came from.
- **CLOSED — the file and the inventory agree: 38 = 3 groups + 35 leaves, of which 31 active.**
  The apparent one-row discrepancy was two arithmetic errors, both in this record, and neither in
  the harness. `flattenRows` (`dsh-agent-presets/lib/index.js:991`) and `mountedCompositionRows`
  (`:1038`) **both `continue` past `group: true` entries**, so a row list is leaves only: the
  inventory's 35 is the leaf count, and an independent YAML parse of the file reproduces exactly
  35. The errors were (a) labelling that 35 as "active" when 4 of the 35 are off, and (b) deriving
  "34 enabled" as `38 − 4`, which subtracts from a total that includes the 3 containers no row
  list contains. Correct equation: **35 leaves − 4 disabled = 31 active**; the two `!!js` gates are
  reported three-way (`"conditional"`), and on Windows exactly one of them runs.
- **`bin/preflight.mjs` does not reject unknown config keys**, and this is a property of
  schemastery rather than a limitation of the script. Measured: `{ mode: 'both', bogus: 1 }`
  against `@deepseek-ai/dsh-agent-tool-presentation`'s own `Config` returns
  `{"value":{"mode":"both","bogus":1}}` — no issue. So a mistyped key name is invisible to the
  static pass whenever it does not leave a required field absent. **A mount would notice — and
  now one has run**, which is what turned this from a caveat into a bounded risk: the mount was
  clean, so no such typo is present in *this* composition today. The caveat still governs the next
  edit, because preflight will keep passing over the same mistake.

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
