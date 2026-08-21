const themeUtil = require('../../utils/theme')

const DEFAULT_THEME = {
  pageBg: '#E8F5E9',
  primary: '#2E7D32',
  primaryContainer: '#C8E6C9',
}

function formatPhoneDisplay(digits) {
  const d = String(digits || '').replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 7) return d.slice(0, 3) + ' ' + d.slice(3)
  return d.slice(0, 3) + ' ' + d.slice(3, 7) + ' ' + d.slice(7)
}

Page({
  data: {
    tab: 'phone',
    phone: '',
    phoneDisplay: '',
    code: '',
    busy: false,
    theme: DEFAULT_THEME,
    cssVars: '--page-bg:#E8F5E9;--primary:#2E7D32;--primary-container:#C8E6C9;',
  },

  onShow() {
    try {
      const { theme } = themeUtil.applyTheme(this)
      const safeTheme = theme && theme.primary ? theme : DEFAULT_THEME
      this.setData({
        theme: safeTheme,
        cssVars: '--page-bg:' + safeTheme.pageBg
          + ';--primary:' + safeTheme.primary
          + ';--primary-container:' + safeTheme.primaryContainer + ';',
      })
    } catch (e) { /* ignore */ }
  },

  switchTab(e) {
    const tab = (e.currentTarget.dataset.tab) || 'phone'
    this.setData({ tab })
  },

  onPhoneInput(e) {
    const phone = String(e.detail.value || '').replace(/\D/g, '').slice(0, 11)
    this.setData({ phone: phone, phoneDisplay: formatPhoneDisplay(phone) })
  },

  onCodeInput(e) {
    const code = String(e.detail.value || '').replace(/\D/g, '').slice(0, 6)
    this.setData({ code })
  },

  async sendCode() {
    const phone = this.data.phone
    if (phone.length !== 11) {
      wx.showToast({ title: '请输入11位手机号', icon: 'none' })
      return
    }
    if (this.data.busy) return
    this.setData({ busy: true })
    wx.showLoading({ title: '发送中', mask: true })
    try {
      const res = await require('../../utils/sync').sendSmsCode(phone)
      const next = {}
      if (res && res.code) {
        next.code = String(res.code)
        next.message = '已填入验证码'
      }
      this.setData(Object.assign({ busy: false }, next))
      wx.hideLoading()
      wx.showToast({
        title: res && res.code ? '已填入验证码' : '验证码已发送',
        icon: 'success',
      })
    } catch (err) {
      this.setData({ busy: false })
      wx.hideLoading()
      wx.showToast({ title: (err && err.message) || '发送失败', icon: 'none' })
    }
  },

  async loginPhone() {
    const phone = this.data.phone
    const code = this.data.code
    if (phone.length !== 11 || !code) {
      wx.showToast({ title: '请填写手机号与验证码', icon: 'none' })
      return
    }
    if (this.data.busy) return
    this.setData({ busy: true })
    wx.showLoading({ title: '登录中', mask: true })
    try {
      await require('../../utils/sync').smsLogin(phone, code)
      wx.hideLoading()
      this.setData({ busy: false })
      wx.showToast({ title: '已登录', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 400)
    } catch (err) {
      this.setData({ busy: false })
      wx.hideLoading()
      wx.showToast({ title: (err && err.message) || '登录失败', icon: 'none' })
    }
  },

  wechatLogin() {
    if (this.data.busy) return
    const that = this
    wx.login({
      success: async (res) => {
        if (!res.code) {
          wx.showToast({ title: '微信登录失败', icon: 'none' })
          return
        }
        that.setData({ busy: true })
        wx.showLoading({ title: '登录中', mask: true })
        try {
          await require('../../utils/sync').wechatLogin(res.code)
          wx.hideLoading()
          that.setData({ busy: false })
          wx.showToast({ title: '已登录', icon: 'success' })
          setTimeout(() => wx.navigateBack(), 400)
        } catch (err) {
          wx.hideLoading()
          that.setData({ busy: false })
          wx.showToast({ title: (err && err.message) || '登录失败', icon: 'none' })
        }
      },
      fail() {
        wx.showToast({ title: '微信登录失败', icon: 'none' })
      },
    })
  },
})
