const store = require('../../utils/store')
const themeUtil = require('../../utils/theme')
const sessionCloudUi = require('../../utils/sessionCloudUi')

const DEFAULT_THEME = {
  pageBg: '#E8F5E9',
  primary: '#2E7D32',
  primaryContainer: '#C8E6C9',
  tabBg: '#DCECDC',
  levelClass: '',
}

Page({
  data: {
    nickname: '我',
    avatarPath: '',
    theme: DEFAULT_THEME,
    cssVars: '--page-bg:#E8F5E9;--primary:#2E7D32;--primary-container:#C8E6C9;',
    jwt: '',
    phone: '',
    cloudUserId: '',
    lastInviteCode: '',
    inviteInput: '',
    isDevelop: false,
    currentUnbound: true,
    showCreateInvite: false,
  },

  _lastCloudUserId: undefined,

  onShow() {
    this.refresh()
  },

  refresh() {
    try {
      const { state, theme } = themeUtil.applyTheme(this)
      const safeTheme = theme && theme.primary ? theme : DEFAULT_THEME
      const prefs = (state && state.prefs) || {}
      const cloudUserId = prefs.cloudUserId || ''
      const sync = require('../../utils/sync')
      const gates = require('../../utils/ledgerRoleGates')
      const jwt = prefs.jwt || ''
      const cloudId = state.project && state.project.cloudLedgerId
      const role = gates.roleOf(cloudId, sync.getLastCloudSummaries())
      const patch = {
        theme: safeTheme,
        cssVars: '--page-bg:' + safeTheme.pageBg
          + ';--primary:' + safeTheme.primary
          + ';--primary-container:' + safeTheme.primaryContainer + ';',
        nickname: prefs.nickname || '我',
        avatarPath: prefs.avatarPath || '',
        jwt: jwt,
        phone: prefs.phone || '',
        cloudUserId: cloudUserId,
        currentUnbound: !cloudId,
        showCreateInvite: gates.showCreateInvite(role, !!jwt, !!cloudId),
        isDevelop: require('../../utils/api').isDevelop(),
      }
      if (this._lastCloudUserId !== undefined &&
          sessionCloudUi.shouldClearSessionUi(this._lastCloudUserId, cloudUserId)) {
        patch.lastInviteCode = ''
        patch.inviteInput = ''
      }
      this._lastCloudUserId = cloudUserId
      this.setData(patch)
    } catch (e) {
      console.error('profile refresh failed', e)
      this.setData({ theme: DEFAULT_THEME })
    }
  },

  openLogin() {
    wx.navigateTo({ url: '/pages/login/login' })
  },

  logout() {
    require('../../utils/sync').logout()
    this._lastCloudUserId = ''
    this.setData({ lastInviteCode: '', inviteInput: '' })
    this.refresh()
    wx.showToast({ title: '已退出登录', icon: 'success' })
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

  async onGetPhoneNumber(e) {
    const code = e.detail && e.detail.code
    if (!code) {
      wx.showToast({ title: '未授权手机号', icon: 'none' })
      return
    }
    wx.showLoading({ title: '绑定中', mask: true })
    try {
      await require('../../utils/sync').bindPhone(code)
      this.refresh()
      wx.hideLoading()
      wx.showToast({ title: '已绑定手机号', icon: 'success' })
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: (err && err.message) || '绑定失败', icon: 'none' })
    }
  },

  async uploadLedger() {
    if (this._cloudBusy) return
    this._cloudBusy = true
    wx.showLoading({ title: '上传中', mask: true })
    try {
      await require('../../utils/sync').importCurrent()
      this.refresh()
      wx.hideLoading()
      wx.showToast({ title: '已上传到云端', icon: 'success' })
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: (err && err.message) || '上传失败', icon: 'none' })
    } finally {
      this._cloudBusy = false
    }
  },

  async createInvite() {
    if (this._cloudBusy) return
    this._cloudBusy = true
    wx.showLoading({ title: '生成中', mask: true })
    try {
      const res = await require('../../utils/sync').createInvite()
      const code = res && res.code
      this.setData({ lastInviteCode: code || '' })
      wx.hideLoading()
      if (code) {
        this.copyInviteShare(code)
      } else {
        wx.showToast({ title: '生成失败', icon: 'none' })
      }
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: (err && err.message) || '生成失败', icon: 'none' })
    } finally {
      this._cloudBusy = false
    }
  },

  copyInviteShare(code) {
    const inviteShare = require('../../utils/inviteShare')
    const raw = typeof code === 'string' ? code : this.data.lastInviteCode
    if (!String(raw || '').trim()) {
      wx.showToast({ title: '暂无邀请码', icon: 'none' })
      return
    }
    wx.setClipboardData({
      data: inviteShare.message(raw),
      success() {
        wx.showToast({ title: '邀请信息已复制', icon: 'success' })
      },
    })
  },

  onInviteInput(e) {
    this.setData({ inviteInput: e.detail.value })
  },

  async joinInvite() {
    const inviteShare = require('../../utils/inviteShare')
    const code = inviteShare.extractCode(this.data.inviteInput || '')
    if (!code || this._cloudBusy) return
    this._cloudBusy = true
    wx.showLoading({ title: '查询邀请…', mask: true })
    const that = this
    try {
      const preview = await require('../../utils/sync').previewInvite(code)
      wx.hideLoading()
      this._cloudBusy = false
      const owner = (preview && preview.ownerNickname) || '账本拥有者'
      const ledger = (preview && preview.ledgerName) || '账本'
      wx.showModal({
        title: '加入账本',
        content: '是否加入「' + owner + '」的「' + ledger + '」账本？',
        confirmText: '确认',
        cancelText: '取消',
        success(res) {
          if (!res.confirm) return
          that.confirmJoinInvite(code)
        },
      })
    } catch (err) {
      wx.hideLoading()
      this._cloudBusy = false
      wx.showToast({ title: (err && err.message) || '邀请无效', icon: 'none' })
    }
  },

  async confirmJoinInvite(code) {
    if (this._cloudBusy) return
    this._cloudBusy = true
    wx.showLoading({ title: '加入中', mask: true })
    try {
      await require('../../utils/sync').joinInvite(code)
      this.setData({ inviteInput: '' })
      this.refresh()
      wx.hideLoading()
      wx.showToast({ title: '已加入账本', icon: 'success' })
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: (err && err.message) || '加入失败', icon: 'none' })
    } finally {
      this._cloudBusy = false
    }
  },
})
