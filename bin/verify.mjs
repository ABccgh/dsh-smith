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
 * AND THERE IS A SECOND, HARDER LIMIT -- that is not in this script's favour.
 *
 * The probe below boots its OWN runtime: `root = new cordis.Context()` at line
 * ~204, then `root.plugin(probe)`. A bare Cordis context carries none of the
 * harness registries, so `agentPresets` is absent by CONSTRUCTION, and this
 * script therefore reports INCONCLUSIVE from every session -- including a
 * session on the shipped `cordis` preset where the probe route works fine.
 * Measured twice, verbatim identical output: once in an ordinary shell, once
 * inside a shipped-`cordis` session that had `tool-cordis` active, and both
 * printed `this runtime publishes no \`agentPresets\` service` with exit 1.
 *
 * So this script is a DIAGNOSTIC, not the mount check: it tells you whether
 * THIS machine's CLI can reach a harness runtime, and it can say MOUNT REJECTED
 * only when it is handed one. The mount verdict comes from the roster's own
 * method, called inside a live harness process -- the dynamic-plugin route
 * (`cordis_define` + `cordis_run` registering a probe tool that calls
 * `ctx.agentPresets.standingKeyFor(id)`), which needs a session whose preset
 * composes `tool-cordis`: the shipped `cordis` preset, and NOT `dsh-smith` or
 * `dsh-forge`, whose gates remove exactly those tools. See AGENTS.md rule 5.
 *
 * Outcomes are reported distinctly, because "verified" and "could not check"
 * must never look alike:
 *
 *   MOUNTED OK      the preset composed: no unusable row, no leaked service
 *   MOUNT REJECTED  the preset cannot be composed; the reason is printed
 *   INCONCLUSIVE    nothing was verified (exit 1 -- an unrun check is not a pass)
 *
 * Usage:
 *   node bin/verify.mjs                 verify the installed dsh-smith preset
 *   node bin/verify.mjs --preset <id>   verify a specific preset
 *   node bin/verify.mjs --path X        check the composition file at X instead
 *   node bin/verify.mjs --quiet         print only the verdict and the next steps
 */
import { access, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  dshHome,
  installedComposition,
  presetEntry,
  presetFromArgv,
  repoComposition,
  UnknownPresetError,
} from './presets.mjs'

let PRESET_ID
let EXPECTED_TOOLS
try {
  PRESET_ID = presetFromArgv(process.argv.slice(2))
  EXPECTED_TOOLS = presetEntry(PRESET_ID).expectedTools
} catch (error) {
  console.error(`verify: ${error instanceof UnknownPresetError ? error.message : String(error)}`)
  process.exit(1)
}

const DSH_HOME = dshHome()
const INSTALLED = installedComposition(PRESET_ID, DSH_HOME)
const REPO_COPY = repoComposition(PRESET_ID)
/** How long to give the mount before concluding the runtime never answered. */
const ANSWER_WINDOW_MS = 30_000

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
  stream(`Open a NEW session on the preset 「${presetEntry(PRESET_ID).displayName}」, then:`)
  stream(`  cordis_inspect_query  platform=host provider=Tool method=listTools`)
  stream(`  and confirm these names appear: ${EXPECTED_TOOLS.join(', ')}`)
  const promptSurface = presetEntry(PRESET_ID).promptSurface
  if (promptSurface !== undefined) {
    // A reserved presentation transport is NOT a registered tool, so it cannot
    // appear in the tool table this script just told the reader to inspect.
    // `run_code` is reserved against registration (dsh-tools/lib/index.js:2780)
    // and materialized only at schema assembly, so it is visible in the model's
    // wire schema and in the generated `tools:sdk` prompt section instead.
    stream('')
    stream(`  ${promptSurface} is NOT in that list, and its absence there is not a defect:`)
    stream(`  ${promptSurface} is the PTC presentation transport, reserved against registration and`)
    stream('  materialized only at schema assembly. Look for it in the model-facing schema /')
    stream('  the generated `tools:sdk` prompt section instead.')
  }
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
    console.error('verify: from inside a session on the SHIPPED `cordis` preset — see the next')
    console.error('verify: stanza for why no locally authored preset can run this check.')
    process.exitCode = 1
    return
  }

  const verdict = { mount: undefined, inconclusive: '' }

  // A probe that declares the one service this check needs. When the runtime
  // publishes it, `apply` runs and asks the roster the question that matters.
  const probe = {
    name: `preset-verify-${PRESET_ID}`,
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
    console.error('verify: nothing was verified. This script boots its OWN bare Cordis context')
    console.error('verify: (new cordis.Context(), near line 204), which carries none of the')
    console.error('verify: harness registries — so it CANNOT reach `agentPresets` from ANY')
    console.error('verify: session, including one on the shipped `cordis` preset where the')
    console.error('verify: check does work.')
    console.error('verify:')
    console.error('verify: The mount verdict comes from the roster method itself, called inside a')
    console.error('verify: live harness process. Use the dynamic-plugin route from a session on the')
    console.error('verify: shipped `cordis` preset: define a Host plugin that injects')
    console.error("verify: ['agentPresets'], register a tool that awaits")
    console.error(`verify:   ctx.agentPresets.standingKeyFor('${PRESET_ID}')`)
    console.error('verify: and read the result through that tool. A locally authored preset cannot')
    console.error('verify: do this: the route needs `cordis_*`, and the gate that keeps this preset')
    console.error('verify: mountable is exactly what removes those tools. AGENTS.md rule 5.')
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
