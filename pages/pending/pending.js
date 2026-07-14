const store = require('../../utils/store')
const { fenToYuan } = require('../../utils/money')
const { deriveStatus, ItemStatus, PaymentStatus, effectiveCost } = require('../../utils/model')
const themeUtil = require('../../utils/theme')

Page({
  data: {
    tab: 'unpaid',
    rows: [],
    theme: {},
  },

  onLoad(query) {
    this.setData({ tab: query.tab === 'tobuy' ? 'tobuy' : 'unpaid' })
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
    let rows = []
    if (this.data.tab === 'tobuy') {
      rows = state.items
        .filter((i) => deriveStatus(i) === ItemStatus.TO_BUY)
        .map((i) => ({
          id: i.id,
          title: i.name,
          sub: i.stage || '',
          amountText: fenToYuan(effectiveCost(i)),
        }))
    } else {
      state.items.forEach((item) => {
        ;(item.payments || [])
          .filter((p) => p.status === PaymentStatus.UNPAID)
          .forEach((p) => {
            rows.push({
              id: item.id + '_' + p.id,
              itemId: item.id,
              title: item.name,
              sub: '未付尾款/款项',
              amountText: fenToYuan(p.amount),
            })
          })
      })
    }
    this.setData({
      theme,
      cssVars: `--page-bg:${theme.pageBg};--primary:${theme.primary};`,
      rows,
    })
  },

  open(e) {
    const id = e.currentTarget.dataset.itemId || e.currentTarget.dataset.id
    // for unpaid rows use itemId
    const itemId = e.currentTarget.dataset.itemId || id
    wx.navigateTo({ url: `/pages/detail/detail?id=${itemId}` })
  },
})
