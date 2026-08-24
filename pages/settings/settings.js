const store = require('../../utils/store')
const themeUtil = require('../../utils/theme')
const aiKeys = require('../../utils/aiKeys')

Page({
  data: {
    version: '0.1.0',
    theme: { pageBg: '#E8F5E9', primary: '#2E7D32' },
    deepSeekDraft: '',
    dashScopeDraft: '',
    deepSeekMasked: '',
    dashScopeMasked: '',
  },

  onShow() {
    this.refresh()
  },

  refresh() {
    try {
      themeUtil.applyTheme(this)
      const app = getApp()
      this.setData({
        version: (app && app.globalData && app.globalData.version) || '0.1.0',
        theme: this.data.theme || { pageBg: '#E8F5E9', primary: '#2E7D32' },
        deepSeekMasked: aiKeys.maskKey(aiKeys.getDeepSeekKey()),
        dashScopeMasked: aiKeys.maskKey(aiKeys.getDashScopeKey()),
      })
    } catch (e) {
      // keep defaults
    }
  },

  onDeepSeekInput(e) {
    this.setData({ deepSeekDraft: e.detail.value })
  },

  onDashScopeInput(e) {
    this.setData({ dashScopeDraft: e.detail.value })
  },

  saveDeepSeek() {
    aiKeys.setDeepSeekKey(this.data.deepSeekDraft)
    this.setData({ deepSeekDraft: '', deepSeekMasked: aiKeys.maskKey(aiKeys.getDeepSeekKey()) })
    wx.showToast({ title: '已保存 DeepSeek Key', icon: 'success' })
  },

  saveDashScope() {
    aiKeys.setDashScopeKey(this.data.dashScopeDraft)
    this.setData({ dashScopeDraft: '', dashScopeMasked: aiKeys.maskKey(aiKeys.getDashScopeKey()) })
    wx.showToast({ title: '已保存百炼 Key', icon: 'success' })
  },
})
