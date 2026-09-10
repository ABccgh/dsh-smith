#!/usr/bin/env node
/**
 * Install one of this repository's agent presets into this machine's DeepSeek
 * Harness home.
 *
 * The harness discovers locally authored presets as one directory per preset
 * under `${DSH_HOME:-$HOME/.dsh}/.agent-presets/<id>/`, so installing is a
 * directory copy — nothing is generated and no harness file is edited.
 *
 * Two failure modes this script is written to avoid, both of which are silent
 * by nature:
 *
 *   1. Installing into a directory the harness never scans. If `DSH_HOME` is
 *      unset in an environment that does not use `~/.dsh`, the copy succeeds and
 *      the preset simply never appears. The check below reports which home was
 *      chosen and how to override it, before anything is written.
 *   2. Leaving the previous version's files behind. A plain recursive copy over
 *      an existing directory merges: a skill removed in the new version stays on
 *      disk and keeps loading. Replacing therefore removes the target first, so
 *      what is installed is exactly what this repository contains.
 *
 * Usage:
 *   node bin/install.mjs                    install dsh-smith (refuses to overwrite)
 *   node bin/install.mjs --preset <id>      install a specific preset
 *   node bin/install.mjs --force            replace an existing installation
 *   node bin/install.mjs --home <dir>       install into a specific DSH home
 *
 * `--preset` defaults to `dsh-smith`, so every invocation that predates the
 * second preset keeps its exact meaning.
 */
import { cp, mkdir, readdir, rm, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { UnknownPresetError, presetEntry, presetFromArgv, repoPresetDir } from './presets.mjs'

/** Arguments this script understands. */
function parseArgs(argv) {
  const homeIndex = argv.indexOf('--home')
  const explicitHome = homeIndex === -1 ? undefined : argv[homeIndex + 1]
  if (homeIndex !== -1 && explicitHome === undefined) {
    console.error('install: --home needs a directory argument')
    process.exit(1)
  }
  return { force: argv.includes('--force'), explicitHome, presetId: presetFromArgv(argv) }
}

let parsed
try {
  parsed = parseArgs(process.argv.slice(2))
} catch (error) {
  console.error(`install: ${error instanceof UnknownPresetError ? error.message : String(error)}`)
  console.error('install: shipped presets are listed in bin/presets.mjs.')
  process.exit(1)
}

const { force, explicitHome, presetId: PRESET_ID } = parsed
const SOURCE = repoPresetDir(PRESET_ID)
const DSH_HOME = explicitHome ?? process.env.DSH_HOME ?? join(homedir(), '.dsh')
const ROOT = join(DSH_HOME, '.agent-presets')
const TARGET = join(ROOT, PRESET_ID)

async function exists(path) {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

/**
 * Decide whether a directory looks like a DeepSeek Harness home.
 *
 * Deliberately a warning, not a refusal: a first run before any profile exists
 * is legitimate, and a wrong refusal is worse than an ignorable warning. What
 * matters is that the chosen path is printed, so a silent no-op becomes visible.
 * `--home` suppresses the warning, because an explicit path is the user's call.
 */
async function describeHome() {
  const clues = []
  for (const name of ['profiles', 'sessions', 'settings.yaml', 'storages']) {
    if (await exists(join(DSH_HOME, name))) clues.push(name)
  }
  return clues
}

async function main() {
  if (!(await exists(SOURCE))) {
    console.error(`install: source preset not found at ${SOURCE}`)
    console.error('install: run this script from a clone of the repository.')
    process.exitCode = 1
    return
  }

  console.log(`home:   ${DSH_HOME}`)
  if (explicitHome === undefined && process.env.DSH_HOME === undefined) {
    console.log('        (no DSH_HOME in the environment; using ~/.dsh)')
  }
  const clues = await describeHome()
  if (clues.length === 0 && explicitHome === undefined) {
    console.warn('warn:   this directory has none of the usual harness entries')
    console.warn('warn:   (profiles/, sessions/, storages/, settings.yaml).')
    console.warn('warn:   If your harness lives elsewhere, set DSH_HOME or pass --home <dir> —')
    console.warn('warn:   otherwise this preset installs where nothing will scan for it.')
  } else if (clues.length > 0) {
    console.log(`found:  ${clues.join(', ')}`)
  }
  console.log(`target: ${TARGET}`)
  console.log('')

  if (await exists(TARGET)) {
    if (!force) {
      console.error(`install: ${TARGET} already exists — refusing to overwrite.`)
      console.error('install: pass --force to replace it, or remove the directory yourself first.')
      process.exitCode = 1
      return
    }
    // Remove before copying: a merge would keep files the new version dropped,
    // and a stale skill still loads. Replacement must equal this repository.
    await rm(TARGET, { recursive: true, force: true })
    console.log('replacing the existing installation (--force)')
  }

  await mkdir(ROOT, { recursive: true })
  await cp(SOURCE, TARGET, { recursive: true, force: true })

  let entries
  try {
    entries = await readdir(TARGET)
  } catch (error) {
    console.error(`install: copied but cannot read back ${TARGET}`)
    console.error(`install:   ${error && error.message ? error.message : String(error)}`)
    process.exitCode = 1
    return
  }

  console.log(`installed: ${TARGET}`)
  console.log(`contents:  ${entries.join(', ')}`)
  console.log('')
  console.log(`next:      node bin/verify.mjs --preset ${PRESET_ID} && node bin/lint-skills.mjs --preset ${PRESET_ID}`)
  console.log('then:      open a NEW session — a preset is mounted at session start, so a')
  console.log('           session that is already open will not gain this one.')
  console.log(`           In the mode picker choose 「${presetEntry(PRESET_ID).displayName}」.`)
}

await main()
