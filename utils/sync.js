const api = require('./api')

function paymentToDto(p) {
  return {
    id: p.id,
    type: p.type,
    amount: p.amount,
    status: p.status,
    paidAtEpochMs: p.paidAtEpochMs || null,
    paidOnDate: p.paidOnDate || null,
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
    paidOnDate: p.paidOnDate || null,
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
    settledOnDate: item.settledOnDate || null,
    settledAtEpochMs: item.settledAtEpochMs || null,
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
    settledOnDate: dto.settledOnDate || null,
    settledAtEpochMs: dto.settledAtEpochMs || null,
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
      cloudLinkedAtEpochMs: current.project.cloudLinkedAtEpochMs || Date.now(),
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
  await applyAvatarUrl(res.avatarUrl)
  const action = await refreshOnOpen(true)
  return Object.assign({}, res, { ledgerAction: action })
}

async function sendSmsCode(phone) {
  return api.request('/auth/sms/send', {
    method: 'POST',
    data: { phone: String(phone || '').trim() },
    token: '',
  })
}

async function smsLogin(phone, code) {
  const store = require('./store')
  const res = await api.request('/auth/sms/login', {
    method: 'POST',
    data: {
      phone: String(phone || '').trim(),
      code: String(code || '').trim(),
    },
    token: '',
  })
  store.setPrefs({
    jwt: res.token,
    cloudUserId: res.userId,
    phone: res.phone || phone,
  })
  if (res.nickname) store.setPrefs({ nickname: res.nickname })
  await applyAvatarUrl(res.avatarUrl)
  const action = await refreshOnOpen(true)
  return Object.assign({}, res, { ledgerAction: action })
}

async function logout() {
  const store = require('./store')
  store.setPrefs({ jwt: '', cloudUserId: '', phone: '', nickname: '我', avatarPath: '' })
  lastCloudSummaries = []
  store.purgeBoundLocalLedgersOnLogout()
}

let lastCloudSummaries = []

function getLastCloudSummaries() {
  return lastCloudSummaries.slice()
}

async function switchToFirstAccountLedger(summaries) {
  const store = require('./store')
  const visibility = require('./ledgerVisibility')
  const list = summaries || lastCloudSummaries
  const cloudId = visibility.firstAccountCloudId(list)
  if (cloudId) {
    const local = (store.getState().projects || []).find((p) => p.cloudLedgerId === cloudId)
    if (local) {
      store.switchProject(local.id)
      await pull()
      return
    }
  }
  const unbound = (store.getState().projects || []).find((p) => !p.cloudLedgerId)
  if (unbound) {
    store.switchProject(unbound.id)
    return
  }
  store.createProject('新账本')
  try {
    await createCloudForCurrent()
  } catch (e) { /* keep local */ }
}


async function fetchMe() {
  const store = require('./store')
  if (!store.getState().prefs.jwt) return null
  const me = await api.request('/me')
  const patch = { nickname: (me && me.nickname) || '我' }
  if (me && me.phone !== undefined) patch.phone = me.phone || ''
  store.setPrefs(patch)
  await applyAvatarUrl(me && me.avatarUrl)
  return me
}

async function updateNickname(nickname) {
  const store = require('./store')
  const value = String(nickname || '').trim() || '我'
  if (!store.getState().prefs.jwt) {
    store.setPrefs({ nickname: value })
    return value
  }
  const me = await api.request('/me', {
    method: 'PATCH',
    data: { nickname: value },
  })
  store.setPrefs({
    nickname: (me && me.nickname) || value,
    phone: me && me.phone !== undefined ? (me.phone || '') : store.getState().prefs.phone,
  })
  if (me && me.avatarUrl !== undefined) {
    await applyAvatarUrl(me.avatarUrl)
  }
  return (me && me.nickname) || value
}

function ensureAvatarDir() {
  const fs = wx.getFileSystemManager()
  const dir = wx.env.USER_DATA_PATH + '/avatars'
  try {
    fs.accessSync(dir)
  } catch (e) {
    try { fs.mkdirSync(dir, true) } catch (err) { /* ignore */ }
  }
  return dir
}

function cacheRemoteAvatar(relativeUrl) {
  const url = api.getBaseUrl() + relativeUrl
  const name = String(relativeUrl || '').split('/').pop() || ('avatar_' + Date.now() + '.jpg')
  return new Promise((resolve) => {
    wx.downloadFile({
      url,
      success(res) {
        if (res.statusCode !== 200 || !res.tempFilePath) {
          resolve('')
          return
        }
        const fs = wx.getFileSystemManager()
        const dest = ensureAvatarDir() + '/cloud_' + name
        try {
          fs.saveFileSync(res.tempFilePath, dest)
          resolve(dest)
        } catch (err) {
          try {
            fs.copyFileSync(res.tempFilePath, dest)
            resolve(dest)
          } catch (e2) {
            resolve(res.tempFilePath)
          }
        }
      },
      fail: () => resolve(''),
    })
  })
}

async function applyAvatarUrl(avatarUrl) {
  const store = require('./store')
  const value = String(avatarUrl || '').trim()
  if (!value) {
    store.setPrefs({ avatarPath: '' })
    return
  }
  if (value.indexOf('/avatars/') === 0) {
    const local = await cacheRemoteAvatar(value)
    store.setPrefs({ avatarPath: local || (api.getBaseUrl() + value) })
    return
  }
  store.setPrefs({ avatarPath: value })
}

async function uploadAvatar(localPath) {
  const store = require('./store')
  if (!store.getState().prefs.jwt) {
    store.setPrefs({ avatarPath: localPath })
    return localPath
  }
  const me = await api.uploadFile('/me/avatar', localPath, { name: 'file' })
  await applyAvatarUrl(me && me.avatarUrl)
  return (me && me.avatarUrl) || localPath
}

async function clearAvatar() {
  const store = require('./store')
  if (!store.getState().prefs.jwt) {
    store.setPrefs({ avatarPath: '' })
    return
  }
  const me = await api.request('/me/avatar', { method: 'DELETE' })
  await applyAvatarUrl(me && me.avatarUrl)
}

async function pingHealth() {
  const res = await api.request('/health', { method: 'GET', token: '' })
  if (!res || !res.ok) throw { message: '服务异常' }
  return '连通成功'
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
  if (res.nickname) store.setPrefs({ nickname: res.nickname })
  await applyAvatarUrl(res.avatarUrl)
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

async function refreshOnOpen(fromLogin) {
  const store = require('./store')
  const state = store.getState()
  if (!state.prefs.jwt) {
    lastCloudSummaries = []
    return { action: 'none' }
  }
  try {
    await fetchMe()
  } catch (e) { /* keep local cache */ }
  const summaries = await api.request('/ledgers')
  lastCloudSummaries = Array.isArray(summaries) ? summaries : []
  ;(lastCloudSummaries || []).forEach((s) => store.addCloudPlaceholder(s))
  const current = store.getState().project || {}
  const cloudIds = {}
  lastCloudSummaries.forEach((s) => { if (s && s.id) cloudIds[s.id] = true })
  if (!current.cloudLedgerId) {
    if (fromLogin) {
      return { action: 'offerBind', projectId: current.id, projectName: current.name || '当前账本' }
    }
    return { action: 'none' }
  }
  if (!cloudIds[current.cloudLedgerId]) {
    await switchToFirstAccountLedger(lastCloudSummaries)
    return { action: 'switchedAway' }
  }
  await pull()
  return { action: 'none' }
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
  try {
    const snapshot = await api.request('/ledgers/' + cloudId)
    applySnapshot(snapshot)
    return snapshot
  } catch (err) {
    if (err && err.code === 403) {
      await switchToFirstAccountLedger()
      wx.showToast({ title: '已切换到当前账号的账本', icon: 'none' })
      return null
    }
    toastMapped(err)
    throw err
  }
}

async function pullIfNeeded() {
  return refreshOnOpen(false)
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

async function previewInvite(code) {
  const normalized = String(code || '').trim()
  if (!normalized) throw { message: '请输入邀请码' }
  return api.request('/invites/' + encodeURIComponent(normalized) + '/preview')
}

async function listMembers(cloudLedgerId) {
  const cloudId = String(cloudLedgerId || '').trim()
  if (!cloudId) return []
  const list = await api.request('/ledgers/' + cloudId + '/members')
  return Array.isArray(list) ? list : []
}

async function renameLedger(projectId, name) {
  const store = require('./store')
  store.renameProject(projectId, name)
  const state = store.getState()
  const project = (state.projects || []).find((p) => p.id === projectId)
  const cloudId = project && project.cloudLedgerId
  if (!cloudId || !state.prefs.jwt) return store.getState()
  const trimmed = String(name || '').trim() || '新账本'
  const snapshot = await api.request('/ledgers/' + cloudId, {
    method: 'PATCH',
    data: { name: trimmed },
  })
  const nextProjects = (store.getState().projects || []).map((p) => {
    if (p.id === projectId || p.cloudLedgerId === snapshot.id) {
      return Object.assign({}, p, {
        name: snapshot.name,
        cloudLedgerId: snapshot.id,
        cloudRevision: snapshot.revision,
      })
    }
    return p
  })
  const current = store.getState()
  let nextProject = current.project
  if (nextProject && (nextProject.id === projectId || nextProject.cloudLedgerId === snapshot.id)) {
    nextProject = Object.assign({}, nextProject, {
      name: snapshot.name,
      cloudLedgerId: snapshot.id,
      cloudRevision: snapshot.revision,
    })
  }
  store.write({
    prefs: current.prefs,
    projects: nextProjects,
    currentProjectId: current.project.id,
    project: nextProject,
    items: current.items,
  })
  return store.getState()
}

async function joinInvite(code) {
  const snapshot = await api.request('/invites/join', {
    method: 'POST',
    data: { code: String(code || '').trim() },
  })
  applySnapshot(snapshot)
  try {
    const members = await listMembers(snapshot.id)
    const names = require('./ledgerOwnerDisplay').namesOwnerFirst(members)
    if (names.length) {
      const store = require('./store')
      store.setProject({ memberNames: names })
    }
  } catch (e) { /* keep snapshot members */ }
  return snapshot
}

async function unbindCloudLedger(cloudLedgerId) {
  const store = require('./store')
  const cloudId = String(cloudLedgerId || '').trim()
  if (!cloudId || !(store.getState().prefs || {}).jwt) return
  let role = null
  let found = false
  ;(lastCloudSummaries || []).forEach((s) => {
    if (s && s.id === cloudId) {
      found = true
      role = s.role
    }
  })
  if (!found) {
    try {
      const summaries = await api.request('/ledgers')
      lastCloudSummaries = Array.isArray(summaries) ? summaries : []
      lastCloudSummaries.forEach((s) => {
        if (s && s.id === cloudId) {
          found = true
          role = s.role
        }
      })
    } catch (e) { /* fall through */ }
  }
  if (!found) return
  const isEditor = String(role || '').toUpperCase() === 'EDITOR'
  if (isEditor) {
    await api.request('/ledgers/' + cloudId + '/leave', { method: 'POST' })
  } else {
    await api.request('/ledgers/' + cloudId, { method: 'DELETE' })
  }
  lastCloudSummaries = (lastCloudSummaries || []).filter((s) => s && s.id !== cloudId)
}

module.exports = {
  wechatLogin,
  sendSmsCode,
  smsLogin,
  logout,
  fetchMe,
  updateNickname,
  uploadAvatar,
  clearAvatar,
  pingHealth,
  bindPhone,
  importCurrent,
  pull,
  pullIfNeeded,
  refreshOnOpen,
  createCloudForCurrent,
  pushItem,
  pushDelete,
  createInvite,
  previewInvite,
  listMembers,
  joinInvite,
  renameLedger,
  getLastCloudSummaries,
  unbindCloudLedger,
}
