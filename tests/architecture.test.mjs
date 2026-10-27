import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const server = await readFile(new URL('../dsh/index.js', import.meta.url), 'utf8')
const client = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')
const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))

test('uses DSH Schedule instead of a process-local timer', () => {
  assert.match(server, /ctx\.schedule\.create\(/)
  assert.doesNotMatch(server, /setTimeout\(/)
  assert.match(server, /\[deepseek-harness-daily:v4\]/)
  assert.match(server, /产品更新追踪/)
})

test('uses GitHub Atom, public HTML pagination and patches without REST API fallback', () => {
  assert.match(server, /function githubFeedUrl/)
  assert.match(server, /parseGithubAtom\(feed\.raw\)/)
  assert.match(server, /fetchCommitsFromPublicPages\(spec, window\)/)
  assert.match(server, /parseGithubCommitPage\(response\.raw, spec\)/)
  assert.match(server, /fetchPublicRaw\(`\$\{commit\.url\}\.patch`/)
  assert.match(server, /oldest >= since/)
  assert.match(server, /olderPages >= 2/)
  assert.match(server, /if \(!complete\) throw new Error/)
  assert.doesNotMatch(server, /api\.github\.com|fetchCommitsFromApi|API 补齐失败|x-github-api-version/)
})

test('asks for plain product language while preserving technical English names', () => {
  assert.match(server, /面向产品经理和普通用户/)
  assert.match(server, /内部维护/)
  assert.match(server, /保留原始英文及大小写/)
  assert.match(server, /generation projection/)
  assert.match(server, /不要逐条复述 commit/)
})

test('keeps exactly the two dedicated scoped tracking tools', () => {
  assert.match(server, /agent\.ctx\.tools\.restrict\(\{ allow: \[\] \}\)/)
  assert.match(server, /name: 'tracking_collect_all'/)
  assert.match(server, /name: 'tracking_publish_reports'/)
  assert.doesNotMatch(server, /name: 'deepseek_harness_collect_yesterday'/)
})

test('upserts one stable report per target and report date', () => {
  assert.match(server, /selectCollectionTargets\(state\.targets/)
  assert.match(server, /target_id: \{ type: 'string'/)
  assert.match(server, /collectionWindow\(\{ reportDate \}\)/)
  assert.match(server, /existingReport\?\.id \|\|/)
  assert.match(server, /item\.targetId === report\.targetId && item\.reportDate === report\.reportDate/)
})

test('allows a single GitHub date rerun without rewriting web history or future days', () => {
  assert.match(server, /const reportDate = String\(body\.reportDate \|\| ''\)\.trim\(\)/)
  assert.match(server, /if \(target\.type !== 'github'\) throw new RequestError/)
  assert.match(server, /requested\.until > collectionWindow\(\{\}\)\.until/)
  assert.match(server, /runReport\(ctx, target, true, reportDate\)/)
  assert.match(server, /running\.reportDate !== reportDate/)
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

test('declares only the two verified Desktop host versions for scoped peers', () => {
  for (const name of ['@deepseek-ai/dsh-agent', '@deepseek-ai/dsh-schedule', '@deepseek-ai/dsh-tools']) {
    assert.equal(manifest.peerDependencies[name], '0.2.0-rc.2 || 0.2.1-rc.2')
  }
})

test('makes the custom macOS header draggable without swallowing its controls', () => {
  assert.match(client, /customFrame: true/)
  assert.match(client, /e\('header', \{ className: 'hdy-header', 'data-window-drag': true \}/)
  assert.match(client, /html\[data-platform=darwin\] \.hdy-header \.hdy-actions\{-webkit-app-region:no-drag\}/)
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

test('shows a one-sentence report headline on calendar cell hover and keyboard focus', () => {
  assert.match(client, /function calendarCellSummary\(report, count\)/)
  assert.match(client, /report\?\.headline \|\| report\?\.overview/)
  assert.match(client, /onPointerEnter: \(event\) => showCellSummary/)
  assert.match(client, /onFocus: \(event\) => showCellSummary/)
  assert.match(client, /onScroll: \(\) => setHover\(null\)/)
  assert.match(client, /className: 'hdy-calendar-tip', role: 'tooltip'/)
  assert.match(client, /pointer-events:none/)
})

test('calendar hover text stays a short single sentence for changed and unchanged days', () => {
  const start = client.indexOf('  function calendarCellSummary(')
  const end = client.indexOf('  function CalendarOverview(', start)
  const summary = new Function(`${client.slice(start, end)}; return calendarCellSummary`)()
  assert.equal(summary({ headline: '新增搜索功能。修复设置问题。' }, 2), '新增搜索功能。')
  assert.equal(summary({ headline: '网页内容没有变化' }, 0), '网页内容没有变化。')
  assert.ok(summary({ headline: '更新'.repeat(70) }, 10).length <= 78)
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
