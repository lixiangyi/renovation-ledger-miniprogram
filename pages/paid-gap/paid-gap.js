const { fenToYuan } = require('../../utils/money')
const { classifyPaidBudgetGaps } = require('../../utils/metrics')
const themeUtil = require('../../utils/theme')

function sumAmount(rows) {
  return rows.reduce((s, r) => s + (r.amount || 0), 0)
}

function sumField(rows, key) {
  return rows.reduce((s, r) => s + (r[key] || 0), 0)
}

Page({
  data: {
    tab: 'overspend',
    rows: [],
    overspendCount: 0,
    surplusCount: 0,
    emptyHint: '',
    overspendTotalText: '',
    surplusTotalText: '',
    overspendDetailText: '',
    surplusDetailText: '',
    amountToneClass: 'amt-overspend',
    theme: {},
  },

  onLoad(query) {
    this.setData({ tab: query.tab === 'surplus' ? 'surplus' : 'overspend' })
  },

  onShow() {
    this.refresh()
  },

  setTab(e) {
    this.setData({ tab: e.currentTarget.dataset.tab })
    this.refresh()
  },

  refresh() {
    const { state, theme } = themeUtil.applyTheme(this)
    const { overspend, surplus } = classifyPaidBudgetGaps(state.items)
    const isSurplus = this.data.tab === 'surplus'
    const gapLabel = isSurplus ? '节余' : '超出'
    const source = isSurplus ? surplus : overspend
    const rows = source.map((r) => {
      const amountText = r.amountText || fenToYuan(r.amount)
      const percentText = r.percentText || '—'
      return {
        id: r.id,
        title: r.name,
        gapText: gapLabel + ' ' + amountText + ' · ' + percentText,
        budgetPaidText: '预算 ' + r.budgetText + '  ·  实付 ' + r.paidText,
      }
    })
    const overspendBudget = sumField(overspend, 'budgetAmount')
    const overspendPaid = sumField(overspend, 'paidAmount')
    const surplusBudget = sumField(surplus, 'budgetAmount')
    const surplusPaid = sumField(surplus, 'paidAmount')
    this.setData({
      theme,
      cssVars: `--page-bg:${theme.pageBg};--primary:${theme.primary};--primary-container:${theme.primaryContainer || theme.pageBg};`,
      overspendCount: overspend.length,
      surplusCount: surplus.length,
      rows,
      overspendTotalText: fenToYuan(sumAmount(overspend)),
      surplusTotalText: fenToYuan(sumAmount(surplus)),
      overspendDetailText: '预算 ' + fenToYuan(overspendBudget) + ' · 实付 ' + fenToYuan(overspendPaid),
      surplusDetailText: '预算 ' + fenToYuan(surplusBudget) + ' · 实付 ' + fenToYuan(surplusPaid),
      amountToneClass: isSurplus ? 'amt-surplus' : 'amt-overspend',
      emptyHint: isSurplus
        ? '暂无单项节余（已结清且未花满预算）'
        : '暂无单项超支（已付未超预算）',
    })
  },

  open(e) {
    const id = e.currentTarget.dataset.id
    if (id) wx.navigateTo({ url: `/pages/detail/detail?id=${id}` })
  },
})
