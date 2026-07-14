const store = require('../../utils/store')
const { fenToYuan } = require('../../utils/money')
const { deriveStatus, statusLabel, ItemStatus, effectiveCost } = require('../../utils/model')
const { resolveHealth } = require('../../utils/metrics')
const themeUtil = require('../../utils/theme')

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

Page({
  data: {
    filter: 'all',
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

  refresh() {
    const { state, theme } = themeUtil.applyTheme(this)
    const filter = this.data.filter
    const mildMax = state.prefs.mildOverMaxPercent
    const prevOpen = {}
    ;(this.data.groups || []).forEach((g) => {
      prevOpen[g.stage] = !!g.open
    })
    let items = state.items.slice()
    if (filter !== 'all') {
      items = items.filter((i) => deriveStatus(i) === filter)
    }
    const map = {}
    items.forEach((item) => {
      const stage = item.stage || '未分类'
      if (!map[stage]) {
        map[stage] = { stage, open: !!prevOpen[stage], items: [], budgetSum: 0, actualSum: 0 }
      }
      const st = deriveStatus(item)
      map[stage].budgetSum += item.budgetAmount || 0
      map[stage].actualSum += effectiveCost(item)
      map[stage].items.push({
        id: item.id,
        name: item.name,
        status: st,
        statusText: statusLabel(st),
        recordedDate: item.recordedDate || '',
        dateText: item.recordedDate || '未填日期',
        budgetText: fenToYuan(item.budgetAmount),
        contractText: item.contractAmount != null ? fenToYuan(item.contractAmount) : '',
      })
    })
    const groups = Object.values(map).map((g) => {
      g.items.sort((a, b) => {
        const aEmpty = !a.recordedDate
        const bEmpty = !b.recordedDate
        if (aEmpty !== bEmpty) return aEmpty ? 1 : -1
        if (a.recordedDate !== b.recordedDate) {
          return a.recordedDate < b.recordedDate ? 1 : -1
        }
        return (a.name || '').localeCompare(b.name || '', 'zh')
      })
      const overspend = g.actualSum - g.budgetSum
      const overspendPercent = g.budgetSum > 0
        ? Math.round((overspend / g.budgetSum) * 100)
        : null
      const health = resolveHealth(Math.max(0, overspend), g.budgetSum, mildMax)
      return Object.assign({}, g, {
        budgetText: fenToYuan(g.budgetSum),
        actualText: fenToYuan(g.actualSum),
        overspend,
        overspendPercent,
        overspendText: formatStageOverspendPercent(overspendPercent, overspend),
        overspendClass: overspendHintClass(overspend, health),
      })
    })
    this.setData({
      theme,
      cssVars: `--page-bg:${theme.pageBg};--primary:${theme.primary};--primary-container:${theme.primaryContainer};`,
      groups,
    })
  },

  toggle(e) {
    const stage = e.currentTarget.dataset.stage
    const groups = this.data.groups.map((g) =>
      g.stage === stage ? Object.assign({}, g, { open: !g.open }) : g,
    )
    this.setData({ groups })
  },

  openItem(e) {
    wx.navigateTo({ url: `/pages/detail/detail?id=${e.currentTarget.dataset.id}` })
  },

  goEntry() {
    wx.navigateTo({ url: '/pages/entry/entry' })
  },
})
