// Falsification cases for the reviewer's four findings, run against the live converter.
import { htmlToMarkdown } from './lib/convert.mjs'

const wrap = (inner) => `<div class="mw-parser-output">${inner}</div>`
const cases = [
  ['F1 two sibling tables (cursor reset)', wrap(
    '<table><tr><td>AAA1</td><td>AAA2</td></tr></table>' +
    '<table><tr><td>BBB1</td><td>BBB2</td></tr></table>')],
  ['F2 cell text duplicated into body', wrap(
    '<table><tr><td>alpha1</td><td>beta2</td></tr><tr><td>gamma3</td><td>delta4</td></tr></table>')],
  ['F3 link label swallows prose', wrap(
    '<p>See <a href="/Army">Army levies</a> page.</p>')],
  ['F3b image link keeps href', wrap(
    '<p><a href="/File:X.png" class="image"><img alt="X icon" src="/images/x.png" /></a></p>')],
  ['F4 explicit bold closes', wrap('<p>alpha <b>bold</b> omega</p>')],
]

let bad = 0
for (const [name, html] of cases) {
  const { markdown } = htmlToMarkdown(html)
  console.log(`\n### ${name}`)
  console.log(JSON.stringify(markdown))
  if (name.startsWith('F1')) {
    const secondTableHasBBB = /\|\s*BBB1\s*\|/.test(markdown)
    const secondTableHasAAA = /\|\s*AAA1\s*\|/.test(markdown.split('\n').slice(3).join('\n'))
    console.log(`   second table contains BBB1: ${secondTableHasBBB} ${secondTableHasBBB ? 'OK' : '<-- FINDING 1 CONFIRMED'}`)
    if (!secondTableHasBBB) bad++
    if (secondTableHasAAA) console.log('   second table wrongly contains AAA1 <-- CONFIRMED')
  }
  if (name.startsWith('F2')) {
    const dup = (markdown.match(/alpha1/g) ?? []).length
    console.log(`   'alpha1' occurrences: ${dup} (1 = OK, 2 = FINDING 2 CONFIRMED)`)
    if (dup > 1) bad++
  }
  if (name.startsWith('F3') && !name.startsWith('F3b')) {
    const wrong = /\[Army levies page\.\]/.test(markdown)
    console.log(`   label swallowed prose: ${wrong} ${wrong ? '<-- FINDING 3 CONFIRMED' : 'OK'}`)
    if (wrong) bad++
  }
  if (name.startsWith('F3b')) {
    const ok = /\[!\[X icon\]\(https:\/\/ck3\.paradoxwikis\.com\/images\/x\.png\)\]\(https:\/\/ck3\.paradoxwikis\.com\/File:X\.png\)/.test(markdown)
    console.log(`   image link rendered as [![alt](src)](href): ${ok}`)
  }
  if (name.startsWith('F4')) {
    const ok = /\*\*bold\*\* omega/.test(markdown)
    console.log(`   bold closed before ' omega': ${ok} ${ok ? 'OK' : '<-- FINDING 4 CONFIRMED'}`)
    if (!ok) bad++
  }
}
console.log(`\n${bad} of 4 findings reproduced on this revision`)
process.exit(bad > 0 ? 1 : 0)
