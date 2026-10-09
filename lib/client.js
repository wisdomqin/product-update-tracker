window.__ModuleLoader__.load({ id: 'deepseek-harness-daily', factory: (require) => {
  const React = require('react')
  const e = React.createElement
  const API = '/api/deepseek-harness-daily'

  function App({ service, conversation }) {
    const workbench = React.useSyncExternalStore(service.subscribe, service.getSnapshot, service.getSnapshot)
    const [data, setData] = React.useState({ targets: [], reports: [], schedule: {}, model: {}, automation: {} })
    const [selectedTargetId, setSelectedTargetId] = React.useState('')
    const [selectedId, setSelectedId] = React.useState('')
    const [view, setView] = React.useState('overview')
    const [calendarMonth, setCalendarMonth] = React.useState(() => monthKey(new Date()))
    const [targetDialog, setTargetDialog] = React.useState(null)
    const [targetMenuOpen, setTargetMenuOpen] = React.useState(false)
    const targetPickerRef = React.useRef(null)
    const [busy, setBusy] = React.useState(false)
    const [message, setMessage] = React.useState('')
    const [setupDismissed, setSetupDismissed] = React.useState(false)
    const [setupBusy, setSetupBusy] = React.useState(false)
    const [conversationOpen, setConversationOpen] = React.useState(false)
    const ownerId = 'wisdomqin/product-update-tracker'
    const currentSessionId = service.currentSession()
    const ownedSessionIds = Object.entries(workbench.state?.sessionBindings || {})
      .filter(([, owner]) => owner === ownerId)
      .map(([sessionId]) => sessionId)
    const configuredSessionId = data.automation?.sessionId && ownedSessionIds.includes(data.automation.sessionId)
      ? data.automation.sessionId
      : ownedSessionIds.find((sessionId) => service.workspaceFor(sessionId)) || ''
    const configuredWorkspace = configuredSessionId ? service.workspaceFor(configuredSessionId) : null
    const currentOwned = Boolean(currentSessionId && workbench.state?.sessionBindings?.[currentSessionId] === ownerId)
    const visibleWorkspaces = service.visibleWorkspaces(ownerId)

    React.useEffect(() => {
      if (currentOwned) setConversationOpen(true)
    }, [currentOwned, currentSessionId])

    React.useEffect(() => {
      if (!conversationOpen) return
      const close = (event) => { if (event.key === 'Escape') setConversationOpen(false) }
      window.addEventListener('keydown', close)
      return () => window.removeEventListener('keydown', close)
    }, [conversationOpen])

    React.useEffect(() => {
      if (!targetMenuOpen) return
      const close = (event) => {
        if (event.key === 'Escape' || (event.type === 'pointerdown' && !targetPickerRef.current?.contains(event.target))) setTargetMenuOpen(false)
      }
      window.addEventListener('keydown', close)
      window.addEventListener('pointerdown', close)
      return () => { window.removeEventListener('keydown', close); window.removeEventListener('pointerdown', close) }
    }, [targetMenuOpen])

    const load = React.useCallback(async () => {
      const response = await fetch(`${API}/state`)
      const payload = await response.json()
      if (!response.ok) throw Error(payload.error || '读取日报失败')
      setData(payload)
      setSelectedTargetId((current) => payload.targets?.some((item) => item.id === current) ? current : payload.targets?.[0]?.id || '')
      return payload
    }, [])

    React.useEffect(() => {
      load().catch((error) => setMessage(error.message))
      const timer = setInterval(() => load().catch(() => {}), 15000)
      return () => clearInterval(timer)
    }, [load])

    async function post(path, body = {}) {
      const response = await fetch(`${API}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const payload = await response.json()
      if (!response.ok) {
        if (response.status === 404 && path.startsWith('/targets/')) throw Error('服务端仍在运行旧版本，请使用 ⌘Q 完全退出 DSH Desktop 后重新打开')
        throw Error(payload.error || '操作失败')
      }
      return payload
    }

    async function refresh() {
      if (!selectedTargetId) return setTargetDialog({ mode: 'create', target: null })
      setBusy(true)
      setMessage('正在抓取页面并分析与上次记录之间的变化…')
      try {
        const payload = await post('/refresh', { targetId: selectedTargetId })
        setSelectedId(payload.report.id)
        setView('detail')
        setMessage(`已生成 ${payload.report.targetName || '追踪对象'} · ${payload.report.reportDate} 日报`)
        await load()
      } catch (error) {
        setMessage(error.message)
      } finally {
        setBusy(false)
      }
    }

    async function saveTarget(values) {
      setBusy(true)
      try {
        const path = targetDialog?.mode === 'edit' ? '/targets/update' : '/targets/create'
        const payload = await post(path, targetDialog?.mode === 'edit' ? { id: targetDialog.target.id, ...values } : values)
        setSelectedTargetId(payload.target.id)
        setSelectedId('')
        setView('detail')
        setTargetDialog(null)
        const editing = targetDialog?.mode === 'edit'
        setMessage(editing ? '追踪对象已更新' : '追踪对象已添加，正在进行首次检查…')
        await load()
        if (!editing) {
          try {
            const first = await post('/refresh', { targetId: payload.target.id })
            setSelectedId(first.report.id)
            setMessage(first.report.baseline ? '追踪对象已添加，并已建立首次内容基线' : '追踪对象已添加，并已生成第一份日报')
            await load()
          } catch (error) {
            setMessage(`追踪对象已保存，但首次抓取失败：${error.message}`)
          }
        }
      } finally {
        setBusy(false)
      }
    }

    async function toggleTarget(target) {
      setBusy(true)
      try {
        await post('/targets/toggle', { id: target.id, enabled: !target.enabled })
        setMessage(target.enabled ? '已暂停每日追踪' : '已恢复每日追踪')
        await load()
      } catch (error) { setMessage(error.message) }
      finally { setBusy(false) }
    }

    async function deleteTarget(target) {
      if (!window.confirm(`删除“${target.name}”及其全部历史日报？此操作无法撤销。`)) return
      setBusy(true)
      try {
        await post('/targets/delete', { id: target.id })
        setSelectedTargetId('')
        setSelectedId('')
        setMessage('追踪对象已删除')
        await load()
      } catch (error) { setMessage(error.message) }
      finally { setBusy(false) }
    }

    async function configureSession(sessionId) {
      if (!sessionId) return
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai'
      await post('/automation/configure', { sessionId, timeZone })
      setSetupDismissed(true)
      setConversationOpen(true)
      await load()
    }

    async function selectWorkspace(workspaceId) {
      setSetupBusy(true)
      setMessage('正在准备工作区会话和每日自动化任务…')
      try {
        const existing = ownedSessionIds.find((sessionId) => service.workspaceFor(sessionId)?.workspaceId === workspaceId)
        const sessionId = existing || await service.newSession(workspaceId)
        if (existing) service.showSession(existing)
        await configureSession(sessionId)
        setMessage('已绑定工作区，并创建每天 11:00 的自动化任务')
      } catch (error) {
        setMessage(error.message)
      } finally {
        setSetupBusy(false)
      }
    }

    async function chooseWorkspaceFolder() {
      setSetupBusy(true)
      setMessage('请选择已有文件夹，或在系统选择器中新建文件夹…')
      try {
        const sessionId = await service.newWorkspaceSession()
        if (sessionId) {
          await configureSession(sessionId)
          setMessage('已创建工作区会话和每天 11:00 的自动化任务')
        }
      } catch (error) {
        setMessage(error.message)
      } finally {
        setSetupBusy(false)
      }
    }

    const targets = data.targets || []
    const target = targets.find((item) => item.id === selectedTargetId) || targets[0]
    const reports = (data.reports || []).filter((item) => item.targetId === target?.id)
    const report = reports.find((item) => item.id === selectedId) || reports[0]
    const running = busy || data.running
    const modelLabel = data.model?.available ? `${data.model.provider} / ${data.model.name}` : '无可用模型，将生成基础摘要'

    React.useEffect(() => {
      setSelectedId((current) => reports.some((item) => item.id === current) ? current : reports[0]?.id || '')
    }, [target?.id, data.reports])

    return e('div', { className: 'hdy-root' },
      e('header', { className: 'hdy-header' },
        e('div', { className: 'hdy-brand' },
          e('div', { className: 'hdy-eyebrow' }, e('span', null), 'PRODUCT UPDATE TRACKER'),
          e('h1', null, view === 'overview' ? '产品更新追踪' : target?.name || '产品更新追踪'),
          e('p', null, view === 'overview'
            ? '用月度日历总览所有关注产品每天的更新状态。'
            : target ? '每天 11:00，自动抓取并整理这个追踪对象的最新变化。' : '添加名称和网址，即可开始每日追踪互联网内容变化。'),
        ),
        e('div', { className: 'hdy-actions' },
          e('div', { className: 'hdy-model' }, e('small', null, '分析模型'), e('b', null, modelLabel)),
          view === 'detail' && e('button', { className: 'hdy-secondary', onClick: () => setView('overview') }, '← 月度总览'),
          e('button', { className: 'hdy-secondary', onClick: () => setTargetDialog({ mode: 'create', target: null }) }, '＋ 新增追踪'),
          configuredSessionId && e('button', {
            className: 'hdy-secondary',
            onClick: () => { service.showSession(configuredSessionId); setConversationOpen(true) },
          }, '打开分析会话'),
          view === 'detail' && e('button', { className: 'hdy-primary', onClick: refresh, disabled: running }, running ? '分析中…' : target ? '立即检查' : '添加追踪对象'),
        ),
      ),
      e('style', null, css),
      e('div', { className: 'hdy-subbar' },
        e('div', null,
          e('span', { className: `hdy-live ${data.automation?.enabled ? '' : 'inactive'}` }, data.automation?.enabled ? '自动任务已启用' : '自动任务未配置'),
          e('b', null, data.automation?.enabled ? `每天 ${data.automation.time || '11:00'}` : '请选择工作区'),
          e('span', null, data.automation?.timeZone || data.schedule?.timezone || '本地时区'),
          configuredWorkspace && e('span', { className: 'hdy-workspace-chip' }, configuredWorkspace.name || configuredWorkspace.path || '已绑定工作区'),
        ),
        view === 'detail' && target && e('a', { href: target.url, target: '_blank', rel: 'noreferrer' }, `打开${target.type === 'github' ? ' GitHub' : '来源网页'} ↗`),
      ),
      message && e('div', { className: 'hdy-message', role: 'status' }, message),
      data.lastError && e('div', { className: 'hdy-error', role: 'alert' }, `上次任务失败：${data.lastError}`),
      e('main', { className: `hdy-main ${view === 'overview' ? 'hdy-main-overview' : 'hdy-main-detail'}` },
        view === 'overview'
          ? e(CalendarOverview, {
              targets,
              reports: data.reports || [],
              month: calendarMonth,
              onMonthChange: setCalendarMonth,
              onAddTarget: () => setTargetDialog({ mode: 'create', target: null }),
              onOpenReport: (targetId, reportId) => { setSelectedTargetId(targetId); setSelectedId(reportId); setView('detail') },
              onOpenTarget: (targetId) => { setSelectedTargetId(targetId); setSelectedId(''); setView('detail') },
            })
          : e(React.Fragment, null,
        e('aside', { className: 'hdy-history hdy-tracker-nav', 'aria-label': '追踪对象与历史日报' },
          e('div', { className: 'hdy-section-title' }, e('span', null, '当前追踪'), e('b', null, targets.length)),
          targets.length
            ? e('div', { className: 'hdy-target-picker', ref: targetPickerRef },
                e('button', {
                  className: `hdy-target-picker-button ${targetMenuOpen ? 'open' : ''}`,
                  onClick: () => setTargetMenuOpen((open) => !open),
                  'aria-haspopup': 'listbox',
                  'aria-expanded': targetMenuOpen ? 'true' : 'false',
                },
                  e('span', { className: 'hdy-target-type' }, target?.type === 'github' ? 'GH' : 'WEB'),
                  e('span', { className: 'hdy-target-copy' }, e('b', null, target?.name), e('small', null, target?.enabled ? '每日追踪' : '已暂停')),
                  e('span', { className: 'hdy-target-chevron', 'aria-hidden': 'true' }, '⌄'),
                ),
                targetMenuOpen && e('div', { className: 'hdy-target-menu', role: 'listbox', 'aria-label': '切换追踪对象' },
                  targets.map((item) => e('button', {
                    key: item.id,
                    role: 'option',
                    'aria-selected': target?.id === item.id ? 'true' : 'false',
                    className: `${target?.id === item.id ? 'selected' : ''} ${item.enabled ? '' : 'disabled'}`,
                    onClick: () => { setSelectedTargetId(item.id); setSelectedId(''); setTargetMenuOpen(false) },
                  },
                    e('span', { className: 'hdy-target-type' }, item.type === 'github' ? 'GH' : 'WEB'),
                    e('span', { className: 'hdy-target-copy' }, e('b', null, item.name), e('small', null, item.enabled ? '每日追踪' : '已暂停')),
                    target?.id === item.id && e('span', { className: 'hdy-target-check', 'aria-hidden': 'true' }, '✓'),
                  )),
                  e('button', { className: 'hdy-target-menu-add', onClick: () => { setTargetMenuOpen(false); setTargetDialog({ mode: 'create', target: null }) } }, '＋ 新增追踪对象'),
                ),
              )
            : e('button', { className: 'hdy-target-picker-empty', onClick: () => setTargetDialog({ mode: 'create', target: null }) }, '＋ 添加第一个追踪对象'),
          e('div', { className: 'hdy-nav-divider' }),
          e('div', { className: 'hdy-section-title' }, e('span', null, '日报归档'), e('b', null, reports.length)),
          reports.length
            ? reports.map((item) => e('button', {
                key: item.id,
                className: `hdy-history-item ${report?.id === item.id ? 'active' : ''}`,
                onClick: () => setSelectedId(item.id),
              },
              e('time', null, formatDate(item.reportDate)),
              e('span', null, item.headline),
              e('small', null, `${item.itemCount ?? item.commitCount ?? 0} 项变化 · ${item.trigger === 'scheduled' ? '自动' : '手动'}`),
            ))
            : e('div', { className: 'hdy-empty-small' }, '还没有日报'),
          e('div', { className: 'hdy-schedule-note' },
            e('b', null, '运行说明'),
            e('p', null, data.automation?.enabled
              ? '每天 11:00，一条 DSH 自动化任务会依次检查所有已启用的追踪对象。'
              : '选择工作区后，将创建工作台会话并绑定每日自动化任务。'),
          ),
        ),
        e('section', { className: 'hdy-report' },
          target && e('div', { className: 'hdy-target-manager' },
            e('div', { className: 'hdy-target-manager-copy' },
              e('span', { className: 'hdy-target-type' }, target.type === 'github' ? 'GH' : 'WEB'),
              e('div', null,
                e('b', null, target.name),
                e('a', { href: target.url, target: '_blank', rel: 'noreferrer', title: target.url }, target.url),
              ),
            ),
            e('div', { className: 'hdy-target-manager-actions', 'aria-label': '管理当前追踪对象' },
              e('button', { onClick: () => setTargetDialog({ mode: 'edit', target }) }, '编辑名称和网址'),
              e('button', { onClick: () => toggleTarget(target) }, target.enabled ? '暂停追踪' : '恢复追踪'),
              e('button', { className: 'danger', onClick: () => deleteTarget(target) }, '删除'),
            ),
          ),
          report ? e(Report, { report }) : e(Empty, { onRefresh: refresh, busy: running, hasTarget: Boolean(target) }),
        ),
      ),
      ),
      targetDialog && e(TargetDialog, {
        mode: targetDialog.mode,
        target: targetDialog.target,
        busy,
        onSave: saveTarget,
        onClose: () => setTargetDialog(null),
      }),
      !configuredWorkspace && !setupDismissed && e(WorkspaceSetup, {
        workspaces: visibleWorkspaces,
        busy: setupBusy,
        onSelect: selectWorkspace,
        onChooseFolder: chooseWorkspaceFolder,
        onClose: () => setSetupDismissed(true),
      }),
      currentOwned && conversation && e(ConversationDrawer, {
        open: conversationOpen,
        conversation,
        onClose: () => setConversationOpen(false),
      }),
    )
  }

  function CalendarOverview({ targets, reports, month, onMonthChange, onAddTarget, onOpenReport, onOpenTarget }) {
    const [year, monthNumber] = month.split('-').map(Number)
    const daysInMonth = new Date(year, monthNumber, 0).getDate()
    const days = Array.from({ length: daysInMonth }, (_, index) => index + 1)
    const currentMonth = monthKey(new Date())
    const today = currentMonth === month ? new Date().getDate() : 0
    const latestByTargetDate = new Map()
    for (const report of reports) {
      if (!report.reportDate?.startsWith(`${month}-`)) continue
      const key = `${report.targetId}:${report.reportDate}`
      const previous = latestByTargetDate.get(key)
      if (!previous || String(report.generatedAt || '') > String(previous.generatedAt || '')) latestByTargetDate.set(key, report)
    }
    const monthlyReports = [...latestByTargetDate.values()]
    const updateDays = monthlyReports.filter((report) => (report.itemCount ?? report.commitCount ?? 0) > 0).length
    const updateItems = monthlyReports.reduce((sum, report) => sum + (report.itemCount ?? report.commitCount ?? 0), 0)
    const monthLabel = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long' }).format(new Date(year, monthNumber - 1, 1))
    return e('section', { className: 'hdy-overview', 'aria-label': '产品月度更新日历' },
      e('div', { className: 'hdy-overview-head' },
        e('div', null,
          e('div', { className: 'hdy-overview-kicker' }, 'MONTHLY UPDATE MAP'),
          e('h2', null, monthLabel),
          e('p', null, `${targets.length} 个产品 · ${updateDays} 个更新日 · ${updateItems} 项变化`),
        ),
        e('div', { className: 'hdy-month-controls', 'aria-label': '切换月份' },
          e('button', { onClick: () => onMonthChange(shiftMonth(month, -1)), 'aria-label': '上一个月' }, '←'),
          e('button', { className: 'label', onClick: () => onMonthChange(currentMonth), disabled: month === currentMonth }, '回到本月'),
          e('button', { onClick: () => onMonthChange(shiftMonth(month, 1)), 'aria-label': '下一个月' }, '→'),
        ),
      ),
      targets.length ? e('div', { className: 'hdy-calendar-scroll' },
        e('div', { className: 'hdy-calendar-grid', style: { '--hdy-days': daysInMonth, minWidth: `${210 + daysInMonth * 34}px` } },
          e('div', { className: 'hdy-calendar-corner' }, '产品 / 日期'),
          days.map((day) => {
            const date = new Date(year, monthNumber - 1, day)
            const weekend = date.getDay() === 0 || date.getDay() === 6
            return e('div', { key: `head-${day}`, className: `hdy-day-head ${weekend ? 'weekend' : ''} ${day === today ? 'today' : ''}` },
              e('b', null, day), e('small', null, '日一二三四五六'[date.getDay()]),
            )
          }),
          targets.map((item) => e(React.Fragment, { key: item.id },
            e('button', { className: `hdy-calendar-product ${item.enabled ? '' : 'paused'}`, onClick: () => onOpenTarget(item.id), title: `打开 ${item.name} 日报` },
              e('span', { className: 'hdy-target-type' }, item.type === 'github' ? 'GH' : 'WEB'),
              e('span', null, e('b', null, item.name), e('small', null, item.enabled ? '每日追踪' : '已暂停')),
            ),
            days.map((day) => {
              const dateKey = `${month}-${String(day).padStart(2, '0')}`
              const report = latestByTargetDate.get(`${item.id}:${dateKey}`)
              const count = report ? (report.itemCount ?? report.commitCount ?? 0) : 0
              const level = count >= 6 ? 'high' : count >= 3 ? 'medium' : count > 0 ? 'low' : ''
              const state = report ? (count > 0 ? `有 ${count} 项更新` : '已检查，无更新') : '尚无日报'
              return e('button', {
                key: dateKey,
                className: `hdy-day-cell ${report ? 'checked' : ''} ${level ? `updated ${level}` : ''} ${day === today ? 'today' : ''}`,
                disabled: !report,
                onClick: () => report && onOpenReport(item.id, report.id),
                title: `${item.name} · ${dateKey} · ${state}`,
                'aria-label': `${item.name} ${dateKey} ${state}`,
              }, count > 0 ? (count > 9 ? '9+' : count) : report ? '·' : '')
            }),
          )),
        ),
      ) : e('div', { className: 'hdy-overview-empty' },
        e('div', null, '＋'), e('h3', null, '还没有关注的产品'), e('p', null, '添加追踪对象后，这里会按月份展示每日更新。'),
        e('button', { className: 'hdy-primary', onClick: onAddTarget }, '新增追踪对象'),
      ),
      targets.length > 0 && e('div', { className: 'hdy-calendar-legend' },
        e('span', null, e('i', { className: 'none' }), '尚无日报'),
        e('span', null, e('i', { className: 'checked' }), '已检查，无更新'),
        e('span', null, e('i', { className: 'low' }), '1–2 项'),
        e('span', null, e('i', { className: 'medium' }), '3–5 项'),
        e('span', null, e('i', { className: 'high' }), '6 项以上'),
      ),
    )
  }

  function monthKey(value) {
    const date = value instanceof Date ? value : new Date(value)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  }

  function shiftMonth(month, offset) {
    const [year, monthNumber] = month.split('-').map(Number)
    return monthKey(new Date(year, monthNumber - 1 + offset, 1))
  }

  function TargetDialog({ mode, target, busy, onSave, onClose }) {
    const [name, setName] = React.useState(target?.name || '')
    const [url, setUrl] = React.useState(target?.url || '')
    const [error, setError] = React.useState('')
    const submit = async (event) => {
      event.preventDefault()
      const normalizedName = name.trim()
      const normalizedUrl = url.trim()
      if (!normalizedName) return setError('请输入追踪对象名称')
      if (!/^https?:\/\//i.test(normalizedUrl)) return setError('请输入以 http:// 或 https:// 开头的公开网址')
      setError('')
      try { await onSave({ name: normalizedName, url: normalizedUrl }) }
      catch (reason) { setError(reason.message) }
    }
    return e('div', { className: 'hdy-overlay', role: 'presentation' },
      e('form', { className: 'hdy-setup-dialog hdy-target-dialog', role: 'dialog', 'aria-modal': 'true', onSubmit: submit },
        e('button', { type: 'button', className: 'hdy-icon-button', onClick: onClose, 'aria-label': '关闭' }, '×'),
        e('div', { className: 'hdy-setup-kicker' }, mode === 'edit' ? '编辑追踪' : '新增追踪'),
        e('h2', null, mode === 'edit' ? '修改追踪对象' : '添加一个想持续关注的页面'),
        e('p', null, 'GitHub 仓库会自动使用提交 API；其他公开网页会建立内容快照，并在每天抓取时比较变化。'),
        e('label', { className: 'hdy-field' }, e('span', null, '名称'), e('input', { value: name, maxLength: 80, autoFocus: true, placeholder: '例如：DeepSeek 官方博客', onChange: (event) => setName(event.target.value) })),
        e('label', { className: 'hdy-field' }, e('span', null, '网址'), e('input', { value: url, type: 'url', placeholder: 'https://example.com/updates', onChange: (event) => setUrl(event.target.value) })),
        error && e('div', { className: 'hdy-form-error', role: 'alert' }, error),
        e('button', { className: 'hdy-primary hdy-wide', disabled: busy, type: 'submit' }, busy ? '正在保存…' : mode === 'edit' ? '保存修改' : '添加并开始追踪'),
      ),
    )
  }

  function WorkspaceSetup({ workspaces, busy, onSelect, onChooseFolder, onClose }) {
    return e('div', { className: 'hdy-overlay hdy-setup-overlay', role: 'presentation' },
      e('section', { className: 'hdy-setup-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'hdy-setup-title' },
        e('button', { className: 'hdy-icon-button', onClick: onClose, 'aria-label': '暂时关闭' }, '×'),
        e('div', { className: 'hdy-setup-kicker' }, '首次设置'),
        e('h2', { id: 'hdy-setup-title' }, '选择日报所在的工作区'),
        e('p', null, '工作台会在所选工作区创建并长期复用一条分析会话，再由 DSH 自动化任务每天 11:00 检查所有已启用的追踪对象。'),
        workspaces.length > 0 && e('div', { className: 'hdy-workspace-list' },
          workspaces.map((workspace) => e('button', {
            key: workspace.workspaceId,
            disabled: busy,
            onClick: () => onSelect(workspace.workspaceId),
          },
            e('b', null, workspace.name || workspace.path?.split('/').filter(Boolean).pop() || '已有工作区'),
            e('span', null, workspace.path || workspace.workspaceId),
          )),
        ),
        e('button', { className: 'hdy-primary hdy-wide', disabled: busy, onClick: onChooseFolder },
          busy ? '正在准备…' : '选择文件夹或创建新工作区',
        ),
        e('small', null, '暂时关闭不会创建目录、会话或自动化任务；下次进入仍会提示。'),
      ),
    )
  }

  function ConversationDrawer({ open, conversation, onClose }) {
    return e('div', { className: `hdy-conversation-layer ${open ? 'open' : ''}`, 'aria-hidden': open ? 'false' : 'true' },
      e('button', { className: 'hdy-conversation-backdrop', onClick: onClose, tabIndex: -1, 'aria-label': '关闭会话浮窗' }),
      e('section', { className: 'hdy-conversation-drawer', role: 'dialog', 'aria-modal': 'true', 'aria-label': '产品更新追踪分析会话' },
        e('div', { className: 'hdy-conversation-bar' },
          e('div', null, e('b', null, '分析会话'), e('span', null, '自动任务会把每日更新追加到这里')),
          e('button', { className: 'hdy-icon-button', onClick: onClose, 'aria-label': '关闭会话浮窗' }, '×'),
        ),
        e('div', { className: 'hdy-conversation-content' }, conversation),
      ),
    )
  }

  function Report({ report }) {
    const isGitHub = report.sourceType === 'github'
    return e(React.Fragment, null,
      e('section', { className: 'hdy-hero' },
        e('div', { className: 'hdy-date-block' },
          e('small', null, 'REPORT DATE'),
          e('strong', null, report.reportDate),
          e('span', null, report.timezone),
        ),
        e('div', { className: 'hdy-hero-copy' },
          e('div', { className: 'hdy-badges' },
            e('span', { className: `confidence c-${report.confidence}` }, `置信度 ${report.confidence}`),
            report.analysisError && e('span', { className: 'fallback' }, '基础摘要'),
            report.truncated && e('span', { className: 'fallback' }, '采集内容已截断'),
            report.baseline && e('span', { className: 'fallback' }, '首次基线'),
          ),
          e('h2', null, report.headline),
          e('p', null, report.overview),
          e('div', { className: 'hdy-tags' }, (report.themes || []).map((theme) => e('span', { key: theme }, theme))),
        ),
      ),
      e('section', { className: 'hdy-stats', 'aria-label': '日报统计' },
        e(Stat, { label: isGitHub ? '提交' : '变化项', value: report.itemCount ?? report.commitCount ?? 0, suffix: isGitHub ? 'commits' : 'detected' }),
        e(Stat, { label: '新增', value: `+${report.stats?.additions || 0}`, suffix: isGitHub ? 'lines' : '文本行', tone: 'green' }),
        e(Stat, { label: '移除', value: `−${report.stats?.deletions || 0}`, suffix: 'lines', tone: 'red' }),
        e(Stat, { label: '重点', value: (report.changes || []).length, suffix: 'items' }),
      ),
      report.analysisError && e('div', { className: 'hdy-fallback-note' },
        e('b', null, '本次未完成大模型分析'),
        e('span', null, report.analysisError),
      ),
      e('div', { className: 'hdy-report-grid' },
        e('div', { className: 'hdy-column' },
          e('div', { className: 'hdy-heading' }, e('span', null, '01'), e('div', null, e('h3', null, '具体更新'), e('p', null, isGitHub ? '按主题合并相关提交' : '根据前后内容快照整理'))),
          (report.changes || []).length
            ? report.changes.map((change, index) => e(ChangeCard, { key: `${change.title}-${index}`, change, report }))
            : e('div', { className: 'hdy-empty-card' }, report.baseline ? '首次抓取已建立内容基线，下一次检查开始对比变化。' : '本次没有检测到内容变化。'),
        ),
        e('aside', { className: 'hdy-column hdy-insights' },
          e('div', { className: 'hdy-heading' }, e('span', null, '02'), e('div', null, e('h3', null, '开发者关注'), e('p', null, '风险与后续阅读线索'))),
          e('div', { className: 'hdy-insight-card' },
            e('h4', null, '风险观察'),
            e('p', null, report.risk || '未发现明确风险。'),
          ),
          (report.developerNotes || []).length > 0 && e('div', { className: 'hdy-insight-card' },
            e('h4', null, '值得关注'),
            e('ul', null, report.developerNotes.map((note, index) => e('li', { key: index }, note))),
          ),
          (report.commits || []).length > 0
            ? e('div', { className: 'hdy-insight-card' },
                e('h4', null, '提交索引'),
                e('div', { className: 'hdy-commit-list' }, report.commits.map((commit) => e('a', {
                  key: commit.sha,
                  href: commit.url,
                  target: '_blank',
                  rel: 'noreferrer',
                }, e('code', null, commit.shortSha), e('span', null, commit.message || '无标题提交')))),
              )
            : e('div', { className: 'hdy-insight-card' },
                e('h4', null, '内容来源'),
                e('a', { href: report.targetUrl || report.source, target: '_blank', rel: 'noreferrer' }, report.targetName || '打开原始网页'),
              ),
          e('div', { className: 'hdy-meta' },
            e('span', null, `生成于 ${new Date(report.generatedAt).toLocaleString()}`),
            report.model && e('span', null, `${report.model.provider} / ${report.model.name}`),
          ),
        ),
      ),
    )
  }

  function ChangeCard({ change, report }) {
    const commitMap = new Map((report.commits || []).map((item) => [item.shortSha, item]))
    return e('article', { className: 'hdy-change' },
      e('div', { className: 'hdy-change-top' },
        e('span', { className: 'hdy-change-dot' }),
        e('h4', null, change.title),
      ),
      e('p', null, change.summary),
      change.impact && e('div', { className: 'hdy-impact' }, e('b', null, '可能影响'), e('span', null, change.impact)),
      (change.files || []).length > 0 && e('div', { className: 'hdy-files' }, change.files.map((file) => e('code', { key: file }, file))),
      (change.commits || []).length > 0 && e('footer', null,
        e('span', null, '相关提交'),
        change.commits.map((sha) => {
          const commit = commitMap.get(sha)
          return commit
            ? e('a', { key: sha, href: commit.url, target: '_blank', rel: 'noreferrer' }, sha)
            : e('code', { key: sha }, sha)
        }),
      ),
    )
  }

  function Stat({ label, value, suffix, tone = '' }) {
    return e('div', { className: `hdy-stat ${tone}` }, e('span', null, label), e('strong', null, value), e('small', null, suffix))
  }

  function Empty({ onRefresh, busy, hasTarget }) {
    return e('div', { className: 'hdy-empty' },
      e('div', { className: 'hdy-empty-icon' }, hasTarget ? '11' : '＋'),
      e('h2', null, hasTarget ? '等待这个对象的第一份更新日报' : '添加第一个追踪对象'),
      e('p', null, hasTarget ? '首次检查会建立内容基线；之后每天 11:00 自动比较变化。' : '只需要一个名称和公开网址，GitHub 与普通网页都会自动选择合适的采集方式。'),
      e('button', { className: 'hdy-primary', onClick: onRefresh, disabled: busy }, busy ? '分析中…' : hasTarget ? '立即检查' : '新增追踪对象'),
    )
  }

  function formatDate(value) {
    const [year, month, day] = String(value).split('-')
    return `${month} 月 ${day} 日 · ${year}`
  }

  function apply(ctx) {
    ctx.effect(() => {
      const service = ctx.desktopWorkbenches
      const dispose = service.register({
        title: '产品更新追踪',
        repository: 'https://github.com/wisdomqin/product-update-tracker',
        description: '添加名称和网址，每天自动追踪 GitHub 仓库或普通网页的内容变化',
        panelTitle: '产品更新追踪',
        icon: '◫',
        audience: '希望持续关注项目、产品和网页更新的用户',
        requirements: '需要联网访问公开网址；动态网页或登录内容可能无法抓取',
        initialization: 'home',
        customFrame: true,
        layout: { businessSide: 'left', businessWidth: 0.7 },
      }, App)
      const id = 'wisdomqin/product-update-tracker'
      let adding = false
      const ensureAdded = () => {
        if (adding || !service.ready || !service.catalog?.has(id) || service.state?.added?.includes(id)) return
        adding = true
        service.add(id).catch(() => {}).finally(() => { adding = false })
      }
      let opened = false
      const openOnce = () => {
        const key = 'deepseek-harness-daily.opened.0.4.2'
        if (opened || !service.ready || !service.catalog?.has(id) || !service.state?.added?.includes(id)) return
        opened = true
        if (window.localStorage.getItem(key) === '1') return
        window.localStorage.setItem(key, '1')
        service.home(id).catch(() => {
          window.localStorage.removeItem(key)
          opened = false
        })
      }
      ensureAdded()
      openOnce()
      const timer = setInterval(() => { ensureAdded(); openOnce() }, 500)
      return () => { clearInterval(timer); dispose() }
    }, 'deepseek-harness-daily: register workbench')
  }

  return { apply, inject: ['desktopWorkbenches'] }
} })

const css = `
:root{--hdy-ink:#17202d;--hdy-muted:#6f7885;--hdy-line:#e7e5df;--hdy-paper:#f5f3ed;--hdy-card:#fff;--hdy-red:#dd4a32;--hdy-blue:#2667d8;--hdy-green:#15835c}*{box-sizing:border-box}.hdy-root{height:100%;overflow:auto;background:var(--hdy-paper);color:var(--hdy-ink);font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif}.hdy-header{display:flex;align-items:center;justify-content:space-between;gap:28px;padding:30px 36px 22px;background:#fff;border-bottom:1px solid var(--hdy-line)}.hdy-eyebrow{display:flex;align-items:center;gap:8px;color:#8a8174;font-size:10px;letter-spacing:.18em;font-weight:800}.hdy-eyebrow span{width:18px;height:2px;background:var(--hdy-red)}.hdy-brand h1{margin:7px 0 5px;font-size:30px;letter-spacing:-.045em}.hdy-brand p{margin:0;color:var(--hdy-muted);font-size:13px}.hdy-actions{display:flex;align-items:center;gap:12px}.hdy-model{max-width:260px;padding:9px 12px;border:1px solid var(--hdy-line);border-radius:8px;background:#faf9f6}.hdy-model small,.hdy-model b{display:block}.hdy-model small{font-size:9px;color:var(--hdy-muted);text-transform:uppercase;letter-spacing:.1em}.hdy-model b{margin-top:3px;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.hdy-primary{border:0;border-radius:8px;background:var(--hdy-ink);color:#fff;padding:11px 16px;font-weight:750;cursor:pointer}.hdy-primary:hover{background:#29384b}.hdy-primary:focus-visible,.hdy-history-item:focus-visible,a:focus-visible{outline:3px solid #79a7f5;outline-offset:2px}.hdy-primary:disabled{opacity:.55;cursor:wait}.hdy-subbar{display:flex;justify-content:space-between;gap:16px;padding:10px 36px;background:#fff;border-bottom:1px solid var(--hdy-line);font-size:11px;color:var(--hdy-muted)}.hdy-subbar div{display:flex;align-items:center;gap:9px}.hdy-subbar b{color:var(--hdy-ink)}.hdy-live{padding:3px 7px;border-radius:999px;background:#e8f6ef;color:var(--hdy-green);font-weight:800}.hdy-subbar a{color:var(--hdy-blue);text-decoration:none}.hdy-message,.hdy-error{position:sticky;top:0;z-index:10;padding:10px 36px;background:#17202d;color:#fff;font-size:12px}.hdy-error{background:#8b3024}.hdy-main{max-width:1500px;margin:auto;display:grid;grid-template-columns:220px minmax(0,1fr);gap:24px;padding:28px 36px 56px}.hdy-history{min-width:0}.hdy-section-title{display:flex;justify-content:space-between;align-items:center;padding:0 4px 11px;font-size:11px;color:var(--hdy-muted);letter-spacing:.08em}.hdy-section-title b{display:grid;place-items:center;width:22px;height:22px;border-radius:50%;background:#e7e3da;color:var(--hdy-ink)}.hdy-history-item{width:100%;text-align:left;border:0;border-left:2px solid transparent;background:transparent;padding:12px 12px;cursor:pointer;color:var(--hdy-muted)}.hdy-history-item time,.hdy-history-item span,.hdy-history-item small{display:block}.hdy-history-item time{font-size:10px;font-weight:800;letter-spacing:.04em}.hdy-history-item span{margin:5px 0;font-size:12px;color:var(--hdy-ink);line-height:1.4}.hdy-history-item small{font-size:10px}.hdy-history-item:hover{background:#eeebe4}.hdy-history-item.active{border-left-color:var(--hdy-red);background:#fff;box-shadow:0 7px 20px #27231b0b}.hdy-schedule-note{margin-top:20px;padding:14px;border-top:1px solid #dbd7cf;color:var(--hdy-muted);font-size:10px;line-height:1.55}.hdy-schedule-note b{color:var(--hdy-ink)}.hdy-schedule-note p{margin:6px 0 0}.hdy-report{min-width:0}.hdy-hero{display:grid;grid-template-columns:155px 1fr;background:var(--hdy-card);border:1px solid var(--hdy-line);box-shadow:0 10px 35px #342f2710}.hdy-date-block{display:flex;flex-direction:column;justify-content:center;padding:26px;border-right:1px solid var(--hdy-line);background:#fbfaf7}.hdy-date-block small{font-size:9px;letter-spacing:.16em;color:var(--hdy-muted)}.hdy-date-block strong{font-size:18px;margin:8px 0 4px}.hdy-date-block span{font-size:10px;color:var(--hdy-muted)}.hdy-hero-copy{padding:25px 30px}.hdy-badges{display:flex;gap:6px;flex-wrap:wrap}.hdy-badges span{font-size:9px;border-radius:999px;padding:4px 8px;font-weight:800}.confidence{background:#e8f6ef;color:var(--hdy-green)}.c-中{background:#fff2d6;color:#916009}.c-低,.fallback{background:#fae8e4;color:#a53a29}.hdy-hero h2{font-size:24px;margin:12px 0 8px;letter-spacing:-.03em}.hdy-hero p{margin:0;color:#545f6d;font-size:13px;line-height:1.7}.hdy-tags{display:flex;gap:7px;flex-wrap:wrap;margin-top:15px}.hdy-tags span{font-size:10px;color:#40546c;background:#edf2f8;padding:5px 8px;border-radius:4px}.hdy-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border:1px solid var(--hdy-line);border-top:0;background:#fff}.hdy-stat{padding:17px 22px;border-right:1px solid var(--hdy-line)}.hdy-stat:last-child{border-right:0}.hdy-stat span,.hdy-stat small{display:block;color:var(--hdy-muted);font-size:9px;text-transform:uppercase;letter-spacing:.1em}.hdy-stat strong{display:block;margin:4px 0 2px;font-size:23px}.hdy-stat.green strong{color:var(--hdy-green)}.hdy-stat.red strong{color:var(--hdy-red)}.hdy-fallback-note{display:flex;gap:12px;margin-top:14px;padding:11px 14px;border:1px solid #f0c8bd;background:#fff6f3;color:#8b3e31;font-size:11px}.hdy-fallback-note span{color:#76554e}.hdy-report-grid{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(280px,.8fr);gap:24px;margin-top:26px}.hdy-heading{display:flex;gap:12px;align-items:flex-start;margin-bottom:12px}.hdy-heading>span{color:var(--hdy-red);font-size:10px;font-weight:900}.hdy-heading h3{margin:-3px 0 3px;font-size:16px}.hdy-heading p{margin:0;color:var(--hdy-muted);font-size:10px}.hdy-change,.hdy-insight-card{background:#fff;border:1px solid var(--hdy-line);margin-bottom:12px}.hdy-change{padding:19px 20px}.hdy-change-top{display:flex;align-items:flex-start;gap:10px}.hdy-change-dot{flex:0 0 7px;height:7px;border-radius:50%;background:var(--hdy-red);margin-top:6px}.hdy-change h4{margin:0;font-size:14px}.hdy-change>p{margin:10px 0;color:#4f5c6b;font-size:12px;line-height:1.7}.hdy-impact{display:grid;grid-template-columns:64px 1fr;gap:8px;padding:10px 12px;background:#f7f6f2;font-size:10px;line-height:1.5}.hdy-impact b{color:#7d5c2b}.hdy-files{display:flex;gap:5px;flex-wrap:wrap;margin-top:11px}.hdy-files code{max-width:100%;overflow:hidden;text-overflow:ellipsis;padding:3px 6px;background:#eef2f5;color:#425466;border-radius:3px;font-size:9px}.hdy-change footer{display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin-top:13px;padding-top:11px;border-top:1px solid #efede8;font-size:9px;color:var(--hdy-muted)}.hdy-change footer a,.hdy-change footer code{color:var(--hdy-blue);text-decoration:none;font-family:ui-monospace,monospace}.hdy-insight-card{padding:17px 18px}.hdy-insight-card h4{margin:0 0 9px;font-size:12px}.hdy-insight-card p,.hdy-insight-card li{font-size:11px;line-height:1.65;color:#556171}.hdy-insight-card p{margin:0}.hdy-insight-card ul{margin:0;padding-left:17px}.hdy-commit-list{display:flex;flex-direction:column;max-height:390px;overflow:auto}.hdy-commit-list a{display:grid;grid-template-columns:55px 1fr;gap:7px;padding:7px 0;border-bottom:1px solid #f0eee9;text-decoration:none;color:#4c5968;font-size:10px}.hdy-commit-list code{color:var(--hdy-blue)}.hdy-commit-list span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.hdy-meta{display:flex;flex-direction:column;gap:3px;color:var(--hdy-muted);font-size:9px;padding:5px}.hdy-empty{min-height:480px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;background:#fff;border:1px solid var(--hdy-line)}.hdy-empty-icon{display:grid;place-items:center;width:70px;height:70px;border:1px solid var(--hdy-ink);font:800 20px ui-monospace,monospace}.hdy-empty h2{margin:18px 0 7px}.hdy-empty p{max-width:400px;margin:0 0 18px;color:var(--hdy-muted);font-size:12px}.hdy-empty-small{padding:20px 10px;color:var(--hdy-muted);font-size:11px}.hdy-empty-card{padding:28px;border:1px dashed #ccc7bc;color:var(--hdy-muted);font-size:12px;background:#faf9f6}@media(max-width:1050px){.hdy-header{padding:24px}.hdy-subbar{padding:10px 24px}.hdy-main{grid-template-columns:180px minmax(0,1fr);padding:24px}.hdy-report-grid{grid-template-columns:1fr}.hdy-insights{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.hdy-insights>.hdy-heading,.hdy-insights>.hdy-meta{grid-column:1/-1}.hdy-insight-card{margin:0}}@media(max-width:760px){.hdy-header{align-items:flex-start;flex-direction:column}.hdy-actions{width:100%;flex-wrap:wrap}.hdy-model{flex:1}.hdy-subbar{align-items:flex-start;flex-direction:column}.hdy-main{display:block;padding:18px}.hdy-history{display:flex;gap:7px;overflow:auto;margin-bottom:18px}.hdy-history>.hdy-section-title,.hdy-schedule-note{display:none}.hdy-history-item{min-width:150px;border-left:0;border-top:2px solid transparent}.hdy-history-item.active{border-left:0;border-top-color:var(--hdy-red)}.hdy-hero{grid-template-columns:1fr}.hdy-date-block{border-right:0;border-bottom:1px solid var(--hdy-line)}.hdy-stats{grid-template-columns:repeat(2,1fr)}.hdy-stat:nth-child(2){border-right:0}.hdy-stat:nth-child(-n+2){border-bottom:1px solid var(--hdy-line)}.hdy-insights{display:block}.hdy-insight-card{margin-bottom:12px}}@media(max-width:480px){.hdy-header{padding:19px}.hdy-actions{align-items:stretch;flex-direction:column}.hdy-model{max-width:none}.hdy-primary{width:100%}.hdy-hero-copy{padding:20px}.hdy-hero h2{font-size:20px}}
.hdy-root{position:relative;display:flex;flex-direction:column;width:100%;height:100%;max-height:100%;min-height:0;overflow:hidden}.hdy-header,.hdy-subbar,.hdy-message,.hdy-error{flex:none}.hdy-main{flex:1;min-height:0;overflow:auto;align-content:start}.hdy-secondary{border:1px solid var(--hdy-line);border-radius:8px;background:#fff;color:var(--hdy-ink);padding:10px 14px;font-weight:750;cursor:pointer}.hdy-secondary:hover{background:#f3f1eb}.hdy-secondary:focus-visible,.hdy-icon-button:focus-visible,.hdy-workspace-list button:focus-visible{outline:3px solid #79a7f5;outline-offset:2px}.hdy-live.inactive{background:#f0ece4;color:#7a7063}.hdy-workspace-chip{max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.hdy-overlay,.hdy-conversation-layer{position:absolute;inset:0;z-index:40}.hdy-overlay{display:grid;place-items:center;padding:24px;background:#17202d66;backdrop-filter:blur(5px)}.hdy-setup-dialog{position:relative;width:min(620px,100%);max-height:calc(100% - 24px);overflow:auto;padding:30px;border:1px solid var(--hdy-line);border-radius:14px;background:#fff;box-shadow:0 28px 80px #11182733}.hdy-setup-kicker{color:var(--hdy-red);font-size:10px;font-weight:900;letter-spacing:.16em}.hdy-setup-dialog h2{margin:9px 36px 8px 0;font-size:24px}.hdy-setup-dialog>p{margin:0 0 20px;color:var(--hdy-muted);font-size:13px;line-height:1.7}.hdy-setup-dialog>small{display:block;margin-top:10px;color:var(--hdy-muted);font-size:10px;line-height:1.5}.hdy-icon-button{display:grid;place-items:center;width:34px;height:34px;border:1px solid var(--hdy-line);border-radius:8px;background:#fff;color:var(--hdy-ink);font-size:22px;line-height:1;cursor:pointer}.hdy-setup-dialog>.hdy-icon-button{position:absolute;top:22px;right:22px}.hdy-workspace-list{display:grid;gap:8px;max-height:260px;overflow:auto;margin-bottom:14px}.hdy-workspace-list button{display:flex;flex-direction:column;gap:4px;width:100%;padding:13px 15px;text-align:left;border:1px solid var(--hdy-line);border-radius:9px;background:#faf9f6;cursor:pointer}.hdy-workspace-list button:hover{border-color:#b9b2a7;background:#f4f1e9}.hdy-workspace-list button b{font-size:13px}.hdy-workspace-list button span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--hdy-muted);font-size:10px}.hdy-wide{width:100%}.hdy-conversation-layer{display:flex;justify-content:flex-end;visibility:hidden;pointer-events:none;background:transparent;transition:visibility .2s}.hdy-conversation-layer.open{visibility:visible;pointer-events:auto}.hdy-conversation-backdrop{position:absolute;inset:0;border:0;background:#17202d66;opacity:0;transition:opacity .2s;cursor:default}.hdy-conversation-layer.open .hdy-conversation-backdrop{opacity:1}.hdy-conversation-drawer{position:relative;display:flex;flex-direction:column;width:min(680px,100%);height:100%;background:#fff;box-shadow:-24px 0 70px #11182730;transform:translateX(100%);transition:transform .24s ease;overflow:hidden}.hdy-conversation-layer.open .hdy-conversation-drawer{transform:translateX(0)}.hdy-conversation-bar{display:flex;align-items:center;justify-content:space-between;gap:18px;min-height:68px;padding:13px 18px;border-bottom:1px solid var(--hdy-line);background:#fbfaf7}.hdy-conversation-bar>div{display:flex;flex-direction:column;gap:3px}.hdy-conversation-bar b{font-size:13px}.hdy-conversation-bar span{color:var(--hdy-muted);font-size:10px}.hdy-conversation-content{display:flex;flex:1;min-height:0;min-width:0;overflow:hidden}.hdy-conversation-content>*{flex:1;min-height:0;min-width:0}@media(max-width:680px){.hdy-overlay{padding:10px}.hdy-setup-dialog{padding:24px 18px}.hdy-conversation-drawer{width:100%}.hdy-actions{align-items:stretch}.hdy-secondary{width:100%}.hdy-workspace-chip{display:none}}
.hdy-mini-add{display:grid;place-items:center;width:24px;height:24px;border:1px solid var(--hdy-line);border-radius:6px;background:#fff;color:var(--hdy-ink);cursor:pointer}.hdy-target-list{display:grid;gap:7px;margin-bottom:10px}.hdy-target-item{display:flex;align-items:center;gap:9px;width:100%;padding:9px;border:1px solid transparent;border-radius:8px;background:transparent;text-align:left;cursor:pointer}.hdy-target-item:hover{background:#fff}.hdy-target-item.active{border-color:#d8d3c9;background:#fff;box-shadow:0 5px 16px #2230470a}.hdy-target-item.disabled{opacity:.55}.hdy-target-type{display:grid;place-items:center;width:32px;height:28px;border-radius:6px;background:#e9edf5;color:#405678;font-size:9px;font-weight:900}.hdy-target-copy{display:flex;flex-direction:column;min-width:0;gap:2px}.hdy-target-copy b,.hdy-target-copy small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.hdy-target-copy b{font-size:11px}.hdy-target-copy small{color:var(--hdy-muted);font-size:9px}.hdy-target-actions{display:flex;gap:6px;margin:0 0 14px;padding:0 3px}.hdy-target-actions button{border:0;background:transparent;color:var(--hdy-blue);padding:3px;font-size:9px;cursor:pointer}.hdy-target-actions button.danger{color:#b63d31}.hdy-nav-divider{height:1px;margin:5px 0 15px;background:var(--hdy-line)}.hdy-field{display:grid;gap:7px;margin:0 0 15px}.hdy-field>span{font-size:11px;font-weight:800}.hdy-field input{width:100%;height:42px;padding:0 12px;border:1px solid #d7d3cb;border-radius:8px;background:#fff;color:var(--hdy-ink);font:inherit;outline:none}.hdy-field input:focus{border-color:#6c91d6;box-shadow:0 0 0 3px #79a7f52b}.hdy-form-error{margin:-4px 0 12px;padding:9px 11px;border-radius:7px;background:#fff0ed;color:#a63a2e;font-size:11px}.hdy-target-dialog .hdy-primary{margin-top:4px}.hdy-target-picker{position:relative;margin-bottom:14px}.hdy-target-picker-button,.hdy-target-picker-empty{display:flex;align-items:center;gap:10px;width:100%;min-height:54px;padding:9px 11px;border:1px solid #d8d4cc;border-radius:9px;background:#fff;text-align:left;cursor:pointer;box-shadow:0 4px 14px #22304708}.hdy-target-picker-button.open{border-color:#aebbd2;box-shadow:0 0 0 3px #79a7f51f}.hdy-target-picker-button .hdy-target-copy{flex:1}.hdy-target-chevron{color:var(--hdy-muted);font-size:18px;line-height:1;transform:translateY(-2px)}.hdy-target-picker-button.open .hdy-target-chevron{transform:rotate(180deg) translateY(2px)}.hdy-target-picker-empty{justify-content:center;color:var(--hdy-blue);font-size:10px;font-weight:800}.hdy-target-menu{position:absolute;z-index:20;top:calc(100% + 7px);left:0;width:max(100%,250px);padding:6px;border:1px solid #d8d4cc;border-radius:10px;background:#fff;box-shadow:0 16px 40px #17202d26}.hdy-target-menu>button{display:flex;align-items:center;gap:9px;width:100%;padding:9px;border:0;border-radius:7px;background:#fff;text-align:left;cursor:pointer}.hdy-target-menu>button:hover,.hdy-target-menu>button.selected{background:#f3f1eb}.hdy-target-menu>button.disabled{opacity:.55}.hdy-target-menu .hdy-target-copy{flex:1}.hdy-target-check{color:var(--hdy-green);font-weight:900}.hdy-target-menu>button.hdy-target-menu-add{justify-content:center;margin-top:5px;border-top:1px solid var(--hdy-line);border-radius:0 0 7px 7px;color:var(--hdy-blue);font-size:10px;font-weight:800}.hdy-target-manager{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:18px;padding:13px 15px;border:1px solid #dedbd4;border-radius:10px;background:#fff;box-shadow:0 6px 18px #2230470a}.hdy-target-manager-copy{display:flex;align-items:center;gap:11px;min-width:0}.hdy-target-manager-copy>div{display:grid;gap:3px;min-width:0}.hdy-target-manager-copy b{font-size:12px}.hdy-target-manager-copy a{max-width:520px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--hdy-muted);font-size:10px;text-decoration:none}.hdy-target-manager-actions{display:flex;align-items:center;gap:7px;flex:none}.hdy-target-manager-actions button{padding:7px 9px;border:1px solid var(--hdy-line);border-radius:7px;background:#faf9f6;color:var(--hdy-ink);font-size:10px;font-weight:700;cursor:pointer}.hdy-target-manager-actions button:hover{background:#f0eee8}.hdy-target-manager-actions button.danger{color:#b63d31}@media(max-width:900px){.hdy-actions{flex-wrap:wrap;justify-content:flex-end}.hdy-model{display:none}.hdy-target-manager{align-items:flex-start;flex-direction:column}.hdy-target-manager-actions{flex-wrap:wrap}} 
.hdy-main{width:100%;max-width:none}.hdy-main-detail{display:grid;grid-template-columns:220px minmax(0,1fr)}.hdy-main-overview{display:block;padding:28px 36px 56px}.hdy-overview{width:100%;min-width:0}.hdy-overview-head{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin-bottom:20px}.hdy-overview-kicker{color:#8a8174;font-size:10px;font-weight:900;letter-spacing:.16em}.hdy-overview-head h2{margin:7px 0 3px;font-size:28px;letter-spacing:-.04em}.hdy-overview-head p{margin:0;color:var(--hdy-muted);font-size:12px}.hdy-month-controls{display:flex;align-items:center;gap:7px}.hdy-month-controls button{height:36px;min-width:38px;padding:0 12px;border:1px solid var(--hdy-line);border-radius:8px;background:#fff;color:var(--hdy-ink);font-weight:800;cursor:pointer}.hdy-month-controls button:hover:not(:disabled){background:#efede7}.hdy-month-controls button.label{min-width:88px;font-size:11px}.hdy-month-controls button:disabled{color:#a7a096;cursor:default}.hdy-calendar-scroll{overflow:auto;border:1px solid var(--hdy-line);border-radius:12px;background:#fff;box-shadow:0 12px 36px #342f270d}.hdy-calendar-grid{display:grid;grid-template-columns:190px repeat(var(--hdy-days),minmax(30px,1fr));align-items:stretch}.hdy-calendar-corner,.hdy-day-head{position:sticky;top:0;z-index:3;display:flex;align-items:center;justify-content:center;min-height:56px;border-bottom:1px solid var(--hdy-line);background:#faf9f6}.hdy-calendar-corner{left:0;z-index:5;justify-content:flex-start;padding:0 16px;color:var(--hdy-muted);font-size:10px;font-weight:800;letter-spacing:.08em}.hdy-day-head{flex-direction:column;gap:2px;border-left:1px solid #efede8}.hdy-day-head b{font-size:11px}.hdy-day-head small{color:#a0998e;font-size:8px}.hdy-day-head.weekend{background:#f6f3ed}.hdy-day-head.today{color:var(--hdy-red);box-shadow:inset 0 -2px var(--hdy-red)}.hdy-calendar-product{position:sticky;left:0;z-index:2;display:flex;align-items:center;gap:10px;min-width:0;min-height:58px;padding:8px 14px;border:0;border-bottom:1px solid var(--hdy-line);background:#fff;text-align:left;cursor:pointer}.hdy-calendar-product:hover{background:#faf8f3}.hdy-calendar-product.paused{opacity:.55}.hdy-calendar-product>span:last-child{display:flex;min-width:0;flex-direction:column;gap:2px}.hdy-calendar-product b,.hdy-calendar-product small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.hdy-calendar-product b{font-size:11px}.hdy-calendar-product small{color:var(--hdy-muted);font-size:9px}.hdy-day-cell{display:grid;place-items:center;min-width:30px;min-height:58px;border:0;border-left:1px solid #f0eee9;border-bottom:1px solid var(--hdy-line);background:#fff;color:#a9a399;font-size:10px;font-weight:900}.hdy-day-cell:disabled{cursor:default}.hdy-day-cell.checked{background:#f1efe9;color:#aaa397;cursor:pointer}.hdy-day-cell.checked:hover{box-shadow:inset 0 0 0 2px #c8c1b6}.hdy-day-cell.updated{color:#fff;cursor:pointer}.hdy-day-cell.updated.low{background:#e89380}.hdy-day-cell.updated.medium{background:#df654e}.hdy-day-cell.updated.high{background:#b93628}.hdy-day-cell.updated:hover{filter:brightness(.92);box-shadow:inset 0 0 0 2px #ffffff80}.hdy-day-cell.today{box-shadow:inset 0 0 0 1px #dd4a3266}.hdy-calendar-legend{display:flex;justify-content:flex-end;flex-wrap:wrap;gap:16px;margin-top:12px;color:var(--hdy-muted);font-size:10px}.hdy-calendar-legend span{display:flex;align-items:center;gap:6px}.hdy-calendar-legend i{width:13px;height:13px;border:1px solid var(--hdy-line);border-radius:3px;background:#fff}.hdy-calendar-legend i.checked{background:#f1efe9}.hdy-calendar-legend i.low{background:#e89380}.hdy-calendar-legend i.medium{background:#df654e}.hdy-calendar-legend i.high{background:#b93628}.hdy-overview-empty{display:grid;place-items:center;min-height:420px;padding:50px;border:1px dashed #d8d3c9;border-radius:12px;background:#fff;text-align:center}.hdy-overview-empty>div{display:grid;place-items:center;width:56px;height:56px;border-radius:50%;background:#ece8df;color:var(--hdy-red);font-size:26px}.hdy-overview-empty h3{margin:14px 0 5px}.hdy-overview-empty p{margin:0 0 18px;color:var(--hdy-muted);font-size:12px}@media(max-width:1050px){.hdy-main-detail{grid-template-columns:180px minmax(0,1fr)}}@media(max-width:760px){.hdy-main-detail{display:block}.hdy-main-overview{padding:18px}.hdy-overview-head{align-items:flex-start;flex-direction:column}.hdy-calendar-grid{grid-template-columns:150px repeat(var(--hdy-days),32px)}.hdy-calendar-product{padding:8px}.hdy-calendar-corner{padding:0 10px}}
`
