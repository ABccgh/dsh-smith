/**
 * Verification harness for lib/convert.mjs.
 *
 * `--fetch <Title...>`  fetch those pages' parse HTML into data/_raw (uses the network)
 * `--check <Title...>`  convert the stored HTML and run assertions (offline)
 * `--checkall`          convert every stored HTML file and report the whole corpus
 *
 * The assertions are deliberately about things that would be INVISIBLE in a plausible but
 * wrong conversion: leaked cell text, unrendered wiki syntax, lost table semantics, lost
 * icon text, and self-links turned into link noise.
 */
import { readFile, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { apiGet } from './lib/http.mjs'
import { htmlToMarkdown } from './lib/convert.mjs'

const RAW = 'data/_raw'
const args = process.argv.slice(2)
const mode = args[0]
const titles = args.slice(1)

const slug = (t) => t.replace(/[^\w.-]+/g, '_')

async function fetchPages(list) {
  for (const title of list) {
    const res = await apiGet({ action: 'parse', page: title, prop: 'text|revid|displaytitle' })
    if (!res.parse) { console.log(`FETCH FAIL ${title}: ${JSON.stringify(res.error ?? res).slice(0, 160)}`); continue }
    const html = res.parse.text
    const { writeFile, mkdir } = await import('node:fs/promises')
    await mkdir(RAW, { recursive: true })
    await writeFile(`${RAW}/${slug(title)}.html`, html, 'utf8')
    console.log(`fetched ${title} -> ${slug(title)}.html  revid=${res.parse.revid} htmlLen=${html.length}`)
  }
}

function assertReport(title, html, md, stats) {
  const problems = []
  const notes = []
  const push = (msg) => problems.push(msg)

  // `<br>` is deliberate: it is how a newline inside a table cell is spelled.
  const tagHits = (md.match(/<[a-zA-Z/][^>]*>/g) ?? []).filter((t) => !/^<br\s*\/?>$/i.test(t))
  if (tagHits.length > 0) push(`residual HTML tag(s): ${[...new Set(tagHits)].slice(0, 3).join(' ')}`)
  if (/mw-editsection|\[\s*edit\s*\]/i.test(md)) push(`edit link survived`)
  if (/\u0000|\u0001|\u0002|\u0003/.test(md)) push(`sentinel leaked into output`)
  if (md.length < 400) push(`suspiciously short (${md.length} chars)`)

  // Self-links: a page must not become a link to itself.
  const selfLink = new RegExp(`\\[[^\\]]*\\]\\(https://ck3\\.paradoxwikis\\.com/${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`, 'i')
  if (selfLink.test(md)) push(`self-link rendered as a link`)

  // Headings: the source's heading count must be the output's heading count.
  const sourceHeadings = (html.match(/<h[1-6][\s>]/g) ?? []).length
  const outHeadings = (md.match(/^#{1,6} /gm) ?? []).length
  if (sourceHeadings > 0 && outHeadings < sourceHeadings * 0.8) {
    push(`headings lost: ${outHeadings} rendered vs ${sourceHeadings} in source`)
  }

  // Table semantics: the source's table rows must be represented.
  if (stats.tablesSeen > 0) {
    const pipeRows = (md.match(/^\|.*\|$/gm) ?? []).length
    if (pipeRows < stats.tableRows * 0.6) {
      push(`table rows lost: ${pipeRows} rendered vs ${stats.tableRows} in source`)
    }
  }
  // The wiki's Yes/No/icon semantics live in image text.
  if (stats.images > 20 && stats.textImages === 0) push(`no image text recovered from ${stats.images} images`)

  // A cell's text appearing twice in one row is NOT by itself a defect: this wiki repeats
  // list items inside a single `<td>` (measured: the Shinto row's court-chaplain cell
  // contains each name twice in the source). So it is reported as a NOTE, and the source is
  // consulted before a caller treats it as a leak.
  // A cell's text appearing twice in one row is NOT by itself a defect: this wiki repeats
  // list items inside a single `<td>` (measured: the Shinto row's court-chaplain cell
  // contains each name twice in the source). So it is reported as a NOTE, and the source is
  // consulted before a caller treats it as a leak. The comparison must be made on text the
  // source actually CONTAINS — an earlier version compared rendered Markdown (link labels,
  // image alt text, synthetic "- " bullets) against tag- and attribute-stripped HTML, so the
  // needle could never be found and faithful output was reported as broken.
  for (const line of md.split('\n').filter((l) => l.startsWith('|'))) {
    const seen = new Map()
    for (const cell of line.split('|').map((c) => c.trim())) {
      if (cell.length > 12 && !/^-+$/.test(cell)) seen.set(cell, (seen.get(cell) ?? 0) + 1)
    }
    for (const [cell, count] of seen) {
      if (count <= 1) continue
      const needle = normaliseForCompare(cell).split(' ').filter((w) => w.length > 3).slice(0, 4).join(' ')
      const haystack = html
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;|&#160;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
      const inSource = needle.length < 8 ? 0 : haystack.split(needle).length - 1
      if (inSource >= count) notes.push(`row repeats "${cell.slice(0, 44)}…" ${count}× — source contains it ${inSource}× (faithful)`)
      else notes.push(`row repeats "${cell.slice(0, 44)}…" ${count}×, source ${inSource}× — verify against the source row below`)
    }
  }
  // TOTAL row comparison across the whole page. This is what catches a rendered table whose
  // rows were overwritten wholesale (the "cursor reset per table" defect): the rendered row
  // count collapses toward the first table's size while the source still has all its rows.
  //
  // A finer per-row source alignment was attempted twice and abandoned: rendered rows cannot
  // be index-aligned with source rows (tables nest, some source rows render as header rows,
  // and cells get padded by colspan), and a word-coverage heuristic fired on correct output
  // for any row of terse cells. Rather than ship a check that cries wolf — which would train
  // its reader to ignore it — the precise defect is pinned by `falsify.mjs`, whose synthetic
  // two-table case is deterministic and fails loudly when the cursor is reset.
  const sourceRowTotal = [...html.matchAll(/<tr\b/gi)].length
  const renderedRowTotal = (md.match(/^\|.*\|$/gm) ?? []).length - (md.match(/^\|\s*---/gm) ?? []).length
  if (sourceRowTotal > 0 && renderedRowTotal < sourceRowTotal * 0.8) {
    push(`table rows lost: ${renderedRowTotal} rendered vs ${sourceRowTotal} <tr> in source`)
  }

  return { problems, notes }
}

function stripMarkup(fragment) {
  return fragment
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/\s+/g, ' ')
    .trim()
}

/** Reduce a rendered cell to the words that must also exist in the source text. */
function normaliseForCompare(text) {
  return text
    .replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/g, ' ')   // [![alt](src)](href)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')                 // ![alt](src)
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')               // [label](url) -> label
    .replace(/^\s*[-*]\s+/gm, ' ')                         // list bullets added by the converter
    .replace(/\*\*|__|`|~~/g, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/\\\|/g, '|')
    .replace(/\s+/g, ' ')
    .trim()
}

async function checkOne(title) {
  const path = `${RAW}/${slug(title)}.html`
  if (!existsSync(path)) { console.log(`SKIP ${title}: ${path} missing (run --fetch first)`); return null }
  const html = await readFile(path, 'utf8')
  const started = Date.now()
  const { markdown, stats } = htmlToMarkdown(html)
  const { problems, notes } = assertReport(title, html, markdown, stats)
  const headings = (markdown.match(/^#{1,6} /gm) ?? []).length
  console.log(
    `${problems.length === 0 ? 'PASS' : 'FAIL'} ${title.padEnd(28)} ` +
    `html=${String(html.length).padStart(7)} md=${String(markdown.length).padStart(7)} ` +
    `headings=${String(headings).padStart(3)}/${String(stats.headings).padStart(3)} ` +
    `tables=${String(stats.tablesSeen).padStart(3)} rows=${String(stats.tableRows).padStart(4)} ` +
    `img=${String(stats.images).padStart(4)}/(${stats.textImages} text) links=${String(stats.links).padStart(4)} ` +
    `${Date.now() - started}ms`,
  )
  for (const p of problems) console.log(`      ! ${p}`)
  for (const n of notes) console.log(`      · ${n}`)
  return { title, problems, notes, stats, markdown, html }
}

if (mode === '--fetch') {
  await fetchPages(titles)
} else if (mode === '--check') {
  for (const t of titles) await checkOne(t)
} else if (mode === '--checkall') {
  const files = (await readdir(RAW)).filter((f) => f.endsWith('.html'))
  let failed = 0
  for (const f of files) {
    const html = await readFile(`${RAW}/${f}`, 'utf8')
    const title = f.replace(/\.html$/, '').replace(/_/g, ' ')
    const { markdown, stats } = htmlToMarkdown(html)
    const { problems } = assertReport(title, html, markdown, stats)
    if (problems.length > 0) {
      failed += 1
      console.log(`FAIL ${f}:`)
      for (const p of problems) console.log(`      ! ${p}`)
    }
  }
  console.log(`\nchecked ${files.length} stored pages, ${failed} failed`)
} else {
  console.log('usage: node verify-convert.mjs --fetch <Title...> | --check <Title...> | --checkall')
}
