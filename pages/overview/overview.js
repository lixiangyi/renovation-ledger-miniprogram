const store = require('../../utils/store')
const { fenToYuan } = require('../../utils/money')
const {
  resolveHealth,
  hintHealthClass,
  classifyPaidBudgetGaps,
} = require('../../utils/metrics')
const { computeProjectedSpendPercent, projectedGapAmountText } = require('../../utils/projectedSpend')
const { PaymentStatus, effectiveCost, deriveStatus, statusLabel } = require('../../utils/model')
const themeUtil = require('../../utils/theme')
const { getExpandState, setExpandState } = require('../../utils/overview-expand')
const aiKeys = require('../../utils/aiKeys')
const dashScopeAsr = require('../../utils/dashScopeAsr')
const voiceIntent = require('../../utils/voiceIntent')

const DEFAULT_THEME = {
  pageBg: '#E8F5E9',
  primary: '#2E7D32',
  primaryContainer: '#C8E6C9',
  tabBg: '#DCECDC',
  levelClass: '',
}

function overspendText(amount) {
  if (amount > 0) return '超支 ' + fenToYuan(amount)
  if (amount < 0) return '节余 ' + fenToYuan(-amount)
  return '与预算持平'
}

function budgetGapInfo(budgetAmount, actualAmount) {
  const gap = (actualAmount || 0) - (budgetAmount || 0)
  if (!budgetAmount || !gap) return { text: '', cls: '' }
  const percent = Math.abs(gap) * 100 / budgetAmount
  const percentText = Number(percent.toFixed(1)).toString() + '%'
  return gap > 0
    ? { text: `超支 ${percentText}`, cls: 'over' }
    : { text: `节余 ${percentText}`, cls: 'surplus' }
}

function themeCssVars(theme) {
  const t = theme && theme.primary ? theme : DEFAULT_THEME
  return '--page-bg:' + t.pageBg
    + ';--primary:' + t.primary
    + ';--primary-container:' + t.primaryContainer + ';'
}

Page({
  data: Object.assign({
    projectName: '',
    projectDisplayName: '',
    memberNames: '',
    currentProjectId: '',
    projects: [],
    drawerOpen: false,
    showCreate: false,
    newLedgerName: '新账本',
    showRename: false,
    renameProjectId: '',
    renameLedgerName: '',
    metrics: {},
    theme: DEFAULT_THEME,
    cssVars: themeCssVars(DEFAULT_THEME),
    healthClass: '',
    projectedHealthClass: '',
    recent: [],
    overspendRows: [],
    surplusRows: [],
    overspendPreview: [],
    surplusPreview: [],
    overspendMore: 0,
    surplusMore: 0,
    loadError: '',
    contentReady: false,
    voiceOpen: false,
    voiceStatus: '',
    voiceDraft: '',
    voiceTypedVisible: false,
    voiceBusy: false,
    nickname: '我',
    avatarPath: '',
  }, getExpandState()),

  onShow() {
    this.setData(getExpandState())
    this.refresh()
    const that = this
    require('../../utils/sync').pullIfNeeded()
      .catch(function () { /* toast in sync */ })
      .then(function () { that.refresh() })
  },

  openDrawer() {
    this.setData({ drawerOpen: true })
  },

  closeDrawer() {
    this.setData({ drawerOpen: false })
  },

  switchLedger(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    store.switchProject(id)
    this.setData({ drawerOpen: false })
    const that = this
    const project = (store.getState().projects || []).find((p) => p.id === id)
    if (project && project.cloudLedgerId && (store.getState().prefs || {}).jwt) {
      require('../../utils/sync').pull()
        .catch(function () { /* toast in sync */ })
        .then(function () { that.refresh() })
    } else {
      that.refresh()
    }
  },

  startCreateLedger() {
    this.setData({ showCreate: true, newLedgerName: '新账本', drawerOpen: false })
  },

  cancelCreateLedger() {
    this.setData({ showCreate: false })
  },

  onNewLedgerInput(e) {
    this.setData({ newLedgerName: e.detail.value })
  },

  confirmCreateLedger() {
    store.createProject(this.data.newLedgerName)
    this.setData({ showCreate: false })
    const that = this
    const jwt = (store.getState().prefs || {}).jwt
    if (jwt) {
      require('../../utils/sync').createCloudForCurrent()
        .catch(function (err) {
          wx.showToast({ title: '云端创建失败，账本仍在本机', icon: 'none' })
        })
        .then(function () { that.refresh() })
    } else {
      this.refresh()
    }
  },

  startRenameCurrent() {
    this.setData({
      showRename: true,
      renameProjectId: this.data.currentProjectId,
      renameLedgerName: this.data.projectName || '',
      drawerOpen: false,
    })
  },

  startRenameLedger(e) {
    const id = e.currentTarget.dataset.id
    const name = e.currentTarget.dataset.name || ''
    if (!id) return
    this.setData({
      showRename: true,
      renameProjectId: id,
      renameLedgerName: name,
      drawerOpen: false,
    })
  },

  cancelRenameLedger() {
    this.setData({ showRename: false, renameProjectId: '', renameLedgerName: '' })
  },

  onRenameLedgerInput(e) {
    this.setData({ renameLedgerName: e.detail.value })
  },

  confirmRenameLedger() {
    const name = String(this.data.renameLedgerName || '').trim()
    if (!name || !this.data.renameProjectId) return
    const projectId = this.data.renameProjectId
    const sync = require('../../utils/sync')
    Promise.resolve(sync.renameLedger(projectId, name))
      .then(() => {
        this.setData({ showRename: false, renameProjectId: '', renameLedgerName: '' })
        this.refresh()
      })
      .catch((err) => {
        this.setData({ showRename: false, renameProjectId: '', renameLedgerName: '' })
        this.refresh()
        wx.showToast({
          title: (err && err.message) || '云端改名失败，已保存本机',
          icon: 'none',
        })
      })
  },

  startDeleteLedger(e) {
    const id = e.currentTarget.dataset.id
    const name = e.currentTarget.dataset.name || '账本'
    if (!id) return
    const state = store.getState()
    const project = (state.projects || []).find((p) => p.id === id) || {}
    const sync = require('../../utils/sync')
    const gates = require('../../utils/ledgerRoleGates')
    const role = gates.roleOf(project.cloudLedgerId, sync.getLastCloudSummaries())
    const copy = require('../../utils/deleteLedgerCopy').forRole(
      role,
      name,
      !!project.cloudLedgerId,
    )
    const that = this
    wx.showModal({
      title: copy.title,
      content: copy.body,
      confirmText: copy.confirm,
      success(res) {
        if (!res.confirm) return
        store.moveProjectToTrashAsync(id)
          .then(function () {
            that.setData({ drawerOpen: false })
            that.refresh()
            wx.showToast({ title: '已移入垃圾箱', icon: 'success' })
          })
          .catch(function (err) {
            that.setData({ drawerOpen: false })
            that.refresh()
            wx.showToast({
              title: (err && err.message) || '删除失败',
              icon: 'none',
            })
          })
      },
    })
  },

  noop() {},

  refresh() {
    try {
      const { state, metrics, theme } = themeUtil.applyTheme(this)
      const safeTheme = theme && theme.primary ? theme : DEFAULT_THEME
      const prefs = state.prefs || {}
      const project = state.project || { id: '', name: '我家装修' }
      const items = state.items || []
      const currentHealth = resolveHealth(
        metrics.currentOverspend,
        metrics.totalBudget,
        prefs.mildOverMaxPercent,
      )
      const projectedHealth = resolveHealth(
        metrics.projectedOverspend,
        metrics.totalBudget,
        prefs.mildOverMaxPercent,
      )
      const recent = []
      items.forEach((item) => {
        const paidAmount = (item.payments || [])
          .filter((p) => p.status === PaymentStatus.PAID)
          .reduce((s, p) => s + p.amount, 0)
        const scheduledUnpaid = (item.payments || [])
          .filter((p) => p.status === PaymentStatus.UNPAID)
          .reduce((s, p) => s + p.amount, 0)
        const actualAmount = effectiveCost(item)
        const unpaidAmount = Math.max(actualAmount - paidAmount, scheduledUnpaid, 0)
        const statusText = statusLabel(deriveStatus(item))
        ;(item.payments || []).forEach((p) => {
          recent.push(Object.assign({}, p, {
            itemId: item.id,
            itemName: item.name,
            category: item.category || item.stage || '未分类',
            recordedDate: item.recordedDate || '',
            isNewAddition: !!item.isNewAddition,
            budgetAmount: item.budgetAmount || 0,
            actualAmount,
            paidAmount,
            unpaidAmount,
            statusText,
          }))
        })
      })
      recent.sort((a, b) => (b.paidAtEpochMs || 0) - (a.paidAtEpochMs || 0))
      const recentRows = recent.slice(0, 5).map((p) => {
        const dateText = p.paidAtEpochMs
          ? new Date(p.paidAtEpochMs).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
          : ''
        const displayDate = p.recordedDate || dateText
        const budgetText = fenToYuan(p.budgetAmount)
        const actualText = fenToYuan(p.actualAmount)
        const gap = budgetGapInfo(p.budgetAmount, p.actualAmount)
        return {
          id: p.id,
          itemId: p.itemId,
          title: p.itemName,
          category: p.category,
          dateText: displayDate,
          isNewAddition: p.isNewAddition,
          statusText: p.statusText,
          statusClass: p.statusText === '已结清' ? 'settled' : 'pending',
          amountLine: p.actualAmount !== p.budgetAmount
            ? `${budgetText} → ${actualText}`
            : budgetText,
          amountGapText: gap.text,
          amountGapClass: gap.cls,
          paidText: fenToYuan(p.paidAmount),
          unpaidText: fenToYuan(p.unpaidAmount),
        }
      })

      const projected = computeProjectedSpendPercent(metrics.projectedTotal, metrics.totalBudget)

      const { overspend, surplus } = classifyPaidBudgetGaps(items)
      const overspendGapTotal = overspend.reduce((s, r) => s + r.amount, 0)
      const surplusGapTotal = surplus.reduce((s, r) => s + r.amount, 0)

      const visibility = require('../../utils/ledgerVisibility')
      const jwt = !!(prefs.jwt)
      const summaries = require('../../utils/sync').getLastCloudSummaries() || []
      const visible = visibility.visible(state.projects || [project], summaries, jwt)
      const drawerProjects = visible.map((v) => Object.assign({}, v.project, {
        displayName: v.displayName,
      }))
      const currentVisible = visible.find((v) => v.project.id === project.id)
      const members = (project.memberNames && project.memberNames.length)
        ? project.memberNames
        : [prefs.nickname || '我']
      const ownerName = require('../../utils/ledgerOwnerDisplay').nickname(members)

      this.setData({
        projectName: project.name || '我家装修',
        projectDisplayName: (currentVisible && currentVisible.displayName)
          || project.name
          || '我家装修',
        memberNames: ownerName,
        contentReady: true,
        currentProjectId: state.currentProjectId || project.id || '',
        projects: drawerProjects,
        theme: safeTheme,
        cssVars: themeCssVars(safeTheme),
        healthClass: hintHealthClass(metrics.currentOverspend, currentHealth),
        projectedHealthClass: hintHealthClass(metrics.projectedOverspend, projectedHealth),
        metrics: {
          totalBudgetText: fenToYuan(metrics.totalBudget),
          paidText: fenToYuan(metrics.paidActual),
          pendingText: fenToYuan(metrics.pendingSpend),
          unpaidFinalText: fenToYuan(metrics.unpaidFinal),
          toBuyText: fenToYuan(metrics.toBuyAmount),
          projectedText: fenToYuan(metrics.projectedTotal),
          currentHint: overspendText(metrics.currentOverspend),
          overspendGapText: fenToYuan(overspendGapTotal),
          surplusGapText: fenToYuan(surplusGapTotal),
          projectedPercentLabel: projected.percent !== null ? projected.label : '',
          projectedGapText: projected.gap !== 0 ? projectedGapAmountText(projected.gap) : '',
        },
        recent: recentRows,
        overspendRows: overspend,
        surplusRows: surplus,
        overspendPreview: overspend.slice(0, 5).map((r) => Object.assign({}, r, {
          amountText: '+' + (r.amountText || fenToYuan(r.amount)),
        })),
        surplusPreview: surplus.slice(0, 5).map((r) => Object.assign({}, r, {
          amountText: '-' + (r.amountText || fenToYuan(r.amount)),
        })),
        overspendMore: Math.max(0, overspend.length - 5),
        surplusMore: Math.max(0, surplus.length - 5),
        nickname: prefs.nickname || '我',
        avatarPath: prefs.avatarPath || '',
        loadError: '',
      })
    } catch (e) {
      console.error('overview refresh failed', e)
      this.setData({
        loadError: (e && e.message) || '页面加载失败',
        theme: DEFAULT_THEME,
        cssVars: themeCssVars(DEFAULT_THEME),
      })
    }
  },

  togglePaid() {
    const next = !this.data.paidExpanded
    this.setData(setExpandState({
      paidExpanded: next,
      pendingExpanded: next ? false : this.data.pendingExpanded,
    }))
  },

  togglePending() {
    const next = !this.data.pendingExpanded
    this.setData(setExpandState({
      pendingExpanded: next,
      paidExpanded: next ? false : this.data.paidExpanded,
    }))
  },

  setPaidTab(e) {
    this.setData(setExpandState({ paidTab: Number(e.currentTarget.dataset.tab) }))
  },

  setPendingTab(e) {
    this.setData(setExpandState({ pendingTab: e.currentTarget.dataset.tab }))
  },

  goPending(e) {
    const tab = e.currentTarget.dataset.tab || this.data.pendingTab || 'unpaid'
    wx.navigateTo({ url: `/pages/pending/pending?tab=${tab}` })
  },

  goPaidGap() {
    const tab = this.data.paidTab === 1 ? 'surplus' : 'overspend'
    wx.navigateTo({ url: `/pages/paid-gap/paid-gap?tab=${tab}` })
  },

  openItem(e) {
    const id = e.currentTarget.dataset.id
    if (id) wx.navigateTo({ url: `/pages/detail/detail?id=${id}` })
  },

  goSearch() {
    wx.navigateTo({ url: '/pages/search/search' })
  },

  openProfile() {
    wx.navigateTo({ url: '/pages/profile/profile' })
  },

  goEntry() {
    wx.navigateTo({ url: '/pages/entry/entry' })
  },

  openVoice() {
    this.setData({
      voiceOpen: true,
      voiceStatus: aiKeys.getDashScopeKey()
        ? '按住说话，松手后转写'
        : '未配置百炼 Key，可直接文字输入',
      voiceDraft: '',
      voiceTypedVisible: !aiKeys.getDashScopeKey(),
      voiceBusy: false,
    })
  },

  closeVoice() {
    try {
      if (this._recorder) this._recorder.stop()
    } catch (e) { /* ignore */ }
    this.setData({ voiceOpen: false, voiceBusy: false })
  },

  useVoiceTyped() {
    this.setData({
      voiceTypedVisible: true,
      voiceStatus: '请输入要记账的内容',
    })
  },

  onVoiceDraft(e) {
    this.setData({ voiceDraft: e.detail.value })
  },

  onVoiceHoldStart() {
    if (this.data.voiceBusy) return
    if (!aiKeys.getDashScopeKey()) {
      this.setData({ voiceTypedVisible: true, voiceStatus: '请先在设置页配置百炼 Key，或直接输入' })
      return
    }
    const that = this
    wx.authorize({
      scope: 'scope.record',
      success() {
        that._startRecorder()
      },
      fail() {
        that.setData({ voiceTypedVisible: true, voiceStatus: '需要麦克风权限，可改打字' })
      },
    })
  },

  _startRecorder() {
    if (!this._recorder) {
      this._recorder = wx.getRecorderManager()
      const that = this
      this._recorder.onStop((res) => {
        that._onRecordStop(res)
      })
      this._recorder.onError(() => {
        that.setData({ voiceBusy: false, voiceTypedVisible: true, voiceStatus: '录音失败，可改打字' })
      })
    }
    this.setData({ voiceStatus: '正在录音…', voiceBusy: true })
    this._recorder.start({
      duration: 30000,
      sampleRate: 16000,
      numberOfChannels: 1,
      encodeBitRate: 48000,
      format: 'mp3',
    })
  },

  onVoiceHoldEnd() {
    if (!this.data.voiceBusy || !this._recorder) return
    try {
      this._recorder.stop()
    } catch (e) {
      this.setData({ voiceBusy: false })
    }
  },

  _onRecordStop(res) {
    const path = res && res.tempFilePath
    if (!path) {
      this.setData({ voiceBusy: false, voiceTypedVisible: true, voiceStatus: '没听清，可改打字' })
      return
    }
    this.setData({ voiceStatus: '正在转写…' })
    const that = this
    dashScopeAsr.transcribeFile(path)
      .then((text) => that._afterTranscript(text))
      .catch(() => {
        that.setData({
          voiceBusy: false,
          voiceTypedVisible: true,
          voiceStatus: '转写失败，可改打字',
        })
      })
  },

  submitVoiceDraft() {
    const text = (this.data.voiceDraft || '').trim()
    if (!text) {
      wx.showToast({ title: '请先输入内容', icon: 'none' })
      return
    }
    this._afterTranscript(text)
  },

  _afterTranscript(text) {
    this.setData({ voiceStatus: '正在分析…', voiceBusy: true, voiceDraft: text })
    const that = this
    voiceIntent.parseLedgerIntent(text)
      .then((prefill) => {
        that.setData({ voiceOpen: false, voiceBusy: false })
        wx.navigateTo({
          url: '/pages/entry/entry?fromVoice=1',
          success(nav) {
            if (nav.eventChannel) {
              nav.eventChannel.emit('voicePrefill', prefill)
            }
          },
        })
      })
      .catch(() => {
        that.setData({
          voiceBusy: false,
          voiceTypedVisible: true,
          voiceStatus: '分析失败，可改打字后继续',
        })
      })
  },
})
