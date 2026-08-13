const store = require('../../utils/store')
const { fenToYuan } = require('../../utils/money')
const { effectiveCost } = require('../../utils/model')
const { matchByName } = require('../../utils/search')
const themeUtil = require('../../utils/theme')

Page({
  data: {
    query: '',
    results: [],
    history: [],
    theme: {},
  },

  onShow() {
    this.refresh()
  },

  refresh() {
    const { state, theme } = themeUtil.applyTheme(this)
    const history = Array.isArray(state.prefs.searchHistory) ? state.prefs.searchHistory : []
    const results = matchByName(state.items, this.data.query).map((item) => ({
      id: item.id,
      name: item.name || '未命名',
      metaText: [item.stage, item.category, item.space].filter((v) => v).join(' · '),
      amountText: fenToYuan(effectiveCost(item)),
    }))
    this.setData({ theme, history, results })
  },

  onInput(e) {
    this.setData({ query: e.detail.value })
    this.refresh()
  },

  clearQuery() {
    this.setData({ query: '' })
    this.refresh()
  },

  onSubmit() {
    const q = String(this.data.query || '').trim()
    if (!q) return
    store.addSearchHistory(q)
    this.refresh()
  },

  onSelectHistory(e) {
    const q = e.currentTarget.dataset.query || ''
    store.addSearchHistory(q)
    this.setData({ query: q })
    this.refresh()
  },

  onClearHistory() {
    store.clearSearchHistory()
    this.refresh()
  },

  openItem(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    const q = String(this.data.query || '').trim()
    if (q) store.addSearchHistory(q)
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` })
  },
})
