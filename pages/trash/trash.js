const store = require('../../utils/store')
const themeUtil = require('../../utils/theme')

function formatTime(ms) {
  const d = new Date(ms || 0)
  const p = (n) => String(n).padStart(2, '0')
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
    + ' ' + p(d.getHours()) + ':' + p(d.getMinutes())
}

Page({
  data: {
    entries: [],
    empty: true,
    theme: { pageBg: '#E8F5E9', primary: '#2E7D32' },
  },

  onShow() {
    this.refresh()
  },

  refresh() {
    try {
      themeUtil.applyTheme(this)
      const entries = (store.listTrash() || []).map((e) => Object.assign({}, e, {
        deletedAtText: formatTime(e.deletedAt),
      }))
      this.setData({
        entries,
        empty: !entries.length,
        theme: this.data.theme || { pageBg: '#E8F5E9', primary: '#2E7D32' },
      })
    } catch (e) {
      this.setData({ entries: [], empty: true })
    }
  },

  restore(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    const that = this
    try {
      store.restoreFromTrash(id)
      wx.showToast({ title: '已恢复', icon: 'success' })
      that.refresh()
    } catch (err) {
      wx.showToast({ title: (err && err.message) || '恢复失败', icon: 'none' })
    }
  },

  purge(e) {
    const id = e.currentTarget.dataset.id
    const name = e.currentTarget.dataset.name || '备份'
    if (!id) return
    const that = this
    wx.showModal({
      title: '永久删除',
      content: '将永久删除「' + name + '」的备份，删除后无法恢复。确定吗？',
      confirmColor: '#C62828',
      success(res) {
        if (!res.confirm) return
        try {
          store.purgeTrashEntry(id)
          that.refresh()
          wx.showToast({ title: '已永久删除', icon: 'success' })
        } catch (err) {
          wx.showToast({ title: (err && err.message) || '删除失败', icon: 'none' })
        }
      },
    })
  },
})
