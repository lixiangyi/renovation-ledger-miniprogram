const { uid, PaymentType, PaymentStatus } = require('./model')
const { defaultTaxonomy, normalizeTaxonomy } = require('./taxonomy')

const STORAGE_KEY = 'renovation_ledger_v1'

function defaultPrefs() {
  return {
    nickname: '我',
    healthColorEnabled: true,
    mildOverMaxPercent: 15,
    taxonomy: defaultTaxonomy(),
  }
}

function defaultProject() {
  return {
    id: uid('proj'),
    name: '我家装修',
    memberNames: ['我'],
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

function getTaxonomy() {
  return normalizeTaxonomy(getState().prefs.taxonomy)
}

function setTaxonomy(partial) {
  const current = getTaxonomy()
  return setPrefs({
    taxonomy: normalizeTaxonomy(Object.assign({}, current, partial)),
  })
}

function addTaxonomyOption(kind, value) {
  const trimmed = String(value || '').trim()
  if (!trimmed) return getState()
  const taxonomy = getTaxonomy()
  const list = (taxonomy[kind] || []).slice()
  if (list.indexOf(trimmed) < 0) list.push(trimmed)
  taxonomy[kind] = list
  return setPrefs({ taxonomy })
}

function renameTaxonomyOption(kind, oldValue, newValue) {
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
  return setPrefs({ taxonomy })
}

function removeTaxonomyOption(kind, value) {
  const taxonomy = getTaxonomy()
  taxonomy[kind] = (taxonomy[kind] || []).filter((v) => v !== value)
  return setPrefs({ taxonomy })
}

function resetTaxonomyKind(kind) {
  const defaults = defaultTaxonomy()
  const taxonomy = getTaxonomy()
  taxonomy[kind] = defaults[kind].slice()
  return setPrefs({ taxonomy })
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

function createProject(name, nickname) {
  const raw = ensureRaw()
  const project = {
    id: uid('proj'),
    name: String(name || '').trim() || '新账本',
    memberNames: [String(nickname || raw.prefs.nickname || '我').trim() || '我'],
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
  return upsertItems([item])
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
      note: p.note || '',
      createdBy: p.createdBy || '',
    }))
    return {
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
    }
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
  return viewOf(raw)
}

function getItem(id) {
  return ensureRaw().items.find((i) => i.id === id) || null
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
  const lines = ['项名称,阶段,分类,预算元,合同元,状态,付款类型,付款金额元,付款状态,日期,记账人']
  state.items.forEach((item) => {
    const st = statusLabel(deriveStatus(item))
    const budget = ((item.budgetAmount || 0) / 100).toFixed(2)
    const contract = item.contractAmount == null ? '' : (item.contractAmount / 100).toFixed(2)
    if (!item.payments || !item.payments.length) {
      lines.push([item.name, item.stage, item.category || '', budget, contract, st, '', '', '', '', ''].join(','))
    } else {
      item.payments.forEach((p) => {
        const date = p.paidAtEpochMs
          ? new Date(p.paidAtEpochMs).toISOString().slice(0, 10)
          : ''
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
          date,
          p.createdBy || '',
        ].join(','))
      })
    }
  })
  return lines.join('\n')
}

module.exports = {
  STORAGE_KEY,
  ensureInitialized,
  getState,
  setPrefs,
  setProject,
  switchProject,
  createProject,
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
  write,
  getTaxonomy,
  setTaxonomy,
  addTaxonomyOption,
  renameTaxonomyOption,
  removeTaxonomyOption,
  resetTaxonomyKind,
}
