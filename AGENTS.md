# AGENTS.md — D:\DeepSeek Harness

This tree is the **`dsh-smith` npm package** and the presets it ships. Source of truth for each
composition is that preset's own directory: `dsh-smith/agent.cordis.yml` (builds harness agents
and Cordis plugins) and `dsh-forge/agent.cordis.yml` (software delivery). `bin/presets.mjs` is
the single registry of which presets exist, which directory each lives in, and which shipped
preset each one was copied from — the four tool scripts read their paths from it, so a preset
id is defined in exactly one place.

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
     the working directory is not evidence.

## Editing rules

6. **Edit the preset here, never the installed copy by hand.** The live files are
   `${DSH_HOME}/.agent-presets/<id>/agent.cordis.yml`. A hand edit there creates silent
   drift from this repo. Change `dsh-smith/**` or `dsh-forge/**` and then re-install —
   `node bin/install.mjs --preset <id>` is the *sanctioned* writer for that path, and
   `--force` is a real replace (delete then copy), which is what removes skills a newer
   version dropped. Both local preset directories are *user* preset territory and are
   authoring-free; the shipped presets under the deployment's own `agent-presets`
   directory (`standard`, `ptc`, `minimal`, `cordis`) are the ones that must never be
   written at all.

7. **This repo ships presets and nothing else.** Two directories — `dsh-smith/` and `dsh-forge/` —
   are the whole owned surface, and each is written to its install target only through
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
   belongs to the same history: nothing balance-shaped ships from here or is mounted there.)*

## Boundaries

- Do not modify, migrate, or delete anything under `~/.dsh/**` — profiles, sessions, or other
  presets' installs — from a session rooted here, **except** the two preset directories this
  repo owns (`~/.dsh/.agent-presets/dsh-smith` and `.../dsh-forge`), and only through
  `bin/install.mjs`, which is the sanctioned writer for exactly those two paths. A hand edit
  under `~/.dsh` is still a violation even for an owned preset.
- `bin/verify.mjs` **boots its own bare runtime and cannot reach the roster** — treat its output as
  a diagnostic, never as a mount verdict (rule 5). `bin/preflight.mjs` is the static half: it
  resolves every row's package and validates each config against the plugin's own schema, and it
  prints which failure classes it cannot see. A row that mounts and contributes nothing is the
  failure mode both of them miss, so only `standingKeyFor` answers it. Never present a preflight
  pass, or a verify exit code, as "the preset works".
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
- **`bin/push-api.ps1` is the fallback when git's TLS layer is blocked but the HTTPS API is not.**
  It reproduces `git push` over REST: blobs → trees (bottom-up) → commits → ref, with
  `-DryRun` to inspect and `-Force` to rewrite the ref. Run it as
  `$env:GH_TOKEN='…'; pwsh -File bin/push-api.ps1 -Base <sha>`.
  **Three things it exists to get right, each of which it first got wrong:**
  1. **`POST /git/trees` takes a BARE entry name in `path`, never a path.** Passing
     `bin/preflight.mjs` makes the API build a *subtree* named `bin/`, so the result lands as
     `bin/bin/preflight.mjs` and **every directory in the repository doubles**. That was pushed
     once and caught by listing the remote tree, not by the API refusing it — the API returned
     success. Always compare the remote tree against `git ls-files` after a push.
  2. **A commit message read through a PowerShell string capture loses its newlines**, collapsing
     to one long subject line. The API accepts that silently. Read messages through a file, and let
     the tree hash be the proof that content survived: the created tree SHA must equal
     `git rev-parse <sha>^{tree}`, and the script refuses to commit when it does not.
  3. **API-created commits have different SHAs from the local ones**, because the commit object is
     re-encoded. The trees and every blob keep their SHAs (raw bytes are uploaded base64), so the
     *content* is identical and only history identity differs. The script prints the local→remote
     map; the local clone's `main` then diverges from the remote by SHA while agreeing on content.
