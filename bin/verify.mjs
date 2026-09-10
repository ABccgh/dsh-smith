#!/usr/bin/env node
/**
 * Verify that the `dsh-smith` preset actually composes in this deployment.
 *
 * A composition can parse, list cleanly in the roster's picker, and still be
 * unusable: a row can name a package that does not resolve, carry a config the
 * plugin rejects, wait forever for a service nothing supplies, or publish a
 * service into the process-global realm. The roster's `agentPresets` service
 * answers all four through `standingKeyFor(id)`, which composes the preset's
 * plugin subtree the way a session start does — minus the agent.
 *
 * There is no CLI for that call, so this script reaches it through the harness's
 * own Cordis runtime: it boots the composition with a small probe plugin that
 * injects `agentPresets` and prints the verdict.
 *
 * The three outcomes are reported distinctly, because "verified" and "could not
 * check" must never look alike:
 *
 *   MOUNTED OK        the preset composed — no unusable row, no leaked service
 *   MOUNT REJECTED    the preset cannot be composed; the reason is printed
 *   INCONCLUSIVE      this machine has no harness runtime to ask, so nothing
 *                     was verified (exit code 1 — an unrun check is not a pass)
 *
 * Usage:
 *   node bin/verify.mjs            verify the installed preset
 *   node bin/verify.mjs --path X   check the composition file at X instead
 */
import { access, readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const PRESET_ID = 'dsh-smith'
const DSH_HOME = process.env.DSH_HOME ?? join(homedir(), '.dsh')
const INSTALLED = join(DSH_HOME, '.agent-presets', PRESET_ID, 'agent.cordis.yml')
const REPO_COPY = resolve(dirname(fileURLToPath(import.meta.url)), '..', PRESET_ID, 'agent.cordis.yml')
/** How long to give the mount before concluding the runtime never answered. */
const ANSWER_WINDOW_MS = 30_000

/** Read `--path <file>`, else prefer the installed preset and fall back to the repo copy. */
async function targetComposition() {
  const index = process.argv.indexOf('--path')
  if (index !== -1 && process.argv[index + 1] !== undefined) return resolve(process.argv[index + 1])
  try {
    await access(INSTALLED)
    return INSTALLED
  } catch {
    return REPO_COPY
  }
}

/** Locate the harness's own Cordis module so its runtime can host the probe. */
async function loadCordis() {
  const candidates = [
    join(DSH_HOME, 'profiles', 'node_modules', '@deepseek-ai', 'cordis', 'lib', 'index.js'),
    join(DSH_HOME, 'profiles', 'web', 'node_modules', '@deepseek-ai', 'cordis', 'lib', 'index.js'),
  ]
  for (const candidate of candidates) {
    try {
      await access(candidate)
      return await import(pathToFileURL(candidate).href)
    } catch {
      // keep looking
    }
  }
  try {
    return await import('@deepseek-ai/cordis')
  } catch {
    return undefined
  }
}

/** Count the rows a composition file names, at top level and inside its groups. */
async function namedRows(path) {
  try {
    const text = await readFile(path, 'utf8')
    const lines = text.split('\n')
    const top = lines.filter((line) => /^- id: /.test(line)).length
    const nested = lines.filter((line) => /^ {4}- id: /.test(line)).length
    return top + nested
  } catch {
    return undefined
  }
}

async function main() {
  const path = await targetComposition()

  try {
    await access(path)
  } catch {
    console.error(`verify: no composition found at ${path}`)
    console.error('verify: install the preset first with `node bin/install.mjs`.')
    process.exitCode = 1
    return
  }

  const rows = await namedRows(path)
  console.log(`composition: ${path}`)
  if (rows !== undefined) console.log(`rows named in the file: ${rows}`)
  console.log('')

  const cordis = await loadCordis()
  if (cordis === undefined) {
    console.error('verify: INCONCLUSIVE — could not import @deepseek-ai/cordis from this machine.')
    console.error('verify: nothing was verified. Point DSH_HOME at an installed harness, or run')
    console.error(`verify:   standingKeyFor('${PRESET_ID}')`)
    console.error('verify: from inside a session on any preset.')
    process.exitCode = 1
    return
  }

  const verdict = { settled: false, ok: false, inconclusive: '', detail: '' }

  // A probe that declares the single service this check needs. When the runtime
  // publishes it, `apply` runs and asks the roster the one question that matters.
  const probe = {
    name: 'dsh-smith-verify',
    inject: ['agentPresets'],
    apply(ctx) {
      const presets = ctx.agentPresets
      void (async () => {
        try {
          await presets.standingKeyFor(PRESET_ID)
          verdict.ok = true
          verdict.detail = 'no unusable row and no process-global service leak'
        } catch (error) {
          verdict.ok = false
          verdict.detail = error && error.message ? error.message : String(error)
        } finally {
          verdict.settled = true
        }
      })()
    },
  }

  let root
  try {
    root = new cordis.Context()
    root.plugin(probe)
    await root.lifecycle?.ready?.()
  } catch (error) {
    console.error('verify: INCONCLUSIVE — could not boot a Cordis runtime to host the probe.')
    console.error(`verify:   ${error && error.message ? error.message : String(error)}`)
    process.exitCode = 1
    return
  }

  // `agentPresets` absent means the probe never applied, so no verdict can come.
  // Waiting the full window in that case would only delay the same conclusion.
  if (root.get('agentPresets') === undefined) {
    verdict.settled = true
    verdict.inconclusive = 'this runtime publishes no `agentPresets` service'
  }

  if (!verdict.settled) {
    await new Promise((settle) => setTimeout(settle, ANSWER_WINDOW_MS))
  }

  try {
    await root.dispose?.()
  } catch {
    // The verdict is already in hand; a teardown error must not replace it.
  }

  if (verdict.inconclusive !== '') {
    console.error(`verify: INCONCLUSIVE — ${verdict.inconclusive}, so the preset was never asked.`)
    console.error('verify: nothing was verified. A bare Cordis runtime carries none of the')
    console.error('verify: harness registries; run this from a session on a real profile, or')
    console.error(`verify:   standingKeyFor('${PRESET_ID}')`)
    process.exitCode = 1
    return
  }

  if (!verdict.settled) {
    console.error('verify: INCONCLUSIVE — the roster did not answer within ' + ANSWER_WINDOW_MS + 'ms.')
    console.error('verify: nothing was verified.')
    process.exitCode = 1
    return
  }

  if (verdict.ok) {
    console.log('MOUNTED OK — the preset composed with no unusable row and no leaked service.')
    console.log(`A new session can use the mode "${PRESET_ID}".`)
    console.log('Not covered here: the model-facing tool names an expert row produces, which')
    console.log('only a real session shows. Confirm the four expert tools on first use.')
    return
  }

  console.error('MOUNT REJECTED — the preset cannot be composed:')
  console.error(`  ${verdict.detail}`)
  process.exitCode = 1
}

await main()
