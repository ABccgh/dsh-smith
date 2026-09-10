# AGENTS.md — D:\DeepSeek Harness

This tree is the **`dsh-smith` npm package** and the preset it ships. Source of truth for the
composition is `dsh-smith/agent.cordis.yml`.

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

## Editing rules

5. **Edit the preset here, never the installed copy by hand.** The live file is
   `${DSH_HOME}/.agent-presets/dsh-smith/agent.cordis.yml`. A hand edit there creates silent
   drift from this repo. Change `dsh-smith/**` and then re-install — `node bin/install.mjs`
   is the *sanctioned* writer for that path, and `--force` is a real replace (delete then
   copy), which is what removes skills a newer version dropped. `dsh-smith/` is a *user*
   preset, so it is authoring-free territory; the shipped presets under the deployment's own
   `agent-presets` directory (`standard`, `ptc`, `minimal`, `cordis`) are the ones that must
   never be written at all.

## Boundaries

- Do not modify, migrate, or delete anything under `~/.dsh/**` — profiles, sessions, or the
  installed preset — from a session rooted here.
- `bin/verify.mjs` mounts the preset; a row that mounts and contributes nothing is the
  failure mode to check for, not a mount error.
