const { uid, PaymentType, PaymentStatus } = require('./model')
const { defaultTaxonomy, normalizeTaxonomy } = require('./taxonomy')
const { pushHistory } = require('./search')

const STORAGE_KEY = 'renovation_ledger_v1'

function defaultPrefs() {
  return {
    nickname: '我',
    avatarPath: '',
    healthColorEnabled: true,
    mildOverMaxPercent: 15,
    taxonomy: defaultTaxonomy(),
    paymentListGroupBy: 'stage',
    paymentListLayout: 'nested',
    searchHistory: [],
    jwt: '',
    cloudUserId: '',
    pendingItemIds: [],
    pendingSync: false,
  }
}

function defaultProject() {
  return {
    id: uid('proj'),
    name: '我家装修',
    memberNames: ['我'],
    cloudLedgerId: '',
    cloudRevision: 0,
    cloudLinkedAtEpochMs: 0,
  }
}

/** 精简示例数据（可被「重置示例」覆盖） */
function sampleItems(projectId, nickname) {
  const mk = (name, stage, yuan, settled) => {
    const id = uid('item')
    const amount = Math.round(yuan * 100)
    const payments = settled
      ? [{
        id: uid('pay'),
        budgetItemId: id,
        type: PaymentType.OTHER,
        amount,
        status: PaymentStatus.PAID,
        paidAtEpochMs: Date.now(),
        paidOnDate: require('./operationTimes').today(Date.now()),
        note: '结清补差',
        createdBy: nickname,
      }]
      : []
    return {
      id,
      projectId,
      name,
      stage,
      category: stage,
      space: '',
      budgetAmount: amount,
      contractAmount: amount,
      merchant: '',
      recordedDate: '2026-06-01',
      remark: '',
      isNewAddition: true,
      payments,
    }
  }
  return [
    mk('全屋定制', '全屋定制', 105500, true),
    mk('电视', '家电', 22000, true),
    mk('窗帘', '软装', 8000, false),
    mk('瓷砖', '硬装', 15000, false),
    mk('沙发', '家具', 12000, true),
    mk('空调', '家电', 18000, false),
    mk('灯具', '软装', 3500, true),
    mk('卫浴洁具', '卫浴', 9800, false),
  ]
}

function emptyRaw() {
  const prefs = defaultPrefs()
  const project = defaultProject()
  project.memberNames = [prefs.nickname]
  return {
    prefs,
    projects: [project],
    currentProjectId: project.id,
    items: sampleItems(project.id, prefs.nickname),
  }
}

/** 内存全量：projects + 全部 items */
var rawCache = null

function migrateRaw(raw) {
  if (!raw) return null
  const prefs = Object.assign(defaultPrefs(), raw.prefs || {})
  prefs.taxonomy = normalizeTaxonomy(prefs.taxonomy)

  // 旧版：单 project
  if (raw.project && !Array.isArray(raw.projects)) {
    const project = raw.project
    return {
      prefs,
      projects: [project],
      currentProjectId: project.id,
      items: Array.isArray(raw.items) ? raw.items : [],
    }
  }

  if (Array.isArray(raw.projects) && Array.isArray(raw.items)) {
    let currentProjectId = raw.currentProjectId
    if (!currentProjectId || !raw.projects.some((p) => p.id === currentProjectId)) {
      currentProjectId = raw.projects[0] && raw.projects[0].id
    }
    return {
      prefs,
      projects: raw.projects,
      currentProjectId,
      items: raw.items,
    }
  }
  return null
}

function readRaw() {
  try {
    const raw = wx.getStorageSync(STORAGE_KEY)
    return migrateRaw(raw)
  } catch (e) {
    console.warn('read storage failed', e)
    return null
  }
}

function writeRaw(raw) {
  rawCache = raw
  wx.setStorageSync(STORAGE_KEY, {
    prefs: raw.prefs,
    projects: raw.projects,
    currentProjectId: raw.currentProjectId,
    items: raw.items,
  })
}

function ensureRaw() {
  if (rawCache) return rawCache
  let raw = readRaw()
  if (!raw || !raw.projects.length) {
    raw = emptyRaw()
    writeRaw(raw)
  } else {
    rawCache = raw
  }
  return rawCache
}

function viewOf(raw) {
  const projects = (raw.projects || []).filter(Boolean)
  let currentId = raw.currentProjectId
  if (!currentId || !projects.some((p) => p && p.id === currentId)) {
    currentId = projects[0] && projects[0].id
  }
  const project = projects.find((p) => p.id === currentId) || projects[0] || {
    id: 'fallback',
    name: '我家装修',
    memberNames: ['我'],
  }
  if (!project.name) project.name = '我家装修'
  if (!Array.isArray(project.memberNames)) project.memberNames = ['我']
  if (!project.cloudLedgerId) project.cloudLedgerId = ''
  if (project.cloudRevision == null) project.cloudRevision = 0
  if (project.cloudLinkedAtEpochMs == null) project.cloudLinkedAtEpochMs = 0
  const items = (raw.items || []).filter((i) => i && i.projectId === project.id)
  return {
    prefs: raw.prefs || defaultPrefs(),
    projects: projects.length ? projects : [project],
    currentProjectId: project.id,
    project,
    items,
  }
}

function ensureInitialized() {
  return viewOf(ensureRaw())
}

function getState() {
  return ensureInitialized()
}

function write(view) {
  // 兼容旧调用：传入的 view.items 是当前账本；需合并进全量
  const raw = ensureRaw()
  const currentId = (view.project && view.project.id) || view.currentProjectId || raw.currentProjectId
  const otherItems = (raw.items || []).filter((i) => i.projectId !== currentId)
  const nextProjects = view.projects || raw.projects
  // 更新当前 project 对象
  const projects = nextProjects.map((p) => {
    if (view.project && p.id === view.project.id) return view.project
    return p
  })
  writeRaw({
    prefs: view.prefs || raw.prefs,
    projects,
    currentProjectId: currentId,
    items: otherItems.concat(view.items || []),
  })
  return viewOf(rawCache)
}

function setPrefs(partial) {
  const raw = ensureRaw()
  const next = Object.assign({}, raw.prefs, partial)
  if (partial && partial.taxonomy) {
    next.taxonomy = normalizeTaxonomy(partial.taxonomy)
  }
  raw.prefs = next
  writeRaw(raw)
  return viewOf(raw)
}

function addSearchHistory(query) {
  const raw = ensureRaw()
  const existing = Array.isArray(raw.prefs.searchHistory) ? raw.prefs.searchHistory : []
  return setPrefs({ searchHistory: pushHistory(existing, query) })
}

function clearSearchHistory() {
  return setPrefs({ searchHistory: [] })
}

function getTaxonomy() {
  return normalizeTaxonomy(getState().prefs.taxonomy)
}

function setTaxonomy(partial) {
  const current = getTaxonomy()
  return setPrefs({
    taxonomy: normalizeTaxonomy(Object.assign({}, current, partial)),
  })
}

function addTaxonomyOption(kind, value, icon) {
  const trimmed = String(value || '').trim()
  if (!trimmed) return getState()
  const taxonomy = getTaxonomy()
  const list = (taxonomy[kind] || []).slice()
  if (list.indexOf(trimmed) < 0) list.push(trimmed)
  taxonomy[kind] = list
  if (icon) {
    taxonomy.icons = taxonomy.icons || { stages: {}, categories: {}, spaces: {} }
    taxonomy.icons[kind] = Object.assign({}, taxonomy.icons[kind], { [trimmed]: icon })
  }
  return setPrefs({ taxonomy })
}

function renameTaxonomyOption(kind, oldValue, newValue, icon) {
  const trimmed = String(newValue || '').trim()
  if (!trimmed) return getState()
  const taxonomy = getTaxonomy()
  const list = (taxonomy[kind] || []).slice()
  const index = list.indexOf(oldValue)
  if (index < 0) return getState()
  if (trimmed !== oldValue && list.indexOf(trimmed) >= 0) {
    list.splice(index, 1)
  } else {
    list[index] = trimmed
  }
  taxonomy[kind] = list

  taxonomy.icons = taxonomy.icons || { stages: {}, categories: {}, spaces: {} }
  const iconMap = Object.assign({}, taxonomy.icons[kind])
  const carried = iconMap[oldValue]
  if (trimmed !== oldValue) delete iconMap[oldValue]
  const finalIcon = icon !== undefined ? icon : carried
  if (finalIcon) {
    iconMap[trimmed] = finalIcon
  } else {
    delete iconMap[trimmed]
  }
  taxonomy.icons[kind] = iconMap

  return setPrefs({ taxonomy })
}

function removeTaxonomyOption(kind, value) {
  const taxonomy = getTaxonomy()
  taxonomy[kind] = (taxonomy[kind] || []).filter((v) => v !== value)
  if (taxonomy.icons && taxonomy.icons[kind]) {
    const iconMap = Object.assign({}, taxonomy.icons[kind])
    delete iconMap[value]
    taxonomy.icons[kind] = iconMap
  }
  return setPrefs({ taxonomy })
}

function resetTaxonomyKind(kind) {
  const defaults = defaultTaxonomy()
  const taxonomy = getTaxonomy()
  taxonomy[kind] = defaults[kind].slice()
  taxonomy.icons = taxonomy.icons || { stages: {}, categories: {}, spaces: {} }
  taxonomy.icons[kind] = {}
  return setPrefs({ taxonomy })
}

/** 单独设置/清除某个标签值的图标（不改名）。icon 为空/undefined 即清除。 */
function setTaxonomyIcon(kind, value, icon) {
  const trimmed = String(value || '').trim()
  if (!trimmed) return getState()
  const taxonomy = getTaxonomy()
  taxonomy.icons = taxonomy.icons || { stages: {}, categories: {}, spaces: {} }
  const iconMap = Object.assign({}, taxonomy.icons[kind])
  if (icon) {
    iconMap[trimmed] = icon
  } else {
    delete iconMap[trimmed]
  }
  taxonomy.icons[kind] = iconMap
  return setPrefs({ taxonomy })
}

/** 按 kind + value 取图标引用（{iconKey}|{iconPath}|null）。 */
function getTaxonomyIcon(kind, value) {
  const taxonomy = getTaxonomy()
  return (taxonomy.icons && taxonomy.icons[kind] && taxonomy.icons[kind][value]) || null
}

function setProject(partial) {
  const raw = ensureRaw()
  const idx = raw.projects.findIndex((p) => p.id === raw.currentProjectId)
  if (idx < 0) return viewOf(raw)
  raw.projects[idx] = Object.assign({}, raw.projects[idx], partial)
  writeRaw(raw)
  return viewOf(raw)
}

function switchProject(projectId) {
  const raw = ensureRaw()
  if (!raw.projects.some((p) => p.id === projectId)) return viewOf(raw)
  raw.currentProjectId = projectId
  writeRaw(raw)
  return viewOf(raw)
}

function addCloudPlaceholder(summary) {
  if (!summary || !summary.id) return getState()
  const raw = ensureRaw()
  if ((raw.projects || []).some((p) => p.cloudLedgerId === summary.id || p.id === summary.id)) {
    return viewOf(raw)
  }
  raw.projects.push({
    id: summary.id,
    name: summary.name || '云账本',
    memberNames: [],
    cloudLedgerId: summary.id,
    cloudRevision: summary.revision || 0,
    cloudLinkedAtEpochMs: summary.createdAtEpochMs || Date.now(),
  })
  writeRaw(raw)
  return viewOf(raw)
}

function createProject(name, nickname) {
  const raw = ensureRaw()
  const project = {
    id: uid('proj'),
    name: String(name || '').trim() || '新账本',
    memberNames: [String(nickname || raw.prefs.nickname || '我').trim() || '我'],
    cloudLedgerId: '',
    cloudRevision: 0,
    cloudLinkedAtEpochMs: 0,
  }
  raw.projects.push(project)
  raw.currentProjectId = project.id
  writeRaw(raw)
  return viewOf(raw)
}

function createProjectForImport() {
  const now = new Date()
  const stamp = (now.getMonth() + 1) + '/' + now.getDate() + ' '
    + String(now.getHours()).padStart(2, '0') + ':'
    + String(now.getMinutes()).padStart(2, '0')
  return createProject('导入账本 ' + stamp)
}

function renameProject(projectId, name) {
  const raw = ensureRaw()
  const trimmed = String(name || '').trim()
  if (!trimmed) return viewOf(raw)
  const idx = raw.projects.findIndex((p) => p.id === projectId)
  if (idx < 0) return viewOf(raw)
  raw.projects[idx] = Object.assign({}, raw.projects[idx], { name: trimmed })
  writeRaw(raw)
  return viewOf(raw)
}

function upsertItems(items) {
  const raw = ensureRaw()
  items.forEach((item) => {
    const idx = raw.items.findIndex((i) => i.id === item.id)
    if (idx >= 0) raw.items[idx] = item
    else raw.items.unshift(item)
  })
  writeRaw(raw)
  return viewOf(raw)
}

function upsertItem(item) {
  const view = upsertItems([item])
  if (item && item.id) {
    try {
      require('./sync').pushItem(item.id).catch(function () { /* toast in sync */ })
    } catch (e) { /* ignore */ }
  }
  return view
}

function importDraftsAsToBuy(drafts, options) {
  options = options || {}
  if (options.createNewLedger !== false) {
    createProjectForImport()
  }
  const state = getState()
  const projectId = state.project.id
  const selected = (drafts || []).filter((d) => d.selected !== false)
  const items = selected.map((d) => {
    const itemId = uid('item')
    const budget = d.budgetCents != null ? d.budgetCents : d.amountCents
    const contract = Object.prototype.hasOwnProperty.call(d, 'contractCents')
      ? d.contractCents
      : d.amountCents
    const payments = (d.payments || []).map((p) => ({
      id: uid('pay'),
      budgetItemId: itemId,
      type: p.type,
      amount: p.amountCents != null ? p.amountCents : p.amount,
      status: p.status,
      paidAtEpochMs: p.paidAtEpochMs || null,
      paidOnDate: p.paidOnDate || null,
      note: p.note || '',
      createdBy: p.createdBy || '',
    }))
    return require('./operationTimes').backfill({
      id: itemId,
      projectId,
      name: d.name,
      stage: d.stage,
      category: d.category || d.stage,
      space: '',
      budgetAmount: budget,
      contractAmount: contract,
      merchant: '',
      recordedDate: d.recordedDate || null,
      remark: d.remark || '',
      isNewAddition: true,
      payments,
    })
  })
  const raw = ensureRaw()
  items.reverse().forEach((item) => raw.items.unshift(item))
  writeRaw(raw)
  return { state: viewOf(raw), count: items.length }
}

function deleteItem(id) {
  const raw = ensureRaw()
  raw.items = raw.items.filter((i) => i.id !== id)
  writeRaw(raw)
  try {
    require('./sync').pushDelete(id).catch(function () { /* toast in sync */ })
  } catch (e) { /* ignore */ }
  return viewOf(raw)
}

function getItem(id) {
  const item = ensureRaw().items.find((i) => i.id === id) || null
  return item ? require('./operationTimes').backfill(item) : null
}

function resetSample() {
  const prevTaxonomy = (() => {
    try {
      return normalizeTaxonomy(getState().prefs.taxonomy)
    } catch (e) {
      return defaultTaxonomy()
    }
  })()
  const raw = emptyRaw()
  raw.prefs.taxonomy = prevTaxonomy
  writeRaw(raw)
  return viewOf(raw)
}

function clearAllItems() {
  const raw = ensureRaw()
  const currentId = raw.currentProjectId
  raw.items = raw.items.filter((i) => i.projectId !== currentId)
  writeRaw(raw)
  return viewOf(raw)
}

function exportCsv(state) {
  const { deriveStatus, statusLabel, paymentTypeLabel, paymentStatusLabel } = require('./model')
  const times = require('./operationTimes')
  const lines = ['项名称,阶段,分类,预算元,合同元,状态,付款类型,付款金额元,付款状态,日期,记账人,标记已付时间,结清日期,结清操作时间']
  state.items.forEach((item) => {
    const st = statusLabel(deriveStatus(item))
    const budget = ((item.budgetAmount || 0) / 100).toFixed(2)
    const contract = item.contractAmount == null ? '' : (item.contractAmount / 100).toFixed(2)
    const settledAt = item.settledAtEpochMs ? times.formatDateTimeToMinute(item.settledAtEpochMs) : ''
    if (!item.payments || !item.payments.length) {
      lines.push([item.name, item.stage, item.category || '', budget, contract, st, '', '', '', '', '', '', item.settledOnDate || '', settledAt].join(','))
    } else {
      item.payments.forEach((p) => {
        const marked = p.paidAtEpochMs ? times.formatDateTimeToMinute(p.paidAtEpochMs) : ''
        lines.push([
          item.name,
          item.stage,
          item.category || '',
          budget,
          contract,
          st,
          paymentTypeLabel(p.type),
          (p.amount / 100).toFixed(2),
          paymentStatusLabel(p.status),
          p.paidOnDate || '',
          p.createdBy || '',
          marked,
          item.settledOnDate || '',
          settledAt,
        ].join(','))
      })
    }
  })
  return lines.join('\n')
}

function snapshotProjectForTrash(projectId) {
  const raw = ensureRaw()
  const project = raw.projects.find((p) => p.id === projectId)
  if (!project) throw new Error('账本不存在')
  const items = raw.items.filter((i) => i.projectId === projectId)
  const payments = []
  items.forEach((item) => {
    ;(item.payments || []).forEach((p) => payments.push(Object.assign({}, p)))
  })
  const itemsBare = items.map((item) => {
    const copy = Object.assign({}, item)
    copy.payments = []
    return copy
  })
  return { project: Object.assign({}, project), items: itemsBare, payments }
}

function moveProjectToTrash(projectId) {
  const trashCsv = require('./trashCsv')
  const trashStore = require('./trashStore')
  const snapshot = snapshotProjectForTrash(projectId)
  const csvText = trashCsv.encode(snapshot)
  trashStore.writeTrash(
    projectId,
    snapshot.project.name,
    snapshot.items.length,
    csvText,
  )
  const raw = ensureRaw()
  raw.projects = raw.projects.filter((p) => p.id !== projectId)
  raw.items = raw.items.filter((i) => i.projectId !== projectId)
  if (!raw.projects.length) {
    writeRaw(raw)
    return createProject('新账本')
  }
  if (raw.currentProjectId === projectId || !raw.projects.some((p) => p.id === raw.currentProjectId)) {
    raw.currentProjectId = raw.projects[0].id
  }
  writeRaw(raw)
  return viewOf(raw)
}

/**
 * 移入垃圾箱并与账号解绑（OWNER 软删 / EDITOR leave）。返回 Promise。
 */
function moveProjectToTrashAsync(projectId) {
  const trashCsv = require('./trashCsv')
  const trashStore = require('./trashStore')
  const snapshot = snapshotProjectForTrash(projectId)
  const csvText = trashCsv.encode(snapshot)
  trashStore.writeTrash(
    projectId,
    snapshot.project.name,
    snapshot.items.length,
    csvText,
  )
  const cloudId = snapshot.project && snapshot.project.cloudLedgerId
  const jwt = !!((ensureRaw().prefs || {}).jwt)

  function removeLocal() {
    const raw = ensureRaw()
    raw.projects = raw.projects.filter((p) => p.id !== projectId)
    raw.items = raw.items.filter((i) => i.projectId !== projectId)
    if (!raw.projects.length) {
      writeRaw(raw)
      return createProject('新账本')
    }
    if (raw.currentProjectId === projectId || !raw.projects.some((p) => p.id === raw.currentProjectId)) {
      raw.currentProjectId = raw.projects[0].id
    }
    writeRaw(raw)
    return viewOf(raw)
  }

  if (cloudId && jwt) {
    return require('./sync').unbindCloudLedger(cloudId)
      .catch(function (err) {
        return { __unbindError: (err && err.message) || '云端解绑失败' }
      })
      .then(function (maybeErr) {
        const view = removeLocal()
        if (maybeErr && maybeErr.__unbindError) {
          const e = new Error('已移入垃圾箱，但云端解绑失败：' + maybeErr.__unbindError)
          e.partial = true
          e.view = view
          throw e
        }
        return view
      })
  }
  return Promise.resolve(removeLocal())
}

function restoreFromTrash(entryId) {
  const trashCsv = require('./trashCsv')
  const trashStore = require('./trashStore')
  const csvText = trashStore.readCsv(entryId)
  if (!csvText) throw new Error('垃圾箱备份文件不存在或已损坏')
  const snapshot = trashCsv.decode(csvText)
  if (!snapshot || !snapshot.project) throw new Error('垃圾箱备份无法解析')
  const raw = ensureRaw()
  let project = Object.assign({}, snapshot.project)
  let items = (snapshot.items || []).map((i) => Object.assign({}, i, { payments: [] }))
  const payments = snapshot.payments || []
  if (raw.projects.some((p) => p.id === project.id)) {
    const newId = uid('proj')
    project.id = newId
    items = items.map((i) => Object.assign({}, i, { projectId: newId }))
  }
  const paymentsByItem = {}
  payments.forEach((p) => {
    if (!paymentsByItem[p.budgetItemId]) paymentsByItem[p.budgetItemId] = []
    paymentsByItem[p.budgetItemId].push(Object.assign({}, p))
  })
  items = items.map((item) => Object.assign({}, item, {
    payments: paymentsByItem[item.id] || [],
  }))
  raw.projects.push(project)
  items.forEach((item) => raw.items.unshift(item))
  raw.currentProjectId = project.id
  writeRaw(raw)
  trashStore.removeEntry(entryId)
  return viewOf(raw)
}

function purgeTrashEntry(entryId) {
  require('./trashStore').removeEntry(entryId)
}

function listTrash() {
  return require('./trashStore').listEntries()
}

module.exports = {
  STORAGE_KEY,
  ensureInitialized,
  getState,
  setPrefs,
  setProject,
  switchProject,
  createProject,
  addCloudPlaceholder,
  createProjectForImport,
  renameProject,
  upsertItem,
  upsertItems,
  importDraftsAsToBuy,
  deleteItem,
  getItem,
  resetSample,
  clearAllItems,
  exportCsv,
  moveProjectToTrash,
  moveProjectToTrashAsync,
  restoreFromTrash,
  purgeTrashEntry,
  listTrash,
  write,
  addSearchHistory,
  clearSearchHistory,
  getTaxonomy,
  setTaxonomy,
  addTaxonomyOption,
  renameTaxonomyOption,
  removeTaxonomyOption,
  resetTaxonomyKind,
  setTaxonomyIcon,
  getTaxonomyIcon,
}
