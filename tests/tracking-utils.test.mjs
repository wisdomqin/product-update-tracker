import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_TARGET_URL,
  diffLines,
  isPublicAddress,
  isProxyFakeAddress,
  limitReportsPerTarget,
  migrateState,
  normalizeTargetUrl,
  normalizeText,
  parseGithubUrl,
  textHash,
} from '../dsh/tracking-utils.js'

test('parses GitHub repository roots and commits branches', () => {
  assert.deepEqual(parseGithubUrl('https://github.com/deepseek-ai/deepseek-harness'), {
    owner: 'deepseek-ai', repo: 'deepseek-harness', branch: '',
  })
  assert.deepEqual(parseGithubUrl('https://github.com/acme/widgets/commits/release/v2'), {
    owner: 'acme', repo: 'widgets', branch: 'release/v2',
  })
  assert.equal(parseGithubUrl('https://example.com/feed.xml'), null)
})

test('rejects local, private and credential-bearing URLs', () => {
  for (const url of [
    'http://localhost/x', 'http://service.local/x', 'http://127.0.0.1/x',
    'http://10.1.2.3/x', 'http://172.20.1.1/x', 'http://192.168.1.1/x',
    'http://[::1]/x', 'ftp://example.com/x', 'https://user:pass@example.com/x',
  ]) assert.throws(() => normalizeTargetUrl(url))
  assert.equal(normalizeTargetUrl('HTTPS://Example.COM:443/a//b#part'), 'https://example.com/a/b')
})

test('classifies resolved addresses conservatively', () => {
  assert.equal(isPublicAddress('8.8.8.8'), true)
  assert.equal(isPublicAddress('1.1.1.1'), true)
  assert.equal(isPublicAddress('127.0.0.1'), false)
  assert.equal(isPublicAddress('100.64.0.1'), false)
  assert.equal(isPublicAddress('169.254.1.2'), false)
  assert.equal(isPublicAddress('203.0.113.8'), false)
  assert.equal(isPublicAddress('::1'), false)
  assert.equal(isPublicAddress('fd00::1'), false)
  assert.equal(isPublicAddress('2606:4700:4700::1111'), true)
  assert.equal(isProxyFakeAddress('198.18.1.158'), true)
  assert.equal(isProxyFakeAddress('198.19.255.254'), true)
  assert.equal(isProxyFakeAddress('192.168.1.1'), false)
})

test('migrates v2 state and annotates legacy reports', () => {
  const migrated = migrateState({
    version: 2,
    reports: [{ id: 'old', source: DEFAULT_TARGET_URL, headline: 'legacy' }],
    automation: { sessionId: 'session-1', taskId: 'task-1' },
  }, '2026-10-08T00:00:00.000Z')
  assert.equal(migrated.version, 3)
  assert.equal(migrated.targets.length, 1)
  assert.equal(migrated.targets[0].id, 'deepseek-harness')
  assert.equal(migrated.targets[0].name, 'DeepSeek Harness')
  assert.equal(migrated.reports[0].targetId, 'deepseek-harness')
  assert.equal(migrated.reports[0].targetName, 'DeepSeek Harness')
  assert.equal(migrated.reports[0].sourceType, 'github')
  assert.equal(migrated.automation.sessionId, 'session-1')
})

test('preserves an explicitly empty v3 target list and drops orphan reports', () => {
  const migrated = migrateState({ version: 3, targets: [], reports: [{ id: 'orphan', targetId: 'gone' }] })
  assert.deepEqual(migrated.targets, [])
  assert.deepEqual(migrated.reports, [])
})

test('limits reports independently for each target', () => {
  const reports = [
    ...Array.from({ length: 65 }, (_, index) => ({ id: `a-${index}`, targetId: 'a' })),
    ...Array.from({ length: 63 }, (_, index) => ({ id: `b-${index}`, targetId: 'b' })),
  ]
  const limited = limitReportsPerTarget(reports, 60)
  assert.equal(limited.filter((report) => report.targetId === 'a').length, 60)
  assert.equal(limited.filter((report) => report.targetId === 'b').length, 60)
  assert.equal(limited.length, 120)
  assert.equal(limited[0].id, 'a-0')
})

test('produces bounded line diffs with previous-to-current semantics', () => {
  const diff = diffLines('alpha\nbeta\nremoved', 'alpha\nbeta changed\nadded', 1)
  assert.deepEqual(diff.added, ['beta changed'])
  assert.deepEqual(diff.removed, ['beta'])
  assert.equal(diff.addedCount, 2)
  assert.equal(diff.removedCount, 2)
  assert.equal(diff.truncated, true)
})

test('normalizes HTML and structured JSON into stable text', () => {
  const html = normalizeText('<style>x{}</style><!--noise--><h1>Hello</h1><script>bad()</script><p>World&nbsp; now</p>', 'text/html')
  assert.equal(html, 'Hello\nWorld now')
  const first = normalizeText('{"b":2,"generated_at":"today","a":1}', 'application/json')
  const second = normalizeText('{"a":1,"generated_at":"tomorrow","b":2}', 'application/json')
  assert.equal(first, second)
  assert.equal(textHash(first), textHash(second))
})
