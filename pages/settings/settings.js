const store = require('../../utils/store')
const themeUtil = require('../../utils/theme')

Page({
  data: {
    version: '0.1.0',
    nickname: '我',
    avatarPath: '',
    theme: { pageBg: '#E8F5E9', primary: '#2E7D32' },
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
      })
    } catch (e) {
      // keep defaults
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
    if (names.indexOf(nickname) < 0 && names.length) names[0] = nickname
    const uniq = []
    names.forEach((n) => {
      if (uniq.indexOf(n) < 0) uniq.push(n)
    })
    store.setProject({ memberNames: uniq })
    this.refresh()
    wx.showToast({ title: '昵称已保存', icon: 'success' })
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
