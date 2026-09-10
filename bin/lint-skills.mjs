#!/usr/bin/env node
/**
 * Lint the preset's skill files.
 *
 * A skill is discovered by its directory and published by the YAML frontmatter in
 * `SKILL.md`. The failure mode this script exists for is silent: a malformed
 * frontmatter block, a missing `name`, or a missing `description` makes the skill
 * drop out of the catalog without an error anyone sees — and the README keeps
 * promising a skill that is no longer loadable.
 *
 * Checks, per skill directory:
 *
 *   * `SKILL.md` exists;
 *   * it opens with a `---` frontmatter block that is closed;
 *   * the block declares a non-empty `name` and a non-empty `description`;
 *   * `name` equals the directory name (the catalog keys on it);
 *   * the `description` is long enough to be useful as a trigger cue;
 *   * the body after the frontmatter is not empty.
 *
 * Extra frontmatter keys are reported as notes rather than errors: the loader may
 * accept keys this script does not know about.
 *
 * Usage:
 *   node bin/lint-skills.mjs                 lint the dsh-smith repo copy
 *   node bin/lint-skills.mjs --preset <id>   lint a specific preset's repo copy
 *   node bin/lint-skills.mjs --path <dir>    lint a specific preset directory
 *   node bin/lint-skills.mjs --installed     lint the installed copy
 */
import { readdir, readFile, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import {
  dshHome,
  installedPresetDir,
  presetEntry,
  presetFromArgv,
  repoPresetDir,
  UnknownPresetError,
} from './presets.mjs'

let PRESET_ID
try {
  PRESET_ID = presetFromArgv(process.argv.slice(2))
} catch (error) {
  console.error(`lint-skills: ${error instanceof UnknownPresetError ? error.message : String(error)}`)
  process.exit(1)
}

const DSH_HOME = dshHome()
const REPO_PRESET = repoPresetDir(PRESET_ID)
const INSTALLED_PRESET = installedPresetDir(PRESET_ID, DSH_HOME)
/** Below this, a description is too terse to work as a "use when…" cue. */
const MIN_DESCRIPTION = 40

/** Known frontmatter keys; anything else is a note, not an error. */
const KNOWN_KEYS = new Set(['name', 'description', 'allowed-tools', 'license', 'version', 'metadata'])

/**
 * Parse a SKILL.md frontmatter block.
 *
 * Deliberately minimal: flat `key: value` pairs only, which is what every skill in
 * this repository uses. It is a linter, not a YAML implementation, and it reports
 * anything it cannot read rather than guessing.
 */
function parseFrontmatter(text) {
  const normalized = text.replace(/^\uFEFF/, '')
  if (!normalized.startsWith('---')) return { error: 'does not start with a `---` frontmatter fence' }
  const end = normalized.indexOf('\n---', 3)
  if (end === -1) return { error: 'frontmatter fence `---` is never closed' }
  const block = normalized.slice(normalized.indexOf('\n', 3) + 1, end + 1)
  const body = normalized.slice(end + 4)

  const fields = new Map()
  for (const rawLine of block.split('\n')) {
    const line = rawLine.trimEnd()
    if (line.trim() === '' || line.trimStart().startsWith('#')) continue
    const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line)
    if (match === null) {
      return { error: `frontmatter line is not a flat \`key: value\` pair: ${JSON.stringify(line)}` }
    }
    let value = match[2].trim()
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
      (value.startsWith("'") && value.endsWith("'") && value.length > 1)
    ) {
      value = value.slice(1, -1)
    }
    fields.set(match[1], value)
  }
  return { fields, body }
}

async function presetDir() {
  const index = process.argv.indexOf('--path')
  if (index !== -1 && process.argv[index + 1] !== undefined) return resolve(process.argv[index + 1])
  if (process.argv.includes('--installed')) return INSTALLED_PRESET
  return REPO_PRESET
}

async function main() {
  const base = await presetDir()
  const skillsRoot = join(base, 'skills')

  try {
    const info = await stat(skillsRoot)
    if (!info.isDirectory()) throw new Error('not a directory')
  } catch {
    console.error(`lint-skills: no skills directory at ${skillsRoot}`)
    console.error('lint-skills: install the preset first, or pass --path <preset dir>.')
    process.exitCode = 1
    return
  }

  const entries = await readdir(skillsRoot, { withFileTypes: true })
  const dirs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()
  if (dirs.length === 0) {
    console.error(`lint-skills: ${skillsRoot} contains no skill directories`)
    process.exitCode = 1
    return
  }

  console.log(`linting ${dirs.length} skill(s) under ${skillsRoot}`)
  console.log('')

  let failures = 0
  const notes = []

  for (const dir of dirs) {
    const file = join(skillsRoot, dir, 'SKILL.md')
    let text
    try {
      text = await readFile(file, 'utf8')
    } catch {
      console.error(`FAIL  ${dir}: SKILL.md is missing`)
      failures += 1
      continue
    }

    const parsed = parseFrontmatter(text)
    if (parsed.error !== undefined) {
      console.error(`FAIL  ${dir}: ${parsed.error}`)
      failures += 1
      continue
    }

    const problems = []
    const name = parsed.fields.get('name')
    const description = parsed.fields.get('description')

    if (name === undefined || name === '') problems.push('frontmatter has no `name`')
    else if (name !== dir) problems.push(`\`name\` is "${name}" but the directory is "${dir}"`)
    if (description === undefined || description === '') problems.push('frontmatter has no `description`')
    else if (description.length < MIN_DESCRIPTION) {
      problems.push(`\`description\` is only ${description.length} chars; it drives skill selection`)
    }
    if (parsed.body.trim() === '') problems.push('body after the frontmatter is empty')

    for (const key of parsed.fields.keys()) {
      if (!KNOWN_KEYS.has(key)) notes.push(`${dir}: extra frontmatter key \`${key}\``)
    }

    if (problems.length > 0) {
      console.error(`FAIL  ${dir}`)
      for (const problem of problems) console.error(`        ${problem}`)
      failures += 1
      continue
    }

    console.log(`ok    ${dir}  (name="${name}", description ${description.length} chars, body ${parsed.body.trim().length} chars)`)
  }

  console.log('')
  for (const note of notes) console.log(`note  ${note}`)
  if (notes.length > 0) console.log('')

  if (failures > 0) {
    console.error(`${failures} skill(s) failed to lint. A failing skill drops out of the catalog silently,`)
    console.error('so this is a real defect even though nothing at runtime reports it.')
    process.exitCode = 1
    return
  }
  console.log(`all ${dirs.length} skill(s) lint clean`)
}

await main()
