const store = require('../../utils/store')
const themeUtil = require('../../utils/theme')
const aiKeys = require('../../utils/aiKeys')

Page({
  data: {
    version: '0.1.0',
    nickname: '我',
    avatarPath: '',
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
      const state = store.getState()
      this.setData({
        version: (app && app.globalData && app.globalData.version) || '0.1.0',
        nickname: (state.prefs && state.prefs.nickname) || '我',
        avatarPath: (state.prefs && state.prefs.avatarPath) || '',
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

  onNicknameInput(e) {
    this.setData({ nickname: e.detail.value })
  },

  onNicknameBlur(e) {
    const nickname = (e.detail.value || '').trim() || '我'
    const state = store.getState()
    const old = state.prefs.nickname
    const sync = require('../../utils/sync')
    Promise.resolve(sync.updateNickname(nickname))
      .then((saved) => {
        const names = (state.project.memberNames || []).map((n) => (n === old ? saved : n))
        if (names.indexOf(saved) < 0 && names.length) names[0] = saved
        const uniq = []
        names.forEach((n) => {
          if (uniq.indexOf(n) < 0) uniq.push(n)
        })
        store.setProject({ memberNames: uniq })
        this.refresh()
        wx.showToast({ title: '昵称已保存', icon: 'success' })
      })
      .catch((err) => {
        this.refresh()
        wx.showToast({
          title: (err && err.message) || '昵称保存失败',
          icon: 'none',
        })
      })
  },

  chooseAvatar() {
    const that = this
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      success(res) {
        const temp = res.tempFiles && res.tempFiles[0] && res.tempFiles[0].tempFilePath
        if (!temp) return
        const fs = wx.getFileSystemManager()
        const dir = wx.env.USER_DATA_PATH + '/avatars'
        try {
          fs.accessSync(dir)
        } catch (e) {
          try { fs.mkdirSync(dir, true) } catch (err) { /* ignore */ }
        }
        const dest = dir + '/avatar_' + Date.now() + '.jpg'
        try {
          fs.saveFileSync(temp, dest)
          store.setPrefs({ avatarPath: dest })
          that.refresh()
          wx.showToast({ title: '头像已更新', icon: 'success' })
        } catch (err) {
          // saveFileSync may fail if path already under USER_DATA; try copy
          try {
            fs.copyFileSync(temp, dest)
            store.setPrefs({ avatarPath: dest })
            that.refresh()
            wx.showToast({ title: '头像已更新', icon: 'success' })
          } catch (e2) {
            wx.showToast({ title: '头像保存失败', icon: 'none' })
          }
        }
      },
    })
  },

  clearAvatar() {
    store.setPrefs({ avatarPath: '' })
    this.refresh()
    wx.showToast({ title: '已清除头像', icon: 'success' })
  },
})
