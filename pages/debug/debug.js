const api = require('../../utils/api')
const themeUtil = require('../../utils/theme')

Page({
  data: {
    env: 'dev',
    jwt: '',
    serverBaseUrl: '',
    theme: { pageBg: '#E8F5E9', primary: '#2E7D32' },
    cssVars: '',
  },

  onShow() {
    this.refresh()
  },

  refresh() {
    const { state, theme } = themeUtil.applyTheme(this)
    this.setData({
      theme: theme || this.data.theme,
      cssVars: theme ? ('--page-bg:' + theme.pageBg + ';--primary:' + theme.primary + ';') : '',
      env: api.getEnv(),
      jwt: (state.prefs && state.prefs.jwt) || '',
      serverBaseUrl: api.getBaseUrl(),
    })
  },

  setDev() {
    api.setEnv('dev')
    this.refresh()
    wx.showToast({ title: '已切换到开发', icon: 'success' })
  },

  setProd() {
    api.setEnv('prod')
    this.refresh()
    wx.showToast({ title: '已切换到正式', icon: 'success' })
  },

  onServerUrlInput(e) {
    this.setData({ serverBaseUrl: e.detail.value })
  },

  saveServerUrl() {
    api.setBaseUrl(this.data.serverBaseUrl)
    this.setData({ serverBaseUrl: api.getBaseUrl() })
    wx.showToast({ title: '已保存', icon: 'success' })
  },
})
