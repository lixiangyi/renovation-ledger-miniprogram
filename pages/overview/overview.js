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
  }, getExpandState()),

  onShow() {
    this.setData(getExpandState())
    this.refresh()
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
    this.refresh()
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
    this.refresh()
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
    store.renameProject(this.data.renameProjectId, name)
    this.setData({ showRename: false, renameProjectId: '', renameLedgerName: '' })
    this.refresh()
  },

  startDeleteLedger(e) {
    const id = e.currentTarget.dataset.id
    const name = e.currentTarget.dataset.name || '账本'
    if (!id) return
    const that = this
    wx.showModal({
      title: '移入垃圾箱',
      content: '将「' + name + '」移入垃圾箱。会先导出备份，之后可从垃圾箱恢复；永久删除前仍可找回。',
      confirmText: '移入',
      success(res) {
        if (!res.confirm) return
        try {
          store.moveProjectToTrash(id)
          that.setData({ drawerOpen: false })
          that.refresh()
          wx.showToast({ title: '已移入垃圾箱', icon: 'success' })
        } catch (err) {
          wx.showToast({ title: (err && err.message) || '删除失败', icon: 'none' })
        }
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

      this.setData({
        projectName: project.name || '我家装修',
        currentProjectId: state.currentProjectId || project.id || '',
        projects: state.projects || [project],
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

  goEntry() {
    wx.navigateTo({ url: '/pages/entry/entry' })
  },
})
