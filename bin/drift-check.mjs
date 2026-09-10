#!/usr/bin/env node
/**
 * Report how far this preset has drifted from the shipped preset it was copied from.
 *
 * `dsh-smith` began as a copy of the deployment's `cordis` preset, so every row it
 * shares with that preset is a row an upstream upgrade can move underneath it. A
 * row whose config surface changed upstream does not fail here — it keeps loading
 * with a stale config, or stops matching the package it names, and nothing says so.
 *
 * This script does not fix drift. It reports it, because the decision to follow an
 * upstream change is a design decision (this preset deliberately rewrites several
 * of the rows it inherited) and a tool that "helpfully" synced them would erase
 * the whole point of the copy.
 *
 * What it compares, per row id present in both files:
 *   * the row's package name;
 *   * the row's `disabled` line, verbatim;
 *   * the set of config keys the row names, with values that are short scalars
 *     compared literally and long block scalars reduced to a length + first line.
 *
 * Usage:
 *   node bin/drift-check.mjs                    compare against the installed preset
 *   node bin/drift-check.mjs --upstream <path>  compare against a specific file
 *   node bin/drift-check.mjs --quiet            only rows that differ
 *
 * Locating the upstream file: the roster reports each preset's real path, and the
 * shipped install sits beside the deployment's own config. The default below
 * covers a standard `dsh` install; pass --upstream when yours differs.
 */
import { access, readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const LOCAL = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dsh-smith', 'agent.cordis.yml')
const quiet = process.argv.includes('--quiet')

/** Candidate locations for the shipped `cordis` preset, most specific first. */
async function findUpstream() {
  const index = process.argv.indexOf('--upstream')
  if (index !== -1 && process.argv[index + 1] !== undefined) return resolve(process.argv[index + 1])

  const home = process.env.DSH_HOME ?? join(homedir(), '.dsh')
  const candidates = [
    join(home, 'profiles', 'node_modules', '@deepseek-ai', 'dsh-agent-presets', 'presets', 'cordis', 'agent.cordis.yml'),
    join(home, 'profiles', 'web', 'node_modules', '@deepseek-ai', 'dsh-agent-presets', 'presets', 'cordis', 'agent.cordis.yml'),
  ]
  for (const candidate of candidates) {
    try {
      await access(candidate)
      return candidate
    } catch {
      // keep looking
    }
  }
  return undefined
}

/**
 * Reduce one composition file to `rowId -> { package, disabled, config }`.
 *
 * A line-oriented reader rather than a YAML parser: this script must run with no
 * dependencies, and it only needs the shape rows in these two files actually use.
 * Anything it cannot attribute to a row is ignored, and the summary says so.
 */
function readRows(text) {
  const rows = new Map()
  let current
  let inConfig = false
  const lines = text.split('\n')

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const rowMatch = /^(\s*)- id: (\S+)\s*$/.exec(line)
    if (rowMatch !== null) {
      current = { id: rowMatch[2], package: undefined, disabled: undefined, config: new Map(), indent: rowMatch[1].length }
      rows.set(current.id, current)
      inConfig = false
      continue
    }
    if (current === undefined) continue

    const indent = line.length - line.trimStart().length
    if (line.trim() !== '' && indent <= current.indent) {
      // Left this row's block.
      current = undefined
      inConfig = false
      continue
    }

    const packageMatch = /^\s*name: (.+)$/.exec(line)
    if (packageMatch !== null && current.package === undefined) {
      current.package = packageMatch[1].trim()
      continue
    }
    const disabledMatch = /^\s*disabled: (.+)$/.exec(line)
    if (disabledMatch !== null) {
      current.disabled = disabledMatch[1].trim()
      continue
    }
    if (/^\s*config:\s*$/.test(line)) {
      inConfig = true
      continue
    }
    if (!inConfig) continue

    const keyMatch = /^\s*([A-Za-z0-9_-]+):\s*(.*)$/.exec(line)
    if (keyMatch === null) continue
    const [, key, rawValue] = keyMatch
    let value = rawValue.trim()
    if (value === '' ) {
      // A block scalar: capture its length and first line as a cheap fingerprint.
      let length = 0
      let firstLine = ''
      for (let probe = index + 1; probe < lines.length; probe += 1) {
        const inner = lines[probe]
        if (inner.trim() !== '' && inner.length - inner.trimStart().length <= indent) break
        if (inner.trim() === '') continue
        if (firstLine === '') firstLine = inner.trim()
        length += inner.length
      }
      value = `<block ${length} chars: ${firstLine.slice(0, 48)}>`
    }
    current.config.set(key, value)
  }
  return rows
}

function configDiff(local, upstream) {
  const keys = new Set([...local.config.keys(), ...upstream.config.keys()])
  const differing = []
  for (const key of keys) {
    const left = local.config.get(key)
    const right = upstream.config.get(key)
    if (left === right) continue
    differing.push(`${key}: local=${left === undefined ? '(absent)' : left}  upstream=${right === undefined ? '(absent)' : right}`)
  }
  return differing
}

async function main() {
  const upstreamPath = await findUpstream()
  if (upstreamPath === undefined) {
    console.error('drift-check: could not find the shipped `cordis` preset to compare against.')
    console.error('drift-check: the roster reports each preset\'s real path; pass it explicitly:')
    console.error('drift-check:   node bin/drift-check.mjs --upstream <path to cordis/agent.cordis.yml>')
    process.exitCode = 1
    return
  }

  // Read both files with a diagnostic rather than letting `readFile` reject
  // uncaught: a mistyped `--upstream` path is the most likely way to reach this
  // script wrongly, and a stack trace tells the caller nothing about which path
  // was wrong. An empty comparison is not a failure — a lone `[]` upstream is a
  // legitimate empty composition — but a MISSING file is.
  let localText
  let upstreamText
  try {
    localText = await readFile(LOCAL, 'utf8')
  } catch (error) {
    console.error(`drift-check: cannot read the local composition at ${LOCAL}`)
    console.error(`drift-check:   ${error && error.message ? error.message : String(error)}`)
    process.exitCode = 1
    return
  }
  try {
    upstreamText = await readFile(upstreamPath, 'utf8')
  } catch (error) {
    console.error(`drift-check: cannot read the upstream composition at ${upstreamPath}`)
    console.error(`drift-check:   ${error && error.message ? error.message : String(error)}`)
    console.error('drift-check: check the path, or omit --upstream to let this script locate')
    console.error('drift-check: the shipped `cordis` preset under $DSH_HOME/profiles.')
    process.exitCode = 1
    return
  }

  const local = readRows(localText)
  const upstream = readRows(upstreamText)

  console.log(`local:    ${LOCAL}  (${local.size} rows)`)
  console.log(`upstream: ${upstreamPath}  (${upstream.size} rows)`)
  console.log('')

  const shared = [...local.keys()].filter((id) => upstream.has(id))
  const localOnly = [...local.keys()].filter((id) => !upstream.has(id))
  const upstreamOnly = [...upstream.keys()].filter((id) => !local.has(id))

  let drifted = 0
  for (const id of shared) {
    const left = local.get(id)
    const right = upstream.get(id)
    const problems = []
    if (left.package !== right.package) problems.push(`package: local=${left.package}  upstream=${right.package}`)
    if (left.disabled !== right.disabled) {
      problems.push(`disabled: local=${left.disabled ?? '(none)'}  upstream=${right.disabled ?? '(none)'}`)
    }
    problems.push(...configDiff(left, right))
    if (problems.length === 0) continue
    drifted += 1
    console.log(`DRIFT  ${id}`)
    for (const problem of problems) console.log(`         ${problem}`)
  }

  if (!quiet) {
    console.log('')
    console.log(`shared rows:            ${shared.length}  (${drifted} differ)`)
    console.log(`local-only rows:        ${localOnly.length}${localOnly.length > 0 ? `  (${localOnly.join(', ')})` : ''}`)
    console.log(`upstream-only rows:     ${upstreamOnly.length}${upstreamOnly.length > 0 ? `  (${upstreamOnly.join(', ')})` : ''}`)
    console.log('')
    console.log('A differing row is not automatically a defect: this preset deliberately changes')
    console.log('several rows it inherited. The question each line asks is whether the upstream')
    console.log('change is one this preset should follow. Following it is a manual edit.')
  }

  if (drifted === 0) console.log('no drift in shared rows')
}

await main()
