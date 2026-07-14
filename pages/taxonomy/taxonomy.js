const store = require('../../utils/store')
const themeUtil = require('../../utils/theme')
const { KIND_LABEL } = require('../../utils/taxonomy')

Page({
  data: {
    kind: 'stages',
    kindLabel: '阶段',
    options: [],
    theme: {},
  },

  onShow() {
    this.refresh()
  },

  refresh() {
    const { theme } = themeUtil.applyTheme(this)
    const taxonomy = store.getTaxonomy()
    const kind = this.data.kind
    this.setData({
      theme,
      cssVars: `--page-bg:${theme.pageBg};--primary:${theme.primary};`,
      kindLabel: KIND_LABEL[kind] || '标签',
      options: taxonomy[kind] || [],
    })
  },

  onKind(e) {
    const kind = e.currentTarget.dataset.kind
    this.setData({ kind }, () => this.refresh())
  },

  onAdd() {
    wx.showModal({
      title: `新增${this.data.kindLabel}`,
      editable: true,
      placeholderText: '输入名称',
      success: (res) => {
        if (!res.confirm) return
        const value = (res.content || '').trim()
        if (!value) {
          wx.showToast({ title: '名称不能为空', icon: 'none' })
          return
        }
        store.addTaxonomyOption(this.data.kind, value)
        this.refresh()
      },
    })
  },

  onRename(e) {
    const oldValue = e.currentTarget.dataset.value
    wx.showModal({
      title: `重命名「${oldValue}」`,
      editable: true,
      placeholderText: '新名称',
      content: oldValue,
      success: (res) => {
        if (!res.confirm) return
        const value = (res.content || '').trim()
        if (!value) {
          wx.showToast({ title: '名称不能为空', icon: 'none' })
          return
        }
        store.renameTaxonomyOption(this.data.kind, oldValue, value)
        this.refresh()
      },
    })
  },

  onRemove(e) {
    const value = e.currentTarget.dataset.value
    wx.showModal({
      title: '删除标签',
      content: `确定删除「${value}」？已有预算项的标签值不会自动改写。`,
      success: (res) => {
        if (!res.confirm) return
        store.removeTaxonomyOption(this.data.kind, value)
        this.refresh()
      },
    })
  },

  onReset() {
    wx.showModal({
      title: '恢复默认',
      content: `将「${this.data.kindLabel}」恢复为默认列表？`,
      success: (res) => {
        if (!res.confirm) return
        store.resetTaxonomyKind(this.data.kind)
        this.refresh()
      },
    })
  },
})
