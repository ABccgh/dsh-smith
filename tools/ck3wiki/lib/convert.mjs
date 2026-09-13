/**
 * MediaWiki HTML -> Markdown, dependency-free.
 *
 * Written against the markup `action=parse&prop=text` actually returns for this wiki
 * (inspected with `probe-html.mjs` on the 169 KB "Faith" page), not against a general HTML
 * spec. The observed shapes that drove the rules below:
 *
 *   - the content lives in a single `<div class="mw-parser-output">`;
 *   - a `<div id="toc">` table of contents and 15 `<span class="mw-editsection">` links are
 *     interleaved with the content and mean nothing in a text corpus;
 *   - SELF-references are `<a class="mw-selflink selflink">Faith</a>`; emitting them as
 *     links would turn every page into link noise, so they deglyph to plain text;
 *   - 508 of that page's images are wiki UI icons whose meaning lives in `title`/`alt`
 *     (`Icon_check.png` with `alt="Yes" title="Yes"`, `Icon_commander_advantage.png` with
 *     both EMPTY). Dropping images loses real semantics; rendering every image buries the
 *     prose. So: an image with non-empty text becomes that text, an empty one nothing;
 *   - tables carry `rowspan`/`colspan` (664 `<td>`, 81 `<th>` on that page);
 *   - MediaWiki leaves three large HTML comments in the body (the NewPP limit report, the
 *     transclusion time report, a parser-cache note) which must never reach the corpus;
 *   - the wiki itself sometimes renders a broken template as the literal text
 *     `(unrecognized string “kuzarism” for Template:Icon)`. That is the wiki's own output,
 *     so it is preserved rather than silently edited away.
 *
 * ARCHITECTURE, and the three bugs it exists to prevent. A naive converter here fails in
 * ways that are invisible: the corpus still looks complete.
 *
 *   1. ONE OUTPUT BUFFER per scope. Structural frames on the stack carry no text. An earlier
 *      revision gave every frame its own buffer and appended text to "the current frame":
 *      the entire prose body of every page vanished, because text inside a `<div>` went into
 *      a buffer that was discarded when the frame closed.
 *   2. A frame closed IMPLICITLY must not run its structural close action. MediaWiki omits
 *      countless end tags; running close actions while unwinding made one `</div>` inside a
 *      table emit and clear the whole table.
 *   3. Three values are unknown where their output position is fixed — a heading's text (its
 *      marker must come first), a link's label (the URL comes last), and a table cell's text
 *      (pipe rows are assembled after all cells are read). Each is written as a document-order
 *      MARKER and substituted at the end, in the same order. Both orders are depth-first over
 *      the same token stream, so they cannot disagree.
 */

const VOID_TAGS = new Set(['br', 'hr', 'img', 'input', 'meta', 'link', 'area', 'base', 'col', 'embed', 'source', 'track', 'wbr'])

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—',
  hellip: '…', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', times: '×', minus: '−',
  deg: '°', bull: '•', middot: '·', laquo: '«', raquo: '»', copy: '©', reg: '®',
  trade: '™', dagger: '†', prime: '′', euro: '€', pound: '£', yen: '¥',
  sect: '§', para: '¶', infin: '∞', ne: '≠', le: '≤', ge: '≥',
}

/** Decode the HTML entities this wiki actually emits (named set + numeric). */
export function decodeEntities(text) {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (whole, body) => {
    if (body.startsWith('#')) {
      const hex = body[1] === 'x' || body[1] === 'X'
      const code = Number.parseInt(hex ? body.slice(2) : body.slice(1), hex ? 16 : 10)
      return Number.isFinite(code) ? safeFromCodePoint(code, whole) : whole
    }
    return ENTITIES[body] ?? whole
  })
}

function safeFromCodePoint(code, fallback) {
  if (code < 9 || (code > 13 && code < 32) || code === 0x7f) return fallback
  try { return String.fromCodePoint(code) } catch { return fallback }
}

function attribute(attrs, name) {
  const re = new RegExp(`(?:^|\\s)${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i')
  const m = re.exec(attrs)
  if (!m) return undefined
  return decodeEntities(m[2] ?? m[3] ?? m[4] ?? '')
}

function hasClass(attrs, cls) {
  return (attribute(attrs, 'class') ?? '').split(/\s+/).includes(cls)
}

const squash = (s) => s.replace(/[ \t\u00a0]+/g, ' ')
const normaliseInline = (t) => squash(t).replace(/\s+([,.;:!?)])/g, '$1').replace(/\(\s+/g, '(')

/** Tokenise an HTML fragment. HTML comments are dropped, never emitted as text. */
function tokenise(html) {
  const tokens = []
  // Comments and tags in ONE pass, so a comment can never be mistaken for text.
  const re = /<!--[\s\S]*?-->|<(\/)?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*?)(\/)?>/g
  let last = 0
  let m
  while ((m = re.exec(html)) !== null) {
    if (m[0].startsWith('<!--')) { last = re.lastIndex; continue }
    if (m.index > last) tokens.push({ type: 'text', value: html.slice(last, m.index) })
    last = re.lastIndex
    tokens.push({
      type: m[1] ? 'close' : 'open',
      tag: m[2].toLowerCase(),
      attrs: m[3] ?? '',
      self: Boolean(m[4]) || VOID_TAGS.has(m[2].toLowerCase()),
    })
  }
  if (last < html.length) tokens.push({ type: 'text', value: html.slice(last) })
  return tokens
}

/** True when `tag` closes the given structural frame. */
function frameAccepts(frame, tag) {
  switch (frame.kind) {
    case 'heading': return /^h[1-6]$/.test(tag)
    case 'inline': return frame.tag === tag
    case 'link': return tag === 'a'
    case 'block': return tag === 'div' || tag === 'span'
    case 'passthrough': return frame.tag === tag
    case 'caption': return tag === 'caption'
    case 'list': return tag === 'ul' || tag === 'ol'
    case 'listItem': return tag === 'li'
    case 'defItem': return tag === 'dt' || tag === 'dd'
    case 'table': return tag === 'table'
    case 'tableRow': return tag === 'tr'
    case 'cell': return tag === 'td' || tag === 'th'
    case 'p': return tag === 'p'
    default: return false
  }
}

/**
 * Convert one parsed wiki page body into Markdown.
 *
 * @param {string} html - `parse.text`
 * @param {{title?: string}} [meta]
 * @returns {{markdown: string, stats: object}}
 */
export function htmlToMarkdown(html, meta = {}) {
  const stats = { tablesSeen: 0, tableRows: 0, images: 0, textImages: 0, links: 0, headings: 0 }
  const markdown = renderScope(trimToParserOutput(html), stats, 0)
  return { markdown: normalise(markdown), stats }
}

/** MediaWiki wraps the content in one container; the rest of the document is chrome. */
function trimToParserOutput(html) {
  const startMatch = /<div class="mw-parser-output"[^>]*>/i.exec(html)
  let body = html
  if (startMatch) {
    const tail = html.slice(startMatch.index + startMatch[0].length)
    const cutAt = tail.search(/<div class="printfooter"|<div class="catlinks"|<div class="mw-authority-control"/i)
    body = cutAt === -1 ? tail : tail.slice(0, cutAt)
  }
  return body
}

/**
 * Sentinel written where a heading's text will go. Only headings still need one: a heading's
 * `## ` marker must precede text that is not known until the heading closes. Links and cells
 * are resolved as they close, so they carry no marker at all.
 */
export const MARK_HEADING = '\u0001H\u0001'

function renderScope(html, stats, depth) {
  if (depth > 24) return ''
  const tokens = tokenise(html)
  const out = []
  const stack = [{ kind: 'root' }]
  const top = () => stack[stack.length - 1]
  const findAncestor = (kind) => {
    for (let i = stack.length - 1; i >= 0; i--) if (stack[i].kind === kind) return stack[i]
    return undefined
  }
  const emit = (t) => out.push(t)

  const headings = []
  const cells = []
  let headingAt = 0
  /** Cells already consumed by a rendered table; see `renderTable`'s `startAt`. */
  let cellCursor = 0

  /**
   * Frame kinds that CAPTURE their inner text instead of emitting it, and the nearest such
   * frame at or above a stack position.
   *
   * Text must resolve to its nearest capturing ancestor, not to the frame on top: an `<h2>`
   * almost always wraps its text in a `<span class="mw-headline">`, and a cell may wrap it in
   * anything at all, so the transparent frame on top would otherwise turn a heading into
   * plain prose and a cell's text into loose body text.
   */
  const CAPTURES = new Set(['cell', 'tableRow', 'heading', 'caption', 'link'])
  const captureFrom = (from) => {
    for (let i = from; i >= 0; i--) if (CAPTURES.has(stack[i].kind)) return stack[i]
    return undefined
  }
  const textOwner = () => captureFrom(stack.length - 1)

  /**
   * Render one link frame into whatever captures text around it.
   *
   * The label comes from the frame's own captured text, never from a regex over the finished
   * output: a lazy capture can only guess where the link ended, and the guess used to be "the
   * next blank line", so every link swallowed the prose that followed it — 130 links on one
   * page ended up with paragraph-length labels and the prose moved inside them.
   */
  function emitLink(frame) {
    const label = normaliseInline(frame.parts.join(''))
    if (!label) return
    const at = stack.indexOf(frame)
    const host = at >= 0 ? captureFrom(at - 1) : undefined
    let rendered = label
    if (frame.href) {
      const url = /^https?:\/\//i.test(frame.href) ? frame.href : `https://ck3.paradoxwikis.com${frame.href}`
      stats.links += 1
      rendered = `[${label}](${url})`
    }
    if (host) host.parts.push(rendered)
    else emit(rendered)
  }

  /** Capture an element's raw inner HTML so it can be rendered as its own document. */
  function collect(openIndex, tag) {
    let level = 0
    const parts = []
    for (let i = openIndex; i < tokens.length; i++) {
      const token = tokens[i]
      if (token.type === 'open' && token.tag === tag && !token.self) level += 1
      if (token.type === 'close' && token.tag === tag) {
        level -= 1
        if (level === 0) return { html: parts.join(''), next: i }
      }
      if (i > openIndex) {
        if (token.type === 'text') parts.push(token.value)
        else parts.push(`<${token.type === 'close' ? '/' : ''}${token.tag}${token.attrs ? ` ${token.attrs}` : ''}>`)
      }
    }
    return { html: parts.join(''), next: tokens.length - 1 }
  }

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]

    if (token.type === 'text') {
      const owner = textOwner()
      if (owner) owner.parts.push(token.value)
      else emit(squash(decodeEntities(token.value)))
      continue
    }

    if (token.type === 'open') {
      switch (token.tag) {
        case 'style': case 'script': case 'noscript':
          i = collect(i, token.tag).next
          continue
        case 'pre': case 'syntaxhighlight': case 'source': case 'nowiki': {
          // Preformatted and code regions hold TEXT, and this wiki uses them to document
          // markup: `Template:Go to top` renders the literal sentence "The template inserts
          // the following HTML code:" before a `<div style="float: right;">`. Walking that
          // content as markup would emit the example as a real tag; emitting it verbatim in a
          // fence keeps it readable and keeps the audit honest.
          const collected = collect(i, token.tag)
          const text = collected.html.replace(/<[^>]*>/g, '')
          if (text.trim()) emit(`\n\n\`\`\`\n${decodeEntities(text).trim()}\n\`\`\`\n\n`)
          i = collected.next
          continue
        }
        case 'table':
          stats.tablesSeen += 1
          emit('\n\n')
          stack.push({ kind: 'table', rows: [], caption: '' })
          continue
        case 'caption': {
          const table = findAncestor('table')
          stack.push({ kind: 'caption', table, parts: [] })
          continue
        }
        case 'tr': {
          const table = findAncestor('table')
          if (!table) continue
          const row = { cells: [], header: false }
          table.rows.push(row)
          stats.tableRows += 1
          stack.push({ kind: 'tableRow', row, table, parts: [] })
          continue
        }
        case 'td': case 'th': {
          const row = findAncestor('tableRow')
          if (!row) continue
          const collected = collect(i, token.tag)
          row.row.cells.push({
            header: token.tag === 'th',
            colspan: Number(attribute(token.attrs, 'colspan') ?? 1) || 1,
            rowspan: Number(attribute(token.attrs, 'rowspan') ?? 1) || 1,
            raw: collected.html,
          })
          // The cell's whole range was consumed by `collect`, so this frame is pushed and
          // then popped by the close token at `collected.next`, which the loop reaches next.
          stack.push({ kind: 'cell', cell: row.row.cells[row.row.cells.length - 1], parts: [] })
          i = collected.next - 1
          continue
        }
        case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6':
          emit(`\n\n${MARK_HEADING}`)
          stack.push({ kind: 'heading', level: Number(token.tag[1]), parts: [] })
          continue
        case 'p':
          emit('\n')
          stack.push({ kind: 'p', parts: [] })
          continue
        case 'ul': case 'ol': {
          emit('\n')
          const outer = findAncestor('list')
          stack.push({ kind: 'list', ordered: token.tag === 'ol', itemIndex: 0, depth: outer ? outer.depth + 1 : 1 })
          continue
        }
        case 'li': {
          const list = findAncestor('list')
          const indent = list ? '  '.repeat(Math.max(0, list.depth - 1)) : ''
          if (list) list.itemIndex += 1
          emit(`\n${indent}${list?.ordered ? `${list.itemIndex}. ` : '- '}`)
          stack.push({ kind: 'listItem', parts: [] })
          continue
        }
        case 'dt': emit('\n\n'); stack.push({ kind: 'defItem', parts: [] }); continue
        case 'dd': emit('\n: '); stack.push({ kind: 'defItem', parts: [] }); continue
        case 'b': case 'strong': emit('**'); stack.push({ kind: 'inline', tag: token.tag, closeTo: '**', parts: [] }); continue
        case 'i': case 'em': emit('*'); stack.push({ kind: 'inline', tag: token.tag, closeTo: '*', parts: [] }); continue
        case 'code': case 'tt': emit('`'); stack.push({ kind: 'inline', tag: token.tag, closeTo: '`', parts: [] }); continue
        case 's': case 'strike': case 'del': emit('~~'); stack.push({ kind: 'inline', tag: token.tag, closeTo: '~~', parts: [] }); continue
        case 'sub': case 'sup': case 'u': case 'small': case 'big': case 'abbr': case 'q': case 'time': case 'bdi':
        case 'ruby': case 'rt': case 'rb':
          stack.push({ kind: 'inline', tag: token.tag, closeTo: '', parts: [] })
          continue
        case 'a':
          stack.push({ kind: 'link', parts: [], href: selfLinkHref(token.attrs) })
          continue
        case 'img':
          // An image inside a link IS that link's label (`[![alt](src)](href)`), so it must be
          // captured by the link frame rather than emitted past it — otherwise every
          // image-only link silently loses its href.
          renderImage(token.attrs, (t) => {
            const owner = textOwner()
            if (owner && owner.kind === 'link') owner.parts.push(t)
            else emit(t)
          }, stats)
          continue
        case 'br': emit('\n'); continue
        case 'hr': emit('\n\n---\n\n'); continue
        case 'figure': case 'figcaption': case 'center': case 'blockquote': case 'section':
          emit('\n')
          stack.push({ kind: 'block', tag: token.tag, parts: [] })
          continue
        case 'div': case 'span': {
          if (hasClass(token.attrs, 'mw-editsection') || isNoiseContainer(token.attrs)) {
            i = collect(i, token.tag).next
            continue
          }
          stack.push({ kind: 'block', tag: token.tag, parts: [] })
          continue
        }
        default:
          stack.push({ kind: 'passthrough', tag: token.tag, parts: [] })
      }
      continue
    }

    // ---- close ----
    let index = -1
    for (let j = stack.length - 1; j >= 0; j--) {
      if (frameAccepts(stack[j], token.tag)) { index = j; break }
    }
    if (index === -1) continue
    // Unwind frames that did NOT receive their own end tag. They must not run a structural
    // close action: MediaWiki omits thousands of end tags, and running them was the defect
    // that made a single `</div>` inside a table clear the entire table. An inline frame
    // still needs its delimiter closed so the Markdown stays balanced.
    for (let j = stack.length - 1; j > index; j--) {
      const implicit = stack[j]
      if (implicit.kind === 'link') emitLink(implicit)
      if (implicit.kind === 'inline' && implicit.closeTo) emit(implicit.closeTo)
      stack.splice(j, 1)
    }
    closeFrame(stack[index], token.tag)
    stack.splice(index, 1)
  }

  /** One frame's structural close action, for the frame that owned the end tag. */
  function closeFrame(frame) {
    switch (frame.kind) {
      case 'heading': {
        stats.headings += 1
        const text = normaliseInline(frame.parts.join('')).trim()
        headings.push(text ? `${'#'.repeat(Math.min(frame.level + 1, 6))} ${text}` : '')
        break
      }
      case 'cell': {
        // Rendered as an isolated sub-document so a nested list or nested table inside one
        // cell cannot leak text into a sibling cell. The result goes into `cells` ONLY —
        // it must not also be emitted into the body, which is what duplicated every cell's
        // text once as loose prose and once inside a pipe row.
        cells.push(normaliseInline(renderScope(frame.cell.raw, stats, depth + 1).trim()))
        break
      }
      case 'caption': {
        if (frame.table) frame.table.caption = normaliseInline(frame.parts.join('')).trim()
        break
      }
      case 'table': {
        // The cursor is threaded in, not reset: `cells` is per scope and the root scope of a
        // page holds many tables, so a reset made every table after the first re-read the
        // FIRST table's cells — right shape, wrong content, invisible to a row count.
        const rendered = renderTable(frame, cells, cellCursor)
        cellCursor += frame.rows.reduce((n, row) => n + row.cells.length, 0)
        if (rendered) emit(`\n\n${rendered}\n\n`)
        break
      }
      case 'link':
        emitLink(frame)
        break
      case 'inline': if (frame.closeTo) emit(frame.closeTo); break
      case 'p': case 'list': case 'listItem': case 'block': case 'passthrough': case 'defItem':
        emit('\n')
        break
      default: break
    }
  }

  // `\u0001S\u0002` is the interim marker where each heading's own text goes; it is the only
  // substitution left, because links and cells are resolved as they close rather than read
  // back out of the finished text stream.
  const text = out.join('').replaceAll(MARK_HEADING, '\u0001S\u0002')
  return text
    .replace(/\u0001S\u0002/g, () => headings[headingAt++] ?? '')
    .replace(/[\u0001\u0002\u0003]/g, '')
}

/** `href` for a link, or undefined when the link points at the page it is on. */
function selfLinkHref(attrs) {
  if (hasClass(attrs, 'mw-selflink') || hasClass(attrs, 'selflink')) return undefined
  return attribute(attrs, 'href')
}

/** Containers whose text is wiki plumbing rather than article content. */
function isNoiseContainer(attrs) {
  for (const cls of ['mw-editsection', 'navbox', 'vertical-navbox', 'catlinks', 'printfooter', 'mw-hidden-catlinks', 'toc', 'mw-cite-backlink']) {
    if (hasClass(attrs, cls)) return true
  }
  const id = attribute(attrs, 'id')
  return id === 'toc' || id === 'catlinks' || id === 'printfooter'
}

/**
 * Turn one image into text. The wiki encodes Yes/No and unit symbols as images whose
 * `title`/`alt` is the only place the meaning exists, so a non-empty text is always kept;
 * an image with no text at all contributes nothing.
 */
function renderImage(attrs, emit, stats) {
  stats.images += 1
  const text = (attribute(attrs, 'title') || attribute(attrs, 'alt') || '').trim()
  if (!text) return
  stats.textImages += 1
  const src = attribute(attrs, 'src') ?? ''
  const padding = `${src} ${attribute(attrs, 'class') ?? ''}`
  const isUiIcon = /Icon_|Trait_|Doctrine_|Unit_|Structure_|DLC_|_icon|icon_/i.test(padding)
  if (isUiIcon) { emit(text); return }
  const absolute = src.startsWith('http') ? src : `https://ck3.paradoxwikis.com${src}`
  emit(`![${text}](${absolute})`)
}

/** Assemble the table's pipe rows, consuming cell text from `startAt` in document order. */
function renderTable(table, cellTexts, startAt) {
  const live = table.rows.filter((r) => r.cells.length > 0)
  if (live.length === 0) return ''
  const width = Math.max(...live.map((r) => r.cells.reduce((n, c) => n + c.colspan, 0)))
  // Read each cell's text exactly once: `take` advances the cursor, so calling it twice for
  // a rowspan cell would consume the following cell's text too.
  let cursor = startAt
  const take = () => escapeCell(cellTexts[cursor++] ?? '')
  const lines = []
  if (table.caption) lines.push(`**${table.caption}**\n`)

  const carried = new Map()
  live.forEach((row, rowIndex) => {
    const cells = []
    for (const [column, value] of carried) {
      if (value.remaining > 0 && cells[column] === undefined) { cells[column] = value.text; value.remaining -= 1 }
    }
    for (const cell of row.cells) {
      while (cells[cells.length] !== undefined) cells.push(undefined)
      const start = cells.length
      const text = take()
      cells[start] = text
      if (cell.rowspan > 1) carried.set(start, { text, remaining: cell.rowspan - 1 })
      for (let extra = 1; extra < cell.colspan; extra++) cells.push('')
    }
    const padded = Array.from({ length: width }, (_, i) => cells[i] ?? '')
    lines.push(`| ${padded.join(' | ')} |`)
    if (rowIndex === 0) lines.push(`| ${padded.map(() => '---').join(' | ')} |`)
  })
  return lines.join('\n')
}

function escapeCell(text) {
  return text.replace(/\|/g, '\\|').replace(/\r?\n+/g, '<br>')
}

/** Collapse whitespace runs the token walker inevitably leaves behind. */
function normalise(text) {
  return text
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
