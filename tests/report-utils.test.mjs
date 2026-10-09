import test from 'node:test'
import assert from 'node:assert/strict'
import {
  collectionWindow,
  compactCommitMessage,
  localDateKey,
  localDayWindow,
  previousDayWindow,
} from '../dsh/report-utils.js'

test('uses the previous local calendar day', () => {
  const window = previousDayWindow(new Date(2026, 9, 5, 11, 30))
  assert.equal(window.reportDate, '2026-10-04')
  assert.equal(new Date(window.until).getTime() - new Date(window.since).getTime(), 24 * 60 * 60 * 1000)
})

test('files both scheduled and manual checks under yesterday', () => {
  const now = new Date(2026, 9, 9, 11, 0)
  assert.equal(collectionWindow({ now }).reportDate, '2026-10-08')
  assert.equal(collectionWindow({ now, manual: true }).reportDate, '2026-10-08')
  assert.equal(collectionWindow({ now, reportDate: '2026-10-07', manual: true }).reportDate, '2026-10-07')
})

test('formats a stable local calendar key', () => {
  assert.equal(localDateKey(new Date(2026, 9, 5, 23, 59)), '2026-10-05')
})

test('builds an explicit local-day window for test and catch-up runs', () => {
  const window = localDayWindow('2026-10-08')
  assert.equal(window.reportDate, '2026-10-08')
  assert.equal(new Date(window.until).getTime() - new Date(window.since).getTime(), 24 * 60 * 60 * 1000)
  assert.throws(() => localDayWindow('2026-02-30'), /有效日期/)
})

test('uses only the commit subject in compact labels', () => {
  assert.equal(compactCommitMessage('feat: add report\n\nLong body'), 'feat: add report')
})
