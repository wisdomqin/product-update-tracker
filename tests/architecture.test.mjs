import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const server = await readFile(new URL('../dsh/index.js', import.meta.url), 'utf8')
const client = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')

test('uses DSH Schedule instead of a process-local timer', () => {
  assert.match(server, /ctx\.schedule\.create\(/)
  assert.doesNotMatch(server, /setTimeout\(/)
  assert.match(server, /\[deepseek-harness-daily:v4\]/)
  assert.match(server, /产品更新追踪/)
})

test('uses GitHub Atom and patches before API fallback', () => {
  assert.match(server, /function githubFeedUrl/)
  assert.match(server, /parseGithubAtom\(feed\.raw\)/)
  assert.match(server, /fetchPublicRaw\(`\$\{commit\.url\}\.patch`/)
  assert.match(server, /if \(entries\.length >= 20 && oldest > since\)/)
})

test('keeps exactly the two dedicated scoped tracking tools', () => {
  assert.match(server, /agent\.ctx\.tools\.restrict\(\{ allow: \[\] \}\)/)
  assert.match(server, /name: 'tracking_collect_all'/)
  assert.match(server, /name: 'tracking_publish_reports'/)
  assert.doesNotMatch(server, /name: 'deepseek_harness_collect_yesterday'/)
})

test('upserts one stable report per target and report date', () => {
  assert.match(server, /collectionWindow\(\{ reportDate \}\)/)
  assert.match(server, /existingReport\?\.id \|\|/)
  assert.match(server, /item\.targetId === report\.targetId && item\.reportDate === report\.reportDate/)
})

test('does not expose snapshots in public target state', () => {
  assert.match(server, /state\.targets\.map\(\(\{ snapshot, \.\.\.target \}\) => target\)/)
})

test('commits web snapshots only while storing a report', () => {
  const fetchSection = server.slice(server.indexOf('async function fetchWebTarget'), server.indexOf('function parseModelJson'))
  assert.match(fetchSection, /const nextSnapshot = \{ hash,/)
  assert.doesNotMatch(fetchSection, /target\.snapshot\s*=/)
  assert.match(server, /if \(fetched\.kind === 'web'\) target\.snapshot = fetched\.nextSnapshot/)
})

test('deletes a target reports and keeps web UI counters', () => {
  assert.match(server, /state\.reports = state\.reports\.filter\(\(report\) => report\.targetId !== target\.id\)/)
  assert.match(server, /itemCount: fetched\.kind === 'web'/)
  assert.match(server, /additions: fetched\.diff\.addedCount, deletions: fetched\.diff\.removedCount/)
})

test('switches targets through a compact dropdown', () => {
  assert.match(client, /hdy-target-picker-button/)
  assert.match(client, /aria-haspopup': 'listbox'/)
  assert.match(client, /hdy-target-menu-add/)
  assert.doesNotMatch(client, /className: 'hdy-target-actions'/)
})

test('makes every selected target visibly manageable', () => {
  assert.match(client, /hdy-target-manager/)
  assert.match(client, /编辑名称和网址/)
  assert.match(client, /暂停追踪/)
  assert.match(client, /删除/)
})

test('confines scrolling to the workbench main region', () => {
  assert.match(client, /\.hdy-root\{[^}]*overflow:hidden/)
  assert.match(client, /\.hdy-main\{[^}]*overflow:auto/)
})

test('opens on a monthly product update calendar', () => {
  assert.match(client, /useState\('overview'\)/)
  assert.match(client, /function CalendarOverview/)
  assert.match(client, /repeat\(var\(--hdy-days\)/)
  assert.match(client, /上一个月/)
  assert.match(client, /下一个月/)
  assert.match(client, /onOpenReport\(item\.id, report\.id\)/)
})

test('labels manual refresh as checking yesterday', () => {
  assert.match(client, /检查昨日更新/)
  assert.match(client, /正在检查昨日…/)
  assert.doesNotMatch(client, /立即检查/)
})

test('keeps report detail on the wide layout', () => {
  assert.match(client, /\.hdy-main\{width:100%;max-width:none\}/)
  assert.match(client, /hdy-main-detail/)
  assert.match(client, /← 月度总览/)
})

test('uses the canonical public repository identity', () => {
  assert.match(server, /WORKBENCH_ID = 'wisdomqin\/product-update-tracker'/)
  assert.match(client, /ownerId = 'wisdomqin\/product-update-tracker'/)
  assert.match(client, /repository: 'https:\/\/github\.com\/wisdomqin\/product-update-tracker'/)
  const registration = client.slice(client.indexOf('service.register({'), client.indexOf('}, App)'))
  assert.doesNotMatch(registration, /\bid\s*:/)
})
