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
 * what `drift-check.mjs` compares against by default. The two local presets do
 * NOT share a lineage: `dsh-smith` was copied from the shipped `cordis` preset
 * (itself `standard` plus the self-referential Cordis toolset), while
 * `dsh-forge` is `standard` plus software-development rows. Comparing the wrong
 * one reports drift for every row that legitimately differs, which is worse than
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
