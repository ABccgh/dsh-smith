#!/usr/bin/env node
/**
 * Verify that the `dsh-smith` preset actually composes in this deployment.
 *
 * A composition can parse, list cleanly in the roster's picker, and still be
 * unusable: a row can name a package that does not resolve, carry a config the
 * plugin rejects, wait forever for a service nothing supplies, or publish a
 * service into the process-global realm. The roster's `agentPresets` service
 * answers all four through `standingKeyFor(id)`, which composes the preset's
 * plugin subtree the way a session start does — minus the agent. There is no CLI
 * for that call, so this script reaches it through the harness's own Cordis
 * runtime, hosting a small probe plugin that injects `agentPresets`.
 *
 * WHAT THIS SCRIPT CANNOT DO, AND WHY THAT IS STATED RATHER THAN FAKED.
 *
 * A successful mount proves rows activated. It does NOT prove any tool reached a
 * model's tool list -- that conflation is the mistake this preset's own README
 * now documents. The check that would settle it is "compose an agent from this
 * preset and read its tool schemas", and that check is NOT available from here:
 *
 *   * `ctx.tools.schemas(standingKey)` is meaningless: tools resolve per AGENT
 *     scope, and the standing scope is not one. It returns a near-empty list.
 *   * The low-level `ctx.agents.create({ sessionId })` composes a bare agent
 *     with NO preset attached, so its surface says nothing about this preset.
 *   * The factory that WOULD attach the preset (`ctx.agentLoop.createAgent`) is
 *     unusable from a dynamic plugin: it reads `ctx.fiber`, and the Host guard
 *     withholds framework internals by design
 *     ("sandbox ctx does not expose \"fiber\"").
 *
 * So the tool-surface assertion is left to the only place that can run it: a
 * real session. This script prints the exact calls instead of pretending.
 *
 * Outcomes are reported distinctly, because "verified" and "could not check"
 * must never look alike:
 *
 *   MOUNTED OK      the preset composed: no unusable row, no leaked service
 *   MOUNT REJECTED  the preset cannot be composed; the reason is printed
 *   INCONCLUSIVE    this machine has no harness runtime to ask, so nothing was
 *                   verified (exit 1 -- an unrun check is not a pass)
 *
 * Usage:
 *   node bin/verify.mjs            verify the installed preset
 *   node bin/verify.mjs --path X   check the composition file at X instead
 *   node bin/verify.mjs --quiet    print only the verdict and the next steps
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
/**
 * Tools this preset claims, and the reason this script can only PRINT the check
 * for them rather than run it. Absence of any one is a real defect, so the reader
 * needs to know exactly what to look for.
 */
const EXPECTED_TOOLS = ['expert_architect', 'expert_verifier', 'expert_protocol', 'expert_chronicler']

const quiet = process.argv.includes('--quiet')
const say = (line) => {
  if (!quiet) console.log(line)
}

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

/**
 * Count the rows a composition file names, at any nesting depth.
 *
 * Indentation is matched loosely on purpose: pinning it to exactly four spaces
 * made the count silently wrong for any group whose rows are indented
 * differently, and a wrong number presented as a fact is worse than no number.
 * The file's own YAML is the authority on nesting; this is only a sanity figure.
 */
async function namedRows(path) {
  try {
    const text = await readFile(path, 'utf8')
    return text.split('\n').filter((line) => /^\s*- id: \S/.test(line)).length
  } catch {
    return undefined
  }
}

/** Print the tool-surface check that only a real session can run. */
function printSurfaceSteps(stream) {
  stream('')
  stream('NEXT — confirm the tools actually reach a model, which this script cannot check.')
  stream('Open a NEW session on the preset, then run these two calls in it:')
  stream(`  cordis_inspect_query  platform=host provider=Tool method=listTools`)
  stream(`  and confirm these names appear: ${EXPECTED_TOOLS.join(', ')}`)
  stream('If cordis_inspect_list is itself unknown in that session, see the README section')
  stream('"已知限制" — the tool-cordis row may have self-disabled.')
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
  say(`composition: ${path}`)
  if (rows !== undefined) say(`rows named in the file: ${rows}`)
  say('')

  const cordis = await loadCordis()
  if (cordis === undefined) {
    console.error('verify: INCONCLUSIVE — could not import @deepseek-ai/cordis from this machine.')
    console.error('verify: nothing was verified. Point DSH_HOME at an installed harness, or run')
    console.error(`verify:   standingKeyFor('${PRESET_ID}')`)
    console.error('verify: from inside a session on any preset.')
    process.exitCode = 1
    return
  }

  const verdict = { mount: undefined, inconclusive: '' }

  // A probe that declares the one service this check needs. When the runtime
  // publishes it, `apply` runs and asks the roster the question that matters.
  const probe = {
    name: 'dsh-smith-verify',
    inject: ['agentPresets'],
    apply(ctx) {
      const presets = ctx.agentPresets
      void (async () => {
        try {
          await presets.standingKeyFor(PRESET_ID)
          verdict.mount = { ok: true, detail: 'no unusable row and no process-global service leak' }
        } catch (error) {
          verdict.mount = { ok: false, detail: error && error.message ? error.message : String(error) }
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

  if (root.get('agentPresets') === undefined) {
    verdict.inconclusive = 'this runtime publishes no `agentPresets` service'
  }

  if (verdict.mount === undefined && verdict.inconclusive === '') {
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

  if (verdict.mount === undefined) {
    console.error(`verify: INCONCLUSIVE — the roster did not answer within ${ANSWER_WINDOW_MS}ms.`)
    console.error('verify: nothing was verified.')
    process.exitCode = 1
    return
  }

  if (!verdict.mount.ok) {
    console.error('MOUNT REJECTED — the preset cannot be composed:')
    console.error(`  ${verdict.mount.detail}`)
    process.exitCode = 1
    return
  }

  console.log(`MOUNTED OK — ${verdict.mount.detail}`)
  console.log('Scope of this result: every row activated. It says nothing about whether tools')
  console.log('reached a model, and it cannot be made to — see this file\'s header.')
  printSurfaceSteps(console.log)
}

await main()
