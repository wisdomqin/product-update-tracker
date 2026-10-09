import { isIP } from 'node:net'
import { createHash, randomUUID } from 'node:crypto'

export const DEFAULT_TARGET_URL = 'https://github.com/deepseek-ai/deepseek-harness/commits/master/'
export const MAX_TARGETS = 20

const PRIVATE_V4 = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
  ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
]

function ipv4Number(address) {
  return address.split('.').reduce((sum, value) => (sum * 256) + Number(value), 0) >>> 0
}

// Clash 等本机透明代理会把公网域名映射到 RFC 2544 的 198.18.0.0/15 Fake-IP。
// 仅允许“公网域名解析结果”使用该网段；用户直接填写此 IP 仍会被拒绝。
export function isProxyFakeAddress(address) {
  if (isIP(address) !== 4) return false
  const number = ipv4Number(address)
  const base = ipv4Number('198.18.0.0')
  const mask = (0xffffffff << (32 - 15)) >>> 0
  return (number & mask) === (base & mask)
}

export function isPublicAddress(address) {
  const version = isIP(address)
  if (version === 4) {
    const number = ipv4Number(address)
    return !PRIVATE_V4.some(([baseAddress, bits]) => {
      const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0
      return (number & mask) === (ipv4Number(baseAddress) & mask)
    })
  }
  if (version === 6) {
    const value = address.toLowerCase().split('%')[0]
    if (value === '::' || value === '::1') return false
    if (value.startsWith('fc') || value.startsWith('fd') || /^fe[89ab]/.test(value)) return false
    if (value.startsWith('ff') || value.startsWith('2001:db8:')) return false
    if (value.startsWith('::ffff:')) return isPublicAddress(value.slice(7))
    return true
  }
  return false
}

export function normalizeTargetUrl(input) {
  let url
  try { url = new URL(String(input || '').trim()) } catch { throw new Error('URL 格式无效') }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('URL 仅支持 http/https')
  if (url.username || url.password) throw new Error('URL 不允许包含用户名或密码')
  url.hash = ''
  const host = url.hostname.toLowerCase().replace(/\.$/, '').replace(/^\[|\]$/g, '')
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) throw new Error('URL 必须是公网地址')
  if (isIP(host) && !isPublicAddress(host)) throw new Error('URL 不允许使用私网、环回或保留地址')
  if (!isIP(host) && !host.includes('.')) throw new Error('URL 必须使用公网域名')
  url.hostname = isIP(host) === 6 ? `[${host}]` : host
  if ((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) url.port = ''
  url.pathname = url.pathname.replace(/\/{2,}/g, '/') || '/'
  return url.toString()
}

export function parseGithubUrl(input) {
  const url = new URL(normalizeTargetUrl(input))
  if (url.hostname !== 'github.com') return null
  const parts = url.pathname.split('/').filter(Boolean).map((part) => decodeURIComponent(part))
  if (parts.length < 2 || !/^[\w.-]+$/.test(parts[0]) || !/^[\w.-]+(?:\.git)?$/.test(parts[1])) throw new Error('GitHub URL 必须指向仓库根地址或 /commits/{branch}')
  const owner = parts[0]
  const repo = parts[1].replace(/\.git$/i, '')
  if (parts.length === 2) return { owner, repo, branch: '' }
  if (parts[2] !== 'commits' || parts.length < 4) throw new Error('GitHub URL 必须指向仓库根地址或 /commits/{branch}')
  return { owner, repo, branch: parts.slice(3).join('/') }
}

export function targetType(url) {
  return parseGithubUrl(url) ? 'github' : 'web'
}

export function textHash(text) {
  return createHash('sha256').update(String(text)).digest('hex')
}

function decodeEntities(text) {
  const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
  return text.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (_, key) => {
    if (key[0] === '#') {
      const point = key[1].toLowerCase() === 'x' ? Number.parseInt(key.slice(2), 16) : Number.parseInt(key.slice(1), 10)
      return Number.isFinite(point) ? String.fromCodePoint(point) : ''
    }
    return entities[key.toLowerCase()] || ''
  })
}

function xmlValue(block, tag, firstLine = false) {
  const match = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(block)
  if (!match) return ''
  const decoded = decodeEntities(match[1]).replace(/<[^>]+>/g, ' ').replace(/\r/g, '').trim()
  return firstLine ? (decoded.split('\n').map((line) => line.trim()).find(Boolean) || '') : decoded.replace(/\s+/g, ' ')
}

export function parseGithubAtom(xml) {
  const entries = String(xml || '').match(/<entry\b[^>]*>[\s\S]*?<\/entry>/gi) || []
  return entries.map((entry) => {
    const href = /<link\b[^>]*\bhref=["']([^"']+)["'][^>]*>/i.exec(entry)?.[1] || ''
    const sha = /\/commit\/([0-9a-f]{7,40})(?:[/?#]|$)/i.exec(href)?.[1] || ''
    return {
      sha,
      shortSha: sha.slice(0, 7),
      url: href,
      message: xmlValue(entry, 'content', true) || xmlValue(entry, 'title'),
      author: xmlValue(entry, 'name') || '未知',
      committedAt: xmlValue(entry, 'updated'),
    }
  }).filter((entry) => entry.sha && entry.url && Number.isFinite(Date.parse(entry.committedAt)))
}

export function parseGithubPatch(patch) {
  const chunks = String(patch || '').split(/^diff --git /m).slice(1)
  return chunks.slice(0, 80).map((chunk) => {
    const plus = /^\+\+\+\s+(?:b\/)?(.+)$/m.exec(chunk)?.[1]?.trim()
    const minus = /^---\s+(?:a\/)?(.+)$/m.exec(chunk)?.[1]?.trim()
    const renamed = /^rename to\s+(.+)$/m.exec(chunk)?.[1]?.trim()
    const filename = renamed || (plus && plus !== '/dev/null' ? plus : minus && minus !== '/dev/null' ? minus : '')
    let additions = 0
    let deletions = 0
    for (const line of chunk.split('\n')) {
      if (line.startsWith('+') && !line.startsWith('+++')) additions += 1
      else if (line.startsWith('-') && !line.startsWith('---')) deletions += 1
    }
    const status = /^(?:new file mode)\b/m.test(chunk) ? 'added' : /^(?:deleted file mode)\b/m.test(chunk) ? 'removed' : renamed ? 'renamed' : 'modified'
    return { filename: filename.replace(/^"|"$/g, ''), status, additions, deletions, patch: chunk.slice(0, 900) }
  }).filter((file) => file.filename)
}

export function normalizeText(text, contentType = 'text/plain') {
  let source = String(text || '').replace(/^\uFEFF/, '')
  const type = String(contentType).toLowerCase()
  if (type.includes('json')) {
    try {
      const omit = /^(?:generated|fetched|retrieved|updated|modified)(?:_|-)?at$|^(?:timestamp|request_?id)$/i
      const stable = (value) => {
        if (Array.isArray(value)) return value.map(stable)
        if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().filter((key) => !omit.test(key)).map((key) => [key, stable(value[key])]))
        return value
      }
      source = JSON.stringify(stable(JSON.parse(source)), null, 2)
    } catch { /* retain invalid JSON as text */ }
  } else if (type.includes('html') || type.includes('xml') || type.includes('rss') || type.includes('atom')) {
    source = source
      .replace(/<!--[^]*?-->/g, ' ')
      .replace(/<(script|style|svg|noscript)\b[^>]*>[^]*?<\/\1\s*>/gi, ' ')
      .replace(/<(?:meta|link)\b[^>]*>/gi, ' ')
      .replace(/<\/?(?:p|div|section|article|header|footer|main|aside|nav|h[1-6]|li|tr|br|entry|item|title|description|summary|content)\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
    source = decodeEntities(source)
  }
  return source
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[\t \f\v]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, 100000)
}

export function diffLines(previous, current, limit = 80) {
  const before = new Set(String(previous || '').split('\n').filter(Boolean))
  const after = new Set(String(current || '').split('\n').filter(Boolean))
  const addedAll = [...after].filter((line) => !before.has(line))
  const removedAll = [...before].filter((line) => !after.has(line))
  return {
    added: addedAll.slice(0, limit),
    removed: removedAll.slice(0, limit),
    addedCount: addedAll.length,
    removedCount: removedAll.length,
    truncated: addedAll.length > limit || removedAll.length > limit,
  }
}

export function limitReportsPerTarget(reports, limit = 60) {
  const counts = new Map()
  return reports.filter((report) => {
    const key = String(report.targetId || '')
    const count = counts.get(key) || 0
    if (count >= limit) return false
    counts.set(key, count + 1)
    return true
  })
}

function localKey(value) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  const pad = (part) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function previousDateKey(dateKey) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || ''))
  if (!match) return dateKey
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]) - 1)
  return localKey(date)
}

export function migrateState(saved = {}, timestamp = new Date().toISOString()) {
  const targets = Array.isArray(saved.targets)
    ? saved.targets.map((target) => {
        const url = normalizeTargetUrl(target.url)
        return {
          id: String(target.id || randomUUID()),
          name: String(target.name || '未命名追踪对象').trim().slice(0, 100),
          url,
          type: targetType(url),
          enabled: target.enabled !== false,
          createdAt: target.createdAt || timestamp,
          updatedAt: target.updatedAt || timestamp,
          lastCheckedAt: target.lastCheckedAt || '',
          ...(target.snapshot && typeof target.snapshot === 'object' ? { snapshot: target.snapshot } : {}),
        }
      })
    : [{ id: 'deepseek-harness', name: 'DeepSeek Harness', url: DEFAULT_TARGET_URL, type: 'github', enabled: true, createdAt: timestamp, updatedAt: timestamp, lastCheckedAt: '' }]
  const fallback = targets[0]
  const reports = fallback ? (Array.isArray(saved.reports) ? saved.reports : []).map((report) => {
    const sourceType = report.sourceType || fallback.type
    const generated = new Date(report.generatedAt)
    const scheduledAtEleven = Number.isFinite(generated.getTime()) && generated.getHours() === 11
    const reportDate = Number(saved.version) === 3 && sourceType === 'web' && report.trigger === 'scheduled' && scheduledAtEleven && localKey(report.generatedAt) === report.reportDate
      ? previousDateKey(report.reportDate)
      : report.reportDate
    return {
      ...report,
      reportDate,
      targetId: report.targetId || fallback.id,
      targetName: report.targetName || fallback.name,
      targetUrl: report.targetUrl || report.source || fallback.url,
      sourceType,
    }
  }) : []
  const seenReports = new Set()
  const deduplicatedReports = reports.filter((report) => {
    const key = `${report.targetId}\u0000${report.reportDate}`
    if (seenReports.has(key)) return false
    seenReports.add(key)
    return true
  })
  return {
    version: 4,
    targets,
    reports: deduplicatedReports,
    lastRunAt: saved.lastRunAt || '',
    lastError: saved.lastError || '',
    automation: { sessionId: '', taskId: '', time: '11:00', timeZone: 'Asia/Shanghai', scheduledAt: '', ...(saved.automation || {}) },
  }
}
