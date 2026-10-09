const pad = (value) => String(value).padStart(2, '0')

export function localDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function asWindow(start, end) {
  return {
    reportDate: localDateKey(start),
    since: start.toISOString(),
    until: end.toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'local',
  }
}

export function localDayWindow(dateKey) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || ''))
  if (!match) throw new Error('report_date 必须是 YYYY-MM-DD')
  const [, year, month, day] = match
  const start = new Date(Number(year), Number(month) - 1, Number(day))
  if (localDateKey(start) !== dateKey) throw new Error('report_date 不是有效日期')
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1)
  return asWindow(start, end)
}

export function previousDayWindow(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value)
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 1)
  return asWindow(start, end)
}

export function compactCommitMessage(message = '') {
  return String(message).split('\n')[0].trim().slice(0, 180)
}
