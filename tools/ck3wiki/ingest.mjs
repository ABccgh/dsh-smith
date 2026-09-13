/**
 * Prepare the ima import payload from the extraction manifest.
 *
 * WHY URL IMPORT RATHER THAN UPLOADING THE MARKDOWN
 * -------------------------------------------------
 * Both routes were measured against the live ima account, and the choice is not stylistic:
 *
 *   `import_urls`  writes a media_id that is DERIVED FROM THE URL — importing the same URL
 *                  twice returned a byte-identical media_id and left the entry count
 *                  unchanged (two imports, 13 → 13 entries). That makes re-import an
 *                  in-place refresh, which matters because **ima's OpenAPI has no delete at
 *                  all**: any other route can only ever append.
 *   `add_knowledge` (file upload) has no upsert input, so every re-upload is a NEW permanent
 *                  entry, and its content can never be read back (get_media_info answers
 *                  220030 for media_type 7).
 *
 * So the corpus is ingested by URL, and the Markdown in `data/out/` is the checked local
 * mirror: the thing a human can read, diff, and re-verify against a revision id.
 *
 * WHAT THIS SCRIPT DOES / DOES NOT DO
 *   --list      writes `data/import-urls.json` (the payload) and prints the counts
 *   --verify    prints the reconciliation plan: local titles vs the KB, joined on media_id
 * It never calls the ima API. The write itself is performed by the `ima_import_urls` tool,
 * whose credentials and retry/rate-limit handling live in the dsh-ima-kb plugin.
 */

import { readFile, writeFile } from 'node:fs/promises'

const MANIFEST = 'data/manifest.json'
const PAYLOAD = 'data/import-urls.json'

const args = process.argv.slice(2)
const mode = args[0] ?? '--list'

const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'))
const pages = manifest.pages ?? []
// namespace 0 is the article corpus; the other partitions are supplementary indexes (templates,
// categories, interface text) whose value as retrievable knowledge is much lower than their
// count suggests.
const articles = pages.filter((p) => p.ns === 0).sort((a, b) => a.title.localeCompare(b.title))
const supplementary = pages.filter((p) => p.ns !== 0).sort((a, b) => a.title.localeCompare(b.title))

const payload = {
  generatedAt: new Date().toISOString(),
  source: manifest.source,
  note: 'URL import is an in-place upsert: re-running this payload refreshes the same entries.',
  counts: {
    articles: articles.length,
    supplementary: supplementary.length,
    total: pages.length,
    auditFailed: manifest.counts?.auditFailed ?? 0,
    fetchFailed: (manifest.failures ?? []).length,
  },
  // Grouped by partition because ima CAN create folders (`create_folder`, field discovery in
  // the plugin's `ima_kb_mkdir`), so the knowledge base gets one folder per partition instead
  // of 922 entries piled at the root.
  groups: [...new Map(pages.map((p) => [p.partition, []])).keys()].map((partition) => ({
    partition,
    folderName: `${partition}`,
    urls: pages.filter((p) => p.partition === partition).map((p) => p.url),
  })),
  articles: articles.map((p) => ({ title: p.title, url: p.url, revid: p.revid })),
  supplementary: supplementary.map((p) => ({ title: p.title, url: p.url, ns: p.ns })),
}

if (mode === '--list') {
  await writeFile(PAYLOAD, JSON.stringify(payload, null, 2), 'utf8')
  console.log('CK3 Wiki → ima 导入清单')
  console.log(`  条目页（ns0）      ：${payload.counts.articles}`)
  console.log(`  补充索引页         ：${payload.counts.supplementary}`)
  console.log(`  合计               ：${payload.counts.total}`)
  console.log(`  抓取失败           ：${payload.counts.fetchFailed}`)
  console.log(`  审计未通过         ：${payload.counts.auditFailed}（全部为"页面本身就几乎为空"或"页面在演示 HTML 代码"，见 README 的审计一节）`)
  console.log(`  文件夹分组         ：${payload.groups.length} 个`)
  for (const g of payload.groups) console.log(`      ${g.folderName.padEnd(18)} ${g.urls.length} 条 URL`)
  console.log(`  已写出             ：${PAYLOAD}`)
  console.log('')
  console.log('下一步：')
  console.log('  1. ima_kb_create     建库（名字 1–25 字符）')
  console.log('  2. ima_kb_mkdir      按上面的分组建文件夹，拿到各自的 folder_id')
  console.log('  3. ima_import_urls   每组一次，传对应 folderId')
  console.log('  4. 等标题回填（几分钟）后 ima_kb_browse 核对条目数 == 922')
} else if (mode === '--verify') {
  // The KB is the authority on what exists; the manifest is the authority on what SHOULD.
  // They are joined on media_id, which ima derives from the URL — NOT on title, because ima
  // backfills titles asynchronously (`X - CK3 Wiki`) and they are lossy and non-normalised.
  console.log('核对方式（在会话里做，脚本不发请求）：')
  console.log('  1. ima_kb_browse <新库 id> 逐页翻完，收集 {标题, media_id}')
  console.log('  2. 用媒体 id 与 data/manifest.json 的 url 对撞：')
  console.log('       media_id 形如 weburl_<账号前缀>_<url 的 md5>_<目录 id>')
  console.log('     先用任一已导入 URL 实测出 <账号前缀> 与 <目录 id> 两段，即可由 URL 反推 media_id。')
  console.log('  3. 数量核对：browse 得到的条目数 == manifest.counts.pages（若中途失败则不等，需重跑）')
  console.log(`  本次应出现的条目数：${payload.counts.total}`)
  console.log('  4. 抽查：ima_kb_search 按标题检索 Faith / Casus belli / Achievement 三条')
  console.log('')
  console.log('注意：标题回填是异步的，导入后请等几分钟再核对，否则会看到原始 URL 当标题。')
} else {
  console.log('用法: node ingest.mjs --list | --verify')
  process.exit(1)
}
