#!/usr/bin/env node
/**
 * The preset registry: one entry per preset this repository ships.
 *
 * Before this file existed, `install.mjs`, `verify.mjs`, `lint-skills.mjs` and
 * `drift-check.mjs` each hardcoded their own `const PRESET_ID = 'dsh-smith'`.
 * That is fine for one preset and actively misleading for two: adding a second
 * preset would have meant four independent edits with four chances to leave one
 * script pointing at the wrong directory — and every one of those four scripts
 * reports a wrong path as a *successful* run against the wrong file.
 *
 * So the id lives here once, and each script asks for the paths it needs.
 *
 * `repoDir` is the directory name under the repository root. It is kept as an
 * explicit field rather than derived from `id`, because a rename of either one
 * should be a visible edit here rather than a silent mismatch between a
 * directory name and a composition file that both still parse.
 *
 * `upstreamPreset` is the shipped preset each local preset began as, and it is
 * what `drift-check.mjs` compares against by default. The local presets do
 * NOT share one lineage: `dsh-smith` was copied from the shipped `cordis` preset
 * (itself `standard` plus the self-referential Cordis toolset), while
 * `dsh-forge`, `dsh-ck3-mod` and `dsh-duanju` are each `standard` plus their own
 * rows — forge adds software-development rows, ck3-mod replaces the identity and
 * the team with a Crusader Kings III mod-authoring surface, and duanju replaces
 * them with a vertical short-drama production line. Comparing the wrong one
 * reports drift for every row that legitimately differs, which is worse than
 * reporting nothing.
 */
import { access } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Repository root — `bin/`'s parent. */
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Every preset this repository ships.
 *
 * `expectedTools` is what a real session's tool table must contain, and it is
 * deliberately only the names a session is known to be able to lose: the named
 * experts and the generic delegation tool. It is NOT every tool the preset
 * mounts — `verify.mjs` prints this list as the thing to eyeball in a session it
 * cannot open, and a longer list does not make that check stronger.
 *
 * `promptSurface` is the one capability that is NOT a registered tool and
 * therefore cannot appear in `tools` at all: `run_code` is the PTC transport,
 * reserved against registration (`dsh-tools/lib/index.js:2780`) and materialized
 * only at schema assembly. Listing it under `expectedTools` would make
 * `verify.mjs` instruct a reader to look in the wrong place, so it lives in its
 * own field with its own instruction.
 */
export const PRESETS = {
  'dsh-smith': {
    repoDir: 'dsh-smith',
    displayName: 'DSH 智能体工坊 · DSH Agent Smith',
    upstreamPreset: 'cordis',
    expectedTools: ['expert_architect', 'expert_verifier', 'expert_protocol', 'expert_chronicler'],
    promptSurface: undefined,
  },
  'dsh-ck3-mod': {
    repoDir: 'dsh-ck3-mod',
    displayName: 'CK3 模组工坊 · CK3 Mod Forge',
    upstreamPreset: 'standard',
    // The three experts, the fork surface, and the FOUR tools a session on this
    // preset is known to be able to lose. All four come from the host-plane
    // `dsh-ck3-modcheck` plugin, which is installed per profile and NOT shipped by
    // this repository, so a session that lacks them is a broken install rather than
    // a broken composition.
    // `ck3_mod_evidence` reads CK3's runtime logs, which only exist after the game
    // has been launched once — a session on a machine where it never has will still
    // have the tool, reporting "unavailable" with a reason.
    // `verify.mjs` prints this list as the thing to eyeball in a session it cannot
    // open, and a longer list does not make that check stronger.
    expectedTools: [
      'expert_modd',
      'expert_verifier',
      'expert_chronicler',
      'subagent_fork',
      'ck3_modcheck',
      'ck3_mod_init',
      'ck3_mod_status',
      'ck3_mod_evidence',
    ],
    promptSurface: undefined,
  },
  'dsh-forge': {
    repoDir: 'dsh-forge',
    displayName: 'DSH 研发工坊 · DSH Forge',
    upstreamPreset: 'standard',
    expectedTools: [
      'expert_architect',
      'expert_verifier',
      'expert_debugger',
      'expert_protocol',
      'expert_chronicler',
      'subagent',
      'subagent_fork',
      'workflow',
      'job_list',
    ],
    promptSurface: 'run_code',
  },
  'dsh-duanju': {
    repoDir: 'dsh-duanju',
    displayName: '短剧工坊 · DSH Duanju',
    upstreamPreset: 'standard',
    // The FOUR named experts and the fork surface. This preset now covers the stage AFTER the
    // script: 定稿正文 → 28 列分镜表 → 平台可导入 xlsx → 生成 → 成片 → 投稿. The script stage
    // itself belongs to `dsh-script`, and the platform-side steps are HUMAN-ONLY (有戏AI ships
    // no CLI and no public API, and the workspace holds no credential for it).
    //
    // WHY THE THREE SCRIPT EXPERTS ARE GONE FROM THIS LIST. Until 2026-09-24 this preset carried
    // `expert_script` / `expert_doctor` / `expert_dialogue` — the screenwriter, the script doctor
    // and the dialogue coach. Their functional twins live in `dsh-script`, and two presets
    // publishing the same three roles is the same-capability-twice shape this repository is
    // supposed to avoid. They were removed here and replaced by the two roles this stage needs.
    //
    // WHY NO `duanju_*` NAME IS LISTED. The script-domain tools come from a HOST-plane row
    // (`dsh-duanju-script`, a plugin this repository does not ship and that this preset composes
    // no row for), so they are registered into the host `tools` registry and are visible in EVERY
    // session, not just this preset's. Listing them here would make `verify.mjs` instruct a reader
    // to run a check that is true on every preset — a tautology. The preset-plane discriminators
    // are the four expert names below.
    //
    // Note the tool names are NOT a claim about what the plugin registers: it is down to three
    // (`duanju_gate`, `duanju_recall`, `duanju_checkpoint`), all script-side. This list is about
    // the PRESET's rows, which is a different question.
    expectedTools: [
      'expert_board',
      'expert_shootability',
      'expert_verifier',
      'expert_chronicler',
      'subagent_fork',
    ],
    promptSurface: undefined,
  },
  'dsh-script': {
    repoDir: 'dsh-script',
    displayName: '剧本工坊 · DSH Script',
    upstreamPreset: 'standard',
    // The narrower sibling of `dsh-duanju`: **the script and nothing else**. 选题 → 一句话钩子
    // → 圣经 → 分集功能表 → 逐集正文 → 交给用户在平台上评估 → 按读数改稿. The 28-column
    // 分镜表 and the platform's xlsx import templates are deliberately OUT OF SCOPE, which is
    // why `shotlist` is gone and why the plugin's three storyboard/template tools were deleted.
    //
    // THE FOUR NAMED EXPERTS ARE THE DISCRIMINATOR. The plugin's tools (`duanju_gate`,
    // `duanju_recall`, `duanju_checkpoint`) are HOST-plane — one row in the profile's
    // `cordis.patch.yml`, no row here — so they are visible in every session and are
    // worthless as a preset test. What proves a session is on THIS preset is these four
    // names plus `subagent_fork` (the five delegation rows).
    //
    // There is deliberately NO `expert_verifier`, NO `expert_chronicler`, NO `tool-goal`,
    // NO `tool-workflow`, NO `tool-ralph` and NO generic `subagent` name here: those rows are
    // not composed, and a session that shows them is not on this preset. `verify.mjs` prints
    // this list as the thing to eyeball in a session it cannot open, and a longer list does
    // not make that check stronger.
    //
    // `preflight --preset dsh-script` CAN run in CI: every row resolves from a shipped
    // `@deepseek-ai/*` package, because the plugin needs no row (it is host-plane, so a
    // missing plugin costs the tools, not the mount). Measured on this machine:
    // `validated: 16   skipped: 9   failed: 0`.
    expectedTools: [
      'expert_script',
      'expert_doctor',
      'expert_dialogue',
      'expert_continuity',
      'subagent_fork',
    ],
    promptSurface: undefined,
  },
}

/** The preset an unspecified invocation acts on. */
export const DEFAULT_PRESET = 'dsh-smith'

/** The harness home the scripts act in. */
export function dshHome() {
  return process.env.DSH_HOME ?? join(homedir(), '.dsh')
}

/** The repository copy of a preset directory. */
export function repoPresetDir(id = DEFAULT_PRESET) {
  const entry = presetEntry(id)
  return join(REPO_ROOT, entry.repoDir)
}

/** Where a preset installs, whether or not it is installed right now. */
export function installedPresetDir(id = DEFAULT_PRESET, home = dshHome()) {
  return join(home, '.agent-presets', id)
}

/** The repository copy of a preset's composition file. */
export function repoComposition(id = DEFAULT_PRESET) {
  return join(repoPresetDir(id), 'agent.cordis.yml')
}

/** The installed copy of a preset's composition file. */
export function installedComposition(id = DEFAULT_PRESET, home = dshHome()) {
  return join(installedPresetDir(id, home), 'agent.cordis.yml')
}

/** Resolve one registry entry, failing loud on an id this repository does not ship. */
export function presetEntry(id = DEFAULT_PRESET) {
  const entry = Object.hasOwn(PRESETS, id) ? PRESETS[id] : undefined
  if (entry === undefined) {
    throw new UnknownPresetError(id)
  }
  return entry
}

/** True when `id` names a preset this repository ships. */
export function isKnownPreset(id) {
  return Object.hasOwn(PRESETS, id)
}

/**
 * Read `--preset <id>` from a script's argv, falling back to {@link DEFAULT_PRESET}.
 *
 * Kept as a shared helper rather than four copies so the four scripts cannot
 * disagree about the flag's spelling or its default. Parse errors are the
 * caller's to report — this function throws {@link UnknownPresetError}, and the
 * scripts that need a friendly message catch it at their top level.
 */
export function presetFromArgv(argv, fallback = DEFAULT_PRESET) {
  const index = argv.indexOf('--preset')
  if (index === -1) return fallback
  const value = argv[index + 1]
  if (value === undefined || value.startsWith('--')) {
    throw new Error('--preset needs a preset id')
  }
  if (!isKnownPreset(value)) throw new UnknownPresetError(value)
  return value
}

/** Raised when an invocation names a preset this repository does not define. */
export class UnknownPresetError extends Error {
  constructor(id) {
    super(`unknown preset ${JSON.stringify(id)}: this repository ships ${Object.keys(PRESETS).join(', ')}`)
    this.name = 'UnknownPresetError'
    this.presetId = id
  }
}

/** True when a file exists and can be read. */
export async function fileExists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

/** Where a preset's composition file actually is: installed copy first, repo copy as the fallback. */
export async function preferInstalledComposition(id = DEFAULT_PRESET, home = dshHome()) {
  const installed = installedComposition(id, home)
  return (await fileExists(installed)) ? installed : repoComposition(id)
}
