const store = require('../../utils/store')
const themeUtil = require('../../utils/theme')

const DEFAULT_THEME = {
  pageBg: '#E8F5E9',
  primary: '#2E7D32',
  primaryContainer: '#C8E6C9',
  tabBg: '#DCECDC',
  levelClass: '',
}

Page({
  data: {
    nickname: '',
    projectName: '',
    members: '',
    healthColorEnabled: true,
    mildOverMaxPercent: 15,
    theme: DEFAULT_THEME,
    cssVars: '--page-bg:#E8F5E9;--primary:#2E7D32;--primary-container:#C8E6C9;',
    loadError: '',
  },

  onShow() {
    this.refresh()
  },

  refresh() {
    try {
      const { state, theme } = themeUtil.applyTheme(this)
      const safeTheme = theme && theme.primary ? theme : DEFAULT_THEME
      this.setData({
        theme: safeTheme,
        cssVars: '--page-bg:' + safeTheme.pageBg
          + ';--primary:' + safeTheme.primary
          + ';--primary-container:' + safeTheme.primaryContainer + ';',
        nickname: (state.prefs && state.prefs.nickname) || '我',
        projectName: (state.project && state.project.name) || '我家装修',
        members: ((state.project && state.project.memberNames) || []).join('、'),
        healthColorEnabled: !!(state.prefs && state.prefs.healthColorEnabled),
        mildOverMaxPercent: (state.prefs && state.prefs.mildOverMaxPercent) || 15,
        loadError: '',
      })
    } catch (e) {
      console.error('mine refresh failed', e)
      this.setData({
        loadError: (e && e.message) || '页面加载失败',
        theme: DEFAULT_THEME,
      })
    }
  },

  onNicknameInput(e) {
    this.setData({ nickname: e.detail.value })
  },

  onNicknameBlur(e) {
    const nickname = (e.detail.value || '').trim() || '我'
    const state = store.getState()
    const old = state.prefs.nickname
    store.setPrefs({ nickname })
    const names = (state.project.memberNames || []).map((n) => (n === old ? nickname : n))
    if (names.indexOf(nickname) < 0) names[0] = nickname
    const uniq = []
    names.forEach((n) => {
      if (uniq.indexOf(n) < 0) uniq.push(n)
    })
    store.setProject({ memberNames: uniq })
    this.refresh()
  },

  onProjectInput(e) {
    this.setData({ projectName: e.detail.value })
  },

  onProjectBlur(e) {
    const name = (e.detail.value || '').trim() || '我家装修'
    store.setProject({ name })
    this.refresh()
  },

  clearField(e) {
    const field = e.currentTarget.dataset.field
    if (field === 'nickname') this.setData({ nickname: '' })
    if (field === 'projectName') this.setData({ projectName: '' })
  },

  onHealthSwitch(e) {
    store.setPrefs({ healthColorEnabled: !!e.detail.value })
    this.refresh()
  },

  onMildChanging(e) {
    const mildOverMaxPercent = Math.max(1, Math.min(100, Math.round(e.detail.value)))
    if (mildOverMaxPercent !== this.data.mildOverMaxPercent) {
      this.setData({ mildOverMaxPercent })
    }
  },

  onMildChange(e) {
    const mildOverMaxPercent = Math.max(1, Math.min(100, Math.round(e.detail.value)))
    store.setPrefs({ mildOverMaxPercent })
    this.refresh()
  },

  exportCsv() {
    const state = store.getState()
    const csv = store.exportCsv(state)
    const ledgerName = (state.project && state.project.name) || '装修账本'
    let savedName = ''
    try {
      const out = require('../../utils/csvExportFile').writeOverwriting(ledgerName, csv)
      savedName = out.name
    } catch (e) {
      // 写文件失败仍复制剪贴板
    }
    wx.setClipboardData({
      data: csv,
      success: function () {
        wx.showToast({
          title: savedName ? ('已导出 ' + savedName) : 'CSV 已复制',
          icon: 'success',
          duration: 2500,
        })
      },
    })
  },

  openTaxonomy() {
    wx.navigateTo({ url: '/pages/taxonomy/taxonomy' })
  },

  openImport() {
    wx.navigateTo({ url: '/pages/import/import' })
  },

  resetSample() {
    const that = this
    wx.showModal({
      title: '重置示例数据',
      content: '将覆盖当前本地账本为内置示例，确定吗？',
      success: function (res) {
        if (res.confirm) {
          store.resetSample()
          that.refresh()
          wx.showToast({ title: '已重置', icon: 'success' })
        }
      },
    })
  },
})
