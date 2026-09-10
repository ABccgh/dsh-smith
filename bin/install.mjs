#!/usr/bin/env node
/**
 * Install the `dsh-smith` agent preset into this machine's DeepSeek Harness home.
 *
 * The harness discovers locally authored presets as one directory per preset
 * under `${DSH_HOME:-$HOME/.dsh}/.agent-presets/<id>/`, so installing is a
 * directory copy — nothing is generated and no harness file is edited.
 *
 * Refuses to overwrite an existing preset of the same name: a preset already
 * there may be one the user has been editing, and an installer must not be the
 * thing that silently replaces it.
 */
import { cp, mkdir, readdir, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const PRESET_ID = 'dsh-smith'
const SOURCE = resolve(dirname(fileURLToPath(import.meta.url)), '..', PRESET_ID)
const DSH_HOME = process.env.DSH_HOME ?? join(homedir(), '.dsh')
const ROOT = join(DSH_HOME, '.agent-presets')
const TARGET = join(ROOT, PRESET_ID)

const force = process.argv.includes('--force')

async function exists(path) {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

async function main() {
  if (!(await exists(SOURCE))) {
    console.error(`install: source preset not found at ${SOURCE}`)
    console.error('install: run this script from a clone of the repository.')
    process.exitCode = 1
    return
  }

  if (await exists(TARGET)) {
    if (!force) {
      console.error(`install: ${TARGET} already exists — refusing to overwrite.`)
      console.error('install: pass --force to replace it, or remove the directory yourself first.')
      process.exitCode = 1
      return
    }
    console.warn(`install: replacing the existing preset at ${TARGET} (--force)`)
  }

  await mkdir(ROOT, { recursive: true })
  await cp(SOURCE, TARGET, { recursive: true, force: true })

  const entries = await readdir(TARGET)
  console.log(`installed: ${TARGET}`)
  console.log(`contents:  ${entries.join(', ')}`)
  console.log('')
  console.log('next:      node bin/verify.mjs')
  console.log('then:      start a session and pick the mode "DSH 智能体工坊"')
}

await main()
