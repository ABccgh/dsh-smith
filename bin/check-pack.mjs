#!/usr/bin/env node
/**
 * Assert that the PUBLISHED artifact contains what the repository ships.
 *
 * ## The failure this exists to catch
 *
 * `package.json`'s `files` allowlist decides what lands in the npm tarball, and this
 * repository records the consequence in its own boundaries: "a new preset directory that is
 * not listed in `files` is silently absent from the published tarball while every local
 * script still works, which is the one failure this repo cannot detect by running itself."
 *
 * Every other check in `bin/` reads the working tree, so all of them pass whether or not the
 * allowlist is right. This one reads the tarball instead — the only artifact where the
 * difference is visible.
 *
 * ## What it checks
 *
 *   1. `npm pack` succeeds.
 *   2. Every preset directory declared in `package.json`'s `dsh.presets` is present in the
 *      tarball.
 *   3. Each of those presets' `agent.cordis.yml` and `preset.yml` are present.
 *   4. Every `bin/*.mjs` launcher named in `package.json`'s `bin` map is present.
 *   5. No file that the repository ships in the tree is missing from the tarball — computed
 *      from `files` plus the always-included manifests, so the check follows the allowlist
 *      rather than a copy of it.
 *
 * It deliberately does NOT assert an exact file count: the packed set legitimately grows as
 * files are added, and a frozen number would fail for the wrong reason. It asserts the
 * declared surface is present.
 *
 * Run: node bin/check-pack.mjs
 */

import { execSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const manifest = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'))

const failures = []
const notes = []

/** Record one assertion outcome. */
function check(label, ok, detail = '') {
  const line = `${ok ? 'ok  ' : 'FAIL'}  ${label}${detail === '' ? '' : ` — ${detail}`}`
  if (ok) notes.push(line)
  else failures.push(line)
}

/** Walk a directory and return every file path relative to it, ignoring `node_modules`. */
function walk(dir, base = dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walk(full, base, out)
    else out.push(relative(base, full).split('\\').join('/'))
  }
  return out
}

// ---- what the manifest declares ---------------------------------------------

const presetDirs = (manifest.dsh?.presets ?? []).map((preset) => preset.repoDir)
check('package.json declares at least one preset', presetDirs.length > 0, presetDirs.join(', '))

/** Files that must be in the tarball because the manifest declares them. */
const required = new Set(['package.json'])
for (const dir of presetDirs) {
  required.add(`${dir}/agent.cordis.yml`)
  required.add(`${dir}/preset.yml`)
}
for (const target of Object.values(manifest.bin ?? {})) required.add(target)

// ---- pack -------------------------------------------------------------------

const staging = mkdtempSync(join(tmpdir(), 'dsh-pack-check-'))
let packed = []
try {
  // `npm` is a shell script on POSIX and a `npm.cmd` on Windows, so running it always goes
  // through a shell. `execSync` takes a command LINE for exactly that case, which avoids
  // combining a `shell` flag with an args array — the combination Node deprecates (DEP0190)
  // and which emitted a warning from inside npm that landed in this check's own report.
  //
  // The paths are single-quoted for the shell. `staging` comes from `mkdtempSync` and
  // `repoRoot` from `import.meta.url`, so neither contains a quote; the quoting is still done
  // through a helper rather than concatenated, because that is the part a later edit is most
  // likely to get wrong.
  const quote = (value) => (process.platform === 'win32'
    ? `"${String(value).replace(/"/g, '""')}"`
    : `'${String(value).replace(/'/g, "'\\''")}'`)
  const command = [
    'npm',
    'pack',
    '--json',
    '--ignore-scripts',
    '--pack-destination',
    quote(staging),
  ].join(' ')

  const output = execSync(command, {
    cwd: repoRoot,
    encoding: 'utf8',
    // DEP0190 can also originate inside npm's own child spawn; --no-deprecation keeps that
    // noise out of a report whose every other line is a finding.
    env: { ...process.env, NODE_OPTIONS: [process.env.NODE_OPTIONS, '--no-deprecation'].filter(Boolean).join(' ') },
  })
  const result = JSON.parse(output)
  const entry = Array.isArray(result) ? result[0] : result
  packed = entry.files.map((file) => file.path.split('\\').join('/'))
  notes.push(`ok    npm pack produced ${entry.filename} (${packed.length} files, ${entry.size} bytes packed)`)
} catch (cause) {
  failures.push(`FAIL  npm pack failed: ${cause instanceof Error ? cause.message : String(cause)}`)
}

if (packed.length > 0) {
  const present = new Set(packed)

  for (const path of [...required].sort()) {
    check(`tarball contains ${path}`, present.has(path))
  }

  // Every preset directory must be represented, not merely its manifest: a preset whose
  // skills were dropped would pass the two-file check above and ship a broken composition.
  for (const dir of presetDirs) {
    const inTarball = packed.filter((path) => path.startsWith(`${dir}/`))
    const onDisk = walk(join(repoRoot, dir)).length
    check(
      `preset "${dir}" ships its whole directory`,
      inTarball.length === onDisk && onDisk > 0,
      `${inTarball.length} of ${onDisk} file(s) on disk`,
    )
  }

  // The skills are a preset's substance; a preset dir present but empty is the quiet failure.
  for (const dir of presetDirs) {
    const skillFiles = packed.filter((path) => path.startsWith(`${dir}/skills/`))
    check(`preset "${dir}" ships skills`, skillFiles.length > 0, `${skillFiles.length} file(s) under skills/`)
  }

  // Nothing in the tree that the allowlist claims should be missing. This is the assertion
  // that would have caught a preset directory added without a `files` entry.
  const allowlist = manifest.files ?? []
  check('package.json declares a files allowlist', allowlist.length > 0, allowlist.join(', '))
  for (const entry of allowlist) {
    const full = join(repoRoot, entry)
    if (!existsSync(full)) continue
    // A DIRECTORY entry contributes its contents under its own prefix; a FILE entry is the
    // path itself. An earlier version prefixed the file case too, so it looked for
    // `README.md/README.md` and reported a missing file that was present all along.
    if (statSync(full).isDirectory()) {
      const expected = walk(full)
      const missing = expected.filter((rel) => !present.has(`${entry}/${rel}`))
      check(`every file under "${entry}/" is in the tarball`, missing.length === 0, missing.length === 0 ? `${expected.length} file(s)` : `missing ${missing.slice(0, 5).join(', ')}`)
    } else {
      check(`the tarball contains "${entry}"`, present.has(entry))
    }
  }
}

try {
  rmSync(staging, { recursive: true, force: true })
} catch {
  // a leftover temp directory is not a check failure
}

// ---- report -----------------------------------------------------------------

process.stdout.write(`\n${notes.join('\n')}\n`)
if (failures.length === 0) {
  process.stdout.write(`\nPACK OK — the published tarball carries every declared preset and launcher\n`)
} else {
  process.stdout.write(`\n${failures.join('\n')}\n\nPACK FAILED — ${failures.length} problem(s)\n`)
  process.exitCode = 1
}
