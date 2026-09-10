# AGENTS.md — D:\DeepSeek Harness

This tree is the **`dsh-smith` npm package** and the preset it ships. Source of truth for the
composition is `dsh-smith/agent.cordis.yml`.

## Evidence rules

1. **Session logs cannot prove absence.** `~/.dsh/sessions/**` files contain **only a
   session header** — no turns, no tool calls, no tool table. Both filename variants are in
   scope and both are header-only: a census at the time of writing matched 117 `.zstd` files
   by extension, `109 session.jsonl.zstd` + `8 session.v3.jsonl.zstd` (the `.v3` name is what
   a delegated child gets). Grepping them for a tool name, a row id, or a decision returns
   nothing whether or not the thing existed, so a zero-hit scan is void: it is only evidence
   if a control string known to be present **also** fails. To establish what a session could
   do, enumerate **this live session's own tool table**; do not scan logs.
2. **A runtime claim beats a reading.** Read the installed package's declarations under
   `node_modules/@deepseek-ai/<pkg>/lib/types/` and the implementation in `lib/index.js`
   before asserting a service key, gate, or lifetime; state the file and line in the record.

## Editing rules

3. **Edit the preset here, never the installed copy by hand.** The live file is
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
