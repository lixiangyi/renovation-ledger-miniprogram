const store = require('../../utils/store')
const themeUtil = require('../../utils/theme')
const { KIND_LABEL, PRESET_ICONS, iconDisplay } = require('../../utils/taxonomy')

Page({
  data: {
    kind: 'stages',
    kindLabel: '阶段',
    options: [],
    theme: {},

    showEditor: false,
    editMode: 'add',
    editOldValue: '',
    editName: '',
    editIconKey: '',
    editIconPath: '',
    presetIcons: [],
  },

  onShow() {
    this.refresh()
  },

  refresh() {
    const { theme } = themeUtil.applyTheme(this)
    const taxonomy = store.getTaxonomy()
    const kind = this.data.kind
    const list = taxonomy[kind] || []
    const iconsMap = (taxonomy.icons && taxonomy.icons[kind]) || {}
    const options = list.map((value) => {
      const disp = iconDisplay(iconsMap[value])
      return { value, emoji: disp.emoji, path: disp.path }
    })
    this.setData({
      theme,
      cssVars: `--page-bg:${theme.pageBg};--primary:${theme.primary};`,
      kindLabel: KIND_LABEL[kind] || '标签',
      options,
    })
  },

  onKind(e) {
    const kind = e.currentTarget.dataset.kind
    this.setData({ kind }, () => this.refresh())
  },

  buildPresetIcons(selectedKey) {
    return PRESET_ICONS.map((p) => Object.assign({}, p, { selected: p.key === selectedKey }))
  },

  onAdd() {
    this.setData({
      showEditor: true,
      editMode: 'add',
      editOldValue: '',
      editName: '',
      editIconKey: '',
      editIconPath: '',
      presetIcons: this.buildPresetIcons(''),
    })
  },

  onEdit(e) {
    const oldValue = e.currentTarget.dataset.value
    const icon = store.getTaxonomyIcon(this.data.kind, oldValue) || {}
    this.setData({
      showEditor: true,
      editMode: 'edit',
      editOldValue: oldValue,
      editName: oldValue,
      editIconKey: icon.iconKey || '',
      editIconPath: icon.iconPath || '',
      presetIcons: this.buildPresetIcons(icon.iconKey || ''),
    })
  },

  onEditNameInput(e) {
    this.setData({ editName: e.detail.value })
  },

  onPickPresetIcon(e) {
    const key = e.currentTarget.dataset.key
    const nextKey = this.data.editIconKey === key ? '' : key
    this.setData({
      editIconKey: nextKey,
      editIconPath: '',
      presetIcons: this.buildPresetIcons(nextKey),
    })
  },

  onClearIcon() {
    this.setData({
      editIconKey: '',
      editIconPath: '',
      presetIcons: this.buildPresetIcons(''),
    })
  },

  onPickImage() {
    const that = this
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      success(res) {
        const temp = res.tempFiles && res.tempFiles[0] && res.tempFiles[0].tempFilePath
        if (!temp) return
        const fs = wx.getFileSystemManager()
        const dir = wx.env.USER_DATA_PATH + '/taxonomy_icons'
        try {
          fs.accessSync(dir)
        } catch (e) {
          try { fs.mkdirSync(dir, true) } catch (err) { /* ignore */ }
        }
        const dest = dir + '/icon_' + Date.now() + '.jpg'
        const finish = () => {
          that.setData({
            editIconKey: '',
            editIconPath: dest,
            presetIcons: that.buildPresetIcons(''),
          })
        }
        try {
          fs.saveFileSync(temp, dest)
          finish()
        } catch (err) {
          try {
            fs.copyFileSync(temp, dest)
            finish()
          } catch (e2) {
            wx.showToast({ title: '图标保存失败', icon: 'none' })
          }
        }
      },
    })
  },

  onCancelEditor() {
    this.setData({ showEditor: false })
  },

  noop() {},

  onConfirmEditor() {
    const name = (this.data.editName || '').trim()
    if (!name) {
      wx.showToast({ title: '名称不能为空', icon: 'none' })
      return
    }
    const icon = this.data.editIconPath
      ? { iconPath: this.data.editIconPath }
      : (this.data.editIconKey ? { iconKey: this.data.editIconKey } : null)
    if (this.data.editMode === 'add') {
      store.addTaxonomyOption(this.data.kind, name, icon)
    } else {
      store.renameTaxonomyOption(this.data.kind, this.data.editOldValue, name, icon)
    }
    this.setData({ showEditor: false })
    this.refresh()
  },

  onRemove(e) {
    const value = e.currentTarget.dataset.value
    wx.showModal({
      title: '删除标签',
      content: `确定删除「${value}」？已有预算项的标签值不会自动改名。`,
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
