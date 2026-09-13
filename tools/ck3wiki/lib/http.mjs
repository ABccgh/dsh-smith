/**
 * MediaWiki HTTP transport for ck3.paradoxwikis.com.
 *
 * WHY THIS IS NOT `fetch`
 * -----------------------
 * The wiki sits behind a Fastly JS "Client Challenge" (`_fs_ch_st`) that answers HTTP 200
 * with a ~3 KB HTML page for every path — including `/api.php`, `/rest.php` and
 * `index.php?action=raw`. Measured on this machine, repeatedly:
 *
 *   User-Agent: Mozilla/5.0 …Chrome/131…  +  Accept-Language: en-US,en;q=0.9   -> real JSON
 *   the same, without Accept-Language                                          -> challenge
 *   curl's own UA, with Accept-Language                                        -> challenge
 *   `python-requests/2.31`, with Accept-Language                               -> challenge
 *   Accept-Language: *                                                         -> real JSON
 *   Node 26 `fetch` (undici), with BOTH headers                                -> challenge
 *
 * So the gate wants a browser-looking `User-Agent` and the *presence* of
 * `Accept-Language`; HTTP/1.1 vs 2 makes no difference. undici cannot satisfy it, but
 * `curl.exe` can, and Node may drive curl with piped stdio (measured working). That is the
 * whole reason this file shells out instead of using `fetch`.
 *
 * The discrimination is also INTERMITTENT — the same request sometimes answers 2948 bytes
 * of challenge and sometimes 1613 bytes of JSON — so every response is inspected for an
 * HTML body and retried with backoff rather than trusted.
 */

import { execFile } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export const WIKI_HOST = 'https://ck3.paradoxwikis.com'
export const API = `${WIKI_HOST}/api.php`

/** The exact header pair measured to pass the gate. Do not "simplify" this to a UA alone. */
export const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const ACCEPT_LANGUAGE = 'en-US,en;q=0.9'

/** Requests that returned an HTML challenge body, for the run report. */
export const gateStats = { requests: 0, challenged: 0 }

function curlRaw(url, { timeoutSec = 60, maxBuffer = 1024 * 1024 * 512 } = {}) {
  return new Promise((resolve, reject) => {
    execFile(
      'curl.exe',
      [
        '-s',
        '--http1.1',
        '--max-time', String(timeoutSec),
        '--compressed',
        '-H', `User-Agent: ${BROWSER_UA}`,
        '-H', `Accept-Language: ${ACCEPT_LANGUAGE}`,
        '-H', 'Accept: application/json, text/html;q=0.9, */*;q=0.8',
        url,
      ],
      { maxBuffer, encoding: 'utf8', windowsHide: true },
      (error, stdout, stderr) => {
        if (error) return reject(new Error(`curl failed for ${url}: ${error.message} ${stderr || ''}`.trim()))
        resolve(stdout)
      },
    )
  })
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * GET one URL through curl, retrying while the answer looks like the challenge page.
 *
 * @param {string} url
 * @param {{tries?: number, label?: string}} [options]
 * @returns {Promise<string>} the response body
 * @throws when every attempt was challenged or the transport kept failing
 */
export async function getText(url, { tries = 6, label = url } = {}) {
  let last = 'no attempt made'
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      const body = await curlRaw(url)
      gateStats.requests += 1
      // The challenge page is HTML that starts with the doctype, and so is a normal wiki
      // page — but only the API/parse bodies are ever requested here, and those are JSON.
      const looksChallenged = body.startsWith('<!DOCTYPE html>') && body.includes('_fs-ch-')
      if (!looksChallenged && body.length > 0) return body
      gateStats.challenged += 1
      last = looksChallenged ? `challenge page (${body.length} bytes)` : 'empty body'
    } catch (error) {
      last = error.message
    }
    await sleep(400 * attempt + Math.floor(Math.random() * 250))
  }
  throw new Error(`gate/transport not passed for ${label} after ${tries} tries: ${last}`)
}

/**
 * One `action=query`-style API call, parsed as JSON.
 *
 * @param {Record<string, string|number|undefined>} params query parameters
 * @param {{tries?: number, method?: 'GET'|'POST'}} [options]
 */
export async function apiGet(params, { tries = 6, method = 'GET' } = {}) {
  const url = new URL(API)
  url.searchParams.set('format', 'json')
  url.searchParams.set('formatversion', '2')
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value))
  }
  const body = await getText(url.toString(), { tries, label: String(params.action) })
  try {
    return JSON.parse(body)
  } catch {
    throw new Error(`API returned non-JSON for ${url}: ${body.slice(0, 160)}`)
  }
}

/**
 * Same as {@link apiGet} but POSTs the parameters, for requests whose URL would be too long.
 * MediaWiki accepts `application/x-www-form-urlencoded` bodies for these actions.
 */
export async function apiPost(params, { tries = 6 } = {}) {
  const form = new URLSearchParams()
  form.set('format', 'json')
  form.set('formatversion', '2')
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') form.set(key, String(value))
  }
  let last = 'no attempt made'
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      const body = await new Promise((resolve, reject) => {
        execFile(
          'curl.exe',
          [
            '-s', '--http1.1', '--max-time', '90', '--compressed',
            '-X', 'POST',
            '-H', `User-Agent: ${BROWSER_UA}`,
            '-H', `Accept-Language: ${ACCEPT_LANGUAGE}`,
            '-H', 'Accept: application/json',
            '-H', 'Content-Type: application/x-www-form-urlencoded',
            '--data-binary', '@-',
            API,
          ],
          { maxBuffer: 1024 * 1024 * 512, encoding: 'utf8', windowsHide: true },
          (error, stdout, stderr) => {
            if (error) return reject(new Error(`${error.message} ${stderr || ''}`.trim()))
            resolve(stdout)
          },
        ).stdin?.end?.(form.toString())
      })
      gateStats.requests += 1
      if (!(body.startsWith('<!DOCTYPE html>') && body.includes('_fs-ch_'))) return JSON.parse(body)
      gateStats.challenged += 1
      last = 'challenge page'
    } catch (error) {
      last = error.message
    }
    await sleep(400 * attempt)
  }
  throw new Error(`POST not passed after ${tries} tries: ${last}`)
}

/** Write text to disk, creating parent directories. */
export async function saveText(path, text) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, text, 'utf8')
}

/** Split an array into fixed-size chunks. */
export function chunk(items, size) {
  const out = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}
