/**
 * Crawl the CK3 wiki into a provenance-marked Markdown corpus plus a manifest.
 *
 * WHAT THIS PRODUCES
 *   data/out/<partition>/<safe title>.md   one file per page, with a header carrying the
 *                                          source URL, revision id and revision timestamp
 *   data/manifest.json                     every page's pageid / revid / timestamp / path /
 *                                          SHA-256 / byte count / audit result, and the
 *                                          redirect aliases that resolve to it
 *   data/extract-report.json               the per-page audit, including failures
 *
 * THE AUDIT IS THE POINT. A converter that silently drops half a page still produces a
 * corpus that looks complete, so every page is checked before it is allowed into the
 * corpus, and a page that fails goes to `failed` rather than to `pages`:
 *
 *   - its Markdown must be at least `--min-recall` (default 0.10) of the source's
 *     tag-stripped text, which catches a page whose body silently disappeared;
 *   - its heading count must match the source's `<h*>` count;
 *   - no residual HTML tag may survive (except the deliberate `<br>`);
 *   - no sentinel may reach the output.
 *
 * Redirects are resolved BEFORE fetching: `action=parse&page=X` does NOT follow redirects,
 * and this wiki has 1470 of them against 430 real articles, so a naive crawl would ingest
 * 1470 near-empty stubs as if they were content. Each redirect is recorded as an alias of
 * its target so the alias name still appears in the corpus and stays searchable.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { apiGet, gateStats } from './lib/http.mjs'
import { htmlToMarkdown } from './lib/convert.mjs'

const HOST = 'https://ck3.paradoxwikis.com'
const DATA = 'data'
const OUT = `${DATA}/out`

/** Partition prefixes. ima offers no folder creation through the API, so the corpus is
 *  flat in the knowledge base and these prefixes keep it sorted and readable instead. */
const PARTITIONS = [
  { ns: 0, dir: '00_Articles', label: '文章' },
  { ns: 4, dir: '10_Project', label: '项目页' },
  { ns: 828, dir: '20_Modules', label: '模块' },
  { ns: 8, dir: '30_MediaWiki', label: '界面文案' },
  { ns: 10, dir: '40_Templates', label: '模板' },
  { ns: 14, dir: '50_Categories', label: '分类' },
]

const failures = []
const report = []
const gateFailures = []

function argOf(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i === -1 ? fallback : process.argv[i + 1]
}
const MIN_RECALL = Number(argOf('min-recall', '0.10'))
const CONCURRENCY = Number(argOf('concurrency', '4'))
const LIMIT = Number(argOf('limit', '0')) || Infinity
const ONLY_NS = argOf('ns', '')
const REFRESH = process.argv.includes('--refresh')

/** All page titles in a namespace, following the continuation cursor. */
async function listNamespace(ns, filter) {
  const out = []
  let cont
  do {
    const params = { action: 'query', list: 'allpages', apnamespace: ns, aplimit: 500 }
    if (filter) params.apfilterredir = filter
    if (cont) params.apcontinue = cont
    const res = await apiGet(params)
    out.push(...(res.query?.allpages ?? []))
    cont = res.continue?.apcontinue
  } while (cont)
  return out
}

/**
 * The `from` -> `to` map for every redirect in namespace 0.
 *
 * `redirects=1` on its own only RESOLVES a title; the mapping comes from the `redirects`
 * array the API returns alongside `query.pages`, whose entries are `{ from, to, tofragment }`.
 * Reading `query.pages[].redirects` instead returns nothing at all — the first version of
 * this function did that, reported "0 redirects resolve to 0 targets", and would have left
 * every alias unrecorded while looking like a successful crawl.
 */
async function resolveRedirects() {
  const map = new Map()
  const redirects = await listNamespace(0, 'redirects')
  for (let i = 0; i < redirects.length; i += 50) {
    const batch = redirects.slice(i, i + 50).map((p) => p.title)
    const res = await apiGet({ action: 'query', titles: batch.join('|'), redirects: 1 })
    for (const entry of res.query?.redirects ?? []) {
      if (!entry.to) continue
      const list = map.get(entry.to) ?? []
      list.push(entry.from)
      map.set(entry.to, list)
    }
  }
  return map
}

/** Filesystem-safe name for a page title, stable across runs. */
const safeName = (title) => title.replace(/[/\\:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 150)

/** Text-recall audit: how much of the source's visible text survived conversion. */
function measureRecall(html, markdown) {
  const sourceText = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/\s+/g, ' ')
    .trim()
  const words = (text) => text.split(' ').filter((w) => /[\p{L}\p{N}]/u.test(w)).length
  const sourceWords = words(sourceText)
  const outWords = words(markdown)
  return { sourceWords, outWords, ratio: sourceWords === 0 ? 1 : outWords / sourceWords }
}

/** Rewrite image links to absolute host URLs and neutralise table-breaking pipes. */
function finalise(markdown, title) {
  return markdown
    .replace(/\]\(\/(images|wiki|index\.php)/g, `](${HOST}/$1`)
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function provenanceHeader({ title, url, revid, revisionAt, fetchedAt, aliases, header, stats, sourceBytes }) {
  const lines = [
    `# ${title}`,
    '',
    `> **来源**：${url}`,
    `> **修订**：revid ${revid} ｜ wiki 修订时间 ${revisionAt || '（未取到）'} ｜ 本次抓取时间 ${fetchedAt}`,
    `> **源数据**：${sourceBytes} 字节 HTML → ${stats.headings} 个标题、${stats.tablesSeen} 个表格（${stats.tableRows} 行）、${stats.links} 条链接`,
    `> **抓取工具**：tools/ck3wiki/extract.mjs（DSH）｜ 许可：Paradox Wikis CC BY-SA 4.0`,
  ]
  if (aliases.length > 0) lines.push(`> **别名（本页的重定向标题，便于检索命中）**：${aliases.join('、')}`)
  if (header) lines.push(`> **版本声明**：${header}`)
  lines.push('', '---', '')
  return lines.join('\n')
}

/**
 * One batched pass over the wikitext, gathering both facts `action=parse` does not return:
 * the `{{Version|1.19}}` banner that the HTML render strips, and the page's own revision
 * timestamp.
 *
 * Batched (50 titles per request) because the per-page variant had to transfer every page's
 * full wikitext a second time — measured, that made the whole crawl run ~43 s/page against
 * ~3 s/page for a single parse request per page.
 *
 * @returns a Map of title -> `{ version, timestamp }`.
 */
async function prefetchRevisions(titles) {
  const info = new Map()
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50)
    try {
      const res = await apiGet({ action: 'query', prop: 'revisions', rvprop: 'content|timestamp', rvslots: 'main', titles: batch.join('|') })
      for (const page of res.query?.pages ?? []) {
        const revision = page.revisions?.[0]
        const content = revision?.slots?.main?.content ?? ''
        const m = /\{\{\s*[Vv]ersion\s*\|\s*([^}|]+)/.exec(content)
        info.set(page.title, { version: m ? m[1].trim() : '', timestamp: revision?.timestamp ?? '' })
      }
    } catch (error) {
      // Both facts are niceties; a failed batch must never fail the run.
      console.log(`  revision prefetch batch ${i / 50 + 1} failed: ${error.message}`)
    }
    if ((i / 50) % 5 === 0) console.log(`  revision prefetch: ${Math.min(i + 50, titles.length)}/${titles.length}`)
  }
  return info
}

async function extractPage(title, info, aliases, revisionOf) {
  // ONE request per page. `action=parse` already returns the revision id, and the version
  // banner comes from a batched wikitext prefetch rather than a per-page `prop=revisions`
  // call: that second call transferred the page's ENTIRE wikitext a second time (Army alone
  // is ~380 KB) and dominated the run — measured, the crawl ran ~43 s/page with it and ~3 s
  // per page when the same pages were fetched with a single parse request each.
  const res = await apiGet({
    action: 'parse',
    page: info.target ?? title,
    prop: 'text|revid|displaytitle',
    redirects: 1,
  })
  if (!res.parse) throw new Error(`parse failed: ${JSON.stringify(res.error ?? {}).slice(0, 160)}`)
  const html = res.parse.text
  const revid = res.parse.revid
  const revision = revisionOf.get(res.parse.title) ?? revisionOf.get(title) ?? {}
  const version = revision.version ?? ''

  const { markdown, stats } = htmlToMarkdown(html)
  const recall = measureRecall(html, markdown)
  const url = `${HOST}/${encodeURIComponent(res.parse.title.replace(/ /g, '_'))}`
  // The moment THIS mirror captured the page — kept separate from the wiki's own revision
  // time. The two were once printed from the same value, which made every artifact claim the
  // wiki revision happened at fetch time. `parse` does not return the revision timestamp, so
  // it comes from the batched prefetch rather than from a second request per page.
  const fetchedAt = new Date().toISOString()
  const revisionAt = revision.timestamp ?? ''

  const body = finalise(markdown, res.parse.title)
  const full = `${provenanceHeader({
    title: res.parse.title, url, revid, revisionAt, fetchedAt, aliases, header: version, stats, sourceBytes: html.length,
  })}\n${body}\n`

  const problems = []
  // The size floor measures the BODY, not the whole file: the provenance header is ~300
  // characters on its own, so a threshold applied to `full` fires on every genuinely tiny
  // page — and this wiki is full of them (an icon-only category renders as a single bullet).
  // Measured: `Category:Activity icons` has 727 bytes of source and 10 characters of body,
  // and that is CORRECT; `MediaWiki:Disclaimers` is genuinely three lines.
  if (body.length < 40) problems.push(`body nearly empty (${body.length} chars) while the source has ${html.length} bytes`)
  const sourceHeadings = (html.match(/<h[1-6][\s>]/g) ?? []).length
  const outHeadings = (full.match(/^#{1,6} /gm) ?? []).length
  if (sourceHeadings > 0 && outHeadings < sourceHeadings * 0.8) problems.push(`headings ${outHeadings} vs ${sourceHeadings} in source`)
  // A residual tag means the walker let real HTML through. The test is a DENYLIST of actual
  // HTML element names, not an allowlist of extension tags: this wiki's game-script and
  // modding pages legitimately contain things like `<faith_key>` and `<Player>` as CONTENT,
  // and `<br>` is how a newline inside a table cell is spelled. An allowlist kept growing
  // every time a page invented another placeholder; a denylist only fires on markup that the
  // converter was supposed to consume.
  const HTML_ELEMENTS = /^<\/?(a|b|i|u|s|p|div|span|table|tbody|thead|tfoot|tr|td|th|caption|ul|ol|li|dl|dt|dd|h[1-6]|img|figure|figcaption|blockquote|section|center|small|big|sub|sup|code|tt|abbr|q|time|bdi|ruby|rt|rb|input|label|form|button|select|option|textarea|iframe|object|embed|video|audio|source|canvas|svg|math)\b[^>]*>$/i
  // NOT markup, and each case was measured on a real page rather than assumed:
  //   - an HTML entity that decoded to text such as `&lt;div&gt;`;
  //   - MediaWiki's SectionAnchors markers `<section begin=NAME/>` (invisible anchors);
  //   - markup that a page is DOCUMENTING rather than using. `Template:Go to top` renders the
  //     sentence "The template inserts the following HTML code:" followed by a literal
  //     `<div style="float: right;">`; a check that fails on the wiki's own documentation is a
  //     check whose reader learns to ignore it. `lib/convert.mjs` now puts those regions in a
  //     fenced code block, so the tag is visible content.
  const NOT_MARKUP = /^<\/?(#\d+|[a-z]+);|^<\/?section\s+(begin|end)\s*=/i
  const stray = (full.match(/<[a-zA-Z/][^>]*>/g) ?? []).filter((t) => HTML_ELEMENTS.test(t) && !NOT_MARKUP.test(t))
  if (stray.length > 0) problems.push(`residual HTML: ${[...new Set(stray)].slice(0, 3).join(' ')}`)
  if (/[\u0000-\u0003]/.test(full)) problems.push('sentinel leaked into output')

  return {
    title: res.parse.title,
    requestedTitle: title,
    revid,
    revisionAt,
    fetchedAt,
    declaredBodyBytes: body.length,
    version,
    url,
    aliases,
    stats,
    recall,
    sourceBytes: html.length,
    markdown: full,
    problems,
  }
}

async function mapWithConcurrency(items, limit, worker) {
  const results = []
  let cursor = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++
      results[index] = await worker(items[index], index)
    }
  })
  await Promise.all(runners)
  return results
}

async function main() {
  const started = Date.now()
  await mkdir(OUT, { recursive: true })

  const wantedNs = ONLY_NS ? ONLY_NS.split(',').map(Number) : PARTITIONS.map((p) => p.ns)
  const manifestPath = join(DATA, 'manifest.json')
  let previous = { pages: [] }
  try { previous = JSON.parse(await readFile(manifestPath, 'utf8')) } catch { /* first run */ }
  const prevByTitle = new Map((previous.pages ?? []).map((p) => [p.title, p]))

  console.log('resolving redirects ...')
  const aliasesByTarget = await resolveRedirects()
  console.log(`  ${[...aliasesByTarget.values()].reduce((n, l) => n + l.length, 0)} redirects resolve to ${aliasesByTarget.size} targets`)

  const work = []
  const seenTitles = new Set()
  let duplicates = 0
  for (const part of PARTITIONS) {
    if (!wantedNs.includes(part.ns)) continue
    const filter = part.ns === 0 ? 'nonredirects' : undefined
    const pages = await listNamespace(part.ns, filter)
    console.log(`  ns${part.ns} ${part.dir}: ${pages.length} pages`)
    for (const p of pages) {
      // `list=allpages` pagination can hand back a title twice across a cursor boundary —
      // measured: six Template pages did, and because the output path is derived from the
      // title, the second fetch silently OVERWROTE the first file while the manifest kept two
      // entries whose sha256 no longer matched the disk. Deduplicating here is the fix; the
      // post-write verification below is what would have caught it.
      if (seenTitles.has(p.title)) { duplicates += 1; continue }
      seenTitles.add(p.title)
      work.push({ title: p.title, dir: part.dir, ns: part.ns })
    }
  }
  if (duplicates > 0) console.log(`  deduplicated ${duplicates} title(s) that pagination returned twice`)
  const selected = work.slice(0, LIMIT === Infinity ? work.length : LIMIT)

  console.log('\nprefetching revision info (batched, 50 titles per request) ...')
  const revisionOf = await prefetchRevisions(selected.map((item) => item.title))
  console.log(`  ${[...revisionOf.values()].filter((r) => r.version).length} of ${selected.length} pages declare a {{Version}} banner`)

  console.log(`\nextracting ${selected.length} pages (concurrency ${CONCURRENCY}, min-recall ${MIN_RECALL})\n`)

  let done = 0
  const startedAt = Date.now()
  const results = await mapWithConcurrency(selected, CONCURRENCY, async (item) => {
    const aliases = aliasesByTarget.get(item.title) ?? []
    const prev = prevByTitle.get(item.title)
    try {
      const page = await extractPage(item.title, { target: item.title }, aliases, revisionOf)
      done += 1
      if (done % 25 === 0) {
        const rate = (Date.now() - startedAt) / done
        const remaining = Math.round((selected.length - done) * rate / 1000)
        console.log(`  ... ${done}/${selected.length}  ${(rate / 1000).toFixed(1)}s/page  ~${Math.ceil(remaining / 60)}min left`)
      }
      const path = join(OUT, item.dir, `${safeName(page.title)}.md`)
      await mkdir(join(OUT, item.dir), { recursive: true })
      await writeFile(path, page.markdown, 'utf8')
      const sha256 = createHash('sha256').update(page.markdown, 'utf8').digest('hex')
      const entry = {
        title: page.title,
        requestedTitle: item.title,
        ns: item.ns,
        partition: item.dir,
        revid: page.revid,
        revisionAt: page.revisionAt,
        fetchedAt: page.fetchedAt,
        bodyBytes: page.declaredBodyBytes,
        version: page.version,
        url: page.url,
        aliases: page.aliases,
        bytes: Buffer.byteLength(page.markdown, 'utf8'),
        sha256,
        path: path.replace(/\\/g, '/'),
        recall: Number(page.recall.ratio.toFixed(4)),
        sourceBytes: page.sourceBytes,
        unchangedRevision: prev?.revid === page.revid,
        audit: page.problems,
      }
      if (page.problems.length > 0) gateFailures.push({ title: page.title, problems: page.problems })
      report.push({ ...entry, problems: page.problems })
      return entry
    } catch (error) {
      done += 1
      failures.push({ title: item.title, error: error.message })
      return null
    }
  })

  const pages = results.filter(Boolean)
  const updated = pages.filter((p) => !p.unchangedRevision)

  // Verify the mirror on disk against the manifest, by re-reading every written file and
  // recomputing its digest. Skipped content checks and filename collisions both hide here:
  // a page whose output path collides with another's is silently overwritten, and a manifest
  // that claims a hash it never wrote is worse than no manifest. Six Template pages hit this
  // before the check existed.
  let verified = 0
  const mismatched = []
  for (const entry of pages) {
    try {
      const onDisk = await readFile(entry.path, 'utf8')
      if (createHash('sha256').update(onDisk, 'utf8').digest('hex') !== entry.sha256) mismatched.push(entry.title)
      else verified += 1
    } catch { mismatched.push(entry.title) }
  }
  if (mismatched.length > 0) {
    console.log(`\n!! ${mismatched.length} page(s) do not match the manifest on disk:`)
    for (const title of mismatched.slice(0, 10)) console.log(`   ${title}`)
    console.log('   (a filename collision or a skipped write — the manifest is not trustworthy until this is zero)')
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    source: HOST,
    license: 'Paradox Wikis content is CC BY-SA 4.0',
    minRecall: MIN_RECALL,
    counts: {
      pages: pages.length,
      articles: pages.filter((p) => p.ns === 0).length,
      failed: failures.length,
      auditFailed: gateFailures.length,
      changedSinceLastRun: updated.length,
      redirects: [...aliasesByTarget.values()].reduce((n, l) => n + l.length, 0),
      verifiedOnDisk: verified,
      mismatchedOnDisk: mismatched.length,
    },
    gate: { requests: gateStats.requests, challenged: gateStats.challenged },
    pages,
    failures,
  }
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8')
  await writeFile(join(DATA, 'extract-report.json'), JSON.stringify({ manifest: manifest.counts, gateFailures, failures, pages: report }, null, 2), 'utf8')

  console.log(`\n=== result ===`)
  console.log(`pages written    : ${pages.length}  (articles ${manifest.counts.articles})`)
  console.log(`verified on disk : ${verified} / ${pages.length}${mismatched.length ? `  (${mismatched.length} MISMATCHED)` : ''}`)
  console.log(`fetch failures   : ${failures.length}`)
  console.log(`audit failures   : ${gateFailures.length}`)
  console.log(`changed revisions: ${updated.length} of ${pages.length}`)
  console.log(`gate             : ${gateStats.challenged} challenges out of ${gateStats.requests} requests`)
  console.log(`total bytes      : ${(pages.reduce((n, p) => n + p.bytes, 0) / 1048576).toFixed(1)} MiB`)
  console.log(`elapsed          : ${((Date.now() - started) / 1000).toFixed(1)}s`)
  for (const f of gateFailures.slice(0, 10)) console.log(`  AUDIT ${f.title}: ${f.problems.join('; ')}`)
  for (const f of failures.slice(0, 10)) console.log(`  FETCH ${f.title}: ${f.error}`)
}

main().catch((error) => { console.error('FATAL', error); process.exit(1) })
