const store = require('../../utils/store')
const { fenToYuan } = require('../../utils/money')
const { deriveStatus, statusLabel } = require('../../utils/model')
const { resolveHealth } = require('../../utils/metrics')
const themeUtil = require('../../utils/theme')
const { getIconDisplay } = require('../../utils/taxonomy')
const {
  group,
  tabStats,
  showNewBadge,
  PaymentListGroupBy,
  PaymentListLayout,
} = require('../../utils/paymentList')

function overspendHintClass(overspend, level) {
  if (overspend < 0) return 'health-within'
  if (overspend === 0) return 'health-flat'
  if (level === 'SEVERE_OVER') return 'health-severe'
  if (level === 'MILD_OVER') return 'health-mild'
  return 'health-within'
}

function formatStageOverspendPercent(percent, overspend) {
  if (percent == null) return overspend > 0 ? '超支 —' : '—'
  if (percent > 0) return '超支 ' + percent + '%'
  if (percent < 0) return '节余 ' + Math.abs(percent) + '%'
  return '持平'
}

const FILTER_TABS = [
  { key: 'all', label: '全部' },
  { key: 'TO_BUY', label: '待购买' },
  { key: 'PAYING', label: '付款中' },
  { key: 'SETTLED', label: '已结清' },
]

Page({
  data: {
    filter: 'all',
    groupBy: PaymentListGroupBy.STAGE,
    layout: PaymentListLayout.NESTED,
    tabs: [],
    groups: [],
    theme: {},
  },

  onShow() {
    this.refresh()
  },

  setFilter(e) {
    this.setData({ filter: e.currentTarget.dataset.filter })
    this.refresh()
  },

  setGroupBy(e) {
    const groupBy = e.currentTarget.dataset.value
    if (!groupBy || groupBy === this.data.groupBy) return
    store.setPrefs({ paymentListGroupBy: groupBy })
    this.refresh()
  },

  setLayout(e) {
    const layout = e.currentTarget.dataset.value
    if (!layout || layout === this.data.layout) return
    store.setPrefs({ paymentListLayout: layout })
    this.refresh()
  },

  toggle(e) {
    if (this.data.layout !== PaymentListLayout.NESTED) return
    const key = e.currentTarget.dataset.key
    const groups = this.data.groups.map((g) =>
      g.key === key ? Object.assign({}, g, { open: !g.open }) : g,
    )
    this.setData({ groups })
  },

  refresh() {
    const { state, theme } = themeUtil.applyTheme(this)
    const prefs = state.prefs || {}
    let groupBy = PaymentListGroupBy.STAGE
    if (prefs.paymentListGroupBy === PaymentListGroupBy.CATEGORY) groupBy = PaymentListGroupBy.CATEGORY
    else if (prefs.paymentListGroupBy === PaymentListGroupBy.SPACE) groupBy = PaymentListGroupBy.SPACE
    const layout = prefs.paymentListLayout === PaymentListLayout.FLAT
      ? PaymentListLayout.FLAT
      : PaymentListLayout.NESTED
    const filter = this.data.filter
    const mildMax = prefs.mildOverMaxPercent

    const prevOpen = {}
    ;(this.data.groups || []).forEach((g) => {
      prevOpen[g.key] = !!g.open
    })

    const allItems = state.items.slice()
    const stats = tabStats(allItems)
    const statsByKey = {
      all: stats.all,
      TO_BUY: stats.toBuy,
      PAYING: stats.paying,
      SETTLED: stats.settled,
    }
    const tabs = FILTER_TABS.map((tab) => {
      const stat = statsByKey[tab.key]
      return Object.assign({}, tab, {
        count: stat.count,
        amountText: fenToYuan(stat.amountSum),
      })
    })
    const selectedStat = statsByKey[filter] || stats.all
    const totalAmountText = fenToYuan(selectedStat.amountSum)

    let items = allItems
    if (filter !== 'all') {
      items = items.filter((i) => deriveStatus(i) === filter)
    }

    const taxonomy = store.getTaxonomy()
    let taxonomyKind = 'stages'
    if (groupBy === PaymentListGroupBy.CATEGORY) taxonomyKind = 'categories'
    else if (groupBy === PaymentListGroupBy.SPACE) taxonomyKind = 'spaces'

    const groups = group(items, groupBy).map((g) => {
      const overspend = g.projectedSum - g.budgetSum
      const overspendPercent = g.budgetSum > 0
        ? Math.round((overspend / g.budgetSum) * 100)
        : null
      const health = resolveHealth(Math.max(0, overspend), g.budgetSum, mildMax)
      const items = g.items.slice().sort((a, b) => {
        const aEmpty = !a.recordedDate
        const bEmpty = !b.recordedDate
        if (aEmpty !== bEmpty) return aEmpty ? 1 : -1
        if (a.recordedDate !== b.recordedDate) {
          return a.recordedDate < b.recordedDate ? 1 : -1
        }
        return (a.name || '').localeCompare(b.name || '', 'zh')
      }).map((item) => {
        const st = deriveStatus(item)
        return {
          id: item.id,
          name: item.name,
          status: st,
          statusText: statusLabel(st),
          recordedDate: item.recordedDate || '',
          dateText: item.recordedDate || '未填日期',
          budgetText: fenToYuan(item.budgetAmount),
          contractText: item.contractAmount != null ? fenToYuan(item.contractAmount) : '',
          showNewBadge: showNewBadge(item),
        }
      })
      const icon = getIconDisplay(taxonomy, taxonomyKind, g.key)
      return {
        key: g.key,
        open: !!prevOpen[g.key],
        count: g.items.length,
        items,
        iconEmoji: icon.emoji,
        iconPath: icon.path,
        paidText: fenToYuan(g.paidSum),
        budgetText: fenToYuan(g.budgetSum),
        projectedText: fenToYuan(g.projectedSum),
        paidItemCount: g.paidItemCount,
        pendingItemCount: g.pendingItemCount,
        pendingAmountText: fenToYuan(g.pendingAmountSum),
        overspendText: formatStageOverspendPercent(overspendPercent, overspend),
        overspendClass: overspendHintClass(overspend, health),
      }
    })

    this.setData({
      theme,
      cssVars: `--page-bg:${theme.pageBg};--primary:${theme.primary};--primary-container:${theme.primaryContainer};`,
      groupBy,
      layout,
      filter,
      tabs,
      totalAmountText,
      groups,
    })
  },

  openItem(e) {
    wx.navigateTo({ url: `/pages/detail/detail?id=${e.currentTarget.dataset.id}` })
  },

  goEntry() {
    wx.navigateTo({ url: '/pages/entry/entry' })
  },
})
