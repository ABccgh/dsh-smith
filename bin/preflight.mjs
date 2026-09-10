#!/usr/bin/env node
/**
 * Static preflight for a preset composition: resolve every row's package and
 * validate every row's config against the plugin's OWN schema.
 *
 * WHY THIS EXISTS, given that `verify.mjs` already does the real check.
 *
 * `agentPresets.standingKeyFor(id)` is the only check that counts, and it needs a
 * live harness process. In this deployment NO preset can reach it from a session:
 * `dsh-tool-cordis`'s provider registrations are process-global and already taken
 * by the host (`dsh-web-app/cordis.patch.yml:122` -> `dsh-cordis-host-runner`),
 * so the second composition to contain that row fails its whole mount. The
 * shipped `cordis` preset avoids the collision by being first; every other preset
 * that ships the row must gate it off, which is exactly what `dsh-smith` and
 * `dsh-forge` do. The practical consequence is that a mount check is only
 * runnable from a session on the shipped `cordis` preset.
 *
 * So this script covers the two failure classes that a mount check reports and
 * that can be decided without mounting, using the same artefacts the loader does:
 *
 *   * `Cannot find package …`  — resolve each row's package the way Node does.
 *   * `invalid config: $.<field> missing required value` — call the plugin's own
 *     exported `Config` schema with `~standard.validate(config)` and report the
 *     `issues` it returns. This is schemastery's own validator, so the message
 *     text matches the loader's.
 *
 * WHAT IT CANNOT COVER, stated rather than implied:
 *
 *   * a row that activates but contributes nothing — a consumer left outside its
 *     provider's realm, or a hard dependency nothing supplies. That is a mount
 *     outcome (`N row(s) did not activate: <id>: waiting for <service>`) and this
 *     script cannot produce it.
 *   * a service published into the root realm, and provider-id collisions. Both
 *     are mount audit results.
 *   * validation that lives in `apply()` rather than in the schema. The loader
 *     runs both; this script runs the schema half only. A concrete example in
 *     this deployment: `dsh-repeat-tool-reminder` accepts `thresholds: [1]`
 *     through its schema and throws from `apply` at load, so a threshold this
 *     script passes can still fail the mount.
 *   * unknown config keys. Schemastery does not reject them (measured: an extra
 *     `bogus: 1` beside a valid `mode` validates clean), so a typo in a key name
 *     is invisible here unless it makes a required field absent.
 *
 * Run `node bin/verify.mjs --preset <id>` from a session on the shipped `cordis`
 * preset for the real verdict.
 *
 * Usage:
 *   node bin/preflight.mjs                    preflight dsh-smith
 *   node bin/preflight.mjs --preset <id>      preflight a specific preset
 *   node bin/preflight.mjs --path <file>      preflight a specific composition file
 *   node bin/preflight.mjs --quiet            only rows that failed
 */
import { access, readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  dshHome,
  installedComposition,
  presetFromArgv,
  repoComposition,
  UnknownPresetError,
} from './presets.mjs'

let PRESET_ID
try {
  PRESET_ID = presetFromArgv(process.argv.slice(2))
} catch (error) {
  console.error(`preflight: ${error instanceof UnknownPresetError ? error.message : String(error)}`)
  process.exit(1)
}

const DSH_HOME = dshHome()
const quiet = process.argv.includes('--quiet')
const say = (line) => {
  if (!quiet) console.log(line)
}

/** The `yaml` package the loader itself uses, loaded from the profile it resolves in. */
async function loadYaml() {
  const candidate = join(DSH_HOME, 'profiles', 'node_modules', 'yaml', 'dist', 'index.js')
  try {
    await access(candidate)
    return await import(pathToFileURL(candidate).href)
  } catch {
    try {
      return await import('yaml')
    } catch {
      return undefined
    }
  }
}

/**
 * Parse a composition with `!!js` mapped to the loader's own node shape.
 *
 * The loader marks a tagged expression as `{ __jsExpr: '<source>' }` and tests it
 * with `isJsExpr` — `value instanceof Object && '__jsExpr' in value`
 * (`cordis-plugin-loader/lib/index.js:302-303`). Reproducing that shape is what
 * lets this script tell "a literal disabled: false" apart from "a computed gate I
 * must not second-guess".
 */
function parseComposition(text, YAML) {
  const jsTag = {
    // The identifier must be the RESOLVED tag. With `tag: '!!js'` the parser
    // matches nothing, warns `TAG_RESOLVE_FAILED`, and hands back the raw string
    // — which this script would then read as `disabled: "<source>"`, i.e. a
    // truthy non-true value it would quietly treat as an expression. Measured,
    // not assumed; the resolved form is what `yaml` matches against.
    tag: 'tag:yaml.org,2002:js',
    resolve: (source) => ({ __jsExpr: source }),
  }
  return YAML.parse(text, { customTags: [jsTag] })
}

/** True for a value the loader will evaluate rather than read. */
function isJsExpr(value) {
  return value instanceof Object && '__jsExpr' in value
}

/**
 * Pull `{ id, name, config, disabled }` out of one preset document.
 *
 * A group (`group: true` with a `config` array of nested rows) carries no package
 * of its own and is descended into rather than reported; `cordis:group` is the
 * only group in this repository's presets.
 */
function collectRows(document) {
  const rows = []
  const walk = (entries) => {
    if (!Array.isArray(entries)) return
    for (const entry of entries) {
      if (entry === null || typeof entry !== 'object') continue
      const isGroup = entry.group === true
      rows.push({
        id: entry.id,
        name: entry.name,
        config: entry.config,
        disabled: entry.disabled,
        group: isGroup,
      })
      if (isGroup && Array.isArray(entry.config)) walk(entry.config)
    }
  }
  walk(document)
  return rows
}

/** Resolve a package specifier the way the harness loader would. */
async function resolvePackage(name, requireFrom) {
  try {
    return { ok: true, path: requireFrom.resolve(name) }
  } catch (error) {
    // Namespace specifiers such as `<pkg>/list-agents` have no `exports` entry,
    // so fall back to a path probe before calling the row unresolvable.
    const base = join(DSH_HOME, 'profiles', 'node_modules', name)
    for (const candidate of [join(base, 'lib', 'index.js'), join(base, 'index.js'), base]) {
      try {
        await access(candidate)
        return { ok: true, path: candidate }
      } catch {
        // keep probing
      }
    }
    return { ok: false, detail: error && error.message ? error.message.split('\n')[0] : String(error) }
  }
}

/** Validate one row's config against that plugin's own exported schema, if it has one. */
async function validateConfig(modulePath, config) {
  let module
  try {
    module = await import(pathToFileURL(modulePath).href)
  } catch (error) {
    return { kind: 'unimportable', detail: error && error.message ? error.message.split('\n')[0] : String(error) }
  }
  const Schema = module.Config ?? module.default?.Config
  if (typeof Schema !== 'function') {
    return { kind: 'no-schema' }
  }
  const standard = Schema['~standard']
  if (standard === undefined || typeof standard.validate !== 'function') {
    return { kind: 'no-validator' }
  }
  let outcome
  try {
    outcome = standard.validate(config ?? {})
  } catch (error) {
    return { kind: 'threw', detail: error && error.message ? error.message : String(error) }
  }
  if (Array.isArray(outcome.issues) && outcome.issues.length > 0) {
    return { kind: 'invalid', issues: outcome.issues.map((issue) => issue.message) }
  }
  return { kind: 'valid' }
}

/** Report every JS expression a config carries, since this script cannot evaluate one. */
function expressionPaths(value, prefix = '') {
  if (isJsExpr(value)) return [prefix === '' ? '(root)' : prefix]
  if (Array.isArray(value)) return value.flatMap((item, index) => expressionPaths(item, `${prefix}[${index}]`))
  if (value instanceof Object) {
    return Object.entries(value).flatMap(([key, item]) => expressionPaths(item, prefix === '' ? key : `${prefix}.${key}`))
  }
  return []
}

async function targetComposition() {
  const index = process.argv.indexOf('--path')
  if (index !== -1 && process.argv[index + 1] !== undefined) return resolve(process.argv[index + 1])
  const installed = installedComposition(PRESET_ID, DSH_HOME)
  try {
    await access(installed)
    return installed
  } catch {
    return repoComposition(PRESET_ID)
  }
}

async function main() {
  const compositionPath = await targetComposition()
  let text
  try {
    text = await readFile(compositionPath, 'utf8')
  } catch {
    console.error(`preflight: cannot read ${compositionPath}`)
    process.exitCode = 1
    return
  }

  const YAML = await loadYaml()
  if (YAML === undefined) {
    console.error('preflight: INCONCLUSIVE — no `yaml` module importable from this machine,')
    console.error('preflight: so the composition was never parsed. Nothing was verified.')
    process.exitCode = 1
    return
  }

  let document
  try {
    document = parseComposition(text, YAML)
  } catch (error) {
    console.error(`preflight: the composition does not parse as YAML: ${error && error.message ? error.message : String(error)}`)
    process.exitCode = 1
    return
  }

  const rows = collectRows(document)
  const profileRoot = join(DSH_HOME, 'profiles')
  const requireFrom = createRequire(join(profileRoot, 'package.json'))

  say(`composition: ${compositionPath}`)
  say(`rows:        ${rows.length}`)
  say('')

  const enabled = []
  const disabled = []
  for (const row of rows) {
    if (isJsExpr(row.disabled)) {
      row.disabledReason = `expression (unevaluated): ${row.disabled.__jsExpr}`
    } else if (row.disabled === true) {
      row.disabledReason = 'literal true'
    }
    ;(row.disabledReason === undefined ? enabled : disabled).push(row)
  }

  const failures = []
  let validated = 0
  let skipped = 0

  for (const row of enabled) {
    if (row.group === true || row.name === undefined) {
      skipped += 1
      say(`skip  ${row.id}  (group or unnamed row; no package to resolve)`)
      continue
    }

    const resolution = await resolvePackage(row.name, requireFrom)
    if (!resolution.ok) {
      failures.push({ id: row.id, problem: `Cannot find package: ${row.name}`, detail: resolution.detail })
      console.error(`FAIL  ${row.id}`)
      console.error(`        package does not resolve: ${row.name}`)
      console.error(`        ${resolution.detail}`)
      continue
    }

    const expressions = expressionPaths(row.config)
    if (expressions.length > 0) {
      skipped += 1
      say(`skip  ${row.id}  (config carries an unevaluated expression at ${expressions.join(', ')})`)
      continue
    }

    const verdict = await validateConfig(resolution.path, row.config)
    switch (verdict.kind) {
      case 'valid':
        validated += 1
        say(`ok    ${row.id}  (${row.name})`)
        break
      case 'invalid':
        failures.push({ id: row.id, problem: 'invalid config', detail: verdict.issues.join('; ') })
        console.error(`FAIL  ${row.id}  (${row.name})`)
        for (const issue of verdict.issues) console.error(`        ${issue}`)
        break
      case 'unimportable':
        failures.push({ id: row.id, problem: 'package present but not importable', detail: verdict.detail })
        console.error(`FAIL  ${row.id}  (${row.name})`)
        console.error(`        resolves to ${resolution.path} but cannot be imported:`)
        console.error(`        ${verdict.detail}`)
        break
      case 'no-schema':
      case 'no-validator':
        skipped += 1
        say(`skip  ${row.id}  (${row.name} exports no usable Config schema)`)
        break
      case 'threw':
        failures.push({ id: row.id, problem: 'schema validator threw', detail: verdict.detail })
        console.error(`FAIL  ${row.id}  (${row.name})`)
        console.error(`        ${verdict.detail}`)
        break
    }
  }

  say('')
  if (!quiet) {
    console.log(`disabled rows (not checked): ${disabled.length}`)
    for (const row of disabled) console.log(`  ${row.id}: ${row.disabledReason}`)
    console.log('')
  }

  console.log(`validated: ${validated}   skipped: ${skipped}   failed: ${failures.length}`)
  console.log('')

  if (failures.length > 0) {
    console.error('PREFLIGHT FAILED — this composition cannot mount as written.')
    console.error('Each line below is a mount error this script can decide statically:')
    for (const failure of failures) console.error(`  ${failure.id}: ${failure.problem} — ${failure.detail}`)
    process.exitCode = 1
    return
  }

  console.log('PREFLIGHT PASSED — every row resolved, and every config this script could read')
  console.log('validated against its own plugin schema.')
  console.log('')
  console.log('Scope of this result: it does NOT prove the preset mounts. The failures it cannot')
  console.log('see are the ones that matter most — a row that activates but contributes nothing,')
  console.log('a service published into the root realm, and any check that lives in apply() rather')
  console.log('than in the schema. The mount verdict comes from standingKeyFor(), which needs a')
  console.log('session on the shipped `cordis` preset:')
  console.log(`  node bin/verify.mjs --preset ${PRESET_ID}   (run that session's own probe, or the`)
  console.log('  dynamic-plugin route described in the README)')
}

await main()
