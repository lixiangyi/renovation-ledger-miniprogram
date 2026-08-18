const api = require('./api')

function paymentToDto(p) {
  return {
    id: p.id,
    type: p.type,
    amount: p.amount,
    status: p.status,
    paidAtEpochMs: p.paidAtEpochMs || null,
    note: p.note || '',
    receiptUri: p.receiptUri || null,
    createdByName: p.createdBy || '',
  }
}

function paymentFromDto(p, itemId) {
  return {
    id: p.id,
    budgetItemId: itemId,
    type: p.type,
    amount: p.amount,
    status: p.status,
    paidAtEpochMs: p.paidAtEpochMs || null,
    note: p.note || '',
    receiptUri: p.receiptUri || null,
    createdBy: p.createdByName || p.createdBy || '',
  }
}

function itemToDto(item) {
  return {
    id: item.id,
    name: item.name,
    stage: item.stage,
    category: item.category,
    space: item.space || '',
    budgetAmount: item.budgetAmount || 0,
    contractAmount: item.contractAmount,
    merchant: item.merchant || '',
    recordedDate: item.recordedDate || null,
    remark: item.remark || '',
    isNewAddition: !!item.isNewAddition,
    payments: (item.payments || []).map(paymentToDto),
  }
}

function itemFromDto(dto, projectId) {
  return {
    id: dto.id,
    projectId: projectId,
    name: dto.name,
    stage: dto.stage,
    category: dto.category,
    space: dto.space || '',
    budgetAmount: dto.budgetAmount || 0,
    contractAmount: dto.contractAmount,
    merchant: dto.merchant || '',
    recordedDate: dto.recordedDate || null,
    remark: dto.remark || '',
    isNewAddition: !!dto.isNewAddition,
    payments: (dto.payments || []).map((p) => paymentFromDto(p, dto.id)),
  }
}

function taxonomyToDto(taxonomy) {
  const src = taxonomy || {}
  return {
    stages: src.stages || [],
    categories: src.categories || [],
    spaces: src.spaces || [],
    iconsJson: JSON.stringify(src.icons || { stages: {}, categories: {}, spaces: {} }),
  }
}

function parseIconsJson(iconsJson) {
  try {
    const parsed = JSON.parse(iconsJson || '{}')
    if (parsed && typeof parsed === 'object') return parsed
  } catch (e) { /* ignore */ }
  return { stages: {}, categories: {}, spaces: {} }
}

function applySnapshot(snapshot) {
  const store = require('./store')
  const state = store.getState()
  let project = (state.projects || []).find((p) => p.cloudLedgerId === snapshot.id)
  if (!project) {
    if (state.project && state.project.cloudLedgerId && state.project.cloudLedgerId !== snapshot.id) {
      store.createProject(snapshot.name)
    }
    project = store.getState().project
  } else if (project.id !== state.project.id) {
    store.switchProject(project.id)
    project = store.getState().project
  }
  const current = store.getState()
  const items = (snapshot.items || []).map((dto) => itemFromDto(dto, current.project.id))
  store.write({
    prefs: current.prefs,
    projects: current.projects,
    currentProjectId: current.project.id,
    project: Object.assign({}, current.project, {
      name: snapshot.name,
      cloudLedgerId: snapshot.id,
      cloudRevision: snapshot.revision,
    }),
    items: items,
  })
  const tax = snapshot.taxonomy
  if (tax && (tax.stages && tax.stages.length || tax.categories && tax.categories.length || tax.spaces && tax.spaces.length)) {
    store.setTaxonomy({
      stages: tax.stages,
      categories: tax.categories,
      spaces: tax.spaces,
      icons: parseIconsJson(tax.iconsJson),
    })
  }
  return store.getState()
}

function rememberPending(itemId) {
  const store = require('./store')
  const pending = ((store.getState().prefs || {}).pendingItemIds || []).slice()
  if (pending.indexOf(itemId) < 0) pending.push(itemId)
  store.setPrefs({ pendingItemIds: pending, pendingSync: true })
}

function forgetPending(itemId) {
  const store = require('./store')
  const pending = ((store.getState().prefs || {}).pendingItemIds || []).filter((id) => id !== itemId)
  store.setPrefs({ pendingItemIds: pending, pendingSync: pending.length > 0 })
}

function toastMapped(err) {
  if (!err) return
  if (err.code === 401 || err.code === 403 || err.code === 410) {
    wx.showToast({ title: err.message || '同步失败', icon: 'none' })
  } else if (err.message) {
    wx.showToast({ title: err.message, icon: 'none' })
  }
}

async function wechatLogin(code) {
  const store = require('./store')
  const res = await api.request('/auth/wechat', {
    method: 'POST',
    data: { code: code, client: 'mp' },
    token: '',
  })
  store.setPrefs({
    jwt: res.token,
    cloudUserId: res.userId,
    phone: res.phone || '',
  })
  if (res.nickname) store.setPrefs({ nickname: res.nickname })
  return res
}

async function bindPhone(phoneCode) {
  const store = require('./store')
  const res = await api.request('/auth/bind-phone', {
    method: 'POST',
    data: { phoneCode: phoneCode, client: 'mp' },
  })
  store.setPrefs({
    jwt: res.token || store.getState().prefs.jwt,
    cloudUserId: res.userId || store.getState().prefs.cloudUserId,
    phone: res.phone || '',
  })
  return res
}

async function createCloudForCurrent() {
  const store = require('./store')
  const state = store.getState()
  if (!state.prefs.jwt || !state.project) return null
  if (state.project.cloudLedgerId) return state.project
  const snapshot = await api.request('/ledgers', {
    method: 'POST',
    data: { name: state.project.name, localId: state.project.id },
  })
  applySnapshot(snapshot)
  return snapshot
}

async function refreshOnOpen() {
  const store = require('./store')
  const state = store.getState()
  if (!state.prefs.jwt) return null
  const summaries = await api.request('/ledgers')
  ;(summaries || []).forEach((s) => store.addCloudPlaceholder(s))
  return pull()
}

async function devLogin(label) {
  const store = require('./store')
  const res = await api.request('/auth/dev-login', {
    method: 'POST',
    data: { label: label || 'mp' },
    token: '',
  })
  store.setPrefs({ jwt: res.token, cloudUserId: res.userId, phone: res.phone || '' })
  if (res.nickname) store.setPrefs({ nickname: res.nickname })
  return res
}

async function importCurrent() {
  const store = require('./store')
  const state = store.getState()
  if (state.project && state.project.cloudLedgerId) {
    return pull()
  }
  const snapshot = await api.request('/ledgers/import', {
    method: 'POST',
    data: {
      localId: state.project.id,
      name: state.project.name,
      items: (state.items || []).map(itemToDto),
      taxonomy: taxonomyToDto(state.prefs.taxonomy),
    },
  })
  applySnapshot(snapshot)
  return snapshot
}

async function pull() {
  const store = require('./store')
  const state = store.getState()
  const cloudId = state.project && state.project.cloudLedgerId
  if (!cloudId || !state.prefs.jwt) return null
  const pending = state.prefs.pendingItemIds || []
  for (let i = 0; i < pending.length; i++) {
    try {
      await pushItem(pending[i])
    } catch (e) { /* keep going */ }
  }
  const snapshot = await api.request('/ledgers/' + cloudId)
  applySnapshot(snapshot)
  return snapshot
}

async function pullIfNeeded() {
  return refreshOnOpen()
}

async function pushItem(itemId) {
  const store = require('./store')
  const state = store.getState()
  const cloudId = state.project && state.project.cloudLedgerId
  if (!cloudId || !state.prefs.jwt) return null
  const item = (state.items || []).find((i) => i.id === itemId)
  if (!item) return null
  try {
    const snapshot = await api.request(
      '/ledgers/' + cloudId + '/items/' + itemId,
      {
        method: 'PUT',
        data: {
          baseRevision: state.project.cloudRevision || 0,
          item: itemToDto(item),
        },
      },
    )
    applySnapshot(snapshot)
    forgetPending(itemId)
    return snapshot
  } catch (err) {
    if (!err || (err.code !== 401 && err.code !== 403)) {
      rememberPending(itemId)
    }
    toastMapped(err)
    throw err
  }
}

async function pushDelete(itemId) {
  const store = require('./store')
  const state = store.getState()
  const cloudId = state.project && state.project.cloudLedgerId
  if (!cloudId || !state.prefs.jwt) return null
  try {
    const snapshot = await api.request(
      '/ledgers/' + cloudId + '/items/' + itemId + '?baseRevision=' + (state.project.cloudRevision || 0),
      { method: 'DELETE' },
    )
    applySnapshot(snapshot)
    forgetPending(itemId)
    return snapshot
  } catch (err) {
    toastMapped(err)
    throw err
  }
}

async function createInvite() {
  const store = require('./store')
  const state = store.getState()
  const cloudId = state.project && state.project.cloudLedgerId
  if (!cloudId) throw { message: '请先上传账本' }
  return api.request('/ledgers/' + cloudId + '/invites', { method: 'POST' })
}

async function joinInvite(code) {
  const snapshot = await api.request('/invites/join', {
    method: 'POST',
    data: { code: String(code || '').trim() },
  })
  applySnapshot(snapshot)
  return snapshot
}

module.exports = {
  devLogin,
  wechatLogin,
  bindPhone,
  importCurrent,
  pull,
  pullIfNeeded,
  refreshOnOpen,
  createCloudForCurrent,
  pushItem,
  pushDelete,
  createInvite,
  joinInvite,
}
