const { fenToYuan } = require('../../utils/money')
const { classifyPaidBudgetGaps } = require('../../utils/metrics')
const themeUtil = require('../../utils/theme')

Page({
  data: {
    tab: 'overspend',
    rows: [],
    overspendCount: 0,
    surplusCount: 0,
    emptyHint: '',
    showTotal: false,
    gapTotalText: '',
    budgetPaidTotalText: '',
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
    const showTotal = !isSurplus && overspend.length > 0
    let gapTotalText = ''
    let budgetPaidTotalText = ''
    if (showTotal) {
      const gapTotal = overspend.reduce((s, r) => s + r.amount, 0)
      const budgetTotal = overspend.reduce((s, r) => s + (r.budgetAmount || 0), 0)
      const paidTotal = overspend.reduce((s, r) => s + (r.paidAmount || 0), 0)
      gapTotalText = fenToYuan(gapTotal)
      budgetPaidTotalText = '预算合计 ' + fenToYuan(budgetTotal)
        + '  ·  实付合计 ' + fenToYuan(paidTotal)
    }
    this.setData({
      theme,
      cssVars: `--page-bg:${theme.pageBg};--primary:${theme.primary};--primary-container:${theme.primaryContainer || theme.pageBg};`,
      overspendCount: overspend.length,
      surplusCount: surplus.length,
      rows,
      showTotal,
      gapTotalText,
      budgetPaidTotalText,
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
