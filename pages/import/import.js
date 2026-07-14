const store = require('../../utils/store')
const themeUtil = require('../../utils/theme')
const { parse } = require('../../utils/dcjzCsv')
const { fenToYuan } = require('../../utils/money')
const fs = wx.getFileSystemManager()

Page({
  data: {
    drafts: [],
    duplicates: 0,
    selectedCount: 0,
    sumText: '¥0',
    theme: {},
  },

  onShow() {
    const { theme } = themeUtil.applyTheme(this)
    this.setData({
      theme,
      cssVars: `--page-bg:${theme.pageBg};--primary:${theme.primary};`,
    })
  },

  applyDrafts(result) {
    if (result.error) {
      wx.showToast({ title: result.error, icon: 'none', duration: 2500 })
      return
    }
    if (!result.drafts.length) {
      wx.showToast({ title: '未解析到有效行', icon: 'none' })
      return
    }
    const drafts = result.drafts.map((d) => Object.assign({}, d, {
      amountText: fenToYuan(d.amountCents),
    }))
    this.setData({ drafts, duplicates: result.duplicates }, () => this.refreshStats())
  },

  refreshStats() {
    const drafts = this.data.drafts
    const selected = drafts.filter((d) => d.selected)
    const sum = selected.reduce((s, d) => s + d.amountCents, 0)
    this.setData({
      selectedCount: selected.length,
      sumText: fenToYuan(sum),
    })
  },

  chooseFile() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['csv', 'txt'],
      success: (res) => {
        const file = (res.tempFiles || [])[0]
        if (!file) return
        try {
          const text = fs.readFileSync(file.path, 'utf8')
          this.applyDrafts(parse(text))
        } catch (e) {
          console.error(e)
          wx.showToast({ title: '读取文件失败', icon: 'none' })
        }
      },
      fail: () => {
        wx.showToast({ title: '未选择文件', icon: 'none' })
      },
    })
  },

  pasteClipboard() {
    wx.getClipboardData({
      success: (res) => {
        this.applyDrafts(parse(res.data || ''))
      },
      fail: () => wx.showToast({ title: '读取剪贴板失败', icon: 'none' }),
    })
  },

  toggleRow(e) {
    const index = Number(e.currentTarget.dataset.index)
    const key = `drafts[${index}].selected`
    this.setData({ [key]: !this.data.drafts[index].selected }, () => this.refreshStats())
  },

  selectAll() {
    const drafts = this.data.drafts.map((d) => Object.assign({}, d, { selected: true }))
    this.setData({ drafts }, () => this.refreshStats())
  },

  selectNonDup() {
    const drafts = this.data.drafts.map((d) => Object.assign({}, d, {
      selected: !d.isDuplicate,
    }))
    this.setData({ drafts }, () => this.refreshStats())
  },

  clearAll() {
    this.setData({ drafts: [], duplicates: 0, selectedCount: 0, sumText: '¥0' })
  },

  confirmImport() {
    const selected = this.data.drafts.filter((d) => d.selected)
    if (!selected.length) return
    wx.showModal({
      title: '导入并新建账本',
      content: '将新建账本并切换过去，再导入 '
        + selected.length
        + ' 项（本 App 导出会还原预算/合同与付款）。当前账本保留。是否继续？',
      success: (res) => {
        if (!res.confirm) return
        const { count } = store.importDraftsAsToBuy(selected)
        wx.showToast({ title: `已导入 ${count} 项`, icon: 'success' })
        setTimeout(() => {
          wx.switchTab({ url: '/pages/list/list' })
        }, 500)
      },
    })
  },
})
