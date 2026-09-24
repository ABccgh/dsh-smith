# AGENTS.md — D:\DeepSeek Harness

This tree is the **`dsh-smith` npm package** and the presets it ships. Source of truth for each
composition is that preset's own directory: `dsh-smith/agent.cordis.yml` (builds harness agents
and Cordis plugins), `dsh-forge/agent.cordis.yml` (software delivery),
`dsh-ck3-mod/agent.cordis.yml` (a Crusader Kings III **mod-authoring** agent),
`dsh-script/agent.cordis.yml` (**剧本 and nothing else**: 选题 → 一句话钩子 → 圣经 → 分集功能表 →
逐集正文 → 交给用户在平台上评估 → 按读数改稿; the 28-column 分镜表 and the platform's xlsx import
templates are deliberately **out of scope**), and `dsh-duanju/agent.cordis.yml` (**分镜与成片**, the
stage AFTER the script: it reads the 正文 `dsh-script` delivered and produces the 28-column 分镜表,
the platform-importable xlsx, then 生成 → 成片 → 投稿; **it does not write or edit the 正文**).
The two are **two stages of one short-drama line, not two generations of one preset**: since
2026-09-24 `dsh-duanju` carries no script persona, no script expert and no script skill, so that no
role is published by both. `bin/presets.mjs`
is the registry of which presets exist, which directory each lives in, and which shipped preset
each one was copied from — the five scripts that install, verify, lint, drift-check and preflight a
preset read their paths from it. The ids are mirrored in `package.json`'s `dsh.presets`, which
`bin/check-pack.mjs` reads for the packed surface and the CI inventory step reconciles against disk,
so **a new preset is an edit in both files** — and because the CI inventory step compares the
on-disk directories against that list, **a directory left on disk must stay declared**: `dsh-duanju/`
stays in both, which is why it cannot be removed from `package.json` without also deleting its
directory. (It is no longer a *fallback* for `dsh-script` — the two are different stages of one
line, so neither replaces the other.)

**Preset rows and shipped packages: four of the five presets resolve entirely from shipped
packages, and one does not — but TWO presets depend on an out-of-repo plugin, on DIFFERENT planes,
and that difference is what decides which steps CI can run.**
`dsh-smith`, `dsh-forge`, `dsh-duanju` and `dsh-script` are the clean case: every one of their rows
names a shipped `@deepseek-ai/*` package, so `preflight --preset <id>` runs in CI. `dsh-duanju`'s
platform-side steps (有戏AI 的登录、导入、生成、评估、发布) are human-only, so wrapping them in a
plugin would be inventing an interface that platform does not offer.
**`dsh-ck3-mod` is the one preset whose rows NAME a package this repository does not ship** —
`dsh-ck3-modcheck`, a host-plane Cordis plugin under `$DSH_HOME/plugins/` (rule 7's pattern, like
`dsh-ima-kb`). Two measured consequences. `bin/preflight.mjs --preset dsh-ck3-mod` passes only where
that plugin is installed — measured on this machine, where it is: `validated: 16   skipped: 9
failed: 0`, exit 0 — which is why `.github/workflows/checks.yml` **excludes** that step rather than
running it under a `continue-on-error`; a runner has no profile, so the same command there reports
`Cannot find package`. And that same script **does not validate that row's config at all**: it reads
a row's `Config` export only when that export is a *function* (`bin/preflight.mjs:178`,
`typeof Schema !== 'function'` → `no-schema`), while this plugin exports the plain-object Standard
Schema exactly as `dsh-ima-kb` does, so it prints `skip … (exports no usable Config schema)`. Config
validation for it therefore lives in the plugin's own `test/falsify.mjs`, next to assertions that six
planted defects are each named and that a real vanilla localization file produces zero findings.
**`dsh-script` is the second preset with an out-of-repo dependency, and it names nothing.** Its
plugin `dsh-duanju-script` (source `D:\dsh-duanju-script\`, a `link:` dependency of the profile
rather than a directory under `$DSH_HOME/plugins/`) is a **host-plane** row in
`profiles/<profile>/cordis.patch.yml` that registers three tools into the host `ctx.tools` and
publishes no service (`inject = ['fs','tools']`, no `provide()`). So the preset composes **no row for
it** and `preflight --preset dsh-script` resolves every row from shipped packages exactly like the
four clean presets above — which is the whole reason it belongs in CI while `dsh-ck3-mod`'s step does
not. The consequence in the other direction is the one to remember in a session: without the plugin
the preset still mounts, but the three tools do not appear. Today that plugin still registers **six**
tools (`duanju_gate`, `duanju_recall`, `duanju_checkpoint` plus the three the narrowing removed);
three is the target state, recorded at `dsh-script/agent.cordis.yml:46-53`.

## Evidence rules

1. **Session logs cannot prove absence.** `~/.dsh/sessions/**` files contain **only a
   session header** — no turns, no tool calls, no tool table. Both filename variants are in
   scope and both are header-only: a census at the time of writing matched 120 `.zstd` files
   by extension, `109 session.jsonl.zstd` + `11 session.v3.jsonl.zstd`. A delegated child gets
   the `.v3` name, but a **top-level** session can carry it too (`session-c495d9d3` does), so
   the name is not a reliable "is a child" marker. Grepping them for a tool name, a row id, or
   a decision returns nothing whether or not the thing existed, so a zero-hit scan is void: it
   is only evidence if a control string known to be present **also** fails. To establish what a
   session could do, enumerate **this live session's own tool table**; do not scan logs.
2. **The header's `agentPreset` is a creation-time hint, not the mounted preset.** The field is
   optional (`dsh-session-format/lib/types/types.d.ts:19`), the web-app composition sets
   `config.default: standard` (`dsh-web-app/cordis.patch.yml:484`), and the API reads a session's
   real preset from the projection (`dsh-api-session-controller/lib/index.js:363,522`), whose
   `apply` is driven by the `agent-preset/selected` event (`dsh-agent-presets/lib/index.js`).
   Measured divergence: this repo's root session header says `standard` while its own children —
   same tool table, one delegation deeper — say `dsh-smith`. So `agentPreset` present in every
   header is a valid *control* that the field is written, and **not** evidence of which
   composition served the session. The mounted tool table is the authority.
3. **A runtime claim beats a reading — and beats a commit message.** Read the installed
   package's declarations under `node_modules/@deepseek-ai/<pkg>/lib/types/` and the
   implementation in `lib/index.js` before asserting a service key, gate, or lifetime; state
   the file and line in the record. The installed packages live in the **npx checkout**
   (`C:\Users\曦曦\AppData\Local\npm-cache\_npx\1e7f6d9597241db0\node_modules\@deepseek-ai\`),
   not in this repo's `node_modules`, which has no `@deepseek-ai` directory at all. When a
   claim is "the config says X", re-grep the file you are about to cite: an expert report
   this session asserted `maxDepth` sat on all six delegation rows and cited a commit body as
   its proof; the file has it on two, and the commit it named was two revisions behind. **And
   when the claim is "the composition does not mount it", check *every* bundle the deployment
   composes before writing it down** — "dsh-base has no such row" is a statement about
   `dsh-base`, not about the deployment. That exact shortcut produced a false claim in four
   documents: the row was in the web-app bundle, and the setting was a product opt-in that was
   simply off. Ask the running runtime for the service; it answers in one call.
4. **Prefer the runtime probe to the file grep whenever both can answer.** A service read live
   (`ctx.get('<name>')`, then its own method) settles a question that grepping composition files
   can only suggest, and it cannot be fooled by a bundle you forgot to look in.
4b. **Then check that the probe measures the thing you named.** Four traps this repository has
   actually hit, each producing a confident wrong reading rather than an error:
   - **A delegated child's report is a transcription, not a reading.** One dropped `ralph` from a
     prose list while the runtime array it was summarising contained it, and misquoted a type alias.
     Have the runtime `console.log` the structure and compare against that (D-27).
   - **A grep hit is not a membership test.** Searching a whole prompt for `edit` matches
     `update_goal`'s `action: "edit"` enum value and the persona's own prose; only member syntax
     inside the generated `tools:sdk` block (`edit:`) is evidence about the SDK surface (D-26).
   - **Two "independent" checks can be one fact seen twice.** "Absent from the native table" and
     "absent from the SDK section" both read the same `view(scope).visible` map, so their agreement
     confirms nothing twice over (D-26; D-22's fabricated decomposition is the same shape).
   - **A predicted claim may be coarser than the measured one.** "It holds" passed, and the platform
     does something strictly stronger: the binding does not exist. Record the sharper statement,
     because a later session inherits whichever one was written down (D-27).
5. **The mount check needs a session on the shipped `cordis` preset — this is a preset-lifetime
   fact, not a preference, and it is NOT what `bin/verify.mjs` does.** `standingKeyFor(id)` is the
   only check that counts. Reaching it needs a live harness process, and the practical route into
   one is the dynamic plugin (`cordis_define` + `cordis_run`), which needs `cordis_*`. Those tools
   exist only where a composition registers them: `dsh-tool-cordis` registers four
   **process-global** inspect providers whose registry throws on a duplicate id, and the host takes
   those ids at boot (`dsh-web-app/cordis.patch.yml:122` → `dsh-cordis-host-runner`). Measured live
   loader state: the shipped `cordis` preset has that row `enabled=true`, `dsh-smith` has it
   `enabled=false`, and `dsh-forge` does not contain it at all. So a `dsh-smith` or `dsh-forge`
   session can never run the probe route, and neither can a CLI shell.
   **Two corrections worth keeping, because both were got wrong here first:**
   - **`node bin/verify.mjs` is a diagnostic, not the mount check, and no session fixes it.** It
     builds its own bare Cordis context (`new cordis.Context()`), so `agentPresets` is absent by
     construction and it prints INCONCLUSIVE from every session — measured twice, identically, once
     in an ordinary shell and once inside a shipped-`cordis` session with `tool-cordis` active. Do
     not tell a reader to "run that session's own verify" as if location were the problem.
   - **Do not infer which preset served a session from the repository it is rooted in.** This file
     previously asserted "this repo's root session is served by `dsh-smith` and has no `cordis_*`".
     That held once and is not a rule: a session rooted at `D:\DeepSeek Harness` running the shipped
     `cordis` preset had the full `cordis_*` set. The mounted tool table is the authority (rule 2);
     the working directory is not evidence. **And when a reading is relayed between sessions, say
     WHICH session it came from instead of "this session"** — the same phrase then covers two
     different compositions at once, and each reading looks equally authoritative. Measured
     2026-09-21: one session's mount reading was recorded as refuting a claim made by another, and
     **both readings were correct because they described different sessions** — one on the shipped
     `cordis` (skills resolving from `…\presets\cordis\skills\…`), one on `dsh-smith` (skills
     resolving from `…\.agent-presets\dsh-smith\skills\…`, with `expert_architect`/`expert_protocol`
     in its table). The identifying datum is the tool table or the skill-resolution path; say it.

## Editing rules

6. **Edit the preset here, never the installed copy by hand.** The live files are
   `${DSH_HOME}/.agent-presets/<id>/agent.cordis.yml`. A hand edit there creates silent
   drift from this repo. Change `dsh-smith/**`, `dsh-forge/**`, `dsh-ck3-mod/**`, `dsh-duanju/**` or
   `dsh-script/**` and then
   re-install — `node bin/install.mjs --preset <id>` is the *sanctioned* writer for that path,
   and `--force` is a real replace (delete then copy), which is what removes skills a newer
   version dropped. All five local preset directories are *user* preset territory and are
   authoring-free; the shipped presets under the deployment's own `agent-presets`
   directory (`standard`, `ptc`, `minimal`, `cordis`) are the ones that must never be
   written at all.

7. **This repo ships presets and nothing else.** Five directories — `dsh-smith/`, `dsh-forge/`,
   `dsh-ck3-mod/`, `dsh-duanju/` and `dsh-script/` — are the whole owned surface, and each is written to its install target only through
   `bin/install.mjs --preset <id>` (rule 6). A **Cordis plugin is a different kind of thing** and
   would not belong here: it is mounted by a *host-composition row* in a profile's
   `cordis.patch.yml`, and the sanctioned writer for a profile's dependency graph is
   `dsh plugin --profile <profile> add <path|tarball>` (pnpm underneath). Never hand-edit a
   `package.json` in `~/.dsh/profiles/**`. If a plugin is ever vendored here again, it must also
   be listed in the root `package.json`'s `files` allowlist, or it is silently absent from the
   published tarball while every local command still works — the one failure this repo cannot
   detect by running itself. *(History: a forked balance plugin lived at `dsh-balance/` under
   exactly those rules until the user had it removed outright, source and records together. Do
   not look for it, and do not restore it from a tarball or a session log. A *community* balance
   package that a profile also loaded was removed from the deployment in the same request and
   belongs to the same history.)* **What that history does NOT forbid, measured since:** the user
   later asked the Web GUI to show the account balance, and a from-scratch plugin was written for
   it. It lives **outside this repository** — `$DSH_HOME/plugins/dsh-account-balance`, its own git
   repository at `github.com/ABccgh/dsh-account-balance` — and is mounted by one row in the web
   profile's `cordis.patch.yml`. So "balance-shaped" is no longer absent from the *deployment*;
   what remains true is that nothing balance-shaped ships from **this** tree, which is exactly what
   this rule is about. Do not read the paragraph above as a standing ban on the feature.
   **A second out-of-repo plugin now exists** — `$DSH_HOME/plugins/dsh-ima-kb`, mounted the same way
   by one row in the same `cordis.patch.yml` — so "a plugin lives outside this tree" is the
   established pattern here, not a one-off. One consequence of that sanctioned writer is worth
   knowing before writing the next one: it **symlinks** the package, so the plugin's own **bare**
   specifiers fail to resolve from the link's real path (`ERR_MODULE_NOT_FOUND`), while relative
   imports among its own files are unaffected (D-35).
   **A fourth out-of-repo plugin EXISTED and is now GONE: `$DSH_HOME/plugins/dsh-inbox`** (removed
   2026-09-24 at the user's request; measured 2026-09-17 when it was built) — a durable inbox for the
   Web GUI, mounted by one `insert:` row in the same `cordis.patch.yml`. **The plugin directory (with
   its own `.git`, 1 commit, 0 remotes), the profile dependency, the `insert:` row, and the five
   prompt/skill references to `inbox_add` were all removed in one pass**; the row's site now carries
   an "已移除" note and the three measured reasons it was built the way it was live on in
   `docs/agent-notes/DECISIONS.md` **D-115**, because deleting the directory destroyed the only *local* copy.
   **That sentence was imprecise when it was written, and on 2026-09-24 it became true in a different way:**
   the GitHub repository `ABccgh/dsh-inbox` then held a 13-file copy of the implementation (it had existed
   since 2026-09-19), and at the user's request that repository has since been **deleted** — so no copy
   exists anywhere now, and D-115's design reasoning is what remains. A tarball was taken first and kept at
   `D:\dsh-inbox-retired-20260924.tar.gz` (13 files, 34.5 KB); see **D-119**. Do not go looking for the
   repository, and do not rebuild the plugin without reading D-115 first.
   What the removal cost, and the reason it is worth remembering: that row was ALSO the persistent
   channel for `ask_user_question` (`captureQuestions: true` queued a blocking question for later
   answering, and the answer resolved the same pending tool call). With it gone,
   `ask_user_question` is back to a transient composer card only. **A mechanism was removed; the
   discipline it carried was kept and moved into the handover text** — see D-115 §4.
   Two defects found while building it are *general* facts about host-plane plugin rows here, not
   facts about that plugin, and both were recorded in its `NOTES.md` (also deleted, so D-115 and this
   paragraph are now their only copy):
   1. **A row's `Config` must be a Standard Schema.** The loader resolves it with
      `runtime.Config['~standard'].validate(config)` (`cordis/lib/index.js:957-961`), so a `Config`
      shaped like a JSON Schema throws during config resolution and **the row never mounts** — with no
      message naming the plugin. `bin/preflight.mjs` cannot see this: it reads an exported `Config`
      only when that export is a *function*, so it reports the working shape as
      `skip … (exports no usable Config schema)`. All four earlier out-of-repo rows already export the
      Standard Schema form.
   2. **The tool-schema subset rejects per-property `required: true`.** `required` must be an array of
      property names on the object (`dsh-tools/lib/index.js:153-157`); per-property `true` is
      author-DSL syntax that `defineTool` compiles away, which a no-import host plugin cannot use. A
      schema outside the subset throws while projecting schemas **at prompt assembly**, so it breaks
      every session in the process, not just the offending tool. This also corrects the omission rule
      stated above: omitting `parameters` is not "a tool that registers and shows the model nothing"
      — it is a hard throw on both projection paths, and an omitted `output` throws at `register()`.
   **Two more were built for `dsh-ck3-mod` and one of them has already been retired (measured).**
   `$DSH_HOME/plugins/dsh-ck3-modcheck` validates a mod against the real vanilla installation and is
   **live** — one `insert:` row in the web profile (to be written by `dsh plugin --profile web add`).
   `$DSH_HOME/plugins/dsh-ck3-wiki` (five wiki-retrieval tools) was written, tested 38/38, and then
   **deleted outright** when the user narrowed that preset to mod development only; it never entered
   any profile's dependencies, which is what made deleting the directory sufficient. The lesson worth
   keeping: a plugin that is never added to a profile leaves no trace to unwind, so **write the row
   before the plugin, and put the plugin in the profile only when the capability is wanted** — the
   reverse order costs a `dsh plugin remove` plus a Host restart to undo.
   **A THIRD is GONE — `$DSH_HOME/plugins/dsh-github` (D-47, removed by D-51).**
   The user cancelled that project and it was fully torn down: the plugin, its `link:` dependency,
   the three profile rows, and its two credential refs are all gone. It is kept in this rule as the
   **worked example of a plugin that consumes a service another profile-patch row publishes** —
   `@deepseek-ai/dsh-webhook` provided `ctx.webhookRuntime` from its own row and the plugin merely
   injected it — because that shape recurs and is worth copying. Two facts from it generalize and
   survive the removal: a plugin may hand-implement the helpers a bare import would have supplied
   (it carried a parameter-spec → JSON Schema compiler and a `defineTool` stand-in, because
   **`output.schema` and a wire-format `parameters` are both consumed at registration** and an
   omission there is a hard throw rather than a quiet degradation — an omitted `parameters` throws
   while schemas are projected at prompt assembly, and an omitted `output` throws at `register()`
   itself. *(The wording this sentence used to carry — "a tool that registers and shows the model
   nothing" — was measured false and is superseded by the corrected rule in the `dsh-inbox` bullet
   above.)* Compile-time brands are
   **identity functions with no runtime trace** (`dsh-brand/lib/index.js` —
   `brandString(value) { return value }`), so a plugin with no imports can still satisfy a branded
   contract with plain literals. **Do not rebuild it without reading D-47–D-50 first**; they hold the
   measured contracts, and with the plugin deleted they are now the only copy of that reasoning.
   **One tracked directory here is neither a preset nor a plugin — `tools/ck3wiki/`, the source-only
   tooling for the cancelled CK3 Wiki → ima mirror (D-57) — and it is deliberately tracked.** Its
   generated `data/` is gitignored **and deleted**, and the directory is absent from
   `package.json`'s `files`, so it never enters the tarball and `bin/install.mjs` knows nothing
   about it. Do not "finish the cleanup" by deleting it: `lib/http.mjs` is the only copy of that
   site's Fastly-gate bypass conditions, and `falsify.mjs` is the only regression test for the four
   silent converter defects D-53 records.

## Boundaries

- Do not modify, migrate, or delete anything under `~/.dsh/**` — profiles, sessions, or other
  presets' installs — from a session rooted here, **except** the five preset directories this
  repo owns (`~/.dsh/.agent-presets/dsh-smith`, `.../dsh-forge`, `.../dsh-ck3-mod`, `.../dsh-duanju`,
  `.../dsh-script`),
  and only through `bin/install.mjs`, which is the sanctioned writer for exactly those five paths. A hand
  edit under `~/.dsh` is still a violation even for an owned preset. **Removing one is the
  exception that proves the rule:** `agentPresets.remove(id)` is the only sanctioned delete, it
  needs the `cordis_*` tools, and those exist only in a shipped-`cordis` session — so when a preset
  is retired, delete its **source** here and report the stale install directory for the user to
  remove through that interface. Do not hand-delete it, and do not claim it is gone.
- **A desktop application for DSH exists and it is NOT in this tree** — `D:\dsh-desktop`, its own
  project, the same out-of-repo pattern rule 7 already records for `dsh-account-balance` and
  `dsh-ima-kb`. It is a *shell*: Electron owns one window and one child process, and the harness runs
  in that child on the **system Node**, booted from the user's own `web` profile — so it reads
  `$DSH_HOME/profiles/web` and writes nothing under `~/.dsh`. Its records live in
  `D:\dsh-desktop\docs\agent-notes\`; do not look for it here, and do not "move it in". Two measured
  facts from that work are worth having here because both are non-obvious: **Windows never delivers a
  signal to that child** (`child.kill('SIGTERM'|'SIGINT'|'SIGBREAK')` reports the signal back while no
  handler runs), so it is terminated with `taskkill /T /F`; and **in a packaged Electron app an
  unguarded `process.stdout.write` is fatal to the JavaScript context** when a supervisor closes the
  pipe, which is how that build produced a window stuck on an error page while `npm start` worked.
- `bin/verify.mjs` **boots its own bare runtime and cannot reach the roster** — treat its output as
  a diagnostic, never as a mount verdict (rule 5). `bin/preflight.mjs` is the static half: it
  resolves every row's package and validates each config against the plugin's own schema, and it
  prints which failure classes it cannot see. A row that mounts and contributes nothing is the
  failure mode both of them miss — **and `standingKeyFor` does not close it either.** Measured by
  the user from a shipped-`cordis` session, it proves **"it did not throw"** — the composition is
  usable and the standing mount key was ensured — **not** that any individual row contributes. So
  never present a preflight pass, a verify exit code, **or a clean `MOUNT OK`**, as "the preset
  works"; per-row contribution is a separate question with no standing procedure yet (D-40).
- `.gitignore` and `files` both matter when adding a preset directory: a new preset that is not
  listed in `package.json`'s `files` is silently absent from the published tarball while every
  local script still works, which is the one failure this repo cannot detect by running itself.
- **The git remote is load-bearing and is not in the repo** — `origin` is a local clone's config,
  not tracked content. A fresh clone has none, so `git push` fails with "no configured push
  destination" until someone runs `git remote add origin <url>`. `package.json`'s `repository.url`
  names the intended target, which is why that field is the authority rather than a comment. Do not
  store a token in the remote URL: this machine has Git Credential Manager
  (`git config --get credential.helper`), so a plain `https://github.com/<owner>/<repo>.git` remote
  authenticates from the OS credential store.
- **`git push` may fail in a sandboxed session even when HTTPS itself works**, and the failure is
  TLS-layer rather than credential-layer: measured here, schannel reports
  `CRYPT_E_NO_REVOCATION_CHECK` (revocation endpoints unreachable) and the OpenSSL backend reports
  `unable to get local issuer certificate`. When that happens, commit locally and hand the push to a
  normal terminal rather than reaching for a token — switching to token auth does not fix a TLS
  verification failure, and it puts a credential into the command history.
- **`bin/check-pack.mjs` is the only check that reads the PACKED tarball, and it is the only one
  that can see a `files`-allowlist omission.** Every other script in `bin/` reads the working tree,
  so all of them pass whether or not `package.json`'s `files` list is right — which is the failure
  the bullet above calls undetectable by running this repo. Run it as `node bin/check-pack.mjs`, or
  through CI (`.github/workflows/checks.yml`, which also runs the lint and preflight steps for the
  presets whose rows all resolve from this machine). Two things to keep straight: a
  **falsification must mutate a COPY**, never this tree,
  and **dropping `bin` from `files` is not a defect** because npm force-includes whatever the `bin`
  map names — the case that must fail is a dropped **preset directory**. The workflow deliberately
  does **not** run `verify.mjs`, `install.mjs`, or `drift-check.mjs`, and its header says why; a
  green run there is not a mount verdict (rule 5). See D-48.
- **Every `webServer` route sits OUTSIDE the browser authentication gate — that is a routing
  property, not a defect in any one row.** *(Recorded while the now-removed `/github` adapter row
  existed; the property itself is unchanged and is the reason this bullet survives D-51.)* The
  dispatcher returns on a named route before consulting the fallback that carries the only auth, so
  **any** route registered on `ctx.webServer` is reachable by anything that can reach the port, with
  no credential at the HTTP layer. Consequences to hold for the next such row: on this deployment's
  loopback bind that is invisible, but `dsh web --host 0.0.0.0` would publish every such route over
  the LAN — so a tunnel should forward to the loopback port rather than motivating a bind change;
  and a route must bring its own authentication (the removed adapter used an HMAC over the raw body,
  with `maxBodyBytes` as its only size bound).
- **A `405` from a `webServer` path is NOT evidence that a route is mounted.** The fallback seat
  answers an *unmatched* path with the same `405` a registered handler's own method guard returns, so
  `POST /some-route` and `POST /definitely-not-a-route` are indistinguishable that way — measured
  directly, both answering identically. The discriminating observation is whatever the **handler**
  answers once it is reached: for the removed adapter that was `503` (reached it, credential
  unresolvable) versus `401` (credential present, signature invalid), and the credential was resolved
  *before* the signature was verified. **Generalize the lesson, not the codes:** when checking
  whether a route is registered, find a response that only the handler can produce. See D-47.
- **`git` itself does not work against GitHub from this machine — not just `git push`.** Measured:
  `git clone https://github.com/...` fails with `CRYPT_E_NO_REVOCATION_CHECK (0x80092012)`, the
  same revocation-endpoint defect recorded above, while the GitHub **HTTPS API and codeload are
  reachable**. Anything that needs GitHub repository content should fetch it over `fetch`
  (the API, or a `codeload` tarball) rather than shelling out to `git clone` — with a caveat measured
  2026-09-19: `codeload` verifies from Node, the **API does not**, and `curl.exe` is a **third victim**
  of the same schannel defect as `git` — it cannot fetch a GitHub release asset at all
  (`curl: (35) schannel: … CRYPT_E_NO_REVOCATION_CHECK`, three retries, no file); the client that does
  work is .NET's `Invoke-WebRequest`. That API failure is a *different* defect — Node's **bundled**
  CA store lacks an intermediate GitHub's hosts need (`UNABLE_TO_VERIFY_LEAF_SIGNATURE`) — so do not
  conflate them, and **do not assume it is fixed:** `NODE_OPTIONS=--use-system-ca` is a fix that
  *exists*, not one in force (D-51 reverted the user-level value). Two process-local equivalents, both
  measured on Node v26.8.1: pass the flag in **argv** (`node --use-system-ca …`), or call
  `tls.setDefaultCACertificates(tls.getCACertificates('system'))` (85 certs) — either turns the same
  call into `HTTP 200`, and each binds only the process that runs it.
- **The working route for GitHub *API* access from a session is the `mcp-github` host row** in
  `profiles/web/cordis.patch.yml`: `@deepseek-ai/dsh-mcp-client` → GitHub's own **Go** binary
  (`$DSH_HOME/plugins/dsh-github-mcp/`, tools `mcp__github__*`). Go reads the Windows root store and
  performs no CRL/OCSP check, so **neither TLS defect above applies to it** — that is why the row works.
  Its token comes from `$DSH_HOME/.env` via `node --env-file`, never from the composition.
  **Posture, measured 2026-09-19:** at the user's explicit request ("全面放开") the row runs
  `--toolsets all` **without** `--read-only` → **90 tools, 53 of them writes, visible to every session
  and every delegated child**. The credential was then upgraded, and **writes work**: `push_files` and
  `create_pull_request` answered 2xx (so did a close-PR call), and `create_or_update_file`,
  `create_branch`, `actions_run_trigger`, `issue_write`, `add_issue_comment`, `merge_pull_request` all
  reached the API and failed only on the bogus arguments they were given. **`create_repository` was 403
  then, and is NO LONGER — measured 2026-09-24:** it returned `{"id":"1385636531","url":
  "https://github.com/ABccgh/dsh-duanju-script"}` and the repository exists. So the earlier
  "account-level, needs a **GitHub App**" reading was a property of the credential at that time, not of
  the tool; the App flags (`--app-id`/`--app-installation-id`/`--app-private-key-path`) were never
  exercised. **Re-probe before repeating the 403:** a permission reading has a date, and this line
  proves it can rot in the permissive direction. Still 403 as of that same day: star/unstar, and the
  reads `list_notifications`, `projects_list`, `list_code_scanning_alerts`, `list_dependabot_alerts`.
  **And one toolset gap that is NOT a permission fact:** there is **no tool that updates a repository**,
  so `archived: true` is unreachable through `mcp__github__*` at all — the 90 tools cover issue/PR/
  file/ref/tree/commit/release/ruleset/projects/actions, but not `PATCH /repos/{o}/{r}`. Measured
  2026-09-24, when `ABccgh/dsh-inbox` was archived (read-back `archived=true`) **over REST with the same
  token from `$DSH_HOME/.env`**, because that was the only route — the same pattern as
  `bin/push-api-ref.ps1`. Do not read "no MCP tool" as "not permitted".
  **Two traps that cost real state here, both worth knowing before probing permissions:**
  (i) **"Point the write probe at something that does not exist" is NOT a safe rule** — `push_files`
  *creates* its target branch, so the next probe in the list (`create_pull_request`) found a real head and
  opened a real PR. That artefact could only be closed, not deleted, because GitHub exposes no way to
  delete a pull request; `main` was never touched. (ii) **A 404 from a write probe aimed at a nonexistent
  object proves only that the *read* path was authorized** — GitHub answers 404 for a missing resource and
  403 for a real one you cannot touch, so only calls that reach a write endpoint settle anything.
  **"The tools are listed" and "the tools can act" remain separate claims — keep them separate.**
  None of this moves `git`: whole-history pushes still go through `bin/push-api-ref.ps1`.
- **`bin/push-api.ps1` is the fallback when git's TLS layer is blocked but the HTTPS API is not.**
  It reproduces `git push` over REST: blobs → trees (bottom-up) → commits → ref, with
  `-DryRun` to inspect and `-Force` to rewrite the ref. Run it as
  `$env:GH_TOKEN='…'; pwsh -File bin/push-api.ps1 -Base <sha>`.
  **Four things it exists to get right, each of which it first got wrong — and all four are failures
  of the *serialized body*, not of the call:**
  1. **`POST /git/trees` takes a BARE entry name in `path`, never a path.** Passing
     `bin/preflight.mjs` makes the API build a *subtree* named `bin/`, so the result lands as
     `bin/bin/preflight.mjs` and **every directory in the repository doubles**. That was pushed
     once and caught by listing the remote tree, not by the API refusing it — the API returned
     success. Always compare the remote tree against `git ls-files` after a push.
  2. **A commit message read through a PowerShell string capture loses its newlines**, collapsing
     to one long subject line. The API accepts that silently. Read messages through a file, and let
     the tree hash be the proof that content survived: the created tree SHA must equal
     `git rev-parse <sha>^{tree}`, and the script refuses to commit when it does not.
  3. **API-created commits usually have different SHAs from the local ones**, because the commit
     object is re-encoded. The trees and every blob keep their SHAs (raw bytes are uploaded base64),
     so the *content* is identical and only history identity differs. The script prints the local→remote
     map; the local clone's `main` then diverges from the remote by SHA while agreeing on content.
     **Measured refinement, so this is not over-read:** when the message, tree, author, committer and
     parent list all survive the round trip, re-encoding is *identity* and the two SHAs are equal —
     `ABccgh/dsh-account-balance`'s root commit is `e3d9a98` on both sides. Different SHAs are a
     consequence of *metadata differing*, not of the transport. Do not conclude from the divergence
     that the remote's tree is untrustworthy: compare trees, which is what the script's last line does.
  4. **An array that arrives from an `if` expression has lost its array-ness, and the JSON body is
     where that shows.** Same family as the two above — the value looks right in a parameter and is
     wrong in the **serialized body**, and the API's error names neither the flag nor the cause.
     Measured on this deployment's `pwsh 7.7.0-preview.4`, isolating the two branches of
     `$x = if (…) { @() } else { @($sha) }` and serializing each with
     `@{ parents = $x } | ConvertTo-Json`:

     | how the value was produced | `-is [array]` | emitted as |
     | --- | --- | --- |
     | inline literal `parents = @()` | `True` | `{"parents":[]}` |
     | a variable holding `@()` | `True` | `{"parents":[]}` |
     | from `if`, branch `@()` | **`False` (`$null`)** | `{"parents":null}` |
     | from `if`, branch `@($sha)` | **`False` (bare String)** | `{"parents":"<sha>"}` |
     | from `if` with a leading comma on **both** branches | `True` | `[]` / `["<sha>"]` |

     So **`@()` and `@($sha)` do not survive assignment from an `if`** unless written `,@()` and
     `,@($sha)`; the fix is the comma, on both branches, and it restores the array in both. Each
     wrong spelling is a different `422` naming neither git nor PowerShell:
     `422 For 'properties/parents', nil is not an array` for the null, and (reported, not re-measured
     here) `422 "<sha>" is not an array` for a double-wrapped `[["<sha>"]]`. **Guard the value where
     it is used, not where it is assigned** — `if ($parents -isnot [array]) { throw … }` — because
     that is the last point before it becomes a request body. (D-46.)
- **`bin/push-api-ref.ps1` is the newer of the two, and the one to reach for on a fresh shape.**
  It walks **both** ranges (`-Base` local, `-RemoteBase` remote), refuses to run when their lengths
  disagree, parents the first new commit at the **remote tip** (parenting at the mapped base produces
  a *sibling* and a `422 Update is not a fast forward`), and verifies every blob/tree/commit id it
  sends against `git`'s own value. Extra flags: `-AllowUnrelated` when API-created commits have no
  local counterpart, `-Force` to move the branch onto the whole local history, `-Init` to create a
  branch in a repository that has commits but no ref, **`-RemoteOnlyParent`** when the first commit's
  parent exists only on the remote (below), and `-RemoteOwner`/`-RemoteRepo`/`-Branch` so it
  is not hardcoded to one repository. `bin/push-api.ps1` is left in place unchanged; **why the two
  exist rather than one** is D-32, and the empty-repository facts are D-33.
- **A repository with no commits at all cannot be pushed to by either script.** `POST /git/blobs`
  answers `409 Git Repository is empty.` — the git database endpoints are unusable until the
  repository owns a commit. Bootstrap it with one Contents-API write, then push with `-Force`. Its
  commit survives as the pushed history's **ancestor** rather than becoming an unreachable object
  whenever the payload's own first commit is a **root** — measured on `dsh-ima-kb`, where it then had
  to be dropped by re-creating that commit with no parent. Automating the bootstrap was tried and
  dropped: it roots the branch in two commits that are not the payload. (D-33, D-45.) **No
  ancestor-of-that-kind remains in `dsh-ima-kb` as of D-46** — the repository was deleted and
  re-created, and its `auto_init` commit is in the new history's ancestry **not at all** (the
  re-created root has `parents: 0`), so the caveat above is now a property of *bootstrap-by-Contents-API*
  in general and no longer of that repository.
- **The remote-only-parent limitation is CLOSED IN CODE (`-RemoteOnlyParent`), the crash is fixed,
  and the mode is now MEASURED (D-56) — the "UNPROVEN in a real push" reading this bullet used to
  open with is superseded at its own end, below.** This bullet previously read "neither script can
  push a commit whose parent exists only on the remote"; that is no longer true of
  `bin/push-api-ref.ps1`. The original gap, kept because it is the reason the flag exists: **the
  topology of any remote history rooted in a server-side commit (`auto_init`, a README bootstrap, a
  Contents-API write).** Both scripts derived parent identity from a range walk over **local**
  objects, so there was no local base under a remote-only parent, and the API rejects a commit whose
  parent it does not hold. The two failure shapes differed and both were reproduced:
  `push-api.ps1` **crashed rather than erroring** when its range was empty (`$Base..HEAD` with
  `$Base` = `HEAD`) — `GitBytes` returned an empty array, PowerShell flattened it to `$null`, and the
  caller fed that to `[System.Text.Encoding]::UTF8.GetString` — while `push-api-ref.ps1` **refused**
  at the pairing check (`range length mismatch … refusing to run`). **`-AllowUnrelated` did not
  help:** it governs only the first-parent ancestry walk, not the pairing check. **The gap was in the
  scripts, not the API** — `POST /git/commits` accepts a remote-only parent.
  **What changed (D-48):** `-RemoteOnlyParent` skips the pairing check and the remote-range walk and
  parents the first uploaded commit at the **current remote tip**, so the ref move stays a
  fast-forward and needs no `-Force`; the ancestry walk is skipped too, because the caller has
  asserted there is no local counterpart for it and the **API's own `422 Update is not a fast
  forward`** guards the move server-side, which is stronger than a bounded chain walk.
  `push-api.ps1` now throws `no commits in <base>..HEAD …` with a pointer to that flag instead of
  crashing. **Measured:** both scripts parse; the empty-range guard fires on `-Base <HEAD>` and
  **not** on a real range; `-RemoteOnlyParent` with `-Init` or `-Force` is rejected with its own
  message while `-Init` alone is unaffected.
  **THE HAPPY PATH IS NOW MEASURED (D-56) — the earlier "NOT measured" note is superseded.** With a
  live token the flag pushed `ABccgh/dsh-ima-kb`: `refs/heads/main` moved `4e2d9cc` → `53a3f66`,
  the new commit **parents at the remote tip** so the move was a **fast-forward** and `-Force` was
  never needed, and five checks pass **against the API rather than the script's own report** —
  remote tree `ebdd375` equals the local tree, one parent, 9 blobs identical to `git ls-files`, no
  doubled path segment, 18-line message intact. **Two operational facts learned on the way, both
  worth knowing before the next push:** the script runs git as `git -C $PWD`, so it operates on the
  **caller's** repository — invoke it **from the repo being pushed** and pass a **full SHA** in
  `-Base`, or it reports `no local commits in <sha>..HEAD` for a range that plainly exists. And
  `git push` remains dead **independently of credentials**: retested with a valid token in the URL
  it still fails with `schannel: CRYPT_E_NO_REVOCATION_CHECK`, while **git's OpenSSL backend is not
  an escape either** — no CA bundle exists anywhere on this machine for it to verify against.
